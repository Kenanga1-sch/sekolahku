package util

import (
	"strings"

	"github.com/microcosm-cc/bluemonday"
)

// richTextPolicy membersihkan HTML dari konten rich-text (pengumuman, berita,
// body surat).
//
// Membersihkan saat disimpan — bukan hanya saat dirender — membuat isi
// database sudah aman bagi setiap pemakai berikutnya (halaman publik,
// generator PDF, aplikasi mobile, dsb).
//
// CATATAN bluemonday: AllowAttrs().OnElements() bersifat MENGGANTIKAN, bukan
// menambahkan. Bila satu elemen disebut di dua aturan berbeda, aturan
// terakhir menang dan atribut dari aturan sebelumnya hilang. Karena itu tiap
// elemen hanya boleh muncul di SATU OnElements di bawah ini. Efek
// AllowStyling() juga hilang begitu ada OnElements, maka "style" didaftarkan
// eksplisit di setiap grup.
var richTextPolicy = func() *bluemonday.Policy {
	p := bluemonday.NewPolicy()

	p.AllowElements(
		"p", "br", "strong", "em", "u", "s", "i", "b", "strike", "sub", "sup", "mark", "small",
		"blockquote", "h1", "h2", "h3", "h4", "h5", "h6",
		"ul", "ol", "li",
		"a", "img",
		"table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "caption",
		"pre", "code", "hr", "div", "span", "font", "figure", "figcaption",
	)

	// Grup teks.
	p.AllowAttrs("class", "id", "title", "style").OnElements(
		"p", "div", "span", "blockquote",
		"h1", "h2", "h3", "h4", "h5", "h6",
		"ul", "ol", "li", "pre", "code",
		"strong", "em", "u", "s", "i", "b", "strike", "sub", "sup", "mark", "small",
		"figure", "figcaption", "hr", "br",
	)

	// Tautan. Skema URL dibatasi di AllowURLSchemes.
	p.AllowAttrs("href", "target", "rel", "class", "id", "title", "style").OnElements("a")

	// Gambar.
	p.AllowAttrs("src", "alt", "title", "width", "height", "class", "id", "style").OnElements("img")

	// Tabel — termasuk atribut layout yang dipakai nomor surat & tembusan.
	p.AllowAttrs("colspan", "rowspan", "align", "valign", "width", "height", "class", "id", "title", "style").OnElements(
		"table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col", "caption",
	)

	// Font bawaan editor lama.
	p.AllowAttrs("color", "size", "face", "class", "style").OnElements("font")

	// Hanya skema URL yang aman; javascript: tidak terdaftar.
	p.AllowURLSchemes("http", "https", "mailto", "tel")
	// Gambar inline di editor disimpan sebagai data:image base64 (lihat
	// readAsDataURL di components/letters/editor-sidebar.tsx), jadi src wajib
	// menerima URI relatif DAN data: khusus gambar. data: untuk href tetap
	// ditolak.
	p.AllowRelativeURLs(true)
	p.AllowDataURIImages()
	p.RequireNoFollowOnLinks(true)

	// Data attribute sengaja TIDAK diizinkan, sama seperti ALLOW_DATA_ATTR:
	// false pada sanitizeHTML() di frontend.

	return p
}()

// plainTextPolicy menghapus SEMUA tag, menyisakan teks.
var plainTextPolicy = bluemonday.StrictPolicy()

// SanitizeRichText membersihkan HTML dari konten rich-text.
// Mengembalikan string yang aman untuk disimpan dan dirender.
func SanitizeRichText(dirty string) string {
	if strings.TrimSpace(dirty) == "" {
		return ""
	}
	return richTextPolicy.Sanitize(dirty)
}

// SanitizePlainText menghapus seluruh tag HTML.
func SanitizePlainText(dirty string) string {
	return plainTextPolicy.Sanitize(dirty)
}

// SanitizeRichTextPtr membersihkan field opsional (*string). Mengembalikan
// pointer baru yang sudah bersih, atau nil bila asalnya nil — supaya NULL di
// database tidak berubah menjadi string kosong.
func SanitizeRichTextPtr(dirty *string) *string {
	if dirty == nil {
		return nil
	}
	clean := SanitizeRichText(*dirty)
	return &clean
}

// SanitizePlainTextPtr membersihkan field opsional (*string) menjadi teks
// polos, mempertahankan nil bila asalnya nil.
func SanitizePlainTextPtr(dirty *string) *string {
	if dirty == nil {
		return nil
	}
	clean := SanitizePlainText(*dirty)
	return &clean
}
