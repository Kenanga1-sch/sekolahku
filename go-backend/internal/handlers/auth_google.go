package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"

	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

// Pendaftaran/login Google untuk ORANG TUA.
//
// Google hanya dipakai sebagai bukti kepemilikan email. Hak akses tetap
// ditentukan role di tabel users, dan pendaftaran mandiri tetap wajib
// memverifikasi NISN + tanggal lahir anak — sama seperti /daftar-ortu.
//
// Alur:
//  1. GET /api/auth/google/start     → set cookie state, redirect ke Google.
//  2. GET /api/auth/google/callback  → tukar code, baca userinfo, set tiket
//     (JWT 10 menit, HttpOnly), redirect ke halaman penyelesaian.
//  3. POST /api/auth/google/complete → verifikasi NISN, tautkan/buat akun,
//     terbitkan sesi.
//
// Akun hasil pendaftaran Google TIDAK punya password (password_hash NULL);
// password bisa dibuat kemudian lewat alur reset password yang sudah ada.

const (
	googleStateCookie  = "oauth_state"
	googleTicketCookie = "google_ticket"
	googleStateTTL     = 10 * time.Minute
	googleTicketTTL    = 15 * time.Minute
	googleTicketTyp    = "google_ticket"
	googleDefaultPage  = "/daftar-ortu/google"
	googleParentHome   = "/parent"
)

// Endpoint Google dibuat variabel agar bisa diarahkan ke server uji pada
// unit test (tanpa jaringan keluar).
var (
	googleAuthURL     = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL    = "https://oauth2.googleapis.com/token"
	googleUserInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"
	googleHTTPClient  = &http.Client{Timeout: 15 * time.Second}
)

var safeRedirectRegex = regexp.MustCompile(`^/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$`)

// googleConfigured true bila kredensial OAuth tersedia di environment.
// Tanpa kredensial, tombol Google tidak ditampilkan (frontend menanyakan
// status ini lewat /api/auth/google/status).
func googleConfigured() bool {
	return strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")) != "" &&
		strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")) != ""
}

// oauthPublicBaseURL alamat publik aplikasi (dipakai menyusun redirect_uri).
// Harus sama persis dengan yang didaftarkan di Google Cloud Console.
func oauthPublicBaseURL(c echo.Context) string {
	if base := strings.TrimRight(strings.TrimSpace(os.Getenv("OAUTH_PUBLIC_BASE_URL")), "/"); base != "" {
		return base
	}
	scheme := "https"
	if proto := c.Request().Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = strings.Split(proto, ",")[0]
	} else if os.Getenv("COOKIE_SECURE") == "false" {
		scheme = "http"
	}
	return scheme + "://" + c.Request().Host
}

func googleRedirectURI(c echo.Context) string {
	return oauthPublicBaseURL(c) + "/api/auth/google/callback"
}

func secureCookie() bool {
	return os.Getenv("COOKIE_SECURE") != "false"
}

func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// safeRedirectPath hanya mengizinkan path relatif internal.
// Menolak "//evil.com", "/\evil.com", dan URL absolut.
func safeRedirectPath(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || !strings.HasPrefix(raw, "/") || strings.HasPrefix(raw, "//") {
		return ""
	}
	if strings.Contains(raw, "\\") || strings.Contains(raw, "://") {
		return ""
	}
	if !safeRedirectRegex.MatchString(raw) {
		return ""
	}
	return raw
}

// GoogleStatus memberi tahu frontend apakah tombol Google perlu ditampilkan.
func (h *AuthHandler) GoogleStatus(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]interface{}{
		"enabled": googleConfigured(),
	})
}

