"use client";

import { FileText } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Template {
  id: string;
  name: string;
  category: string;
}

interface TemplateSelectorProps {
  templates: Template[];
  loading: boolean;
  onSelect: (template: Template) => void;
}

export function TemplateSelector({ templates, loading, onSelect }: TemplateSelectorProps) {
  if (loading) {
    return <div className="col-span-3 text-center py-8">Memuat template...</div>;
  }

  if (templates.length === 0) {
    return <div className="col-span-3 text-center py-8 text-muted-foreground">Belum ada template surat.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((tpl) => (
        <Card
          key={tpl.id}
          className="cursor-pointer hover:border-blue-500 transition-colors"
          onClick={() => onSelect(tpl)}
        >
          <CardHeader>
            <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center mb-2">
              <FileText className="h-5 w-5 text-zinc-500" />
            </div>
            <CardTitle className="text-base">{tpl.name}</CardTitle>
            <CardDescription>{tpl.category}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
