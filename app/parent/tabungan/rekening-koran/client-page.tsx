"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Loader2, Printer } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { StatementDocument, type StatementData } from "@/components/tabungan/statement-document";
import { getChildStatementAction, getChildrenAction } from "@/actions/parent";

interface Child {
  studentId: string;
  fullName: string;
  className?: string;
}

export default function ParentRekeningKoranPage() {
  const { settings } = useSchoolSettings();
  const [children, setChildren] = useState<Child[]>([]);
  const [studentId, setStudentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await getChildrenAction();
        if (res.success) {
          const d = res.data as { data?: Child[] };
          const list = d.data || (res.data as Child[]) || [];
          setChildren(list);
          if (list[0]?.studentId) setStudentId(list[0].studentId);
        } else {
          toast.error(res.error || "Gagal memuat data anak");
        }
      } catch {
        toast.error("Gagal memuat data anak");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canGenerate = studentId && startDate && endDate && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const res = await getChildStatementAction(studentId, startDate, endDate);
      if (res.success) {
        const d = res.data as { data?: StatementData };
        const st = d.data || (res.data as StatementData);
        if (!st || !st.student || !Array.isArray(st.mutations)) {
          toast.error("Bentuk data rekening koran tidak dikenal");
          setStatement(null);
        } else {
          setStatement(st);
          toast.success("Rekening koran berhasil dibuat");
        }
      } else {
        toast.error(res.error || "Gagal membuat rekening koran");
        setStatement(null);
      }
    } catch {
      toast.error("Terjadi kesalahan");
      setStatement(null);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data anak yang tertaut ke akun ini.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <BackLink />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" /> Rekening Koran
            </CardTitle>
            <CardDescription>Pilih anak dan rentang tanggal untuk membuat rekening koran.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {children.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {children.map((c) => (
                  <button
                    key={c.studentId}
                    onClick={() => setStudentId(c.studentId)}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                      studentId === c.studentId
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {c.fullName}
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Dari Tanggal</Label>
                <DateInput id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Sampai Tanggal</Label>
                <DateInput id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <Button className="w-full" onClick={handleGenerate} disabled={!canGenerate}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyusun...
                </>
              ) : (
                "Buat Rekening Koran"
              )}
            </Button>
            {!startDate || !endDate ? (
              <p className="text-center text-xs text-muted-foreground">
                Pilih kedua tanggal untuk membuat rekening koran.
              </p>
            ) : null}
          </CardContent>
        </Card>

        {statement && (
          <div className="flex gap-2 print:hidden">
            <Button onClick={() => window.print()} className="flex-1">
              <Printer className="mr-2 h-4 w-4" /> Cetak
            </Button>
          </div>
        )}
      </div>

      {statement && (
        <StatementDocument
          statement={statement}
          schoolName={settings.school_name}
          schoolAddress={settings.school_address}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/parent/tabungan" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali ke Tabungan
    </Link>
  );
}
