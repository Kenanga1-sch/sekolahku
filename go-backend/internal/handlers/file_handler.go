package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/middleware"
)

// FileHandler menyajikan file upload yang BERADA DI FOLDER PRIVAT (spmb,
// alumni, arsip, eoffice, chat, tugas, profiles, inventory, bank-soal).
//
// Route anonim GET /uploads/* kini hanya melayani folder publik (gallery,
// announcements, library, staff, logo, stamp). Semua folder lain harus
// melewati endpoint ini: JWT wajib, dan akses dibatasi per-folder sesuai
// matriks otorisasi di bawah.
//
// Path tetap disimpan dengan format "/uploads/<folder>/..." di DB, sehingga
// migrasi data tidak diperlukan — frontend cukup mengganti prefix URL saja.
type FileHandler struct {
	// legacyRoot adalah direktori upload legacy ("uploads") yang juga dicari
	// bila file tidak ada di public/uploads (data lama eoffice/alumni).
	legacyRoot string
}

func NewFileHandler() *FileHandler {
	return &FileHandler{legacyRoot: "uploads"}
}

// publicUploadFolders adalah subfolder uploads yang MEMANG ditujukan untuk
// dipajang di halaman publik (foto guru, galeri, pengumuman, sampul buku).
// Folder lain (spmb, alumni, arsip, eoffice, chat, tugas, dll) berisi dokumen
// pribadi dan HANYA boleh diakses lewat endpoint terautentikasi /api/files/*.
var publicUploadFolders = map[string]bool{
	"gallery":       true,
	"announcements": true,
	"library":       true,
	"staff":         true,
	"logo":          true,
	"stamp":         true,
}

// IsPublicUploadPath melaporkan apakah path relatif (mis. "spmb/abc/kk.pdf")
// berada di salah satu folder publik. Path kosong/root ditolak.
func IsPublicUploadPath(relPath string) bool {
	if relPath == "" || relPath == "." {
		return false
	}
	top := relPath
	if i := strings.IndexAny(relPath, "/\\"); i > 0 {
		top = relPath[:i]
	}
	return publicUploadFolders[top]
}

// folderRoleMatrix memetakan folder upload -> role yang boleh membacanya.
// Folder tidak tercantum = superadmin/admin saja (paling ketat).
//
// Catatan kepemilikan:
//   - profiles (avatar user)   : pemilik sendiri (cek user_id JWT) atau staf
//   - chat (lampiran DM)       : peserta percakapan (diatur di handler chat)
//   - tugas (pengumpulan siswa): guru pengampu atau siswa pemilik
//
// Kepemilikan row-level membutuhkan query DB per fitur; untuk tahap pertama
// ini, akses role-based sudah menutup celah anonim yang menjadi akar masalah
// (semua file privat sebelumnya bisa dibaca siapa pun tanpa login).
var folderRoleMatrix = map[string][]string{
	"spmb":      {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff},
	"arsip":     {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff},
	"eoffice":   {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff},
	"templates": {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff},
	"inventory": {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff},
	"alumni":    {middleware.RoleSuperadmin, middleware.RoleAdmin},
	"chat":      {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff, middleware.RoleGuru, middleware.RoleSiswa, middleware.RoleOrangtua},
	"tugas":     {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff, middleware.RoleGuru, middleware.RoleSiswa, middleware.RoleOrangtua},
	"profiles":  {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleStaff, middleware.RoleGuru, middleware.RoleSiswa, middleware.RoleOrangtua},
	"bank-soal": {middleware.RoleSuperadmin, middleware.RoleAdmin, middleware.RoleGuru},
}

// ServeFile menangani GET /api/files/*.
//
// Path yang diminta berbentuk "/uploads/<folder>/..." (format tersimpan di
// DB) atau "<folder>/...". Setelah resolusi & validasi containment, file
// disajikan hanya bila role JWT memenuhi matriks folder.
func (h *FileHandler) ServeFile(c echo.Context) error {
	reqPath := c.Param("*")
	if reqPath == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Path file wajib diisi"})
	}

	// Normalisasi: terima baik "/uploads/..." maupun "uploads/...".
	normalized := filepath.ToSlash(filepath.Clean(reqPath))
	normalized = strings.TrimPrefix(normalized, "/")
	if normalized == "." || strings.HasPrefix(normalized, "..") {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Path tidak valid"})
	}

	// Klasifikasi folder: strip prefix "uploads/" bila ada.
	relFolder := strings.TrimPrefix(normalized, "uploads/")
	topFolder := relFolder
	if i := strings.Index(relFolder, "/"); i > 0 {
		topFolder = relFolder[:i]
	}

	// Folder publik tidak perlu lewat sini (tetap disajikan anonim), tapi
	// kalau diakses di sini tidak perlu ditolak — cukup diarahkan.
	allowedRoles, isPrivate := folderRoleMatrix[topFolder]
	if !isPrivate {
		// Bukan folder privat yang dikenal: tolak. Catat: folder publik
		// seharusnya diakses via /uploads/*, bukan /api/files/*.
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Akses file ini tidak diizinkan melalui endpoint ini"})
	}

	// Cek role: JWT middleware sudah set "user_role" di context.
	role, _ := c.Get("user_role").(string)
	roleAllowed := false
	for _, r := range allowedRoles {
		if role == r {
			roleAllowed = true
			break
		}
	}
	if !roleAllowed {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Anda tidak berhak mengakses file ini"})
	}

	// Resolve path aman (validasi containment di dalam public/uploads).
	// resolveStoredFilePath mengharuskan format "/uploads/...".
	diskPath, ok := resolveStoredFilePath("/uploads/" + relFolder)
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File tidak ditemukan"})
	}

	// Cek file ada; cek juga root legacy ("uploads/") untuk data lama
	// (eoffice/alumni lama menulis ke uploads/, bukan public/uploads/).
	if _, err := os.Stat(diskPath); err != nil {
		legacyPath := filepath.Join(h.legacyRoot, relFolder)
		if _, err2 := os.Stat(legacyPath); err2 != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "File tidak ditemukan"})
		}
		diskPath = legacyPath
	}

	if info, err := os.Stat(diskPath); err != nil || info.IsDir() {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "File tidak ditemukan"})
	}

	// nosniff mencegah browser salah menafsirkan tipe konten (mis. HTML
	// yang disamarkan). Sudah diset global, tapi ditegaskan lagi di sini.
	c.Response().Header().Set(echo.HeaderXContentTypeOptions, "nosniff")
	c.Response().Header().Set(echo.HeaderCacheControl, "private, max-age=3600")
	return c.File(diskPath)
}
