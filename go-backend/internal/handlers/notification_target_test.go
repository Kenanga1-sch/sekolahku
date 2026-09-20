package handlers

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// TestNotificationTargetURLsPointToRealRoutes memastikan TargetURL notifikasi
// yang di-hardcode di handler mengarah ke route yang benar-benar ada.
//
// Tab pada /admin/siswa dimuat via query string (?tab=mutasi), bukan nested
// path. Sebelumnya beberapa notifikasi memakai "/admin/siswa/mutasi" dan
// "/admin/siswa/spmb" yang tidak ada → admin klik notif → 404.
func TestNotificationTargetURLsPointToRealRoutes(t *testing.T) {
	// Path-path yang pernah salah dan tidak punya route nyata.
	broken := []string{
		`"/admin/siswa/mutasi"`,
		`"/admin/siswa/spmb"`,
	}

	files, err := filepath.Glob("internal/handlers/*.go")
	if err != nil {
		t.Fatalf("glob handlers: %v", err)
	}

	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		src, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		for _, b := range broken {
			if strings.Contains(string(src), b) {
				t.Fatalf("%s masih memakai target URL yang tidak punya route: %s (gunakan format ?tab=)", f, b)
			}
		}
	}
}
