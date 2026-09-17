# Refactor Bank Soal — Halaman Edit Soal Khusus + UX Improvements

## Keputusan Final (setelah konfirmasi user)

| Aspek | Keputusan |
|-------|-----------|
| URL pattern | `/bank-soal/soal/baru` dan `/bank-soal/soal/[id]` (Indonesia, konsisten dgn modul) |
| Backend grading | Update `SubmitPractice` dengan helper `gradeAnswer()` |
| Backward compat | Migration 000051 normalize options dari `A\|B\|C\|D` ke JSON |
| correctAnswer storage | JSON string konsisten per tipe |

## Analisis Masalah (dari kode saat ini)

### 1. Bug: Select bank soal tidak bisa diklik
**Lokasi:** `app/(dashboard)/bank-soal/tab-soal.tsx:362-370`

**Penyebab:** Radix `Select` dengan `bankId: filterBank || ""` saat filter="all" + race condition.

**Fix:** Ganti ke `SearchableSelect` + CTA inline "Buat Bank Soal" jika kosong.

### 2-6. UX issues (lihat original plan di bawah)

---

## Step Implementation (Final)

### Step 1: Backend — helper `gradeAnswer()` + update `SubmitPractice`

**File: `go-backend/internal/repository/bank_soal_repo.go`**

Tambah helper:
```go
// gradeAnswer menentukan benar/salah untuk satu soal berdasarkan tipe & jawaban.
// correctAnswer: JSON string tergantung tipe (lihat CreateQuestion).
// studentAnswer: string dari frontend.
func gradeAnswer(questionType, correctAnswerJSON, studentAnswer string) bool {
    if correctAnswerJSON == "" || studentAnswer == "" {
        return false
    }
    student := strings.TrimSpace(studentAnswer)
    switch questionType {
    case "pg_single":
        // correctAnswer = text dari 1 pilihan
        return strings.EqualFold(student, strings.TrimSpace(correctAnswerJSON))
    case "pg_multi":
        // correctAnswer = JSON array id, misal '["1","3"]'
        var correctIDs []string
        if err := json.Unmarshal([]byte(correctAnswerJSON), &correctIDs); err != nil {
            return false
        }
        var studentIDs []string
        if err := json.Unmarshal([]byte(student), &studentIDs); err != nil {
            return false
        }
        return stringSetEqual(correctIDs, studentIDs)
    case "true_false":
        return strings.EqualFold(student, strings.TrimSpace(correctAnswerJSON))
    case "fill_blank":
        // correctAnswer = JSON array, semua dianggap benar (case-insensitive)
        var accepts []string
        if err := json.Unmarshal([]byte(correctAnswerJSON), &accepts); err != nil {
            return false
        }
        for _, a := range accepts {
            if strings.EqualFold(student, strings.TrimSpace(a)) {
                return true
            }
        }
        return false
    case "matching", "pair_match":
        // correctAnswer = JSON object {"leftId": "rightId", ...}
        var correct, studentMap map[string]string
        if err := json.Unmarshal([]byte(correctAnswerJSON), &correct); err != nil {
            return false
        }
        if err := json.Unmarshal([]byte(student), &studentMap); err != nil {
            return false
        }
        if len(correct) != len(studentMap) {
            return false
        }
        for k, v := range correct {
            if studentMap[k] != v {
                return false
            }
        }
        return true
    case "essay":
        // Esai dinilai manual; default dianggap benar (poin penuh) kecuali dikoreksi manual
        return false  // esai selalu manual grading
    default:
        return strings.EqualFold(student, correctAnswerJSON)
    }
}

func stringSetEqual(a, b []string) bool {
    if len(a) != len(b) {
        return false
    }
    counts := map[string]int{}
    for _, v := range a { counts[v]++ }
    for _, v := range b {
        counts[v]--
        if counts[v] < 0 { return false }
    }
    return true
}
```

Update `SubmitPractice` line ~778-794:
```go
isCorrect := gradeAnswer(qType, correctAnswer.String, studentAnswer)
```

### Step 2: Backend — Update CreateQuestion/UpdateQuestion untuk parse options & correctAnswer

**File: `go-backend/internal/handlers/bank_soal_handler.go`**

