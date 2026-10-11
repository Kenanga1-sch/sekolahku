package handlers

import (
	"os"
	"path/filepath"
	"regexp"
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
		// "/perpustakaan/sirkulasi" tidak pernah ada sebagai halaman; rute
		// peminjaman perpustakaan adalah "/perpustakaan/peminjaman".
		`"/perpustakaan/sirkulasi"`,
	}

	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("glob handlers: %v", err)
	}
	sched, _ := filepath.Glob("../scheduler/*.go")
	files = append(files, sched...)
	notifyFiles, _ := filepath.Glob("../notify/*.go")
	files = append(files, notifyFiles...)

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
				t.Fatalf("%s masih memakai target URL yang tidak punya route: %s (gunakan format ?tab= atau rute yang benar)", f, b)
			}
		}
	}
}

// navTargetRe mencocokkan literal string yang dipakai sebagai target navigasi
// notifikasi: string yang dimulai "/" dan bukan endpoint API / aset / path
// sistem. Contoh: "/perpustakaan/peminjaman", "/parent", "/admin/siswa?tab=spmb".
var navTargetRe = regexp.MustCompile(`"(/[a-z][a-zA-Z0-9/_-]*)(\?[^"]*)?"`)

// apiOrAssetPrefixes adalah prefix string "/..." yang bukan halaman aplikasi
// (endpoint backend, aset statis, path sistem) sehingga tidak perlu divalidasi
// sebagai route frontend.
var apiOrAssetPrefixes = []string{
	"/api",
	"/uploads",
	"/etc",
	"/tmp",
	"/files",
	"/folders",
	"/notes",
	"/star",
	"/trash",
	"/download",
	"/app",
	"/content",
	"/wasm",
	"/icon",
	"/app-backup",
	"/starred",
}

// TestNotificationNavTargetsHaveFrontendRoutes memvalidasi bahwa setiap target
// navigasi notifikasi (/perpustakaan/..., /parent/..., /admin/...) benar-benar
// punya berkas halaman di frontend (../app/**/page.tsx). Ini mencegah
// regresi seperti "/perpustakaan/sirkulasi" yang tidak punya halaman.
func TestNotificationNavTargetsHaveFrontendRoutes(t *testing.T) {
	routes, ok := collectFrontendRoutes()
	if !ok {
		t.Skip("folder app/ frontend tidak ditemukan (uji dijalankan di luar repo); lewati")
	}

	files, _ := filepath.Glob("*.go")
	sched, _ := filepath.Glob("../scheduler/*.go")
	files = append(files, sched...)
	notifyFiles, _ := filepath.Glob("../notify/*.go")
	files = append(files, notifyFiles...)

	seen := map[string]string{} // path -> first file
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatalf("read %s: %v", f, err)
		}
		for _, m := range navTargetRe.FindAllStringSubmatch(string(data), -1) {
			path := m[1]
			if isApiOrAsset(path) {
				continue
			}
			if _, dup := seen[path]; !dup {
				seen[path] = f
			}
		}
	}

	for path, file := range seen {
		base := strings.TrimPrefix(path, "/")
		if base == "" {
			continue // root "/"
		}
		if _, found := routes[base]; !found {
			t.Errorf("%s: target notifikasi %q tidak punya halaman frontend app/%s/page.tsx", file, path, base)
		}
	}
}

func isApiOrAsset(p string) bool {
	for _, pre := range apiOrAssetPrefixes {
		if p == pre || strings.HasPrefix(p, pre+"/") {
			return true
		}
	}
	return false
}

// collectFrontendRoutes membaca ../app/**/page.tsx dan mengembalikan himpunan
// URL path (tanpa route group "(...)"), mis. "perpustakaan/peminjaman".
func collectFrontendRoutes() (map[string]struct{}, bool) {
	// test berjalan di go-backend/internal/handlers → ../.. = go-backend,
	// ../../.. = root repo yang berisi folder app/.
	roots := []string{"../../../app", "../../app", "./app"}
	var appDir string
	for _, r := range roots {
		if st, err := os.Stat(r); err == nil && st.IsDir() {
			appDir = r
			break
		}
	}
	if appDir == "" {
		return nil, false
	}

	routes := map[string]struct{}{}
	_ = filepath.WalkDir(appDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() || d.Name() != "page.tsx" {
			return nil
		}
		rel := strings.TrimPrefix(path, appDir+string(os.PathSeparator))
		rel = strings.TrimSuffix(rel, string(os.PathSeparator)+"page.tsx")
		rel = strings.TrimSuffix(rel, "page.tsx")
		parts := strings.Split(rel, string(os.PathSeparator))
		clean := make([]string, 0, len(parts))
		for _, p := range parts {
			if p == "" || strings.HasPrefix(p, "(") {
				continue // buang route group
			}
			clean = append(clean, p)
		}
		routes[strings.Join(clean, "/")] = struct{}{}
		return nil
	})
	return routes, true
}
