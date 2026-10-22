package handlers

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
)

// writeStub membuat skrip shell executable sebagai pengganti binary PDF
// (CI tidak memasang chromium/soffice — stub meniru perilaku CLI-nya).
func writeStub(t *testing.T, script string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "stub.sh")
	if err := os.WriteFile(path, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	return path
}

// sofficeStub: untuk tiap input .xlsx/.docx tulis .pdf di --outdir.
const sofficeStub = `#!/bin/sh
outdir=""
expect_out=0
for arg in "$@"; do
  if [ "$expect_out" = "1" ]; then outdir="$arg"; expect_out=0; continue; fi
  case "$arg" in
    --outdir) expect_out=1 ;;
    *.xlsx)
      base=$(basename "$arg" .xlsx)
      printf '%%PDF-1.4 stub-lo' > "$outdir/$base.pdf" ;;
    *.docx)
      base=$(basename "$arg" .docx)
      printf '%%PDF-1.4 stub-lo-docx' > "$outdir/$base.pdf" ;;
  esac
done
[ -n "$outdir" ] || exit 1
`

func TestSanitizePDFFilename(t *testing.T) {
	cases := map[string]string{
		"":                          "dokumen.pdf",
		"laporan bulan ini.pdf":     "laporan_bulan_ini.pdf",
		"../../etc/passwd":          "etc_passwd.pdf",
		"Daftar Hadir Kelas 6 2026": "Daftar_Hadir_Kelas_6_2026.pdf",
		"sudah-aman_1.pdf":          "sudah-aman_1.pdf",
	}
	for in, want := range cases {
		if got := sanitizePDFFilename(in); got != want {
			t.Errorf("sanitizePDFFilename(%q) = %q, want %q", in, got, want)
		}
	}
}

func multipartBody(t *testing.T, files []string, filename string) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	for i, f := range files {
		fw, err := w.CreateFormFile("files", f)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(fw, "PK-"+f); err != nil {
			t.Fatal(err)
		}
		_ = i
	}
	if filename != "" {
		if err := w.WriteField("filename", filename); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return &buf, w.FormDataContentType()
}

func TestConvertXlsxLibreOfficeValidation(t *testing.T) {
	e := echo.New()

	// Tanpa file → 400 (echo JSON → error nil; cek kode respons).
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	body, ctype := multipartBody(t, nil, "")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	_ = NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400 (body %s)", rec.Code, rec.Body.String())
	}

	// Binary hilang → 503.
	t.Setenv("SOFFICE_BIN", filepath.Join(t.TempDir(), "tidak-ada"))
	body, ctype = multipartBody(t, []string{"a.xlsx"}, "")
	req = httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec = httptest.NewRecorder()
	if err := NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec)); err == nil {
		t.Fatal("expected error saat binary tidak ada")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want 503", rec.Code)
	}
}

func TestConvertXlsxLibreOfficeSuccess(t *testing.T) {
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	e := echo.New()
	body, ctype := multipartBody(t, []string{"kelas-6.xlsx"}, "Daftar Hadir Oktober 2026.pdf")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.HasPrefix(rec.Body.String(), "%PDF-1.4") {
		t.Fatalf("body bukan PDF")
	}
	cd := rec.Header().Get(echo.HeaderContentDisposition)
	if !strings.Contains(cd, "Daftar_Hadir_Oktober_2026.pdf") {
		t.Fatalf("content-disposition = %q", cd)
	}
}

// TestExecWithTimeoutPipeYatimTidakMenggantung mereproduksi insiden nyata
// 2026-10-08: anak proses (soffice.bin yatim) memegang pipe stdout setelah
// induk keluar → CombinedOutput menunggu tanpa batas, handler menggantung
// 1 jam dan semaphore bocor (semua request berikut 503 "sedang sibuk").
// WaitDelay harus memaksa execWithTimeout kembali dalam hitungan detik.
func TestExecWithTimeoutPipeYatimTidakMenggantung(t *testing.T) {
	script := writeStub(t, `#!/bin/sh
sleep 60 &
exit 0
`)
	start := time.Now()
	_, err := execWithTimeout(context.Background(), script, nil, nil, 30*time.Second)
	elapsed := time.Since(start)
	if elapsed > 10*time.Second {
		t.Fatalf("menggantung %s — WaitDelay harus memaksa kembali ≤10s", elapsed)
	}
	if err == nil {
		t.Fatal("harus mengembalikan error saat pipe ditahan proses yatim")
	}
}

