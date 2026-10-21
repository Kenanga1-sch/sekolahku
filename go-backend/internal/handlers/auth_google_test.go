package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	_ "modernc.org/sqlite"

	"github.com/sekolahku/go-backend/internal/repository"
)

func setupGoogleTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("buka db: %v", err)
	}
	_, err = db.Exec(`
		CREATE TABLE users (
			id TEXT PRIMARY KEY,
			name TEXT,
			email TEXT UNIQUE,
			email_verified INTEGER,
			image TEXT,
			username TEXT,
			password_hash TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			full_name TEXT,
			phone TEXT,
			is_active INTEGER DEFAULT 1,
			must_change_password INTEGER DEFAULT 0,
			student_id TEXT,
			created_at INTEGER,
			updated_at INTEGER
		);
		CREATE TABLE audit_logs (
			id TEXT PRIMARY KEY,
			action TEXT,
			resource TEXT,
			details TEXT,
			user_id TEXT,
			user_name TEXT,
			user_email TEXT,
			ip_address TEXT,
			user_agent TEXT,
			created_at INTEGER
		);
		CREATE TABLE user_identities (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			provider TEXT NOT NULL,
			provider_user_id TEXT NOT NULL,
			email TEXT,
			email_verified INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0,
			UNIQUE(provider, provider_user_id)
		);
		CREATE TABLE parent_students (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			student_id TEXT NOT NULL,
			relation TEXT NOT NULL DEFAULT 'orangtua',
			is_active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT 0,
			updated_at INTEGER NOT NULL DEFAULT 0,
			UNIQUE(user_id, student_id)
		);
		CREATE TABLE students (
			id TEXT PRIMARY KEY,
			full_name TEXT NOT NULL,
			nisn TEXT UNIQUE,
			birth_date TEXT,
			status TEXT DEFAULT 'active',
			is_active INTEGER DEFAULT 1
		);
		CREATE TABLE notifications (
			id TEXT PRIMARY KEY,
			user_id TEXT,
			type TEXT,
			category TEXT,
			title TEXT,
			message TEXT,
			target_url TEXT,
			is_read INTEGER DEFAULT 0,
			metadata TEXT,
			created_at INTEGER
		);
	`)
	if err != nil {
		t.Fatalf("buat skema: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO students (id, full_name, nisn, birth_date, status, is_active)
		VALUES ('st-1', 'Budi Santoso', '1234567890', '2015-05-01', 'active', 1),
		       ('st-2', 'Siti Aminah', '1234567891', '2015-06-02', 'active', 1);
		INSERT INTO users (id, name, email, role, password_hash, is_active, created_at, updated_at)
		VALUES ('admin-1', 'Admin Sekolah', 'admin@sekolah.sch.id', 'admin', 'x', 1, 1, 1);
	`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	return db
}

func newGoogleTestHandler(t *testing.T) (*AuthHandler, *sql.DB) {
	t.Helper()
	db := setupGoogleTestDB(t)
	h := NewAuthHandler(
		repository.NewUserRepository(db),
		repository.NewAuditLogRepository(db),
		nil,
		repository.NewNotificationRepository(db),
	)
	h.Identities = repository.NewUserIdentityRepository(db)
	h.Parents = repository.NewParentRepository(db)
	return h, db
}

// signTestTicket membuat tiket Google tanpa lewat callback (tanpa jaringan).
func signTestTicket(t *testing.T, sub, email string, expires time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{
		"typ":     googleTicketTyp,
		"sub":     sub,
		"email":   email,
		"name":    "Orang Tua Uji",
		"picture": "",
		"exp":     expires.Unix(),
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).
		SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		t.Fatalf("tanda tangan tiket: %v", err)
	}
	return tok
}

func newJSONContext(e *echo.Echo, method, path, body string) (echo.Context, *httptest.ResponseRecorder) {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	rec := httptest.NewRecorder()
	return e.NewContext(req, rec), rec
}

func TestSafeRedirectPath(t *testing.T) {
	cases := map[string]string{
		"/parent":              "/parent",
		"/parent/tabungan?x=1": "/parent/tabungan?x=1",
		"":                     "",
		"//evil.com":           "",
		"/\\evil.com":          "",
		"https://evil.com":     "",
		"evil":                 "",
	}
	for input, want := range cases {
		if got := safeRedirectPath(input); got != want {
			t.Errorf("safeRedirectPath(%q) = %q, ingin %q", input, got, want)
		}
	}
}

func TestGoogleCompleteCreatesParentWithoutPassword(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	ticket := signTestTicket(t, "google-sub-1", "ortu@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-05-01","relation":"ibu"}`)
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})

	if err := h.GoogleComplete(ctx); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}

	var userID, role, email string
	var passwordHash sql.NullString
	err := db.QueryRow(`SELECT id, role, email, password_hash FROM users WHERE email = 'ortu@example.com'`).
		Scan(&userID, &role, &email, &passwordHash)
	if err != nil {
		t.Fatalf("akun tidak dibuat: %v", err)
	}
	if role != "orangtua" {
		t.Errorf("role = %q, ingin orangtua", role)
	}
	if passwordHash.Valid {
		t.Errorf("akun Google seharusnya tanpa password, dapat %q", passwordHash.String)
	}

	var linked int
	if err := db.QueryRow(`SELECT COUNT(*) FROM parent_students WHERE user_id = ? AND student_id = 'st-1' AND relation = 'ibu'`, userID).Scan(&linked); err != nil {
		t.Fatalf("cek tautan: %v", err)
	}
	if linked != 1 {
		t.Errorf("tautan orang tua–siswa tidak dibuat")
	}

	var ident int
	if err := db.QueryRow(`SELECT COUNT(*) FROM user_identities WHERE user_id = ? AND provider = 'google' AND provider_user_id = 'google-sub-1'`, userID).Scan(&ident); err != nil {
		t.Fatalf("cek identitas: %v", err)
	}
	if ident != 1 {
		t.Errorf("identitas Google tidak tersimpan")
	}

	// Sesi harus terbit (cookie session + user_info).
	var hasSession, hasInfo bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == "session" && c.Value != "" {
			hasSession = true
		}
		if c.Name == "user_info" && c.Value != "" {
			hasInfo = true
		}
	}
	if !hasSession || !hasInfo {
		t.Errorf("cookie sesi tidak lengkap (session=%v user_info=%v)", hasSession, hasInfo)
	}
}

