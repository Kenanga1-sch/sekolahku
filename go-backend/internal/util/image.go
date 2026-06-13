package util

import (
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
)

type ImageResizeConfig struct {
	MaxWidth  int
	MaxHeight int
	Quality   int // JPEG quality (1-100)
}

var DefaultThumbnailConfig = ImageResizeConfig{
	MaxWidth:  400,
	MaxHeight: 300,
	Quality:   80,
}

var DefaultResizeConfig = ImageResizeConfig{
	MaxWidth:  1600,
	MaxHeight: 1200,
	Quality:   85,
}

func ResizeImage(srcPath string, cfg ImageResizeConfig) error {
	src, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("open source: %w", err)
	}
	defer src.Close()

	img, format, err := image.Decode(src)
	if err != nil {
		return fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()

	if w <= cfg.MaxWidth && h <= cfg.MaxHeight {
		return nil
	}

	newW, newH := w, h
	if w > cfg.MaxWidth {
		newW = cfg.MaxWidth
		newH = h * cfg.MaxWidth / w
	}
	if newH > cfg.MaxHeight {
		newH = cfg.MaxHeight
		newW = w * cfg.MaxHeight / h
	}

	dstImg := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.ApproxBiLinear.Scale(dstImg, dstImg.Bounds(), img, bounds, draw.Over, nil)

	src.Close()

	dst, err := os.Create(srcPath)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if format == "png" {
		return png.Encode(dst, dstImg)
	}
	return jpeg.Encode(dst, dstImg, &jpeg.Options{Quality: cfg.Quality})
}

func GenerateThumbnail(srcPath, dstDir string, cfg ImageResizeConfig) (string, error) {
	src, err := os.Open(srcPath)
	if err != nil {
		return "", fmt.Errorf("open source: %w", err)
	}
	defer src.Close()

	img, format, err := image.Decode(src)
	if err != nil {
		return "", fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()

	if w <= cfg.MaxWidth && h <= cfg.MaxHeight {
		return "", nil // no resize needed
	}

	// Calculate new dimensions maintaining aspect ratio
	newW, newH := w, h
	if w > cfg.MaxWidth {
		newW = cfg.MaxWidth
		newH = h * cfg.MaxWidth / w
	}
	if newH > cfg.MaxHeight {
		newH = cfg.MaxHeight
		newW = w * cfg.MaxHeight / h
	}

	dstImg := image.NewRGBA(image.Rect(0, 0, newW, newH))
	draw.ApproxBiLinear.Scale(dstImg, dstImg.Bounds(), img, bounds, draw.Over, nil)

	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return "", fmt.Errorf("create thumbnail dir: %w", err)
	}

	ext := strings.ToLower(filepath.Ext(srcPath))
	base := strings.TrimSuffix(filepath.Base(srcPath), ext)
	thumbExt := ".jpg"
	thumbPath := filepath.Join(dstDir, base+"_thumb"+thumbExt)

	dst, err := os.Create(thumbPath)
	if err != nil {
		return "", fmt.Errorf("create thumbnail file: %w", err)
	}
	defer dst.Close()

	if format == "png" && ext == ".png" {
		return thumbPath, png.Encode(dst, dstImg)
	}
	return thumbPath, jpeg.Encode(dst, dstImg, &jpeg.Options{Quality: cfg.Quality})
}
