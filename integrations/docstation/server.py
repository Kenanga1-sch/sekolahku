import os
import sys
import asyncio
import httpx
import struct
import io
from pathlib import Path
from typing import Optional, AsyncIterator
from fastapi import FastAPI, HTTPException, Request, Depends, status
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

APP_PASSWORD = os.getenv("DOCSTATION_PASSWORD", "20216609")
SESSION_SECONDS = 86400 * 30
MAX_PRINT_BYTES = 50 * 1024 * 1024

app = FastAPI(title="DocStation Server v1.1.02")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

SESSIONS_FILE = BASE_DIR / "sessions.json"

def load_sessions():
    if SESSIONS_FILE.exists():
        try:
            import json
            with open(SESSIONS_FILE, "r") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_sessions():
    try:
        import json
        with open(SESSIONS_FILE, "w") as f:
            json.dump(list(sessions), f)
    except Exception:
        pass

sessions = load_sessions()

PRINTERS = [
    {"ip": "192.168.10.131", "name": "Canon G7000 Series (LAN 1)"},
    {"ip": "192.168.10.140", "name": "Epson L6270 Series (Wi-Fi)"}
]


def require_session(request: Request):
    if not APP_PASSWORD:
        return
    token = request.cookies.get("docstation_session")
    if not token or token not in sessions:
        raise HTTPException(status_code=401, detail="Sesi berakhir, silakan masuk kembali")


def get_target_printer_ip(request: Request) -> str:
    ip = request.headers.get("x-printer-ip", "").strip()
    if not ip or ip not in [p["ip"] for p in PRINTERS]:
        return "192.168.10.131"
    return ip


async def clear_stuck_escl_jobs(printer_ip: str):
    proto = "https" if printer_ip == "192.168.10.140" else "http"
    client = httpx.AsyncClient(verify=False, timeout=httpx.Timeout(3.0))
    try:
        url = f"{proto}://{printer_ip}/eSCL/ScanJobs"
        res = await client.get(url)
        if res.status_code == 200 and "<scan:ScanJob" in res.text:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(res.text)
            for elem in root.iter():
                if elem.tag.endswith("JobUri") or elem.tag.endswith("JobUrl"):
                    job_url = elem.text
                    if job_url:
                        if not job_url.startswith("http"):
                            job_url = f"{proto}://{printer_ip}{job_url}"
                        await client.delete(job_url)
    except Exception as e:
        print(f"[DocStation] Clear eSCL job warning ({printer_ip}): {e}")
    finally:
        await client.aclose()


def make_ipp_print_job(printer_uri: str, job_name: str, doc_format: str, payload_bytes: bytes) -> bytes:
    req = bytearray([
        0x01, 0x01,  # IPP 1.1
        0x00, 0x02,  # Print-Job
        0x00, 0x00, 0x00, 0x01,  # Request ID 1
        0x01  # Operation attributes tag
    ])

    def add_attr(tag: int, name: str, value: str):
        nb = name.encode('utf-8')
        vb = value.encode('utf-8')
        req.append(tag)
        req.extend([(len(nb) >> 8) & 0xff, len(nb) & 0xff])
        req.extend(nb)
        req.extend([(len(vb) >> 8) & 0xff, len(vb) & 0xff])
        req.extend(vb)

    add_attr(0x47, 'attributes-charset', 'utf-8')
    add_attr(0x48, 'attributes-natural-language', 'en-us')
    add_attr(0x45, 'printer-uri', printer_uri)
    add_attr(0x42, 'job-name', job_name)
    add_attr(0x49, 'document-format', doc_format)
    req.append(0x03)  # end-of-attributes-tag
    req.extend(payload_bytes)
    return bytes(req)


@app.get("/")
async def root():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/session")
async def get_session(request: Request):
    token = request.cookies.get("docstation_session")
    authenticated = bool(token and token in sessions)
    return {
        "authenticated": authenticated,
        "authentication_required": bool(APP_PASSWORD)
    }


@app.post("/api/login")
async def login(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    password = body.get("password", "")
    if APP_PASSWORD and password != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="Kata sandi salah")
    
    token = os.urandom(16).hex()
    sessions.add(token)
    save_sessions()
    response = JSONResponse({"status": "success", "token": token})
    response.set_cookie(
        key="docstation_session",
        value=token,
        httponly=True,
        samesite="strict",
        max_age=SESSION_SECONDS
    )
    return response


@app.get("/api/status")
async def get_status(request: Request):
    status_results = []
    for p in PRINTERS:
        ip = p["ip"]
        is_online = False
        for port in [631, 9100, 80]:
            try:
                _, writer = await asyncio.wait_for(asyncio.open_connection(ip, port), timeout=1.2)
                writer.close()
                await writer.wait_closed()
                is_online = True
                break
            except Exception:
                pass
        status_results.append({
            "ip": ip,
            "name": p["name"],
            "online": is_online
        })
    return {
        "status": "ok",
        "printer_ip": PRINTERS[0]["ip"],
        "printers": status_results
    }


