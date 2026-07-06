"use client";

import { ArrowLeft, Check, Download, Loader2, Send, Users, FileText, Printer, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface PreviewStepProps {
  selectedRecipients: any[];
  generatedData: any;
  onBack: () => void;
  onDownload: () => void;
  onSubmitToVerification?: () => void;
  loading: boolean;
  submitting?: boolean;
  mergeBatch?: boolean;
  setMergeBatch?: (val: boolean) => void;
}


export function PreviewStep({
  selectedRecipients,
  generatedData,
  onBack,
  onDownload,
  onSubmitToVerification,
  loading,
  submitting,
  mergeBatch = true,
  setMergeBatch,
}: PreviewStepProps) {
  // Extractions for Kop Surat & Letter Info
  const sekolahNama = generatedData?.sekolah_nama || "SD NEGERI 1 KUNINGAN";
  const sekolahAlamat = generatedData?.sekolah_alamat || "Jl. Siliwangi No. 12, Kabupaten Kuningan, Jawa Barat";
  const sekolahTelepon = generatedData?.sekolah_telepon || "(0232) 871112";
  const sekolahEmail = generatedData?.sekolah_email || "sdn1kuningan@gmail.com";
  const sekolahWebsite = generatedData?.sekolah_website || "www.sdn1kuningan.sch.id";
  const tanggalSurat = generatedData?.tanggal_surat || generatedData?.tanggal_hari_ini || "16 Juni 2026";
  const nomorSurat = generatedData?.nomor_surat || generatedData?.nomor_surat_otomatis || "024/400.3.5/SDN1-KNG/VI/2026";
  const perihalSurat = generatedData?.perihal_surat || generatedData?.perihal || "Surat Keterangan Aktif Belajar";
  const lampiranSurat = generatedData?.lampiran_surat || generatedData?.lampiran || "-";

  // Recipient details
  const penerimaNama = generatedData?.siswa_nama || generatedData?.penerima_nama || generatedData?.guru_nama || "Nama Penerima";
  const penerimaNipNis = generatedData?.siswa_nis || generatedData?.penerima_nip || "-";
  const penerimaNisn = generatedData?.siswa_nisn || "";
  const penerimaKelasJabatan = generatedData?.siswa_kelas || generatedData?.penerima_jabatan || "";
  const penerimaAlamat = generatedData?.siswa_alamat || "di Tempat";

  // Principal Info
  const kepalaSekolahNama = generatedData?.kepala_sekolah_nama || "H. Mamat Slamet, S.Pd., M.Si.";
  const kepalaSekolahNip = generatedData?.kepala_sekolah_nip || "19680324 199203 1 005";
  const tahunAjaran = generatedData?.tahun_ajaran || "2025/2026";

  // Extract other filled custom variables
  const standardKeys = [
    "sekolah_nama", "sekolah_npsn", "sekolah_alamat", "sekolah_telepon",
    "sekolah_email", "sekolah_website", "kepala_sekolah_nama", "kepala_sekolah_nip",
    "tanggal_hari_ini", "tanggal_surat", "tahun_ajaran", "nomor_surat", "nomor_surat_otomatis",
    "siswa_nama", "siswa_nis", "siswa_nisn", "siswa_kelas", "siswa_jenis_kelamin",
    "siswa_tempat_lahir", "siswa_tanggal_lahir", "siswa_tanggal_lahir_indo", "siswa_alamat",
    "siswa_nama_wali", "siswa_no_hp_wali", "penerima_nama", "penerima_nip", "penerima_jabatan",
    "guru_nama", "guru_nip", "guru_jabatan", "lampiran", "lampiran_surat", "perihal", "perihal_surat"
  ];

  const customVariables = Object.entries(generatedData || {})
    .filter(([key, val]) => !standardKeys.includes(key) && val !== "" && typeof val === "string")
    .map(([key, val]) => ({ key: key.replace(/_/g, " "), value: val as string }));

  const isStudent = Boolean(generatedData?.siswa_nama);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Kolom Kiri: High Fidelity Letter Mockup */}
      <div className="lg:col-span-2 space-y-3">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Pratinjau visual cetak dokumen (Simulasi A4)
        </span>
        <div className="bg-slate-200 dark:bg-zinc-950 p-6 md:p-10 rounded-2xl border border-slate-300 dark:border-zinc-800 shadow-inner overflow-auto max-h-[850px] flex justify-center">
          {/* Halaman Surat A4 */}
          <div className="bg-white text-zinc-900 border border-slate-350 dark:border-none shadow-2xl rounded-sm w-[210mm] min-h-[297mm] p-12 md:p-16 flex flex-col justify-between font-serif text-sm relative select-none">
            
            {/* Kop Surat */}
            <div className="text-center space-y-1 text-black font-sans relative">
              <h3 className="text-xs font-bold uppercase tracking-wider">Pemerintah Kabupaten Kuningan</h3>
              <h3 className="text-xs font-bold uppercase tracking-wider">Dinas Pendidikan dan Kebudayaan</h3>
              <h2 className="text-lg font-extrabold uppercase leading-tight tracking-wide">{sekolahNama}</h2>
              <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">
                {sekolahAlamat} <br />
                Telepon: {sekolahTelepon} | Website: {sekolahWebsite} | Email: {sekolahEmail}
              </p>
              {/* Garis Pembatas Kop Surat Resmi */}
              <div className="border-b-4 border-double border-zinc-950 pt-2" />
            </div>

            {/* Isi Surat */}
            <div className="mt-8 flex-1 space-y-6 leading-relaxed text-justify text-black font-serif">
              {/* Tanggal & Info Metadata */}
              <div className="flex justify-between items-start font-sans text-xs mb-4">
                <div className="space-y-1">
                  <table>
                    <tbody>
                      <tr>
                        <td className="w-16">Nomor</td>
                        <td className="w-3 text-center">:</td>
                        <td className="font-mono font-semibold">{nomorSurat}</td>
                      </tr>
                      <tr>
                        <td>Lampiran</td>
                        <td>:</td>
                        <td>{lampiranSurat}</td>
                      </tr>
                      <tr>
                        <td>Perihal</td>
                        <td>:</td>
                        <td className="font-medium underline">{perihalSurat}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <p>Kuningan, {tanggalSurat}</p>
                </div>
              </div>

              {/* Penerima */}
              <div className="font-sans text-xs pt-2">
                <p>Kepada Yth.</p>
                <p className="font-bold uppercase mt-0.5">{penerimaNama}</p>
                <p>{penerimaAlamat}</p>
                <p className="mt-2 font-semibold">di Tempat</p>
              </div>

              {/* Paragraf Pembuka */}
              <div className="text-xs pt-4 space-y-3 font-serif">
                <p>Dengan hormat,</p>
                {isStudent ? (
                  <p>
                    Yang bertanda tangan di bawah ini Kepala Sekolah {sekolahNama} menerangkan dengan sebenarnya bahwa siswa di bawah ini:
                  </p>
                ) : (
                  <p>
                    Yang bertanda tangan di bawah ini Kepala Sekolah {sekolahNama} menerangkan dengan sebenarnya bahwa guru/staf di bawah ini:
                  </p>
                )}

                {/* Tabel Data Utama Penerima */}
                <div className="pl-4 py-2">
                  <table className="text-xs w-full max-w-lg border-collapse">
                    <tbody>
                      <tr>
                        <td className="w-36 py-1 font-medium">Nama Lengkap</td>
                        <td className="w-3 text-center">:</td>
                        <td className="font-semibold py-1">{penerimaNama}</td>
                      </tr>
                      {isStudent ? (
                        <>
                          <tr>
                            <td className="py-1 font-medium">NIS / NISN</td>
                            <td className="text-center">:</td>
                            <td className="py-1">{penerimaNipNis} {penerimaNisn && `/ ${penerimaNisn}`}</td>
                          </tr>
                          <tr>
                            <td className="py-1 font-medium">Kelas / Rombel</td>
                            <td className="text-center">:</td>
                            <td className="py-1">{penerimaKelasJabatan}</td>
                          </tr>
                          {generatedData?.siswa_tempat_lahir && (
                            <tr>
                              <td className="py-1 font-medium">Tempat, Tgl Lahir</td>
                              <td className="text-center">:</td>
                              <td className="py-1">
                                {generatedData.siswa_tempat_lahir}, {generatedData.siswa_tanggal_lahir || "-"}
                              </td>
                            </tr>
                          )}
                          {generatedData?.siswa_alamat && (
                            <tr>
                              <td className="py-1 font-medium">Alamat Lengkap</td>
                              <td className="text-center">:</td>
                              <td className="py-1 leading-normal">{generatedData.siswa_alamat}</td>
                            </tr>
                          )}
                        </>
                      ) : (
                        <>
                          <tr>
                            <td className="py-1 font-medium">NIP / NUPTK</td>
                            <td className="text-center">:</td>
                            <td className="py-1">{penerimaNipNis}</td>
                          </tr>
                          <tr>
                            <td className="py-1 font-medium">Jabatan / Tugas</td>
                            <td className="text-center">:</td>
                            <td className="py-1 font-medium">{penerimaKelasJabatan}</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {isStudent ? (
                  <p>
                    Adalah benar-benar siswa yang terdaftar aktif belajar pada {sekolahNama} pada Tahun Pelajaran {tahunAjaran}.
                  </p>
                ) : (
                  <p>
                    Adalah benar-benar bertugas aktif mengajar / bekerja sebagai tenaga kependidikan pada {sekolahNama} pada Tahun Pelajaran {tahunAjaran}.
                  </p>
                )}

                {/* Variabel Tambahan Kustom */}
                {customVariables.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p>Adapun informasi tambahan terkait pelaksanaan keputusan ini adalah:</p>
                    <div className="pl-4">
                      <table className="text-xs w-full max-w-lg border-collapse">
                        <tbody>
                          {customVariables.map((v) => (
                            <tr key={v.key}>
                              <td className="w-36 py-1 capitalize font-medium">{v.key}</td>
                              <td className="w-3 text-center">:</td>
                              <td className="py-1 font-mono font-medium">{v.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Paragraf Penutup */}
                <p className="pt-4 leading-relaxed">
                  Demikian surat keterangan ini kami buat dengan sebenarnya agar dapat dipergunakan sebagaimana mestinya dan dengan penuh tanggung jawab.
                </p>
              </div>
            </div>

            {/* Blok Tanda Tangan */}
            <div className="mt-8 flex justify-end">
              <div className="w-64 text-left font-sans text-xs text-black">
                <p>Kuningan, {tanggalSurat}</p>
                <p className="font-semibold mt-0.5">Kepala Sekolah,</p>
                
                {/* Tanda tangan placeholder */}
                <div className="h-20 flex items-center justify-center my-1.5 relative">
                  <div className="border border-dashed border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded rotate-[-4deg] bg-indigo-50/20 shadow-sm select-none">
                    Tanda Tangan & Cap
                  </div>
                </div>
                
                <p className="font-bold underline text-sm uppercase">{kepalaSekolahNama}</p>
                <p className="text-[10px] text-zinc-600">NIP. {kepalaSekolahNip}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Kolom Kanan: Actions & Summary Panel */}
      <div className="space-y-6">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
          Aksi & Status Dokumen
        </span>
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 space-y-5">
          {/* Status Badge */}
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-3.5 rounded-xl text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs">
              <p className="font-bold">Draft Dokumen Siap</p>
              <p className="text-muted-foreground mt-0.5">Semua data berhasil digabungkan ke template.</p>
            </div>
          </div>

          {/* Penerima List */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Penerima Surat ({selectedRecipients.length})
            </p>
            <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800/80 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-950/20 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {selectedRecipients.length > 0 ? (
                selectedRecipients.map((r, index) => (
                  <div key={r.id || index} className="py-2.5 flex justify-between items-center first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-slate-200 dark:bg-zinc-800 text-[10px] rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-250 truncate max-w-[140px]">
                        {r.name || r.fullName || "Penerima Manual"}
                      </span>
                    </div>
                    <span className="text-muted-foreground text-[10px] bg-white dark:bg-zinc-900 border dark:border-zinc-850 px-2 py-0.5 rounded-full font-mono">
                      {r.nis || r.nip || "-"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-3 text-center text-muted-foreground italic">
                  Penerima Manual
                </div>
              )}
            </div>
          </div>

          {/* Switch Gabungkan Dokumen (hanya tampil jika penerima > 1) */}
          {selectedRecipients.length > 1 && setMergeBatch && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-950/20 border border-slate-150/80 dark:border-slate-850 rounded-xl text-xs mt-3">
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-850 dark:text-slate-250">Gabungkan Berkas</p>
                <p className="text-muted-foreground text-[10px]">Jadikan 1 file Word (.docx) untuk semua penerima</p>
              </div>
              <Switch checked={mergeBatch} onCheckedChange={setMergeBatch} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {onSubmitToVerification && (
              <Button
                onClick={onSubmitToVerification}
                className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-100 dark:shadow-none"
                disabled={loading || submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {submitting ? "Memproses Verifikasi..." : "Cetak & Kirim ke Verifikasi"}
              </Button>
            )}

            <Button
              onClick={onDownload}
              variant="outline"
              className="w-full border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-zinc-950 font-semibold py-5 rounded-xl flex items-center justify-center gap-2"
              disabled={loading || submitting}
            >
              <Download className="h-4 w-4 text-slate-500" />
              {selectedRecipients.length > 1
                ? mergeBatch
                  ? "Unduh Berkas Gabungan (.docx)"
                  : "Download ZIP (Semua Dokumen)"
                : "Unduh Word (.docx)"}
            </Button>

            <Button
              variant="ghost"
              onClick={onBack}
              disabled={loading || submitting}
              className="w-full text-slate-500 hover:text-slate-800 rounded-xl"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali Edit Data
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
