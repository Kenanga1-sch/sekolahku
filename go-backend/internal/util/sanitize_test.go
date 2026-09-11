package util

import (
	"strings"
	"testing"
)

func TestSanitizeRichTextRemovesScript(t *testing.T) {
	got := SanitizeRichText("<p>Halo</p><script>alert(1)</script>")
	if strings.Contains(strings.ToLower(got), "<script") {
		t.Errorf("tag script harus dibuang, got: %s", got)
	}
	if strings.Contains(got, "alert(1)") {
		t.Errorf("isi script harus dibuang, got: %s", got)
	}
	if !strings.Contains(got, "Halo") {
		t.Errorf("teks sah harus dipertahankan, got: %s", got)
	}
}

func TestSanitizeRichTextRemovesEventHandlers(t *testing.T) {
	cases := []string{
		`<img src=x onerror="alert(1)">`,
		`<p onload="alert(1)">hi</p>`,
		`<div onmouseover="alert(1)">hi</div>`,
		`<a href="#" onclick="alert(1)">hi</a>`,
	}
	for _, in := range cases {
		got := SanitizeRichText(in)
		if strings.Contains(strings.ToLower(got), "onerror") ||
			strings.Contains(strings.ToLower(got), "onload") ||
			strings.Contains(strings.ToLower(got), "onmouseover") ||
			strings.Contains(strings.ToLower(got), "onclick") {
			t.Errorf("event handler harus dibuang pada %q, got: %s", in, got)
		}
	}
}

func TestSanitizeRichTextBlocksJavascriptURL(t *testing.T) {
	got := SanitizeRichText(`<a href="javascript:alert(1)">klik</a>`)
	if strings.Contains(strings.ToLower(got), "javascript:") {
		t.Errorf("URL javascript: harus dibuang, got: %s", got)
	}
	if !strings.Contains(got, "klik") {
		t.Errorf("teks tautan harus dipertahankan, got: %s", got)
	}
}

func TestSanitizeRichTextBlocksDataURL(t *testing.T) {
	got := SanitizeRichText(`<a href="data:text/html,<script>alert(1)</script>">x</a>`)
	if strings.Contains(strings.ToLower(got), "data:text/html") {
		t.Errorf("URL data: harus dibuang, got: %s", got)
	}
}

func TestSanitizeRichTextStripsDataAttributes(t *testing.T) {
	// Selaras dengan ALLOW_DATA_ATTR:false di frontend.
	got := SanitizeRichText(`<div data-foo="bar" data-xss="1">isi</div>`)
	if strings.Contains(strings.ToLower(got), "data-") {
		t.Errorf("data attribute harus dibuang, got: %s", got)
	}
	if !strings.Contains(got, "isi") {
		t.Errorf("konten harus dipertahankan, got: %s", got)
	}
}

func TestSanitizeRichTextKeepsEditorOutput(t *testing.T) {
	// Konten realistis dari Tiptap: tabel bergaya, perataan, warna, gambar.
	in := `<div class="tiptap"><table style="width:100%"><tbody><tr><td colspan="2">a</td></tr></tbody></table>` +
		`<p style="text-align:center"><strong>Bold</strong> <span style="color:#065F46">hijau</span></p>` +
		`<img src="/uploads/foto.jpg" alt=" FOTO "></div>`

	got := SanitizeRichText(in)

	for _, want := range []string{"<table", "<td", "colspan", "text-align:center", "Bold", "hijau", "/uploads/foto.jpg"} {
		if !strings.Contains(got, want) {
			t.Errorf("konten editor sah hilang: %q tidak ada dalam hasil:\n%s", want, got)
		}
	}
}

func TestSanitizeRichTextHandlesEmpty(t *testing.T) {
	for _, in := range []string{"", "   ", "\n\t"} {
		if got := SanitizeRichText(in); got != "" {
			t.Errorf("input kosong %q harus menghasilkan string kosong, got %q", in, got)
		}
	}
}

func TestSanitizeRichTextIsIdempotent(t *testing.T) {
	in := `<p style="text-align:center">Halo <strong>dunia</strong></p>`
	once := SanitizeRichText(in)
	twice := SanitizeRichText(once)
	if once != twice {
		t.Errorf("sanitasi tidak idempoten:\nsekali: %s\nkedua : %s", once, twice)
	}
}

func TestSanitizePlainTextStripsAllTags(t *testing.T) {
	got := SanitizePlainText("<b>halo</b><script>alert(1)</script>")
	if strings.Contains(got, "<") {
		t.Errorf("semua tag harus hilang, got: %s", got)
	}
	if !strings.Contains(got, "halo") {
		t.Errorf("teks harus tersisa, got: %s", got)
	}
}

// TestSanitizeRichTextPreservesSafeLinks memastikan tautan https tetap utuh
// dan dapat dipakai.
func TestSanitizeRichTextPreservesSafeLinks(t *testing.T) {
	got := SanitizeRichText(`<a href="https://sdn1kenanga.sch.id/x">situs</a>`)
	if !strings.Contains(got, `href="https://sdn1kenanga.sch.id/x"`) {
		t.Errorf("tautan https harus dipertahankan, got: %s", got)
	}
}

// TestSanitizeRichTextPreservesBase64Images memastikan gambar yang disisipkan
// editor (readAsDataURL → data:image base64) TIDAK dibuang. Kalau policy
// terlalu ketat, fitur lampiran gambar di surat jadi rusak diam-diam.
func TestSanitizeRichTextPreservesBase64Images(t *testing.T) {
	in := `<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" alt="x"></p>`
	got := SanitizeRichText(in)
	if !strings.Contains(got, "data:image/png;base64,") {
		t.Errorf("gambar base64 harus dipertahankan, got: %s", got)
	}
}

// TestSanitizeRichTextRejectsDataURLInHref memastikan kelonggaran data: hanya
// untuk gambar — bukan untuk href.
func TestSanitizeRichTextRejectsDataURLInHref(t *testing.T) {
	got := SanitizeRichText(`<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>`)
	if strings.Contains(strings.ToLower(got), "data:text/html") {
		t.Errorf("data:text/html di href harus dibuang, got: %s", got)
	}
}

// TestSanitizeRichTextPreservesRelativeImageSrc memastikan src relatif
// (hasil unggah ke /uploads) tetap ada.
func TestSanitizeRichTextPreservesRelativeImageSrc(t *testing.T) {
	got := SanitizeRichText(`<img src="/uploads/gallery/foto.jpg">`)
	if !strings.Contains(got, "/uploads/gallery/foto.jpg") {
		t.Errorf("src relatif harus dipertahankan, got: %s", got)
	}
}

// TestSanitizeRichTextRejectsIframeObjectEmbed memastikan elemen penanam
// konten asing tidak lolos.
func TestSanitizeRichTextRejectsIframeObjectEmbed(t *testing.T) {
	for _, in := range []string{
		`<iframe src="https://evil.tld"></iframe>`,
		`<object data="x.swf"></object>`,
		`<embed src="x.swf">`,
		`<form action="/api/users"><input name="role"></form>`,
		`<style>body{display:none}</style>`,
	} {
		got := SanitizeRichText(in)
		low := strings.ToLower(got)
		for _, bad := range []string{"<iframe", "<object", "<embed", "<form", "<style"} {
			if strings.Contains(low, bad) {
				t.Errorf("%s harus dibuang dari %q, got: %s", bad, in, got)
			}
		}
	}
}