// GoogleStart memulai alur OAuth: simpan state acak di cookie HttpOnly lalu
// redirect ke halaman consent Google. `redirect` opsional (path internal).
func (h *AuthHandler) GoogleStart(c echo.Context) error {
	if !googleConfigured() {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{
			"error": "Login Google belum diaktifkan. Hubungi administrator sekolah.",
		})
	}

	state, err := randomHex(24)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat state OAuth"})
	}

	c.SetCookie(&http.Cookie{
		Name:     googleStateCookie,
		Value:    state,
		Path:     "/api/auth/google",
		MaxAge:   int(googleStateTTL.Seconds()),
		HttpOnly: true,
		Secure:   secureCookie(),
		SameSite: http.SameSiteLaxMode,
	})

	// Target setelah selesai; disimpan di cookie (bukan query state) agar
	// tidak bisa diubah lewat URL callback.
	redirect := safeRedirectPath(c.QueryParam("redirect"))
	if redirect == "" {
		redirect = googleParentHome
	}
	c.SetCookie(&http.Cookie{
		Name:     "oauth_redirect",
		Value:    url.QueryEscape(redirect),
		Path:     "/api/auth/google",
		MaxAge:   int(googleStateTTL.Seconds()),
		HttpOnly: true,
		Secure:   secureCookie(),
		SameSite: http.SameSiteLaxMode,
	})

	// mode=link: pengguna sudah login dan ingin MENAUTKAN Google ke akunnya,
	// bukan mendaftar. Callback akan mengembalikan tiket ke halaman profil.
	mode := ""
	if c.QueryParam("mode") == "link" {
		mode = "link"
	}
	c.SetCookie(&http.Cookie{
		Name:     "oauth_mode",
		Value:    mode,
		Path:     "/api/auth/google",
		MaxAge:   int(googleStateTTL.Seconds()),
		HttpOnly: true,
		Secure:   secureCookie(),
		SameSite: http.SameSiteLaxMode,
	})

	q := url.Values{}
	q.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	q.Set("redirect_uri", googleRedirectURI(c))
	q.Set("response_type", "code")
	q.Set("scope", "openid email profile")
	q.Set("state", state)
	q.Set("prompt", "select_account")

	return c.Redirect(http.StatusFound, googleAuthURL+"?"+q.Encode())
}

type googleUserInfo struct {
	Sub           string       `json:"sub"`
	Email         string       `json:"email"`
	EmailVerified flexibleBool `json:"email_verified"`
	Name          string       `json:"name"`
	Picture       string       `json:"picture"`
}

// flexibleBool menerima true/false maupun "true"/"false" — beberapa endpoint
// Google mengembalikan bentuk string pada versi API lama.
type flexibleBool bool

func (b *flexibleBool) UnmarshalJSON(data []byte) error {
	s := strings.Trim(strings.TrimSpace(string(data)), `"`)
	switch strings.ToLower(s) {
	case "true", "1":
		*b = true
	case "false", "0", "null", "":
		*b = false
	default:
		return fmt.Errorf("nilai boolean tidak dikenal: %s", s)
	}
	return nil
}

// exchangeGoogleCode menukar authorization code dengan access token.
func exchangeGoogleCode(c echo.Context, code string) (string, error) {
	form := url.Values{}
	form.Set("code", code)
	form.Set("client_id", os.Getenv("GOOGLE_CLIENT_ID"))
	form.Set("client_secret", os.Getenv("GOOGLE_CLIENT_SECRET"))
	form.Set("redirect_uri", googleRedirectURI(c))
	form.Set("grant_type", "authorization_code")

	req, err := http.NewRequest(http.MethodPost, googleTokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationForm)

	res, err := googleHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("tukar kode Google gagal (%d): %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", err
	}
	if payload.AccessToken == "" {
		return "", errors.New("access_token kosong dari Google")
	}
	return payload.AccessToken, nil
}

