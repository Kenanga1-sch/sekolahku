package handlers

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/sekolahku/go-backend/internal/models"
	"github.com/sekolahku/go-backend/internal/repository"
)

type BankSoalHandler struct {
	Repo         *repository.BankSoalRepository
	AssignmentRepo *repository.ExamAssignmentRepository
}

func NewBankSoalHandler(repo *repository.BankSoalRepository, assignmentRepo *repository.ExamAssignmentRepository) *BankSoalHandler {
	return &BankSoalHandler{Repo: repo, AssignmentRepo: assignmentRepo}
}

func parsePageLimit(c echo.Context) (int, int) {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	return page, limit
}

// ══════════════════════════════════════════════════════════
// BAB
// ══════════════════════════════════════════════════════════

func (h *BankSoalHandler) ListBabs(c echo.Context) error {
	page, limit := parsePageLimit(c)
	subjectID := c.QueryParam("subjectId")
	classID := c.QueryParam("classId")
	kurikulumID := c.QueryParam("kurikulumId")

	babs, total, err := h.Repo.ListBabs(subjectID, classID, kurikulumID, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat daftar bab",
		})
	}
	if babs == nil {
		babs = []models.Bab{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    babs,
		"total":   total,
	})
}

func (h *BankSoalHandler) GetBab(c echo.Context) error {
	id := c.Param("id")
	bab, err := h.Repo.GetBab(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Bab tidak ditemukan",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    bab,
	})
}

func (h *BankSoalHandler) CreateBab(c echo.Context) error {
	var req models.CreateBabRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.SubjectID == "" || req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Mata pelajaran dan judul wajib diisi",
		})
	}

	userID := c.Get("user_id").(string)
	bab, err := h.Repo.CreateBab(&req, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat bab",
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    bab,
	})
}

func (h *BankSoalHandler) UpdateBab(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateBabRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}

	bab, err := h.Repo.UpdateBab(id, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memperbarui bab",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    bab,
	})
}

func (h *BankSoalHandler) DeleteBab(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteBab(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus bab",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Bab berhasil dihapus",
	})
}

