package handlers

import (
	"strings"
	"testing"
)

// Nama file sampul WAJIB unik per unggahan. Satu ISBN boleh dipakai banyak
// judul dan tiap judul menyimpan sampul sendiri; dulu nama file hanya berisi
// ISBN sehingga unggahan kedua MENIMPA file sampul judul pertama.
func TestGenerateCoverFilenameIsUniquePerUpload(t *testing.T) {
	base := "9786028134255"
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		name := generateCoverFilename(base, "webp")
		if seen[name] {
			t.Fatalf("nama file sampul kembar: %s", name)
		}
		seen[name] = true
		if !strings.HasPrefix(name, base+"-") {
			t.Fatalf("nama file harus diawali base: %s", name)
		}
		if !strings.HasSuffix(name, ".webp") {
			t.Fatalf("ekstensi harus .webp: %s", name)
		}
		if strings.Contains(name, "..") {
			t.Fatalf("nama file tidak boleh mengandung '..': %s", name)
		}
		if strings.ContainsAny(name, `/\`) {
			t.Fatalf("nama file tidak boleh mengandung separator path: %s", name)
		}
	}
}

// Ekstensi boleh datang dengan titik di depan; hasil akhir tetap satu titik.
func TestGenerateCoverFilenameNormalizesExtension(t *testing.T) {
	got := generateCoverFilename("cover", ".webp")
	if !strings.HasSuffix(got, ".webp") {
		t.Fatalf("ekstensi salah: %s", got)
	}
	if strings.Contains(got, "..") {
		t.Fatalf("titik ganda tidak boleh muncul: %s", got)
	}
}

// Sanitasi nama file: traversal & karakter aneh dibuang, sehingga nama file
// tidak bisa keluar dari direktori upload.
func TestSanitizeCoverNameRemovesTraversal(t *testing.T) {
	if got := sanitizeCoverName("../../etc/passwd"); got != "etcpasswd" {
		t.Fatalf("nama tidak aman: %q", got)
	}
	if got := sanitizeCoverName("978 602-813"); got != "978602-813" {
		t.Fatalf("nama salah: %q", got)
	}
	if got := sanitizeCoverName("   "); got != "" {
		t.Fatalf("input kosong harus jadi string kosong: %q", got)
	}
}