func TestGoogleCompleteLinksExistingParentAccount(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	// Akun ortu lama berbasis nomor HP, sudah tertaut ke st-2.
	if _, err := db.Exec(`
		INSERT INTO users (id, name, username, role, is_active, created_at, updated_at)
		VALUES ('ortu-lama', 'Ibu Siti', '081234567890', 'orangtua', 1, 1, 1);
		INSERT INTO parent_students (id, user_id, student_id, relation, is_active)
		VALUES ('ps-1', 'ortu-lama', 'st-2', 'orangtua', 1);
	`); err != nil {
		t.Fatalf("seed ortu lama: %v", err)
	}

	e := echo.New()
	ticket := signTestTicket(t, "google-sub-2", "siti@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567891","birthDate":"2015-06-02"}`)
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})

	if err := h.GoogleComplete(ctx); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}

	// Tidak boleh ada akun baru.
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM users WHERE role = 'orangtua'`).Scan(&count); err != nil {
		t.Fatalf("hitung akun: %v", err)
	}
	if count != 1 {
		t.Errorf("akun ortu bertambah (total %d), seharusnya ditautkan ke akun lama", count)
	}

	var linkedUser string
	if err := db.QueryRow(`SELECT user_id FROM user_identities WHERE provider_user_id = 'google-sub-2'`).Scan(&linkedUser); err != nil {
		t.Fatalf("identitas tidak tersimpan: %v", err)
	}
	if linkedUser != "ortu-lama" {
		t.Errorf("identitas tertaut ke %q, ingin ortu-lama", linkedUser)
	}

	// Akun lama (tanpa email) harus mendapat email Google agar bisa dipakai
	// reset password dan tidak menyisakan akun tanpa alamat.
	var filledEmail string
	if err := db.QueryRow(`SELECT email FROM users WHERE id = 'ortu-lama'`).Scan(&filledEmail); err != nil {
		t.Fatalf("cek email akun lama: %v", err)
	}
	if filledEmail != "siti@example.com" {
		t.Errorf("email akun lama = %q, ingin siti@example.com", filledEmail)
	}
}

