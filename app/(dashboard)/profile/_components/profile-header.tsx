"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Mail, Camera, Sparkles } from "lucide-react";

export interface ProfileHeaderProps {
  profile: { name: string; fullName: string; username: string; email: string; image: string };
  userRole?: string;
  isUploading: boolean;
  resolveImageUrl: (path?: string) => string | undefined;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function ProfileHeader({
  profile,
  userRole,
  isUploading,
  resolveImageUrl,
  onAvatarUpload,
}: ProfileHeaderProps) {
  return (
            <Card className="overflow-hidden border-slate-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950 relative">
                <div className="h-36 bg-blue-600 relative overflow-hidden">
                    {/* Decorative Blobs */}
                    <div className="absolute top-[-50px] right-[-50px] w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none" />
                    <div className="absolute bottom-[-30px] left-[10%] w-32 h-32 rounded-full bg-black/10 blur-lg pointer-events-none" />
                    <div className="absolute inset-0 bg-black/10 backdrop-blur-xs" />
                </div>
                <div className="px-6 pb-6 relative flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-14">
                    <div className="relative group h-28 w-28 rounded-full border-4 border-white dark:border-zinc-950 shadow-2xl overflow-hidden bg-slate-100 dark:bg-zinc-900 shrink-0">
                        <Avatar className="h-full w-full">
                            <AvatarImage src={resolveImageUrl(profile.image)} className="object-cover" />
                            <AvatarFallback className="text-3xl font-extrabold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                {profile.name ? profile.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase() : "U"}
                            </AvatarFallback>
                        </Avatar>
                        
                        <Label 
                            htmlFor="avatar-upload" 
                            className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center cursor-pointer text-white text-[10px] font-bold gap-1.5 text-center px-1"
                        >
                            <Camera className="h-5 w-5 text-white" />
                            {isUploading ? "Mengunggah..." : "Ubah Foto"}
                        </Label>
                        <input 
                            type="file" 
                            id="avatar-upload" 
                            accept="image/*" 
                            onChange={onAvatarUpload}
                            disabled={isUploading}
                            className="hidden" 
                        />
                    </div>
                    <div className="flex-1 text-center sm:text-left space-y-1.5 pb-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-center sm:justify-start gap-2.5">
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white leading-none tracking-tight flex items-center justify-center sm:justify-start gap-1.5">
                                {profile.fullName || profile.name || "User"}
                                <Sparkles className="h-4.5 w-4.5 text-amber-500 fill-amber-500 animate-pulse" />
                            </h2>
                            <Badge className="w-fit self-center sm:self-auto capitalize bg-violet-100 hover:bg-violet-200 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400 dark:hover:bg-violet-950/60 font-semibold border-violet-200/50">
                                {userRole || "User"}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1.5 font-medium">
                            <Mail className="h-3.5 w-3.5 text-slate-400" /> {profile.email}
                            {profile.username && (
                                <>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className="font-semibold text-slate-500 dark:text-slate-400">@{profile.username}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>
            </Card>
  );
}
