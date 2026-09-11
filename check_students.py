#!/usr/bin/env python3
import urllib.request
import urllib.error
import json
import os
import sys
import http.cookiejar

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
BASE = os.environ.get("APP_BASE_URL", "http://localhost:3000")

# Kredensial diambil dari environment — JANGAN pernah hard-code di sini.
EMAIL = os.environ.get("ADMIN_EMAIL")
PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not EMAIL or not PASSWORD:
    print("Set ADMIN_EMAIL dan ADMIN_PASSWORD terlebih dahulu.", file=sys.stderr)
    raise SystemExit(1)

data = json.dumps({"email": EMAIL, "password": PASSWORD}).encode("utf-8")
req = urllib.request.Request(BASE + "/api/auth/login", data=data, headers={"Content-Type": "application/json"})
try:
    opener.open(req, timeout=10)
    print("LOGIN OK")
except urllib.error.HTTPError as e:
    print(f"LOGIN FAIL {e.code}: {e.read().decode()}")
    raise SystemExit

tok = next((c.value for c in cj if c.name == "session"), "")

def auth_get(path):
    req = urllib.request.Request(BASE + path, headers={"Authorization": "Bearer " + tok, "Cookie": ";".join(f"{c.name}={c.value}" for c in cj)})
    try:
        r = urllib.request.urlopen(req, timeout=10)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

print("=== /api/students?limit=5 (no filter) ===")
print(auth_get("/api/students?limit=5"))
print("=== /api/students?limit=5&status=active ===")
print(auth_get("/api/students?limit=5&status=active"))
print("=== /api/classes ===")
print(auth_get("/api/classes"))
