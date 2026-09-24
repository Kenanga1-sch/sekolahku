package cloudstorage

import (
	"bytes"
	"image"
	"image/jpeg"
	"mime"
	"path/filepath"
	"strings"

	// Registrasi codec gambar (diperlukan image.Decode).
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"

	"golang.org/x/image/draw"
)

// fitImage mengecilkan gambar agar muat dalam maxW x maxH mempertahankan rasio.
func fitImage(src image.Image, maxW, maxH int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w <= maxW && h <= maxH {
		return src
	}
	scaleW := float64(maxW) / float64(w)
	scaleH := float64(maxH) / float64(h)
	scale := scaleW
	if scaleH < scale {
		scale = scaleH
	}
	nw := int(float64(w) * scale)
	nh := int(float64(h) * scale)
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, b, draw.Over, nil)
	return dst
}

// encodeJPEG meng-encode gambar ke JPEG dengan kualitas tertentu.
func encodeJPEG(buf *bytes.Buffer, img image.Image, quality int) error {
	return jpeg.Encode(buf, img, &jpeg.Options{Quality: quality})
}

// detectMime menentukan MIME type dari nama file, dengan fallback ke header
// klien bila ekstensi tak dikenali.
func detectMime(name, clientType string) string {
	if ext := filepath.Ext(name); ext != "" {
		if mt := mime.TypeByExtension(ext); mt != "" {
			if i := strings.Index(mt, ";"); i >= 0 {
				mt = mt[:i]
			}
			return mt
		}
	}
	if clientType != "" {
		return clientType
	}
	return "application/octet-stream"
}
