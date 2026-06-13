package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

type CacheConfig struct {
	TTL          time.Duration
	Skipper      func(c echo.Context) bool
	CacheControl string
}

var DefaultCacheConfig = CacheConfig{
	TTL:          5 * time.Minute,
	CacheControl: "public, max-age=300",
	Skipper: func(c echo.Context) bool {
		return c.Request().Method != http.MethodGet || strings.HasPrefix(c.Request().URL.Path, "/api/admin/")
	},
}

func CacheMiddleware(config CacheConfig) echo.MiddlewareFunc {
	if config.TTL == 0 {
		config.TTL = DefaultCacheConfig.TTL
	}
	if config.CacheControl == "" {
		config.CacheControl = DefaultCacheConfig.CacheControl
	}
	if config.Skipper == nil {
		config.Skipper = DefaultCacheConfig.Skipper
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if config.Skipper(c) {
				c.Response().Header().Set(echo.HeaderCacheControl, "no-cache, no-store, must-revalidate")
				return next(c)
			}

			key := c.Request().URL.String()

			if data, ok := CacheGet(key); ok {
				c.Response().Header().Set(echo.HeaderCacheControl, config.CacheControl)
				c.Response().Header().Set("X-Cache", "HIT")
				return c.JSONBlob(http.StatusOK, data)
			}

			w := c.Response().Writer
			buf := new(bytes.Buffer)
			mw := io.MultiWriter(w, buf)
			c.Response().Writer = &responseWriter{Writer: mw, ResponseWriter: w}

			if err := next(c); err != nil {
				return err
			}

			if c.Response().Status == http.StatusOK {
				CacheSet(key, buf.Bytes(), config.TTL)
			}

			return nil
		}
	}
}

type responseWriter struct {
	io.Writer
	http.ResponseWriter
}

func (w *responseWriter) Write(data []byte) (int, error) {
	return w.Writer.Write(data)
}