// fetchGoogleUserInfo mengambil profil dari endpoint userinfo.
func fetchGoogleUserInfo(accessToken string) (*googleUserInfo, error) {
	req, err := http.NewRequest(http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	res, err := googleHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("userinfo Google gagal (%d): %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var info googleUserInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, err
	}
	if strings.TrimSpace(info.Sub) == "" || strings.TrimSpace(info.Email) == "" {
		return nil, errors.New("profil Google tidak lengkap (sub/email kosong)")
	}
	return &info, nil
}

// GoogleCallback menyelesaikan pertukaran kode, lalu menitipkan identitas
// Google pada cookie tiket (JWT 15 menit) dan mengarahkan pengguna ke
// halaman verifikasi NISN. Sesi login BELUM dibuat di sini.
func (h *AuthHandler) GoogleCallback(c echo.Context) error {
	if !googleConfigured() {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Login Google belum diaktifkan"})
	}

	stateCookie, err := c.Cookie(googleStateCookie)
	if err != nil || strings.TrimSpace(stateCookie.Value) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Sesi OAuth tidak ditemukan. Silakan ulangi dari halaman masuk."})
	}
	if c.QueryParam("state") != stateCookie.Value {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "State OAuth tidak valid. Silakan ulangi dari halaman masuk."})
	}
	// State sekali pakai.
	c.SetCookie(&http.Cookie{
		Name: googleStateCookie, Value: "", Path: "/api/auth/google",
		MaxAge: -1, HttpOnly: true, Secure: secureCookie(), SameSite: http.SameSiteLaxMode,
	})

	if errParam := c.QueryParam("error"); errParam != "" {
		return c.Redirect(http.StatusFound, "/login?google=cancelled")
	}

	code := strings.TrimSpace(c.QueryParam("code"))
	if code == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Kode otorisasi Google tidak ditemukan"})
	}

	accessToken, err := exchangeGoogleCode(c, code)
	if err != nil {
		c.Logger().Errorf("google oauth: %v", err)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "Gagal memverifikasi akun Google. Silakan coba lagi."})
	}

	info, err := fetchGoogleUserInfo(accessToken)
	if err != nil {
		c.Logger().Errorf("google oauth: %v", err)
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "Gagal membaca profil Google. Silakan coba lagi."})
	}

	// Email belum terverifikasi di Google tidak boleh dipakai menautkan akun:
	// tanpa ini, siapa pun bisa mengklaim email orang lain.
	if !bool(info.EmailVerified) {
		return c.JSON(http.StatusForbidden, map[string]string{
			"error": "Email Google Anda belum terverifikasi. Verifikasi dulu di akun Google, lalu coba lagi.",
		})
	}

	email := strings.ToLower(strings.TrimSpace(info.Email))

	// Tujuan setelah selesai (dari cookie oauth_redirect yang diset di start).
	afterLogin := ""
	if rc, err := c.Cookie("oauth_redirect"); err == nil {
		if decoded, err := url.QueryUnescape(rc.Value); err == nil {
			afterLogin = safeRedirectPath(decoded)
		}
	}
	if afterLogin == "" {
		afterLogin = googleParentHome
	}
	c.SetCookie(&http.Cookie{
		Name: "oauth_redirect", Value: "", Path: "/api/auth/google",
		MaxAge: -1, HttpOnly: true, Secure: secureCookie(), SameSite: http.SameSiteLaxMode,
	})

	// Identitas sudah pernah ditautkan → langsung buat sesi (login biasa).
	if h.Identities != nil {
		ident, err := h.Identities.GetByProvider(repository.ProviderGoogle, info.Sub)
		if err != nil {
			c.Logger().Errorf("google oauth: cek identitas: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		if ident != nil {
			user, err := h.Repo.GetUserByID(ident.UserID)
			if err != nil || user == nil {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun tertaut tidak ditemukan"})
			}
			if !user.IsActive {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun Anda tidak aktif. Silakan hubungi administrator."})
			}
			if user.Role != "orangtua" {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun ini bukan akun orang tua"})
			}
			if _, err := h.issueSession(c, user, "", ""); err != nil {
				c.Logger().Errorf("google oauth: issue session: %v", err)
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat sesi"})
			}
			h.auditGoogle(c, "login_google", user.ID, &user.Email, "Login via Google")
			return c.Redirect(http.StatusFound, afterLogin)
		}
	}

	ticket, err := h.signGoogleTicket(info, email, afterLogin)
	if err != nil {
		c.Logger().Errorf("google oauth: tiket: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat tiket pendaftaran"})
	}

	c.SetCookie(&http.Cookie{
		Name:     googleTicketCookie,
		Value:    ticket,
		Path:     "/api/auth/google",
		MaxAge:   int(googleTicketTTL.Seconds()),
		HttpOnly: true,
		Secure:   secureCookie(),
		SameSite: http.SameSiteLaxMode,
	})

	// Alur penautan dari portal ortu: kembali ke profil, bukan ke pendaftaran.
	if modeCookie, err := c.Cookie("oauth_mode"); err == nil && modeCookie.Value == "link" {
		c.SetCookie(&http.Cookie{
			Name: "oauth_mode", Value: "", Path: "/api/auth/google",
			MaxAge: -1, HttpOnly: true, Secure: secureCookie(), SameSite: http.SameSiteLaxMode,
		})
		return c.Redirect(http.StatusFound, "/parent/profil?google=link")
	}

	return c.Redirect(http.StatusFound, googleDefaultPage)
}

