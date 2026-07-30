﻿﻿﻿"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence } from "framer-motion";
import { GraduationCap, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { useAlumniDetail } from "./use-alumni-detail";
import { ProfileHeader } from "./profile-header";
import { TranscriptTab } from "./transcript-tab";
import { AttendanceTab } from "./attendance-tab";
import { AchievementTab } from "./achievement-tab";
import { PickupTab } from "./pickup-tab";
import { HealthTab } from "./health-tab";
import { InfoTab } from "./info-tab";
import { DocumentGallery } from "@/components/alumni/document-gallery";
import { DocumentUpload } from "@/components/alumni/document-upload";
import { ColumnsDialog, TemplatesDialog, TranscriptDialog, AttendanceDialog, AchievementDialog, EkskulDialog, HealthDialog } from "./dialogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { TabsContent } from "@/components/ui/tabs";

export default function AlumniDetailPage() {
  const ctx = useAlumniDetail();

  if (ctx.loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!ctx.alumni) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <GraduationCap className="h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">Data siswa tidak ditemukan</h2>
        <Link href="/admin/siswa">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Kembali ke Buku Induk
          </Button>
        </Link>
      </div>
    );
  }

  const { alumni } = ctx;

  return (
    <div className="space-y-6">
      <ProfileHeader alumni={alumni} onDelete={ctx.handleDelete} />

      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full"
        >
          <Tabs value={ctx.activeTab} onValueChange={ctx.setActiveTab}>
            <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted p-1 rounded-lg justify-start md:grid md:grid-cols-7 md:h-10">
              <TabsTrigger value="documents" className="flex-1 text-xs md:text-sm">Dokumen</TabsTrigger>
              <TabsTrigger value="transcripts" className="flex-1 text-xs md:text-sm">Nilai</TabsTrigger>
              <TabsTrigger value="attendance" className="flex-1 text-xs md:text-sm">Absensi</TabsTrigger>
              <TabsTrigger value="achievements" className="flex-1 text-xs md:text-sm">Prestasi</TabsTrigger>
              <TabsTrigger value="health" className="flex-1 text-xs md:text-sm">Kesehatan</TabsTrigger>
              <TabsTrigger value="pickups" className="flex-1 text-xs md:text-sm">Pengambilan</TabsTrigger>
              <TabsTrigger value="info" className="flex-1 text-xs md:text-sm">Info Profil</TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {/* TAB: DOKUMEN */}
              {ctx.activeTab === "documents" && (
                <TabsContent value="documents" className="mt-4">
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-base">Dokumen Arsip Digital</CardTitle>
                        <DocumentUpload alumniId={alumni.id} onUploadComplete={ctx.fetchAlumni} />
                      </CardHeader>
                      <CardContent>
                        <DocumentGallery documents={alumni.documents} onRefresh={ctx.fetchAlumni} />
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              )}

              {/* TAB: TRANSKRIP NILAI */}
              {ctx.activeTab === "transcripts" && (
                <TranscriptTab
                  selectedYear={ctx.selectedYear}
                  setSelectedYear={ctx.setSelectedYear}
                  selectedSemester={ctx.selectedSemester}
                  setSelectedSemester={ctx.setSelectedSemester}
                  columns={ctx.columns}
                  gridRows={ctx.gridRows}
                  savingTranscripts={ctx.savingTranscripts}
                  enrolledYear={alumni.enrolledYear ?? undefined}
                  onCellChange={ctx.handleCellChange}
                  onKeyDown={ctx.handleKeyDown}
                  onRemoveRow={ctx.handleRemoveRow}
                  onAddRow={ctx.addRow}
                  onSaveAll={ctx.handleSaveTranscriptsBulk}
                  onOpenTemplates={() => ctx.setTemplatesOpen(true)}
                  onOpenColumns={() => ctx.setColumnsOpen(true)}
                  onRemoveColumn={ctx.removeColumn}
                />
              )}

              {/* TAB: KEHADIRAN */}
              {ctx.activeTab === "attendance" && (
                <AttendanceTab
                  attendances={alumni.attendanceSummaries}
                  onAdd={() => { ctx.setEditingAttendance(null); ctx.setAttendanceMode("add"); ctx.setAttendanceOpen(true); }}
                  onEdit={(a: typeof alumni.attendanceSummaries[0]) => { ctx.setEditingAttendance(a); ctx.setAttendanceMode("edit"); ctx.setAttendanceOpen(true); }}
                  onDelete={ctx.handleAttendanceDelete}
                />
              )}

              {/* TAB: PRESTASI & EKSKUL */}
              {ctx.activeTab === "achievements" && (
                <AchievementTab
                  achievements={alumni.achievements}
                  extracurriculars={alumni.extracurriculars}
                  onAddAchievement={() => { ctx.setEditingAchievement(null); ctx.setAchievementMode("add"); ctx.setAchievementOpen(true); }}
                  onEditAchievement={(a: typeof alumni.achievements[0]) => { ctx.setEditingAchievement(a); ctx.setAchievementMode("edit"); ctx.setAchievementOpen(true); }}
                  onDeleteAchievement={ctx.handleAchievementDelete}
                  onAddEkskul={() => { ctx.setEditingEkskul(null); ctx.setEkskulMode("add"); ctx.setEkskulOpen(true); }}
                  onEditEkskul={(e: typeof alumni.extracurriculars[0]) => { ctx.setEditingEkskul(e); ctx.setEkskulMode("edit"); ctx.setEkskulOpen(true); }}
                  onDeleteEkskul={ctx.handleEkskulDelete}
                />
              )}

              {/* TAB: RIWAYAT PENGAMBILAN */}
              {ctx.activeTab === "pickups" && (
                <PickupTab
                  pickups={alumni.pickups}
                  alumniId={alumni.id}
                  isGraduated={alumni.status === "graduated"}
                  onRefresh={ctx.fetchAlumni}
                />
              )}

              {/* TAB: KESEHATAN BERKALA */}
              {ctx.activeTab === "health" && (
                <HealthTab
                  records={alumni.healthRecords}
                  onAdd={() => { ctx.setEditingHealth(null); ctx.setHealthMode("add"); ctx.setHealthOpen(true); }}
                  onEdit={(r: typeof alumni.healthRecords[0]) => { ctx.setEditingHealth(r); ctx.setHealthMode("edit"); ctx.setHealthOpen(true); }}
                  onDelete={ctx.handleHealthDelete}
                />
              )}

              {/* TAB: INFO LENGKAP PROFIL */}
              {ctx.activeTab === "info" && <InfoTab alumni={alumni} />}
            </AnimatePresence>
          </Tabs>
        </motion.div>
      </div>

      {/* DIALOGS */}
      <ColumnsDialog
        open={ctx.columnsOpen}
        onOpenChange={ctx.setColumnsOpen}
        columns={ctx.columns}
        newColLabel={ctx.newColLabel}
        onNewColLabelChange={ctx.setNewColLabel}
        onToggleStandard={ctx.toggleStandardColumn}
        onAddCustom={ctx.addCustomColumn}
        onRemove={ctx.removeColumn}
      />

      <TemplatesDialog
        open={ctx.templatesOpen}
        onOpenChange={ctx.setTemplatesOpen}
        templates={ctx.savedTemplates}
        newTemplateName={ctx.newTemplateName}
        onNewTemplateNameChange={ctx.setNewTemplateName}
        onSave={ctx.saveCurrentAsTemplate}
        onLoad={ctx.loadCustomTemplate}
        onDelete={ctx.deleteTemplate}
      />

      <TranscriptDialog
        open={ctx.transcriptOpen}
        onOpenChange={ctx.setTranscriptOpen}
        mode={ctx.transcriptMode}
        editing={ctx.editingTranscript}
        submitting={ctx.submitting}
        onSubmit={ctx.handleTranscriptSubmit}
      />

      <AttendanceDialog
        open={ctx.attendanceOpen}
        onOpenChange={ctx.setAttendanceOpen}
        mode={ctx.attendanceMode}
        editing={ctx.editingAttendance}
        submitting={ctx.submitting}
        onSubmit={ctx.handleAttendanceSubmit}
      />

      <AchievementDialog
        open={ctx.achievementOpen}
        onOpenChange={ctx.setAchievementOpen}
        mode={ctx.achievementMode}
        editing={ctx.editingAchievement}
        submitting={ctx.submitting}
        onSubmit={ctx.handleAchievementSubmit}
      />

      <EkskulDialog
        open={ctx.ekskulOpen}
        onOpenChange={ctx.setEkskulOpen}
        mode={ctx.ekskulMode}
        editing={ctx.editingEkskul}
        submitting={ctx.submitting}
        onSubmit={ctx.handleEkskulSubmit}
      />

      <HealthDialog
        open={ctx.healthOpen}
        onOpenChange={ctx.setHealthOpen}
        mode={ctx.healthMode}
        editing={ctx.editingHealth}
        submitting={ctx.submitting}
        onSubmit={ctx.handleHealthSubmit}
      />
    </div>
  );
}