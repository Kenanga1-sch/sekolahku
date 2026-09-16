"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import QuestionEditor from "../_components/question-editor";

function NewQuestionContent() {
  const params = useSearchParams();
  const presetBankId = params.get("bankId") || undefined;

  return <QuestionEditor presetBankId={presetBankId} />;
}

export default function NewQuestionPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <NewQuestionContent />
    </Suspense>
  );
}