func TestGoogleCompleteFillsEmailOnLegacyParent(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	// Akun ortu lama tanpa email, tertaut ke st-2.
	if _, err := db.Exec(`
		INSERT INTO users (id, name, username, role, is_active, created_at, updated_at)
		VALUES ('ortu-lama2', 'Bapak Budi', '081222222222', 'orangtua', 1, 1, 1);
		INSERT INTO parent_students (id, user_id, student_id, relation, is_active)
		VALUES ('ps-2', 'ortu-lama2', 'st-2', 'orangtua', 1);
	`); err != nil {
		t.Fatalf("seed ortu lama: %v", err)
	}

	e := echo.New()
	ticket := signTestTicket(t, "google-sub-6", "budi@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567891","birthDate":"2015-06-02"}`)
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})

	if err := h.GoogleComplete(ctx); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}

	var email, image sql.NullString
	var verified sql.NullInt64
	if err := db.QueryRow(`SELECT email, image, email_verified FROM users WHERE id = 'ortu-lama2'`).
		Scan(&email, &image, &verified); err != nil {
		t.Fatalf("cek akun: %v", err)
	}
	if email.String != "budi@example.com" {
		t.Errorf("email = %q, ingin budi@example.com", email.String)
	}
	if verified.Int64 == 0 {
		t.Errorf("email_verified belum diisi")
	}
}

func TestGoogleCompleteRejectsAdminEmail(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	ticket := signTestTicket(t, "google-sub-3", "admin@sekolah.sch.id", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-05-01"}`)
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})

	if err := h.GoogleComplete(ctx); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec.Code != http.StatusConflict {
		t.Fatalf("ingin 409 untuk email admin, dapat %d: %s", rec.Code, rec.Body.String())
	}

	// Tidak boleh ada identitas yang tertaut ke akun admin.
	var ident int
	if err := db.QueryRow(`SELECT COUNT(*) FROM user_identities`).Scan(&ident); err != nil {
		t.Fatalf("cek identitas: %v", err)
	}
	if ident != 0 {
		t.Errorf("identitas tetap dibuat untuk email admin")
	}
}

func TestGoogleCompleteRejectsInvalidTicket(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()

	// Tiket kedaluwarsa.
	expired := signTestTicket(t, "google-sub-4", "exp@example.com", time.Now().Add(-time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-05-01"}`)
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: expired})
	if err := h.GoogleComplete(ctx); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("tiket kedaluwarsa: ingin 400, dapat %d", rec.Code)
	}

	// Tanpa cookie tiket.
	ctx2, rec2 := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-05-01"}`)
	if err := h.GoogleComplete(ctx2); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec2.Code != http.StatusBadRequest {
		t.Errorf("tanpa tiket: ingin 400, dapat %d", rec2.Code)
	}

	// Tiket bertanda tangan salah (JWT_SECRET berbeda).
	otherToken, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"typ": googleTicketTyp, "sub": "x", "email": "x@example.com",
		"exp": time.Now().Add(time.Minute).Unix(),
	}).SignedString([]byte("secret-lain"))
	ctx3, rec3 := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-05-01"}`)
	ctx3.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: otherToken})
	if err := h.GoogleComplete(ctx3); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec3.Code != http.StatusBadRequest {
		t.Errorf("tiket palsu: ingin 400, dapat %d", rec3.Code)
	}
}