Tambah helper `buildQuestionPayload(req)` yang:
- Parse `req.Options` (JSON `[{id,text,isCorrect}]`) atau fallback legacy `A|B|C|D`
- Compute `correctAnswer` JSON string dari options[i].isCorrect sesuai tipe
- Return body siap di-insert

```go
type questionPayload struct {
    Options       string  // JSON
    CorrectAnswer string  // JSON string atau plain text
}

func buildQuestionPayload(req *models.CreateQuestionRequest) questionPayload {
    var options []models.QuestionOption
    if req.Options != nil && *req.Options != "" {
        if err := json.Unmarshal([]byte(*req.Options), &options); err != nil {
            // Legacy: "A|B|C|D" + correctAnswer
            parts := strings.Split(*req.Options, "|")
            for i, p := range parts {
                isCorrect := false
                if req.CorrectAnswer != nil && strings.EqualFold(strings.TrimSpace(p), strings.TrimSpace(*req.CorrectAnswer)) {
                    isCorrect = true
                }
                options = append(options, models.QuestionOption{
                    ID:   fmt.Sprintf("%d", i+1),
                    Text: strings.TrimSpace(p),
                    IsCorrect: isCorrect,
                })
            }
        }
    }
    optsJSON, _ := json.Marshal(options)

    var correct string
    switch req.Type {
    case "pg_single":
        for _, o := range options {
            if o.IsCorrect { correct = o.Text; break }
        }
    case "pg_multi":
        ids := []string{}
        for _, o := range options {
            if o.IsCorrect { ids = append(ids, o.ID) }
        }
        b, _ := json.Marshal(ids)
        correct = string(b)
    case "true_false":
        if req.CorrectAnswer != nil { correct = *req.CorrectAnswer }
    case "fill_blank":
        if req.CorrectAnswer != nil {
            // accept: "jawaban1|jawaban2"
            parts := strings.Split(*req.CorrectAnswer, "|")
            list := []string{}
            for _, p := range parts { list = append(list, strings.TrimSpace(p)) }
            b, _ := json.Marshal(list)
            correct = string(b)
        }
    case "matching", "pair_match":
        if req.CorrectAnswer != nil { correct = *req.CorrectAnswer }
    }
    return questionPayload{Options: string(optsJSON), CorrectAnswer: correct}
}
```

Gunakan di `CreateQuestion` & `UpdateQuestion`.

### Step 3: Migration 000051 normalize legacy options

**File: `go-backend/internal/db/migrations/000051_normalize_options.up.sql`**

```sql
-- Normalize soal lama dari format "A|B|C|D" ke JSON [{id,text,isCorrect}]
-- Aman: cek dulu apakah options adalah JSON valid; jika ya skip.
UPDATE questions
SET options = json_object(
    'id', '1', 'text', '',
    'isCorrect', 0
)
WHERE 0;  -- placeholder

-- Logic sebenarnya: Go migration post-step (lihat postMigrations[51])
-- karena JSON construction lebih mudah di Go.
```

**File: `go-backend/internal/db/migrations/000051_normalize_options.go`**

```go
package migrations

import (
    "database/sql"
    "encoding/json"
    "strings"
)

func MigrateNormalizeOptions(db *sql.DB) error {
    rows, err := db.Query(`SELECT id, options, correct_answer, type FROM questions WHERE deleted_at IS NULL AND options IS NOT NULL`)
    if err != nil { return err }
    defer rows.Close()

    type legacy struct{ ID, Options, Correct, Type string }
    var legacyRows []legacy
    for rows.Next() {
        var l legacy
        if err := rows.Scan(&l.ID, &l.Options, &l.Correct, &l.Type); err != nil {
            return err
        }
        legacyRows = append(legacyRows, l)
    }

    for _, l := range legacyRows {
        // Skip jika sudah JSON valid
        if strings.HasPrefix(strings.TrimSpace(l.Options), "[") {
            continue
        }
        // Legacy: "A|B|C|D"
        parts := strings.Split(l.Options, "|")
        options := []map[string]interface{}{}
        for i, p := range parts {
            isCorrect := false
            if l.Correct != "" && strings.EqualFold(strings.TrimSpace(p), strings.TrimSpace(l.Correct)) {
                isCorrect = true
            }
            options = append(options, map[string]interface{}{
                "id":        fmt.Sprintf("%d", i+1),
                "text":      strings.TrimSpace(p),
                "isCorrect": isCorrect,
            })
        }
        b, _ := json.Marshal(options)
        if _, err := db.Exec("UPDATE questions SET options = ? WHERE id = ?", string(b), l.ID); err != nil {
            return err
        }
    }
    return nil
}
```