func (h *BankSoalHandler) ReorderBabs(c echo.Context) error {
	var req struct {
		OrderedIDs []string `json:"orderedIds"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if len(req.OrderedIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Daftar urutan bab kosong",
		})
	}
	if err := h.Repo.ReorderBabs(req.OrderedIDs); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengubah urutan bab",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Urutan bab berhasil diperbarui",
	})
}

// ══════════════════════════════════════════════════════════
// QUESTION BANK
// ══════════════════════════════════════════════════════════

func (h *BankSoalHandler) ListBanks(c echo.Context) error {
	page, limit := parsePageLimit(c)
	subjectID := c.QueryParam("subjectId")
	classID := c.QueryParam("classId")
	kurikulumID := c.QueryParam("kurikulumId")
	search := c.QueryParam("q")

	banks, total, err := h.Repo.ListBanks(subjectID, classID, kurikulumID, search, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat daftar bank soal",
		})
	}
	if banks == nil {
		banks = []models.QuestionBank{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    banks,
		"total":   total,
	})
}

func (h *BankSoalHandler) GetBank(c echo.Context) error {
	id := c.Param("id")
	bank, err := h.Repo.GetBank(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Bank soal tidak ditemukan",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    bank,
	})
}

func (h *BankSoalHandler) CreateBank(c echo.Context) error {
	var req models.CreateQuestionBankRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.SubjectID == "" || req.Title == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Mata pelajaran dan judul wajib diisi",
		})
	}

	userID := c.Get("user_id").(string)
	bank, err := h.Repo.CreateBank(&req, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat bank soal",
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    bank,
	})
}

func (h *BankSoalHandler) DeleteBank(c echo.Context) error {
	id := c.Param("id")

	// Cegah bank yatim: tolak jika masih ada soal aktif.
	count, err := h.Repo.CountQuestionsInBank(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengecek isi bank soal",
		})
	}
	if count > 0 {
		return c.JSON(http.StatusConflict, map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("Masih ada %d soal di bank ini. Hapus atau pindahkan soal terlebih dahulu sebelum menghapus bank.", count),
		})
	}

	if err := h.Repo.DeleteBank(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus bank soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Bank soal berhasil dihapus",
	})
}

// ══════════════════════════════════════════════════════════
// QUESTIONS
// ══════════════════════════════════════════════════════════

func (h *BankSoalHandler) ListQuestions(c echo.Context) error {
	page, limit := parsePageLimit(c)
	bankID := c.QueryParam("bankId")
	qType := c.QueryParam("type")
	difficulty := c.QueryParam("difficulty")
	bloomLevel := c.QueryParam("bloomLevel")
	tag := c.QueryParam("tag")

	questions, total, err := h.Repo.ListQuestions(bankID, qType, difficulty, bloomLevel, tag, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat daftar soal",
		})
	}
	if questions == nil {
		questions = []models.Question{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    questions,
		"total":   total,
	})
}

func (h *BankSoalHandler) GetQuestion(c echo.Context) error {
	id := c.Param("id")
	q, err := h.Repo.GetQuestion(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Soal tidak ditemukan",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    q,
	})
}

func (h *BankSoalHandler) CreateQuestion(c echo.Context) error {
	var req models.CreateQuestionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.BankID == "" || req.Content == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Bank soal dan konten soal wajib diisi",
		})
	}
	if req.Type == "" {
		req.Type = "pg_single"
	}
	if req.Points < 1 {
		req.Points = 1
	}
	if req.Difficulty == "" {
		req.Difficulty = "medium"
	}

	payload := buildQuestionPayload(&req)
	if payload.Options != "" {
		s := payload.Options
		req.Options = &s
	}
	if payload.CorrectAnswer != "" {
		s := payload.CorrectAnswer
		req.CorrectAnswer = &s
	}

	userID := c.Get("user_id").(string)
	req.CreatedBy = userID
	q, err := h.Repo.CreateQuestion(&req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat soal",
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    q,
	})
}

func (h *BankSoalHandler) UpdateQuestion(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateQuestionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}

	// Normalisasi options & correctAnswer jika ada perubahan
	if req.Options != nil || req.CorrectAnswer != nil {
		// Ambil tipe soal saat ini (atau dari request jika berubah)
		qType := ""
		if req.Type != nil {
			qType = *req.Type
		}
		if qType == "" {
			existing, err := h.Repo.GetQuestion(id)
			if err == nil {
				qType = existing.Type
			}
		}
		creq := &models.CreateQuestionRequest{
			Type:          qType,
			Options:       req.Options,
			CorrectAnswer: req.CorrectAnswer,
		}
		payload := buildQuestionPayload(creq)
		if payload.Options != "" {
			s := payload.Options
			req.Options = &s
		}
		if payload.CorrectAnswer != "" {
			s := payload.CorrectAnswer
			req.CorrectAnswer = &s
		}
	}

	q, err := h.Repo.UpdateQuestion(id, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memperbarui soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    q,
	})
}

func (h *BankSoalHandler) DeleteQuestion(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteQuestion(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Soal berhasil dihapus",
	})
}

func (h *BankSoalHandler) BulkDeleteQuestions(c echo.Context) error {
	var req struct {
		IDs []string `json:"ids"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if len(req.IDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Tidak ada soal yang dipilih",
		})
	}

	if err := h.Repo.BulkDeleteQuestions(req.IDs); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Soal berhasil dihapus",
	})
}

// ══════════════════════════════════════════════════════════
// QUESTION SETS (Paket Soal)
// ══════════════════════════════════════════════════════════

func (h *BankSoalHandler) ListSets(c echo.Context) error {
	page, limit := parsePageLimit(c)
	bankID := c.QueryParam("bankId")
	search := c.QueryParam("q")

	sets, total, err := h.Repo.ListSets(bankID, search, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat daftar paket soal",
		})
	}
	if sets == nil {
		sets = []models.QuestionSet{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    sets,
		"total":   total,
	})
}

func (h *BankSoalHandler) GetSet(c echo.Context) error {
	id := c.Param("id")
	set, err := h.Repo.GetSet(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Paket soal tidak ditemukan",
		})
	}
	if h.AssignmentRepo != nil {
		if assignments, err := h.AssignmentRepo.ListBySet(id); err == nil {
			set.AssignedClasses = assignments
		}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    set,
	})
}