func TestGoogleCompleteRejectsWrongStudentData(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	ticket := signTestTicket(t, "google-sub-5", "ortu2@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-01-01"}`)
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})

	if err := h.GoogleComplete(ctx); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec.Code != http.StatusNotFound {
		t.Fatalf("ingin 404 untuk data siswa salah, dapat %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGoogleCallbackRejectsStateMismatch(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=abc&code=xyz", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "beda"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusBadRequest {
		t.Errorf("state tidak cocok: ingin 400, dapat %d", rec.Code)
	}
}

func TestGoogleCallbackRejectsUnverifiedEmail(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	// Mock endpoint token + userinfo.
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok", "token_type": "Bearer"})
	}))
	defer tokenSrv.Close()
	infoSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"sub": "g-1", "email": "belum@example.com", "email_verified": false, "name": "Belum Verifikasi",
		})
	}))
	defer infoSrv.Close()

	origToken, origInfo := googleTokenURL, googleUserInfoURL
	googleTokenURL, googleUserInfoURL = tokenSrv.URL, infoSrv.URL
	defer func() { googleTokenURL, googleUserInfoURL = origToken, origInfo }()

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s1&code=c1", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s1"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("email belum terverifikasi: ingin 403, dapat %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGoogleCallbackExistingIdentityLogsIn(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok", "token_type": "Bearer"})
	}))
	defer tokenSrv.Close()
	infoSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"sub": "g-known", "email": "known@example.com", "email_verified": true, "name": "Ortu Dikenal",
		})
	}))
	defer infoSrv.Close()

	origToken, origInfo := googleTokenURL, googleUserInfoURL
	googleTokenURL, googleUserInfoURL = tokenSrv.URL, infoSrv.URL
	defer func() { googleTokenURL, googleUserInfoURL = origToken, origInfo }()

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('ortu-known', 'Ortu Dikenal', 'known@example.com', 'orangtua', 1, 1, 1);
		INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, email_verified)
		VALUES ('ident-1', 'ortu-known', 'google', 'g-known', 'known@example.com', 1);
	`); err != nil {
		t.Fatalf("seed identitas: %v", err)
	}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s2&code=c2", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s2"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusFound {
		t.Fatalf("ingin 302, dapat %d: %s", rec.Code, rec.Body.String())
	}
	if loc := rec.Header().Get("Location"); loc != googleParentHome {
		t.Errorf("redirect = %q, ingin %q", loc, googleParentHome)
	}
	var hasSession bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == "session" && c.Value != "" {
			hasSession = true
		}
	}
	if !hasSession {
		t.Errorf("sesi tidak diterbitkan untuk identitas yang sudah tertaut")
	}
}

func TestGoogleCallbackNewIdentityRedirectsToComplete(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
	}))
	defer tokenSrv.Close()
	infoSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		// email_verified sebagai string, seperti sebagian respons Google.
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"sub": "g-new", "email": "baru@example.com", "email_verified": "true", "name": "Ortu Baru",
		})
	}))
	defer infoSrv.Close()

	origToken, origInfo := googleTokenURL, googleUserInfoURL
	googleTokenURL, googleUserInfoURL = tokenSrv.URL, infoSrv.URL
	defer func() { googleTokenURL, googleUserInfoURL = origToken, origInfo }()

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s3&code=c3", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s3"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusFound {
		t.Fatalf("ingin 302, dapat %d: %s", rec.Code, rec.Body.String())
	}
	if loc := rec.Header().Get("Location"); loc != googleDefaultPage {
		t.Errorf("redirect = %q, ingin %q", loc, googleDefaultPage)
	}
	var ticket string
	for _, c := range rec.Result().Cookies() {
		if c.Name == googleTicketCookie {
			ticket = c.Value
		}
	}
	if ticket == "" {
		t.Fatalf("cookie tiket Google tidak diset")
	}
	claims, ok := parseGoogleTicket(ticket)
	if !ok {
		t.Fatalf("tiket tidak valid")
	}
	if claims["sub"] != "g-new" {
		t.Errorf("sub tiket = %v, ingin g-new", claims["sub"])
	}

	// Tiket yang sama harus bisa diselesaikan.
	ctx2, rec2 := newJSONContext(e, http.MethodPost, "/api/auth/google/complete",
		`{"nisn":"1234567890","birthDate":"2015-05-01"}`)
	ctx2.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})
	if err := h.GoogleComplete(ctx2); err != nil {
		t.Fatalf("GoogleComplete error: %v", err)
	}
	if rec2.Code != http.StatusOK {
		t.Fatalf("complete: ingin 200, dapat %d: %s", rec2.Code, rec2.Body.String())
	}
}