Daftarkan di `migrate.go`:
```go
var postMigrations = map[int]func(*sql.DB) error{
    34: MigrateInventoryData,
    51: MigrateNormalizeOptions,
}
```

### Step 4: Frontend — Komponen QuestionTypePicker

**File: `app/(dashboard)/bank-soal/soal/_components/question-type-picker.tsx`**

Grid 7 card dengan:
- Lucide icon
- Label tipe
- Mini-preview ASCII 1 baris
- Highlight selected card (border biru + ring-2)

```tsx
const TYPES = [
  { value: "pg_single", icon: CircleDot, label: "PG Tunggal", preview: "○ A  ○ B  ○ C  ○ D" },
  { value: "pg_multi", icon: CheckSquare, label: "PG Multi", preview: "☐ A  ☐ B  ☐ C  ☐ D" },
  { value: "true_false", icon: ToggleLeft, label: "Benar/Salah", preview: "○ Benar   ○ Salah" },
  { value: "fill_blank", icon: TextCursorInput, label: "Isian", preview: "Ibu kota Indonesia adalah ___" },
  { value: "matching", icon: Link2, label: "Menyambungkan", preview: "A → 1   B → 2" },
  { value: "pair_match", icon: GitCompare, label: "Menjodohkan", preview: "Premise ↔ Response" },
  { value: "essay", icon: FileText, label: "Esai", preview: "Jelaskan mengapa..." },
];
```

### Step 5: Frontend — Komponen ChoiceListEditor

**File: `app/(dashboard)/bank-soal/soal/_components/choice-list-editor.tsx`**

Props:
```ts
interface Choice { id: string; text: string; isCorrect: boolean }
interface Props {
  mode: "single" | "multi" | "true_false";
  value: Choice[];
  onChange: (next: Choice[]) => void;
}
```

Render:
- Untuk `pg_single`: list input + Radio di samping (hanya 1 yang bisa isCorrect=true)
- Untuk `pg_multi`: list input + Checkbox (bisa banyak isCorrect)
- Untuk `true_false`: auto-render 2 pilihan tetap "Benar"/"Salah" (user hanya pilih)
- Tombol "Tambah Pilihan" di bawah (max 6)
- Tombol hapus di tiap pilihan (disabled jika cuma 2 tersisa, atau jika true_false)

### Step 6: Frontend — Komponen PairMatchEditor

**File: `app/(dashboard)/bank-soal/soal/_components/pair-match-editor.tsx`**

2 kolom: kiri (premise) dan kanan (response). Untuk tiap premise, dropdown pilih response. Tombol tambah/hapus pasangan. State:
```ts
type Pair = { leftId: string; leftText: string; rightId: string; rightText: string }
```

### Step 7: Frontend — Komponen FillBlankEditor

**File: `app/(dashboard)/bank-soal/soal/_components/fill-blank-editor.tsx`**

Input utama "Kata Kunci" + repeater untuk alternatif. Default: 1 kata kunci.

### Step 8: Frontend — Komponen QuestionPreview

**File: `app/(dashboard)/bank-soal/soal/_components/question-preview.tsx`**

Render conditional sesuai `type`. Pure presentational, no state.

### Step 9: Frontend — Komponen QuestionEditor (orchestrator)

**File: `app/(dashboard)/bank-soal/soal/_components/question-editor.tsx`**

- Props: `initialData?: Question`, `questionId?: string`
- State: bankId, type, content, options, correctAnswer (computed), explanation, points, difficulty
- Layout: 2 kolom di lg+ (kiri form, kanan preview sticky)
- Section dengan anchor: Tipe → Konten → Pilihan → Pembahasan → Pengaturan
- Tombol Simpan disabled sampai valid
- Submit handler: convert state → body → POST/PUT

### Step 10: Frontend — Halaman entry