// ListSetsForStudent mengembalikan paket yang boleh diakses siswa yang login:
// latihan (semua) + ujian yang kelasnya ditugaskan. Dilengkapi status attempt.
func (h *BankSoalHandler) ListSetsForStudent(c echo.Context) error {
	studentID, err := h.resolveStudentID(c)
	if err != nil || studentID == "" {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Data siswa tidak ditemukan",
		})
	}

	sets, err := h.Repo.ListSetsForStudent(studentID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat daftar paket soal",
		})
	}
	if sets == nil {
		sets = []models.QuestionSet{}
	}

	// Sertakan jumlah attempt yang sudah dipakai per paket.
	used := map[string]int{}
	for _, s := range sets {
		if n, err := h.Repo.CountAttempts(studentID, s.ID); err == nil {
			used[s.ID] = n
		}
	}

	data := make([]map[string]interface{}, 0, len(sets))
	for _, s := range sets {
		data = append(data, map[string]interface{}{
			"set":          s,
			"attemptsUsed": used[s.ID],
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    data,
	})
}

// GetSetAnalytics mengembalikan analitik performa paket.
func (h *BankSoalHandler) GetSetAnalytics(c echo.Context) error {
	setID := c.Param("id")
	analytics, err := h.Repo.GetSetAnalytics(setID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat analitik",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    analytics,
	})
}

// ListAssignments mengembalikan daftar kelas yang ditugaskan ke paket.
func (h *BankSoalHandler) ListAssignments(c echo.Context) error {
	setID := c.Param("id")
	assignments, err := h.AssignmentRepo.ListBySet(setID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat penugasan",
		})
	}
	if assignments == nil {
		assignments = []models.ExamAssignment{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    assignments,
	})
}

// AssignClasses mengganti daftar kelas yang ditugaskan ke paket ujian.
func (h *BankSoalHandler) AssignClasses(c echo.Context) error {
	setID := c.Param("id")
	var req models.AssignClassesRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}

	set, err := h.Repo.GetSet(setID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Paket soal tidak ditemukan",
		})
	}
	if set.Mode != "ujian" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Hanya paket mode ujian yang dapat ditugaskan ke kelas",
		})
	}

	userID, _ := c.Get("user_id").(string)
	if err := h.AssignmentRepo.ReplaceForSet(setID, req.ClassIDs, userID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menyimpan penugasan",
		})
	}

	assignments, _ := h.AssignmentRepo.ListBySet(setID)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    assignments,
	})
}

func (h *BankSoalHandler) CreateSet(c echo.Context) error {
	var req models.CreateQuestionSetRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.Name == "" || req.BankID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Nama paket dan bank soal wajib diisi",
		})
	}

	userID := c.Get("user_id").(string)
	set, err := h.Repo.CreateSet(&req, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal membuat paket soal",
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    set,
	})
}

func (h *BankSoalHandler) UpdateSet(c echo.Context) error {
	id := c.Param("id")
	var req models.UpdateQuestionSetRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}

	set, err := h.Repo.UpdateSet(id, &req)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memperbarui paket soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    set,
	})
}

func (h *BankSoalHandler) DeleteSet(c echo.Context) error {
	id := c.Param("id")
	if err := h.Repo.DeleteSet(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus paket soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Paket soal berhasil dihapus",
	})
}

// ══════════════════════════════════════════════════════════
// QUESTION SET ITEMS
// ══════════════════════════════════════════════════════════

func (h *BankSoalHandler) ListSetItems(c echo.Context) error {
	setID := c.Param("id")
	items, err := h.Repo.ListSetItems(setID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat isi paket soal",
		})
	}
	if items == nil {
		items = []models.QuestionSetItem{}
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    items,
	})
}

func (h *BankSoalHandler) AddSetItem(c echo.Context) error {
	setID := c.Param("id")
	var req models.AddSetItemRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.QuestionID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Question ID wajib diisi",
		})
	}

	item, err := h.Repo.AddSetItem(setID, req.QuestionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menambahkan soal ke paket",
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    item,
	})
}

func (h *BankSoalHandler) BulkAddSetItems(c echo.Context) error {
	setID := c.Param("id")
	var req models.BulkAddSetItemsRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if len(req.QuestionIDs) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Tidak ada soal yang dipilih",
		})
	}

	if err := h.Repo.BulkAddSetItems(setID, req.QuestionIDs); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menambahkan soal ke paket",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Soal berhasil ditambahkan ke paket",
	})
}

func (h *BankSoalHandler) RemoveSetItem(c echo.Context) error {
	setID := c.Param("id")
	questionID := c.Param("questionId")

	if err := h.Repo.RemoveSetItem(setID, questionID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menghapus soal dari paket",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Soal berhasil dihapus dari paket",
	})
}