@app.api_route("/api/escl/{path:path}", methods=["GET", "POST", "DELETE", "OPTIONS"])
async def escl_proxy(request: Request, path: str):
    require_session(request)
    printer_ip = get_target_printer_ip(request)

    if path == "ScanJobs" and request.method == "POST" and printer_ip == "192.168.10.140":
        await clear_stuck_escl_jobs(printer_ip)
        await asyncio.sleep(0.3)

    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("cookie", None)
    body = await request.body()

    protocols = ["https", "http"] if printer_ip == "192.168.10.140" else ["http", "https"]
    last_exception = None
    upstream = None
    used_client = None

    for proto in protocols:
        url = f"{proto}://{printer_ip}/eSCL/{path}"
        client = httpx.AsyncClient(verify=False, timeout=httpx.Timeout(15.0, read=60.0))
        try:
            upstream_request = client.build_request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                params=request.query_params,
            )
            res = await client.send(upstream_request, stream=True)

            if res.status_code == 503 and path == "ScanJobs" and request.method == "POST":
                await res.aclose()
                await client.aclose()
                await clear_stuck_escl_jobs(printer_ip)
                await asyncio.sleep(0.6)

                client = httpx.AsyncClient(verify=False, timeout=httpx.Timeout(15.0, read=60.0))
                upstream_request = client.build_request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body,
                    params=request.query_params,
                )
                res = await client.send(upstream_request, stream=True)

            if res.status_code != 404 or proto == protocols[-1]:
                upstream = res
                used_client = client
                break
            else:
                await res.aclose()
                await client.aclose()
        except Exception as err:
            await client.aclose()
            last_exception = err

    if not upstream or not used_client:
        raise HTTPException(status_code=502, detail=f"Printer ({printer_ip}) tidak merespon eSCL: {last_exception}")

    excluded_headers = {"content-encoding", "content-length", "transfer-encoding", "connection"}
    response_headers = {k: v for k, v in upstream.headers.items() if k.lower() not in excluded_headers}

    location = upstream.headers.get("location")
    if location:
        rewritten = f"/api/escl/ScanJobs/{location.split('/')[-1]}" if "ScanJobs" in location else location
        response_headers["location"] = rewritten
        response_headers["x-docstation-job"] = rewritten

    async def stream_response() -> AsyncIterator[bytes]:
        try:
            async for chunk in upstream.aiter_bytes():
                yield chunk
        finally:
            await upstream.aclose()
            await used_client.aclose()

    return StreamingResponse(
        stream_response(),
        status_code=upstream.status_code,
        headers=response_headers,
        media_type=upstream.headers.get("content-type"),
    )


async def send_ipp_bytes_to_printer(printer_ip: str, payload_bytes: bytes, doc_format: str = "image/jpeg"):
    proto = "https" if printer_ip == "192.168.10.140" else "http"
    ipp_uri = f"ipp://{printer_ip}/ipp/print"
    url = f"{proto}://{printer_ip}:631/ipp/print"

    ipp_body = make_ipp_print_job(ipp_uri, "DocStation_Job", doc_format, payload_bytes)
    headers = {"Content-Type": "application/ipp", "Content-Length": str(len(ipp_body))}

    client = httpx.AsyncClient(verify=False, timeout=httpx.Timeout(15.0, read=45.0))
    try:
        res = await client.post(url, data=ipp_body, headers=headers)
        if res.status_code == 200 and len(res.content) >= 4:
            status_code = (res.content[2] << 8) + res.content[3]
            if status_code in (0x0000, 0x0001, 0x0002):
                return True
    except Exception as err:
        print(f"[DocStation] IPP print attempt failed for {printer_ip}: {err}")
    finally:
        await client.aclose()

    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(printer_ip, 9100), timeout=5.0)
        writer.write(payload_bytes)
        await writer.drain()
        writer.close()
        await writer.wait_closed()
        return True
    except Exception as err:
        raise Exception(f"Gagal mengirim data ke port 9100 printer {printer_ip}: {err}")


@app.post("/api/print")
@app.post("/api/print/ipp")
async def print_spooler(request: Request):
    require_session(request)
    printer_ip = get_target_printer_ip(request)

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Data print kosong")

    is_jpeg = body.startswith(b'\xff\xd8')
    is_png = body.startswith(b'\x89PNG')
    is_pdf = body.startswith(b'%PDF')

    try:
        if is_jpeg or is_png:
            format_name = "image/jpeg" if is_jpeg else "image/png"
            await send_ipp_bytes_to_printer(printer_ip, body, format_name)
        elif is_pdf:
            try:
                await send_ipp_bytes_to_printer(printer_ip, body, "application/pdf")
            except Exception:
                await send_ipp_bytes_to_printer(printer_ip, body, "image/jpeg")
        else:
            _, writer = await asyncio.wait_for(asyncio.open_connection(printer_ip, 9100), timeout=5.0)
            writer.write(body)
            await writer.drain()
            writer.close()
            await writer.wait_closed()

        return JSONResponse({"status": "success", "message": f"Pekerjaan cetak berhasil dikirim ke printer ({printer_ip})"})
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal mengirim cetakan ke printer ({printer_ip}): {e}")


@app.get("/{file_name:path}")
async def serve_static_root(file_name: str):
    file_path = STATIC_DIR / file_name
    if file_path.is_file():
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File tidak ditemukan")