func (h *AuthHandler) signGoogleTicket(info *googleUserInfo, email, afterLogin string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", errors.New("JWT_SECRET tidak diset")
	}
	claims := jwt.MapClaims{
		"typ":     googleTicketTyp,
		"sub":     info.Sub,
		"email":   email,
		"name":    info.Name,
		"picture": info.Picture,
		"after":   afterLogin,
		"exp":     time.Now().Add(googleTicketTTL).Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

// parseGoogleTicket memvalidasi tiket dari cookie. Nilai kedua false bila
// tiket tidak ada/kedaluwarsa/berjenis salah.
func parseGoogleTicket(raw string) (jwt.MapClaims, bool) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" || strings.TrimSpace(raw) == "" {
		return nil, false
	}
	token, err := jwt.Parse(raw, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("metode tanda tangan tidak didukung: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, false
	}
	if typ, _ := claims["typ"].(string); typ != googleTicketTyp {
		return nil, false
	}
	return claims, true
}

// GooglePending mengembalikan identitas Google yang sedang menunggu
// verifikasi NISN (dibaca dari cookie tiket).
func (h *AuthHandler) GooglePending(c echo.Context) error {
	ck, err := c.Cookie(googleTicketCookie)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Tidak ada pendaftaran Google yang sedang berjalan"})
	}
	claims, ok := parseGoogleTicket(ck.Value)
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Sesi pendaftaran Google sudah kedaluwarsa. Silakan ulangi."})
	}
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	picture, _ := claims["picture"].(string)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"email":   email,
		"name":    name,
		"picture": picture,
	})
}

type googleCompleteRequest struct {
	NISN      string `json:"nisn"`
	BirthDate string `json:"birthDate"`
	Relation  string `json:"relation"`
}