func TestGoogleLinkRejectsForeignIdentity(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('ortu-a', 'Ortu A', 'a@example.com', 'orangtua', 1, 1, 1),
		       ('ortu-b', 'Ortu B', 'b@example.com', 'orangtua', 1, 1, 1);
		INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, email_verified)
		VALUES ('ident-b', 'ortu-b', 'google', 'g-b', 'b@example.com', 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ticket := signTestTicket(t, "g-b", "b@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/link", "")
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})
	ctx.Set("user_id", "ortu-a")
	ctx.Set("user_role", "orangtua")

	if err := h.GoogleLink(ctx); err != nil {
		t.Fatalf("GoogleLink error: %v", err)
	}
	if rec.Code != http.StatusConflict {
		t.Fatalf("ingin 409 (identitas milik akun lain), dapat %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGoogleLinkAttachesIdentityToSessionUser(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, username, role, is_active, created_at, updated_at)
		VALUES ('ortu-hp', 'Ortu HP', '081111111111', 'orangtua', 1, 1, 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ticket := signTestTicket(t, "g-hp", "hp@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/link", "")
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})
	ctx.Set("user_id", "ortu-hp")
	ctx.Set("user_role", "orangtua")

	if err := h.GoogleLink(ctx); err != nil {
		t.Fatalf("GoogleLink error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}

	var linkedUser string
	if err := db.QueryRow(`SELECT user_id FROM user_identities WHERE provider_user_id = 'g-hp'`).Scan(&linkedUser); err != nil {
		t.Fatalf("identitas tidak tersimpan: %v", err)
	}
	if linkedUser != "ortu-hp" {
		t.Errorf("identitas tertaut ke %q, ingin ortu-hp", linkedUser)
	}
}

func TestGoogleStatusDisabledWithoutCredentials(t *testing.T) {
	os.Unsetenv("GOOGLE_CLIENT_ID")
	os.Unsetenv("GOOGLE_CLIENT_SECRET")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/status", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleStatus(ctx); err != nil {
		t.Fatalf("GoogleStatus error: %v", err)
	}
	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp["enabled"] != false {
		t.Errorf("enabled = %v, ingin false tanpa kredensial", resp["enabled"])
	}
}

func TestGoogleStartSetsStateCookie(t *testing.T) {
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	os.Setenv("OAUTH_PUBLIC_BASE_URL", "https://sdn1kenanga.sch.id")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")
	defer os.Unsetenv("OAUTH_PUBLIC_BASE_URL")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/start?redirect=/parent/tabungan", nil)
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleStart(ctx); err != nil {
		t.Fatalf("GoogleStart error: %v", err)
	}
	if rec.Code != http.StatusFound {
		t.Fatalf("ingin 302, dapat %d: %s", rec.Code, rec.Body.String())
	}

	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("parse Location: %v", err)
	}
	if !strings.HasPrefix(loc.String(), googleAuthURL) {
		t.Errorf("redirect bukan ke Google: %s", loc.String())
	}
	q := loc.Query()
	if q.Get("redirect_uri") != "https://sdn1kenanga.sch.id/api/auth/google/callback" {
		t.Errorf("redirect_uri = %q", q.Get("redirect_uri"))
	}
	if q.Get("scope") != "openid email profile" {
		t.Errorf("scope = %q", q.Get("scope"))
	}

	var state, redirect string
	for _, c := range rec.Result().Cookies() {
		switch c.Name {
		case googleStateCookie:
			state = c.Value
			if !c.HttpOnly {
				t.Errorf("cookie state harus HttpOnly")
			}
		case "oauth_redirect":
			redirect = c.Value
		}
	}
	if state == "" {
		t.Fatalf("cookie state tidak diset")
	}
	if q.Get("state") != state {
		t.Errorf("state di URL (%q) != cookie (%q)", q.Get("state"), state)
	}
	if decoded, _ := url.QueryUnescape(redirect); decoded != "/parent/tabungan" {
		t.Errorf("oauth_redirect = %q", decoded)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Google untuk SEMUA role (auto-taut berdasarkan email)
// ─────────────────────────────────────────────────────────────────────────────

func TestGoogleHomeForRole(t *testing.T) {
	cases := map[string]string{
		"staff":      "/inventaris",
		"orangtua":   "/parent",
		"admin":      "/overview",
		"superadmin": "/overview",
		"guru":       "/overview",
		"siswa":      "/overview",
	}
	for role, want := range cases {
		if got := googleHomeForRole(role); got != want {
			t.Errorf("googleHomeForRole(%q) = %q, ingin %q", role, got, want)
		}
	}
}

// googleMockServer menyiapkan mock endpoint token + userinfo Google.
func googleMockServer(t *testing.T, sub, email, name string) {
	t.Helper()
	tokenSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "tok"})
	}))
	t.Cleanup(tokenSrv.Close)
	infoSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"sub": sub, "email": email, "email_verified": true, "name": name,
		})
	}))
	t.Cleanup(infoSrv.Close)

	origToken, origInfo := googleTokenURL, googleUserInfoURL
	googleTokenURL, googleUserInfoURL = tokenSrv.URL, infoSrv.URL
	t.Cleanup(func() { googleTokenURL, googleUserInfoURL = origToken, origInfo })
}

