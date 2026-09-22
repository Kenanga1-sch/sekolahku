"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import QuestionEditor from "../_components/question-editor";

interface QuestionData {
  id: string;
  bankId: string;
  type: string;
  content: string;
  options?: string;
  correctAnswer?: string;
  explanation?: string;
  points: number;
  difficulty: string;
  bloomLevel?: string;
  tags?: string[];
}

function EditQuestionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const questionId = searchParams.get("id");
  const [initialData, setInitialData] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!questionId) {
      router.push("/bank-soal");
      return;
    }
    const fetchData = async () => {
      try {
        const res: any = await goGet(`/api/bank-soal/questions/${questionId}`);
        if (res?.data) {
          setInitialData(res.data);
        } else {
          showError("Soal tidak ditemukan");
          router.push("/bank-soal");
        }
      } catch {
        showError("Gagal memuat data soal");
        router.push("/bank-soal");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [questionId, router]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!initialData) return null;

  return <QuestionEditor questionId={questionId!} initialData={initialData} />;
}

export default function EditQuestionPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <EditQuestionContent />
    </Suspense>
  );
}