// GoogleComplete menyelesaikan pendaftaran: verifikasi NISN + tanggal lahir,
// lalu tautkan identitas Google ke akun ortu yang sudah ada untuk siswa itu
// atau buat akun ortu baru (tanpa password).
func (h *AuthHandler) GoogleComplete(c echo.Context) error {
	if h.Identities == nil || h.Parents == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Pendaftaran Google belum siap"})
	}

	ck, err := c.Cookie(googleTicketCookie)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Sesi pendaftaran Google tidak ditemukan. Silakan ulangi dari halaman masuk."})
	}
	claims, ok := parseGoogleTicket(ck.Value)
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Sesi pendaftaran Google sudah kedaluwarsa. Silakan ulangi."})
	}

	var req googleCompleteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Data tidak valid"})
	}
	req.NISN = strings.TrimSpace(req.NISN)
	req.BirthDate = strings.TrimSpace(req.BirthDate)
	req.Relation = strings.TrimSpace(req.Relation)

	if !nisnRegex.MatchString(req.NISN) || !parentDateRegex.MatchString(req.BirthDate) {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "NISN (10 digit) dan tanggal lahir wajib diisi dengan benar"})
	}
	switch req.Relation {
	case "", "orangtua", "ayah", "ibu", "wali":
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Hubungan dengan anak tidak valid"})
	}
	if req.Relation == "" {
		req.Relation = "orangtua"
	}

	providerUserID, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	picture, _ := claims["picture"].(string)
	afterLogin, _ := claims["after"].(string)
	if safe := safeRedirectPath(afterLogin); safe != "" {
		afterLogin = safe
	} else {
		afterLogin = googleParentHome
	}
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if providerUserID == "" || email == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tiket Google tidak lengkap. Silakan ulangi."})
	}

	studentID, studentName, err := h.Parents.FindStudentForRegistration(req.NISN, req.BirthDate)
	if err != nil {
		c.Logger().Errorf("google complete: cari siswa: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	}
	if studentID == "" {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Data siswa tidak ditemukan atau tanggal lahir tidak cocok"})
	}

	// Idempoten: bila identitas sudah tertaut (mis. pengguna menekan dua kali),
	// langsung terbitkan sesi untuk akun tersebut.
	if existing, err := h.Identities.GetByProvider(repository.ProviderGoogle, providerUserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	} else if existing != nil {
		user, err := h.Repo.GetUserByID(existing.UserID)
		if err != nil || user == nil || !user.IsActive || user.Role != "orangtua" {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun tertaut tidak tersedia"})
		}
		return h.finishGoogleLogin(c, user, "login_google", "Login via Google", afterLogin)
	}

	var target *models.User
	created := false

	// 1) Siswa sudah punya akun ortu aktif → tautkan ke akun itu.
	if userID, err := h.Parents.FindActiveParentUserByStudent(studentID); err != nil {
		c.Logger().Errorf("google complete: cari akun ortu: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	} else if userID != "" {
		user, err := h.Repo.GetUserByID(userID)
		if err != nil || user == nil || !user.IsActive {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun orang tua untuk siswa ini tidak aktif"})
		}
		target = user
	}

	// 2) Belum ada akun ortu untuk siswa ini. Email Google mungkin sudah
	//    dipakai akun ortu lain (orang tua dengan beberapa anak) → tautkan.
	if target == nil {
		byEmail, err := h.Repo.GetUserByEmailOnly(email)
		if err != nil {
			c.Logger().Errorf("google complete: cek email: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
		}
		if byEmail != nil {
			if byEmail.Role != "orangtua" {
				return c.JSON(http.StatusConflict, map[string]string{
					"error": "Email ini sudah terdaftar sebagai akun staf/admin. Silakan hubungi administrator sekolah.",
				})
			}
			if !byEmail.IsActive {
				return c.JSON(http.StatusForbidden, map[string]string{"error": "Akun dengan email ini tidak aktif. Hubungi administrator."})
			}
			target = byEmail
		}
	}

	// 3) Buat akun ortu baru tanpa password.
	if target == nil {
		namePtr := name
		if namePtr == "" {
			namePtr = "Orang Tua " + studentName
		}
		emailPtr := email
		var imagePtr *string
		if picture != "" {
			imagePtr = &picture
		}
		now := time.Now()
		userID, err := h.Repo.CreateUser(models.User{
			Name:          &namePtr,
			FullName:      &namePtr,
			Email:         emailPtr,
			EmailVerified: &now,
			Image:         imagePtr,
			Role:          "orangtua",
			IsActive:      true,
		})
		if err != nil {
			c.Logger().Errorf("google complete: buat akun: %v", err)
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat akun"})
		}
		user, err := h.Repo.GetUserByID(userID)
		if err != nil || user == nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membaca akun baru"})
		}
		target = user
		created = true
	}

	if err := h.Parents.LinkParent(target.ID, studentID, req.Relation); err != nil {
		c.Logger().Errorf("google complete: tautkan siswa: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menautkan akun ke siswa"})
	}

	if _, err := h.Identities.CreateIdentity(models.UserIdentity{
		UserID:         target.ID,
		Provider:       repository.ProviderGoogle,
		ProviderUserID: providerUserID,
		Email:          &email,
		EmailVerified:  true,
	}); err != nil {
		c.Logger().Errorf("google complete: simpan identitas: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menautkan akun Google"})
	}

	// Tiket sudah dipakai — hapus cookie agar tidak bisa diputar ulang.
	c.SetCookie(&http.Cookie{
		Name: googleTicketCookie, Value: "", Path: "/api/auth/google",
		MaxAge: -1, HttpOnly: true, Secure: secureCookie(), SameSite: http.SameSiteLaxMode,
	})

	if created {
		h.auditGoogle(c, "signup_google", target.ID, &target.Email,
			"Pendaftaran akun orang tua via Google untuk siswa "+studentName)
		if h.Notifications != nil {
			// Halaman detail siswa memakai query string, bukan nested path.
			targetURL := "/admin/siswa/detail?id=" + studentID
			_ = h.Notifications.NotifyRoles(models.Notification{
				Type:      "info",
				Category:  "account",
				Title:     "Pendaftaran Akun Orang Tua (Google)",
				Message:   name + " (" + email + ") mendaftar sebagai orang tua/wali dari " + studentName + ".",
				TargetURL: &targetURL,
			}, "superadmin", "admin")
		}
	} else {
		h.auditGoogle(c, "link_google", target.ID, &target.Email,
			"Akun Google ditautkan ke akun orang tua untuk siswa "+studentName)
	}

	return h.finishGoogleLogin(c, target, "", "", afterLogin)
}

