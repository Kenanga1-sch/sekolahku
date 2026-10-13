"use client";

// Sub-hook spreadsheet transkrip alumni (diekstrak dari use-alumni-detail.ts).
// Mengelola kolom, baris grid, template lokal, dan operasi sel. Refactor —
// zero behavior change.

import { useState, useEffect } from "react";
import type { AlumniDetail } from "./types-alumni";
import {
  DEFAULT_COLUMNS,
  scoreToLetter,
  type ColumnDef,
  type SavedTemplate,
} from "./alumni-spreadsheet-helpers";

export function useTranscriptGrid(alumni: AlumniDetail | null) {
  // --- Spreadsheet state ---
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("Ganjil");
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS);
  const [gridRows, setGridRows] = useState<Record<string, any>[]>([]);

  // Column management
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [newColLabel, setNewColLabel] = useState("");

  // Template management
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);

  // --- Load custom templates on mount ---
  useEffect(() => {
    const stored = localStorage.getItem("sekolahku_custom_templates");
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- perilaku asli dipertahankan (refactor, zero behavior change)
        setSavedTemplates(JSON.parse(stored));
      } catch (e) {
        console.error("Error parsing templates:", e);
      }
    }
  }, []);

  // --- Sync database records to columns and gridRows ---
  useEffect(() => {
    if (!alumni) return;

    let activeYear = selectedYear;
    if (!activeYear) {
      if (alumni.transcripts && alumni.transcripts.length > 0) {
        activeYear = alumni.transcripts[alumni.transcripts.length - 1].academicYear;
      } else if (alumni.enrolledYear) {
        activeYear = `${alumni.enrolledYear}/${parseInt(alumni.enrolledYear) + 1}`;
      } else {
        const curYear = new Date().getFullYear();
        activeYear = `${curYear - 1}/${curYear}`;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- perilaku asli dipertahankan (refactor, zero behavior change)
      setSelectedYear(activeYear);
    }

    const filtered = alumni.transcripts.filter(
      (t) => t.academicYear === activeYear && t.semester === selectedSemester
    );

    if (filtered.length > 0) {
      const activeCustomCols: Record<string, string> = {};
      const rowsData = filtered.map((t) => {
        let notesText = t.notes || "";
        let customValues: Record<string, string> = {};

        if (t.notes && t.notes.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(t.notes);
            notesText = parsed.notes ?? "";
            customValues = parsed.custom ?? {};
          } catch {
            // Treat as raw notes on error
          }
        }

        Object.keys(customValues).forEach((label) => {
          const colKey = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
          activeCustomCols[colKey] = label;
        });

        return {
          subjectName: t.subjectName,
          subjectCode: t.subjectCode || "",
          score: t.score,
          scoreLetter: t.scoreLetter || "",
          notes: notesText,
          ...customValues,
        };
      });

      setColumns((prev) => {
        const nextCols = [...prev];
        Object.entries(activeCustomCols).forEach(([key, label]) => {
          if (!nextCols.some((c) => c.label === label)) {
            nextCols.push({ key, label, isCustom: true });
          }
        });
        return nextCols;
      });

      const finalRows = rowsData.map((r: any) => {
        const finalRow: Record<string, any> = { ...r };
        Object.entries(activeCustomCols).forEach(([key, label]) => {
          if (r[label] !== undefined) {
            finalRow[key] = r[label];
            delete finalRow[label];
          }
        });
        return finalRow;
      });

      setGridRows(finalRows);
    } else {
      setGridRows([]);
    }
  }, [alumni, selectedYear, selectedSemester]);

  // --- Spreadsheet helpers ---
  const handleCellChange = (rowIndex: number, field: string, value: string) => {
    const updated = [...gridRows];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };

    if (field === "score") {
      const num = parseFloat(value);
      if (!isNaN(num) && num >= 0 && num <= 100) {
        updated[rowIndex].scoreLetter = scoreToLetter(num);
      } else if (value === "") {
        updated[rowIndex].scoreLetter = "";
      }
    }
    setGridRows(updated);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const totalCols = columns.length;
    const totalRows = gridRows.length;
    let targetRow = rowIndex;
    let targetCol = colIndex;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        targetRow = Math.max(0, rowIndex - 1);
        break;
      case "ArrowDown":
        e.preventDefault();
        targetRow = Math.min(totalRows - 1, rowIndex + 1);
        break;
      case "ArrowLeft":
        if (e.currentTarget.selectionStart === 0) {
          e.preventDefault();
          targetCol = Math.max(0, colIndex - 1);
        } else return;
        break;
      case "ArrowRight":
        if (e.currentTarget.selectionEnd === e.currentTarget.value.length) {
          e.preventDefault();
          targetCol = Math.min(totalCols - 1, colIndex + 1);
        } else return;
        break;
      case "Enter":
        e.preventDefault();
        targetRow = Math.min(totalRows - 1, rowIndex + 1);
        break;
      default:
        return;
    }

    if (targetRow !== rowIndex || targetCol !== colIndex) {
      const targetId = `cell-${targetRow}-${targetCol}`;
      const el = document.getElementById(targetId) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  };

  const handleRemoveRow = (index: number) => {
    const updated = [...gridRows];
    updated.splice(index, 1);
    setGridRows(updated);
  };

  const addRow = () => {
    const emptyRow: Record<string, any> = {};
    columns.forEach((col) => {
      emptyRow[col.key] = "";
    });
    setGridRows([...gridRows, emptyRow]);
  };

  const loadSDTemplate = () => {
    const template = [
      { subjectName: "Pendidikan Agama & Budi Pekerti", subjectCode: "PABP", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Pendidikan Pancasila & Kewarganegaraan", subjectCode: "PPKn", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Bahasa Indonesia", subjectCode: "BIN", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Matematika", subjectCode: "MAT", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Ilmu Pengetahuan Alam", subjectCode: "IPA", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Ilmu Pengetahuan Sosial", subjectCode: "IPS", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Seni Budaya & Prakarya", subjectCode: "SBdP", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Pendidikan Jasmani, Olahraga, & Kesehatan", subjectCode: "PJOK", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Bahasa Sunda / Daerah", subjectCode: "BSND", score: "", scoreLetter: "", notes: "" },
      { subjectName: "Mulok Keagamaan", subjectCode: "MLK", score: "", scoreLetter: "", notes: "" },
    ];

    if (gridRows.length > 0 && gridRows.some((r) => r.subjectName !== "" || r.score !== "")) {
      if (!confirm("Muat template akan menggantikan data yang sedang diedit. Lanjutkan?")) return;
    }
    setGridRows(template);
  };

  // --- Custom column management ---
  const addCustomColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    if (columns.some((col) => col.label.toLowerCase() === label.toLowerCase())) {
      alert("Kolom dengan nama tersebut sudah ada!");
      return;
    }
    const key = `custom_${label.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    setColumns([...columns, { key, label, isCustom: true }]);
    setNewColLabel("");
  };

  const removeColumn = (colKey: string) => {
    if (colKey === "subjectName" || colKey === "score") {
      alert("Kolom ini wajib dan tidak dapat dihapus!");
      return;
    }
    if (!confirm("Apakah Anda yakin ingin menghapus kolom ini? Seluruh data pada kolom ini akan hilang.")) return;
    setColumns(columns.filter((col) => col.key !== colKey));
    setGridRows(
      gridRows.map((row) => {
        const updated = { ...row };
        delete updated[colKey];
        return updated;
      })
    );
  };

  const toggleStandardColumn = (key: string, label: string) => {
    if (columns.some((col) => col.key === key)) {
      if (!confirm(`Sembunyikan kolom "${label}"?`)) return;
      setColumns(columns.filter((col) => col.key !== key));
    } else {
      const defaultOrder = ["subjectName", "subjectCode", "score", "scoreLetter", "notes"];
      const newCols = [...columns, { key, label }];
      newCols.sort((a, b) => {
        const idxA = defaultOrder.indexOf(a.key);
        const idxB = defaultOrder.indexOf(b.key);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
      setColumns(newCols);
    }
  };

  // --- Template management ---
  const saveCurrentAsTemplate = () => {
    const name = newTemplateName.trim();
    if (!name) return;
    if (savedTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      if (!confirm("Template dengan nama tersebut sudah ada. Tindih template?")) return;
    }

    const newTemplate: SavedTemplate = {
      id: Date.now().toString(),
      name,
      columns: columns.map((c) => ({ key: c.key, label: c.label, isCustom: c.isCustom })),
      subjects: gridRows.map((row) => {
        const item: Record<string, any> = {};
        columns.forEach((col) => {
          item[col.key] = row[col.key] || "";
        });
        return item;
      }),
    };

    const updated = savedTemplates.filter((t) => t.name.toLowerCase() !== name.toLowerCase());
    updated.push(newTemplate);
    localStorage.setItem("sekolahku_custom_templates", JSON.stringify(updated));
    setSavedTemplates(updated);
    setNewTemplateName("");
    alert("Template berhasil disimpan!");
  };

  const loadCustomTemplate = (template: SavedTemplate) => {
    if (gridRows.length > 0 && gridRows.some((r) => r.subjectName !== "" || r.score !== "")) {
      if (!confirm(`Muat template "${template.name}" akan menggantikan seluruh lembar kerja saat ini. Lanjutkan?`)) return;
    }
    setColumns(template.columns);
    const newRows = template.subjects.map((subj) => {
      const row: Record<string, any> = {};
      template.columns.forEach((col) => {
        row[col.key] = subj[col.key] || "";
      });
      return row;
    });
    setGridRows(newRows);
    setTemplatesOpen(false);
  };

  const deleteTemplate = (id: string) => {
    if (!confirm("Hapus template ini?")) return;
    const updated = savedTemplates.filter((t) => t.id !== id);
    localStorage.setItem("sekolahku_custom_templates", JSON.stringify(updated));
    setSavedTemplates(updated);
  };

  return {
    // Spreadsheet
    selectedYear,
    setSelectedYear,
    selectedSemester,
    setSelectedSemester,
    columns,
    gridRows,
    handleCellChange,
    handleKeyDown,
    handleRemoveRow,
    addRow,
    loadSDTemplate,
    // Column mgmt
    columnsOpen,
    setColumnsOpen,
    newColLabel,
    setNewColLabel,
    addCustomColumn,
    removeColumn,
    toggleStandardColumn,
    // Template mgmt
    templatesOpen,
    setTemplatesOpen,
    newTemplateName,
    setNewTemplateName,
    savedTemplates,
    saveCurrentAsTemplate,
    loadCustomTemplate,
    deleteTemplate,
  };
}
