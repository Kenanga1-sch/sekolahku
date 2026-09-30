package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
)

func csrfTestContext(method, path string, cookie, header string) (echo.Context, *httptest.ResponseRecorder) {
	e := echo.New()
	req := httptest.NewRequest(method, path, nil)
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: csrfCookieName, Value: cookie})
	}
	if header != "" {
		req.Header.Set(csrfHeaderName, header)
	}
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	return c, rec
}

func okHandler(c echo.Context) error {
	return c.String(http.StatusOK, "ok")
}

func TestCSRFDocStationRequiresDoubleSubmit(t *testing.T) {
	mw := CSRFProtected()
	for _, path := range []string{
		"/api/docstation/print",
		"/api/docstation/save",
		"/api/docstation/archive",
		"/api/docstation/escl/ScanJobs",
	} {
		// Tanpa token → 403 walau origin lolos.
		c, rec := csrfTestContext(http.MethodPost, path, "", "")
		if err := mw(okHandler)(c); err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if rec.Code != http.StatusForbidden {
			t.Errorf("%s tanpa token = %d, want 403", path, rec.Code)
		}

		// Cookie saja tanpa header → 403.
		c2, rec2 := csrfTestContext(http.MethodPost, path, "abc", "")
		if err := mw(okHandler)(c2); err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if rec2.Code != http.StatusForbidden {
			t.Errorf("%s cookie saja = %d, want 403", path, rec2.Code)
		}

		// Cookie == header → lolos.
		c3, rec3 := csrfTestContext(http.MethodPost, path, "abc", "abc")
		if err := mw(okHandler)(c3); err != nil {
			t.Fatalf("%s: %v", path, err)
		}
		if rec3.Code != http.StatusOK {
			t.Errorf("%s token cocok = %d, want 200", path, rec3.Code)
		}
	}
}

func TestCSRFDocStationGetTetapBebas(t *testing.T) {
	mw := CSRFProtected()
	c, rec := csrfTestContext(http.MethodGet, "/api/docstation/status", "", "")
	if err := mw(okHandler)(c); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK {
		t.Errorf("GET status = %d, want 200", rec.Code)
	}
}