// GoogleLink menautkan identitas Google ke akun yang SEDANG login.
// Dipakai akun orang tua lama (berbasis nomor HP, tanpa email) supaya bisa
// masuk lewat Google tanpa membuat akun baru.
func (h *AuthHandler) GoogleLink(c echo.Context) error {
	if h.Identities == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "Fitur Google belum siap"})
	}

	userID, _ := c.Get("user_id").(string)
	role, _ := c.Get("user_role").(string)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Sesi tidak valid"})
	}
	if role != "orangtua" {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Hanya akun orang tua yang dapat menautkan Google"})
	}

	ck, err := c.Cookie(googleTicketCookie)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Sesi Google tidak ditemukan. Silakan ulangi."})
	}
	claims, ok := parseGoogleTicket(ck.Value)
	if !ok {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Sesi Google sudah kedaluwarsa. Silakan ulangi."})
	}

	providerUserID, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	email = strings.ToLower(strings.TrimSpace(email))
	if providerUserID == "" || email == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tiket Google tidak lengkap"})
	}

	// Identitas Google milik akun LAIN tidak boleh dipindahkan diam-diam.
	if existing, err := h.Identities.GetByProvider(repository.ProviderGoogle, providerUserID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	} else if existing != nil && existing.UserID != userID {
		return c.JSON(http.StatusConflict, map[string]string{
			"error": "Akun Google ini sudah tertaut ke akun lain. Hubungi administrator sekolah.",
		})
	}

	// Satu akun hanya boleh punya satu identitas per provider.
	if own, err := h.Identities.GetByUserProvider(userID, repository.ProviderGoogle); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Terjadi kesalahan internal"})
	} else if own != nil && own.ProviderUserID != providerUserID {
		return c.JSON(http.StatusConflict, map[string]string{
			"error": "Akun Anda sudah tertaut ke akun Google lain. Hubungi administrator untuk melepasnya.",
		})
	}

	if _, err := h.Identities.CreateIdentity(models.UserIdentity{
		UserID:         userID,
		Provider:       repository.ProviderGoogle,
		ProviderUserID: providerUserID,
		Email:          &email,
		EmailVerified:  true,
	}); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal menautkan akun Google"})
	}

	c.SetCookie(&http.Cookie{
		Name: googleTicketCookie, Value: "", Path: "/api/auth/google",
		MaxAge: -1, HttpOnly: true, Secure: secureCookie(), SameSite: http.SameSiteLaxMode,
	})

	h.auditGoogle(c, "link_google", userID, &email, "Akun Google ditautkan dari portal orang tua")

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Akun Google berhasil ditautkan. Anda bisa masuk memakai tombol Google.",
		"email":   email,
	})
}

// finishGoogleLogin menerbitkan sesi + audit lalu mengembalikan tujuan redirect
// ke frontend (frontend yang melakukan navigasi setelah refresh sesi).
func (h *AuthHandler) finishGoogleLogin(c echo.Context, user *models.User, action, detail, redirect string) error {
	if _, err := h.issueSession(c, user, "", ""); err != nil {
		c.Logger().Errorf("google oauth: issue session: %v", err)
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Gagal membuat sesi"})
	}
	if action != "" {
		h.auditGoogle(c, action, user.ID, &user.Email, detail)
	}
	if redirect == "" {
		redirect = googleParentHome
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":  true,
		"user":     user,
		"redirect": redirect,
	})
}

func (h *AuthHandler) auditGoogle(c echo.Context, action, userID string, email *string, detail string) {
	if h.AuditRepo == nil {
		return
	}
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	_ = h.AuditRepo.CreateLog(models.AuditLog{
		Action:    action,
		Resource:  "user",
		UserID:    &userID,
		UserEmail: email,
		IPAddress: &ip,
		UserAgent: &ua,
		Details:   &detail,
	})
}