func (h *BankSoalHandler) ReorderSetItems(c echo.Context) error {
	setID := c.Param("id")
	// Frontend mengirim `questionIds`; `orderedIds` dipertahankan agar
	// klien lama tetap kompatibel.
	var req struct {
		QuestionIDs []string `json:"questionIds"`
		OrderedIDs  []string `json:"orderedIds"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}

	ids := req.QuestionIDs
	if len(ids) == 0 {
		ids = req.OrderedIDs
	}
	if len(ids) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Daftar urutan soal kosong",
		})
	}

	if err := h.Repo.ReorderSetItems(setID, ids); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal mengubah urutan soal",
		})
	}
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Urutan soal berhasil diperbarui",
	})
}

// ══════════════════════════════════════════════════════════
// STUDENT PRACTICES
// ══════════════════════════════════════════════════════════

// resolveStudentID memetakan user_id dari JWT ke student_id di tabel users.
func (h *BankSoalHandler) resolveStudentID(c echo.Context) (string, error) {
	userID, _ := c.Get("user_id").(string)
	if userID == "" {
		return "", fmt.Errorf("unauthorized")
	}
	return h.Repo.GetStudentIDByUserID(userID)
}

func (h *BankSoalHandler) ListPractices(c echo.Context) error {
	page, limit := parsePageLimit(c)
	studentID := c.QueryParam("studentId")
	setID := c.QueryParam("setId")

	// Siswa hanya boleh melihat praktiknya sendiri.
	if role, _ := c.Get("user_role").(string); role == "siswa" {
		sid, err := h.resolveStudentID(c)
		if err != nil || sid == "" {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Data siswa tidak ditemukan",
			})
		}
		studentID = sid
	}

	practices, total, err := h.Repo.ListPractices(studentID, setID, page, limit)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat data praktik",
		})
	}
	if practices == nil {
		practices = []models.StudentPractice{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    practices,
		"total":   total,
	})
}

func (h *BankSoalHandler) CreatePractice(c echo.Context) error {
	var req struct {
		SetID string `json:"setId"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.SetID == "" {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Set ID wajib diisi",
		})
	}

	studentID, err := h.resolveStudentID(c)
	if err != nil || studentID == "" {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Data siswa tidak ditemukan",
		})
	}

	// Muat set & validasi (mode/jadwal/attempt).
	set, err := h.Repo.GetSet(req.SetID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Paket soal tidak ditemukan",
		})
	}

	now := time.Now()
	if set.Mode == "ujian" {
		// Akses hanya bila kelas siswa ditugaskan.
		assignments, _ := h.AssignmentRepo.ListBySet(set.ID)
		if len(assignments) == 0 {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Ujian ini belum ditugaskan ke kelas mana pun",
			})
		}
		classID, _ := h.Repo.GetStudentClassID(studentID)
		allowed := false
		for _, a := range assignments {
			if a.ClassID == classID && classID != "" {
				allowed = true
				break
			}
		}
		if !allowed {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Ujian ini tidak ditugaskan untuk kelas Anda",
			})
		}
	}

	// Window jadwal (berlaku untuk mode ujian maupun latihan bila diisi).
	if set.AvailableFrom != nil && now.Before(*set.AvailableFrom) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Ujian belum dimulai",
		})
	}
	if set.AvailableUntil != nil && now.After(*set.AvailableUntil) {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Masa pengerjaan ujian telah berakhir",
		})
	}

	// Batas percobaan.
	if set.MaxAttempts != nil && *set.MaxAttempts > 0 {
		used, _ := h.Repo.CountAttempts(studentID, set.ID)
		if used >= *set.MaxAttempts {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Batas percobaan telah tercapai",
			})
		}
	}

	// Deadline server-side = mulai + timer (bila ada). Juga dibatasi
	// oleh available_until agar tidak melewati penutupan ujian.
	var deadline *time.Time
	if set.TimerMinutes != nil && *set.TimerMinutes > 0 {
		d := now.Add(time.Duration(*set.TimerMinutes) * time.Minute)
		deadline = &d
	}
	if set.AvailableUntil != nil && (deadline == nil || set.AvailableUntil.Before(*deadline)) {
		deadline = set.AvailableUntil
	}

	// Urutan soal: bila shuffle, acak di server dan simpan; selain itu pakai urutan DB.
	questionIDs, err := h.Repo.ListQuestionIDsInSet(set.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memuat soal",
		})
	}
	if set.ShuffleQuestions {
		rand.Shuffle(len(questionIDs), func(i, j int) {
			questionIDs[i], questionIDs[j] = questionIDs[j], questionIDs[i]
		})
	}

	practice, err := h.Repo.CreatePractice(studentID, req.SetID, deadline, questionIDs)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal memulai praktik",
		})
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"success": true,
		"data":    practice,
	})
}