**File: `app/(dashboard)/bank-soal/soal/baru/page.tsx`**
```tsx
"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import QuestionEditor from "../_components/question-editor";

function NewQuestionContent() {
  const params = useSearchParams();
  const presetBankId = params.get("bankId") || "";
  return <QuestionEditor presetBankId={presetBankId} />;
}

export default function NewQuestionPage() {
  return <Suspense fallback={null}><NewQuestionContent /></Suspense>;
}
```

**File: `app/(dashboard)/bank-soal/soal/[id]/page.tsx`**
```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { goGet } from "@/lib/api-client";
import QuestionEditor from "../_components/question-editor";

export default function EditQuestionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    goGet(`/api/bank-soal/questions/${id}`).then((r: any) => {
      setInitial(r.data);
      setLoading(false);
    }).catch(() => router.push("/bank-soal"));
  }, [id]);
  
  if (loading) return <Skeleton />;
  return <QuestionEditor questionId={String(id)} initialData={initial} />;
}
```

### Step 11: Refactor tab-soal.tsx

**File: `app/(dashboard)/bank-soal/tab-soal.tsx`**

- Hapus `Dialog`, `formData`, `handleSubmit`, `handleEdit`, `resetForm` — pindah ke halaman edit
- Ganti tombol "Buat Soal" → `router.push("/bank-soal/soal/baru" + (filterBank ? "?bankId=..." : ""))`
- Ganti tombol edit di card → `router.push("/bank-soal/soal/${q.id}")`
- Ganti `<Select>` filter bank dengan `<SearchableSelect>` (untuk fix bug)
- Hapus state `banks` untuk form, tetap pertahankan untuk filter display

### Step 12: Update sidebar page titles

**File: `app/(dashboard)/layout-client.tsx`** line 132-136:
```ts
"/bank-soal/soal/baru": "Buat Soal",
"/bank-soal/soal/[id]": "Edit Soal",  // dynamic — handled by Next.js routing
"/bank-soal/bab": "Kelola Bab",
"/bank-soal/soal": "Kelola Soal",
"/bank-soal/paket": "Paket Soal",
"/bank-soal": "Bank Soal",
```

(Catatan: dynamic route `[id]` biasanya di-match oleh prefix `/bank-soal/soal` → "Kelola Soal". Tambahan entry di atas untuk static `/baru`.)

### Step 13: Build & deploy

1. `cd go-backend && go build -o ../sekolahku_linux ./cmd/api`
2. `npx tsc --noEmit` + `npx next build`
3. `node scripts/gen-sw-precache.cjs`
4. `DEPLOY_PASS='20216609' ./deploy.sh --frontend`
5. `DEPLOY_PASS='20216609' ./deploy.sh`

---

## File yang Diubah/Dibuat

### Backend (4 file)
- `go-backend/internal/db/migrations/000051_normalize_options.up.sql` (placeholder)
- `go-backend/internal/db/migrations/000051_normalize_options.go` (logic Go)
- `go-backend/internal/db/migrations/migrate.go` (daftarkan postMigrations[51])
- `go-backend/internal/repository/bank_soal_repo.go` (gradeAnswer + SubmitPractice update)

### Frontend — File Baru (8 file)
- `app/(dashboard)/bank-soal/soal/baru/page.tsx`
- `app/(dashboard)/bank-soal/soal/[id]/page.tsx`
- `app/(dashboard)/bank-soal/soal/_components/question-editor.tsx`
- `app/(dashboard)/bank-soal/soal/_components/question-type-picker.tsx`
- `app/(dashboard)/bank-soal/soal/_components/choice-list-editor.tsx`
- `app/(dashboard)/bank-soal/soal/_components/pair-match-editor.tsx`
- `app/(dashboard)/bank-soal/soal/_components/fill-blank-editor.tsx`
- `app/(dashboard)/bank-soal/soal/_components/question-preview.tsx`

### Frontend — File Diubah (2 file)
- `app/(dashboard)/bank-soal/tab-soal.tsx` — hapus dialog, link ke halaman edit
- `app/(dashboard)/layout-client.tsx` — tambah page title sub-route

## Trade-offs yang sudah dikonfirmasi user
1. ✅ Backward compatibility — Migration 000051 normalize legacy
2. ✅ Backend grading — Update dengan gradeAnswer()
3. ✅ Routing — `/bank-soal/soal/baru` (Indonesia)
4. ✅ correctAnswer — JSON string konsisten per tipe