// TestExecWithTimeoutBunuhSeluruhGrup memastikan timeout membunuh SELURUH
// process group (Setpgid + kill -pgid): wrapper soffice mem-fork anak yang
// tidak ikut mati bila hanya induk dibunuh. Tanpa group-kill, anak tetap
// memegang pipe → kembali baru setelah WaitDelay (≈ timeout+5s).
func TestExecWithTimeoutBunuhSeluruhGrup(t *testing.T) {
	script := writeStub(t, `#!/bin/sh
trap '' TERM
sleep 60
`)
	start := time.Now()
	_, err := execWithTimeout(context.Background(), script, nil, nil, 2*time.Second)
	elapsed := time.Since(start)
	// Dengan group-kill: kembali ≈2s. Tanpa group-kill (hanya WaitDelay): ≈7s.
	if elapsed > 5*time.Second {
		t.Fatalf("kembali setelah %s — process group tidak dibunuh saat timeout", elapsed)
	}
	if err == nil {
		t.Fatal("harus error karena timeout")
	}
}

// TestLibreOfficeMissingBinary: binary hilang → 503 + saran export Excel
// (dialog cetak sudah dihapus sejak LO-only, 2026-10-08).
func TestLibreOfficeMissingBinary(t *testing.T) {
	t.Setenv("SOFFICE_BIN", filepath.Join(t.TempDir(), "tidak-ada"))
	e := echo.New()
	req := httptest.NewRequest(http.MethodPost, "/", nil)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().ConvertXlsxLibreOffice(e.NewContext(req, rec)); err == nil {
		t.Fatal("expected error saat binary tidak ada")
	}
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("code = %d, want 503", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "export Excel") {
		t.Fatalf("pesan harus mengarahkan ke export Excel, got: %s", rec.Body.String())
	}
}

// TestConvertOfficeLibreOfficeDocx: endpoint netral menerima .docx hasil fill
// template Word Buku Induk dan mengembalikan PDF (stub soffice menulis .pdf
// dari nama berkas .docx).
func TestConvertOfficeLibreOfficeDocx(t *testing.T) {
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	e := echo.New()
	body, ctype := multipartBody(t, []string{"buku-induk-ahmad.docx"}, "buku-induk-ahmad.pdf")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().ConvertOfficeLibreOffice(e.NewContext(req, rec)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d body=%s", rec.Code, rec.Body.String())
	}
	if !strings.HasPrefix(rec.Body.String(), "%PDF-1.4") {
		t.Fatalf("body bukan PDF")
	}
	cd := rec.Header().Get(echo.HeaderContentDisposition)
	if !strings.Contains(cd, "buku-induk-ahmad.pdf") {
		t.Fatalf("content-disposition = %q", cd)
	}
}

// TestConvertOfficeLibreOfficeMultiDocx: beberapa siswa → satu PDF gabungan
// (qpdf); tanpa qpdf terpasang tetap mengirim PDF pertama (fallback).
func TestConvertOfficeLibreOfficeMultiDocx(t *testing.T) {
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	t.Setenv("QPDF_BIN", filepath.Join(t.TempDir(), "qpdf-tidak-ada"))
	e := echo.New()
	body, ctype := multipartBody(t, []string{"a.docx", "b.docx"}, "gabungan.pdf")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().ConvertOfficeLibreOffice(e.NewContext(req, rec)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d body=%s", rec.Code, rec.Body.String())
	}
}

// TestConvertOfficeLibreOfficeTolakEkstensiLain: hanya .xlsx/.docx yang
// diterima — berkas lain ditolak 400 (bukan diteruskan ke soffice).
func TestConvertOfficeLibreOfficeTolakEkstensiLain(t *testing.T) {
	t.Setenv("SOFFICE_BIN", writeStub(t, sofficeStub))
	e := echo.New()
	body, ctype := multipartBody(t, []string{"jahat.exe"}, "")
	req := httptest.NewRequest(http.MethodPost, "/", body)
	req.Header.Set(echo.HeaderContentType, ctype)
	rec := httptest.NewRecorder()
	if err := NewPDFHandler().ConvertOfficeLibreOffice(e.NewContext(req, rec)); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("code = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "xlsx") || !strings.Contains(rec.Body.String(), "docx") {
		t.Fatalf("pesan harus menyebut .xlsx/.docx, got: %s", rec.Body.String())
	}
}