func (h *BankSoalHandler) SubmitPractice(c echo.Context) error {
	practiceID := c.Param("id")
	var req models.SubmitPracticeRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}

	studentID, err := h.resolveStudentID(c)
	if err != nil || studentID == "" {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Data siswa tidak ditemukan",
		})
	}

	// Verify ownership
	practice, err := h.Repo.GetPractice(practiceID)
	if err != nil || practice.StudentID != studentID {
		return c.JSON(http.StatusForbidden, map[string]interface{}{
			"success": false,
			"error":   "Anda tidak memiliki akses ke praktik ini",
		})
	}

	// Convert to answer models
	var answers []models.StudentPracticeAnswer
	for _, a := range req.Answers {
		answers = append(answers, models.StudentPracticeAnswer{
			QuestionID: a.QuestionID,
			Answer:     &a.Answer,
		})
	}

	if err := h.Repo.SubmitPractice(practiceID, answers); err != nil {
		status := http.StatusInternalServerError
		msg := "Gagal menyimpan jawaban"
		switch err.Error() {
		case "ujian sudah dikumpulkan":
			status = http.StatusConflict
			msg = err.Error()
		case "waktu ujian telah berakhir":
			status = http.StatusForbidden
			msg = err.Error()
		}
		return c.JSON(status, map[string]interface{}{
			"success": false,
			"error":   msg,
		})
	}

	updatedPractice, _ := h.Repo.GetPractice(practiceID)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    updatedPractice,
	})
}

func (h *BankSoalHandler) GetPractice(c echo.Context) error {
	practiceID := c.Param("id")
	practice, err := h.Repo.GetPractice(practiceID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Praktik tidak ditemukan",
		})
	}

	// Siswa hanya boleh mengakses praktiknya sendiri.
	if role, _ := c.Get("user_role").(string); role == "siswa" {
		studentID, err := h.resolveStudentID(c)
		if err != nil || practice.StudentID != studentID {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Anda tidak memiliki akses ke praktik ini",
			})
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data":    practice,
	})
}

func (h *BankSoalHandler) GetPracticeResult(c echo.Context) error {
	practiceID := c.Param("id")
	practice, err := h.Repo.GetPractice(practiceID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]interface{}{
			"success": false,
			"error":   "Praktik tidak ditemukan",
		})
	}

	// Siswa hanya boleh mengakses hasilnya sendiri.
	isStudent := false
	if role, _ := c.Get("user_role").(string); role == "siswa" {
		isStudent = true
		studentID, err := h.resolveStudentID(c)
		if err != nil || practice.StudentID != studentID {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Anda tidak memiliki akses ke praktik ini",
			})
		}
	}

	// Bila guru menyembunyikan hasil, siswa tidak boleh melihat detail.
	if isStudent {
		if set, err := h.Repo.GetSet(practice.SetID); err == nil && !set.ResultVisible {
			return c.JSON(http.StatusForbidden, map[string]interface{}{
				"success": false,
				"error":   "Hasil ujian belum dibuka oleh guru",
			})
		}
	}

	answers, _ := h.Repo.GetPracticeAnswers(practiceID)
	if answers == nil {
		answers = []models.StudentPracticeAnswer{}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"practice": practice,
			"answers":  answers,
		},
	})
}

// GradeAnswer menyimpan koreksi manual guru untuk satu jawaban (essay).
func (h *BankSoalHandler) GradeAnswer(c echo.Context) error {
	practiceID := c.Param("id")
	questionID := c.Param("questionId")

	var req models.GradeAnswerRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "Data tidak valid",
		})
	}
	if req.IsCorrect == nil {
		return c.JSON(http.StatusBadRequest, map[string]interface{}{
			"success": false,
			"error":   "isCorrect wajib diisi",
		})
	}

	if err := h.Repo.GradeAnswer(practiceID, questionID, *req.IsCorrect, req.Points); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"success": false,
			"error":   "Gagal menyimpan nilai koreksi",
		})
	}

	practice, _ := h.Repo.GetPractice(practiceID)
	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Nilai berhasil disimpan",
		"data":    practice,
	})
}
