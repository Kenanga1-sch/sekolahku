
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Student {
  id: string;
  nama: string;
  namaLengkap?: string;
}

interface VisualGradingProps {
  students: Student[];
  grades: Record<string, { score: number, notes?: string }>; // Updated prop
  onGradeChange: (studentId: string, value: number) => void;
  onNoteChange?: (studentId: string, note: string) => void; // Optional for now
}

export function VisualGrading({ students, grades, onGradeChange, onNoteChange }: VisualGradingProps) {
  /* Updated to 5 Star Scale */
  const getRating = (score: number) => {
    if (!score) return 0;
    if (score >= 95) return 5;
    if (score >= 85) return 4;
    if (score >= 75) return 3;
    if (score >= 65) return 2;
    return 1;
  };

  const setRating = (studentId: string, rating: number) => {
    let score = 0;
    if (rating === 5) score = 100;
    if (rating === 4) score = 90;
    if (rating === 3) score = 80;
    if (rating === 2) score = 70;
    if (rating === 1) score = 60; // Remedial
    onGradeChange(studentId, score);
  };
  
  // Helper for random color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300",
      "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300",
      "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-300",
      "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300",
      "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300",
      "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300",
      "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300",
      "bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-300",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };
  
  return (
    <TooltipProvider>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {students.map((student) => {
        // ... (rest of render logic remains same until stars loop)
        const gradeData = grades[student.id] || { score: 0 };
        const score = gradeData.score;
        const rating = getRating(score);
        const hasNote = !!gradeData.notes;
        
        return (
          <Card key={student.id} className={`border-2 transition-all duration-300 relative group ${
            score > 0 
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10' 
                : 'border-zinc-200 dark:border-zinc-800 hover:border-blue-400'
          }`}>
             {score > 0 && (
                 <div className="absolute top-2 right-2 text-emerald-600 animate-in zoom-in spin-in-90 duration-300">
                     <CheckCircle2 className="h-5 w-5 fill-emerald-100" />
                 </div>
             )}

            <CardContent className="p-4 flex flex-col items-center gap-3">
              <Avatar className={`h-20 w-20 border-4 border-white dark:border-zinc-900 shadow-md ${getAvatarColor(student.nama || "S")}`}>
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.nama || 'User'}`} />
                <AvatarFallback className="text-xl font-bold bg-transparent">
                    {String(student.nama || "S").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center w-full">
                <h3 className="font-bold text-sm truncate px-2">{student.namaLengkap || student.nama || "Siswa"}</h3>
                <div className="h-5 flex items-center justify-center gap-2 mt-1">
                    {score ? (
                        <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full dark:bg-emerald-900/50 dark:text-emerald-400">
                            {score}
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground italic">Belum dinilai</span>
                    )}
                </div>
              </div>

              <div className="flex gap-1 justify-center mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Tooltip key={star}>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setRating(student.id, star)}
                            className={`transition-all hover:scale-125 focus:outline-none p-0.5 ${
                                rating >= star 
                                ? 'text-yellow-400 drop-shadow-sm' 
                                : 'text-zinc-200 dark:text-zinc-700 hover:text-yellow-200'
                            }`}
                        >
                            <Star className={`w-5 h-5 ${rating >= star ? 'fill-current' : ''}`} />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{star === 5 ? "Sangat Baik (100)" : star === 4 ? "Baik (90)" : star === 3 ? "Cukup (80)" : star === 2 ? "Kurang (70)" : "Perlu Bimbingan (60)"}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </CardContent>
            
            {/* Action Bar (Notes) */}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-8 w-8 rounded-full ${hasNote ? 'bg-blue-100 text-blue-600 opacity-100' : 'bg-white/80 hover:bg-white text-muted-foreground'}`}
                    title="Catatan Anekdotal"
                    onClick={() => {
                        // Quick prompt for notes
                        const currentNote = gradeData.notes || "";
                        const newNote = prompt(`Catatan untuk ${student.nama}:`, currentNote);
                        if (newNote !== null && onNoteChange) {
                            onNoteChange(student.id, newNote);
                        }
                    }}
                 >
                     <MessageSquare className="h-4 w-4" />
                 </Button>
            </div>
          </Card>
        );
      })}
    </div>
    </TooltipProvider>
  );
}