func TestGoogleCallbackAutoLinksStaffByEmail(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	googleMockServer(t, "g-staff", "guru@sekolah.sch.id", "Guru Uji")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('guru-1', 'Guru Uji', 'guru@sekolah.sch.id', 'guru', 1, 1, 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s3&code=c3", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s3"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusFound {
		t.Fatalf("ingin 302 (auto-taut), dapat %d: %s", rec.Code, rec.Body.String())
	}
	if loc := rec.Header().Get("Location"); loc != "/overview" {
		t.Errorf("redirect = %q, ingin /overview (dashboard guru)", loc)
	}

	var linkedUser string
	if err := db.QueryRow(`SELECT user_id FROM user_identities WHERE provider_user_id = 'g-staff'`).Scan(&linkedUser); err != nil {
		t.Fatalf("identitas tidak tersimpan: %v", err)
	}
	if linkedUser != "guru-1" {
		t.Errorf("identitas tertaut ke %q, ingin guru-1", linkedUser)
	}

	var hasSession bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == "session" && c.Value != "" {
			hasSession = true
		}
	}
	if !hasSession {
		t.Errorf("sesi tidak diterbitkan setelah auto-taut")
	}
}

func TestGoogleCallbackAutoLinkRedirectsToRoleHome(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	googleMockServer(t, "g-staff2", "staf@sekolah.sch.id", "Staf Uji")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('staf-1', 'Staf Uji', 'staf@sekolah.sch.id', 'staff', 1, 1, 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s4&code=c4", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s4"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if loc := rec.Header().Get("Location"); loc != "/inventaris" {
		t.Errorf("redirect role staff = %q, ingin /inventaris", loc)
	}
}

func TestGoogleCallbackRejectsStudentEmailMatch(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	googleMockServer(t, "g-siswa", "3181171148@sekolahku.id", "Siswa Uji")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('siswa-1', 'Siswa Uji', '3181171148@sekolahku.id', 'siswa', 1, 1, 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s5&code=c5", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s5"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusForbidden {
		t.Fatalf("akun siswa tidak boleh auto-taut: ingin 403, dapat %d: %s", rec.Code, rec.Body.String())
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM user_identities`).Scan(&count); err != nil {
		t.Fatalf("hitung identitas: %v", err)
	}
	if count != 0 {
		t.Errorf("identitas tetap dibuat untuk akun siswa: %d baris", count)
	}
}

func TestGoogleCallbackAutoLinkConflictWhenAlreadyLinked(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	os.Setenv("GOOGLE_CLIENT_ID", "client-id")
	os.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")
	defer os.Unsetenv("GOOGLE_CLIENT_ID")
	defer os.Unsetenv("GOOGLE_CLIENT_SECRET")

	googleMockServer(t, "g-lain", "guru2@sekolah.sch.id", "Guru Dua")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('guru-2', 'Guru Dua', 'guru2@sekolah.sch.id', 'guru', 1, 1, 1);
		INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, email_verified)
		VALUES ('ident-lama', 'guru-2', 'google', 'g-sebelumnya', 'guru2@sekolah.sch.id', 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?state=s6&code=c6", nil)
	req.AddCookie(&http.Cookie{Name: googleStateCookie, Value: "s6"})
	rec := httptest.NewRecorder()
	ctx := e.NewContext(req, rec)

	if err := h.GoogleCallback(ctx); err != nil {
		t.Fatalf("GoogleCallback error: %v", err)
	}
	if rec.Code != http.StatusConflict {
		t.Fatalf("akun sudah tertaut Google lain: ingin 409, dapat %d: %s", rec.Code, rec.Body.String())
	}
}

func TestGoogleLinkAllowsStaffRoleAndFillsEmail(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, username, role, is_active, created_at, updated_at)
		VALUES ('staf-hp', 'Staf HP', '081222222222', 'staff', 1, 1, 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ticket := signTestTicket(t, "g-staf-hp", "stafhp@example.com", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodPost, "/api/auth/google/link", "")
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})
	ctx.Set("user_id", "staf-hp")
	ctx.Set("user_role", "staff")

	if err := h.GoogleLink(ctx); err != nil {
		t.Fatalf("GoogleLink error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("role staff harus boleh menautkan: ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}

	var linkedUser string
	if err := db.QueryRow(`SELECT user_id FROM user_identities WHERE provider_user_id = 'g-staf-hp'`).Scan(&linkedUser); err != nil {
		t.Fatalf("identitas tidak tersimpan: %v", err)
	}
	if linkedUser != "staf-hp" {
		t.Errorf("identitas tertaut ke %q, ingin staf-hp", linkedUser)
	}

	// Email akun yang sebelumnya kosong harus terisi dari Google.
	var email sql.NullString
	if err := db.QueryRow(`SELECT email FROM users WHERE id = 'staf-hp'`).Scan(&email); err != nil {
		t.Fatalf("baca email: %v", err)
	}
	if email.String != "stafhp@example.com" {
		t.Errorf("email akun = %q, ingin stafhp@example.com", email.String)
	}
}

func TestGooglePendingReportsMatchedRole(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, is_active, created_at, updated_at)
		VALUES ('guru-3', 'Guru Tiga', 'guru3@sekolah.sch.id', 'guru', 1, 1, 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ticket := signTestTicket(t, "g-pending", "guru3@sekolah.sch.id", time.Now().Add(10*time.Minute))
	ctx, rec := newJSONContext(e, http.MethodGet, "/api/auth/google/pending", "")
	ctx.Request().AddCookie(&http.Cookie{Name: googleTicketCookie, Value: ticket})

	if err := h.GooglePending(ctx); err != nil {
		t.Fatalf("GooglePending error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		MatchedRole string `json:"matchedRole"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.MatchedRole != "guru" {
		t.Errorf("matchedRole = %q, ingin guru", resp.MatchedRole)
	}
}

func TestGoogleLinkStatusReportsLinkedAccount(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, password_hash, is_active, created_at, updated_at)
		VALUES ('staf-2', 'Staf Dua', 'staf2@example.com', 'staff', 'x', 1, 1, 1);
		INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, email_verified)
		VALUES ('ident-s2', 'staf-2', 'google', 'g-staf-2', 'staf2@example.com', 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ctx, rec := newJSONContext(e, http.MethodGet, "/api/auth/google/link", "")
	ctx.Set("user_id", "staf-2")
	ctx.Set("user_role", "staff")

	if err := h.GoogleLinkStatus(ctx); err != nil {
		t.Fatalf("GoogleLinkStatus error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct {
		Linked bool   `json:"linked"`
		Email  string `json:"email"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !resp.Linked || resp.Email != "staf2@example.com" {
		t.Errorf("linked=%v email=%q, ingin true + staf2@example.com", resp.Linked, resp.Email)
	}
}

func TestGoogleUnlinkRemovesIdentity(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, password_hash, is_active, created_at, updated_at)
		VALUES ('guru-4', 'Guru Empat', 'guru4@example.com', 'guru', 'x', 1, 1, 1);
		INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, email_verified)
		VALUES ('ident-g4', 'guru-4', 'google', 'g-guru-4', 'guru4@example.com', 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ctx, rec := newJSONContext(e, http.MethodDelete, "/api/auth/google/link", "")
	ctx.Set("user_id", "guru-4")
	ctx.Set("user_role", "guru")

	if err := h.GoogleUnlink(ctx); err != nil {
		t.Fatalf("GoogleUnlink error: %v", err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("ingin 200, dapat %d: %s", rec.Code, rec.Body.String())
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM user_identities WHERE user_id = 'guru-4'`).Scan(&count); err != nil {
		t.Fatalf("hitung identitas: %v", err)
	}
	if count != 0 {
		t.Errorf("identitas belum dilepas: %d baris", count)
	}
}

func TestGoogleUnlinkRejectsAccountWithoutPassword(t *testing.T) {
	os.Setenv("JWT_SECRET", "test-secret-key")
	os.Setenv("COOKIE_SECURE", "false")
	defer os.Unsetenv("JWT_SECRET")
	defer os.Unsetenv("COOKIE_SECURE")

	h, db := newGoogleTestHandler(t)
	defer db.Close()

	if _, err := db.Exec(`
		INSERT INTO users (id, name, email, role, password_hash, is_active, created_at, updated_at)
		VALUES ('ortu-g', 'Ortu Google', 'ortug@example.com', 'orangtua', NULL, 1, 1, 1);
		INSERT INTO user_identities (id, user_id, provider, provider_user_id, email, email_verified)
		VALUES ('ident-og', 'ortu-g', 'google', 'g-ortu-g', 'ortug@example.com', 1);
	`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	e := echo.New()
	ctx, rec := newJSONContext(e, http.MethodDelete, "/api/auth/google/link", "")
	ctx.Set("user_id", "ortu-g")
	ctx.Set("user_role", "orangtua")

	if err := h.GoogleUnlink(ctx); err != nil {
		t.Fatalf("GoogleUnlink error: %v", err)
	}
	if rec.Code != http.StatusConflict {
		t.Fatalf("akun tanpa password tidak boleh dilepas: ingin 409, dapat %d: %s", rec.Code, rec.Body.String())
	}
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM user_identities WHERE user_id = 'ortu-g'`).Scan(&count); err != nil {
		t.Fatalf("hitung identitas: %v", err)
	}
	if count != 1 {
		t.Errorf("identitas ikut terhapus: %d baris", count)
	}
}
