"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  User, 
  CreditCard, 
  MapPin, 
  Calendar, 
  Users, 
  School, 
  BookOpen, 
  Home, 
  Bus,
  Hash,
  FileText
} from "lucide-react";
import type { StudentFormValues } from "@/lib/validations/spmb";
import { LabelInputContainer, BottomGradient } from "@/components/ui/label-input-container";

interface StudentFormProps {
  form: UseFormReturn<StudentFormValues>;
}

const inputClass = "h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-amber-500 transition-all duration-300 placeholder:text-zinc-400";
const selectTriggerClass = "h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-0 focus:border-amber-500 transition-all duration-300";

export default function StudentForm({ form }: StudentFormProps) {
  return (
    <div className="space-y-8">
      {/* --- IDENTITAS PRIBADI --- */}
      <div className="space-y-6">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-4 text-amber-600 dark:text-amber-500">
          <User className="h-5 w-5" /> Identitas Pribadi
        </h3>

        {/* Full Name */}
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <LabelInputContainer>
                <FormLabel>Nama Lengkap</FormLabel>
                <FormControl>
                   <div className="relative group/btn">
                    <Input placeholder="Sesuai Akta Kelahiran" {...field} className={inputClass} />
                    <BottomGradient />
                   </div>
                </FormControl>
                <FormMessage />
              </LabelInputContainer>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Jenis Kelamin</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* Religion */}
          <FormField
            control={form.control}
            name="religion"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Agama</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih Agama" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Islam">Islam</SelectItem>
                      <SelectItem value="Kristen Protestan">Kristen Protestan</SelectItem>
                      <SelectItem value="Kristen Katolik">Kristen Katolik</SelectItem>
                      <SelectItem value="Hindu">Hindu</SelectItem>
                      <SelectItem value="Buddha">Buddha</SelectItem>
                      <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Birth Place */}
          <FormField
            control={form.control}
            name="birth_place"
            render={({ field }) => (
              <FormItem>
                 <LabelInputContainer>
                  <FormLabel>Tempat Lahir</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="Kota/Kabupaten" {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* Birth Date */}
          <FormField
            control={form.control}
            name="birth_date"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Tanggal Lahir</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input type="date" {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* --- DOKUMEN KEPENDUDUKAN --- */}
      <div className="space-y-6 pt-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-4 text-amber-600 dark:text-amber-500">
          <CreditCard className="h-5 w-5" /> Dokumen Kependudukan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* NIK */}
          <FormField
            control={form.control}
            name="nik"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>NIK Siswa</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="16 digit NIK" maxLength={16} {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">Lihat di Kartu Keluarga</FormDescription>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* No KK */}
          <FormField
            control={form.control}
            name="kk_number"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Nomor Kartu Keluarga</FormLabel>
                  <FormControl>
                     <div className="relative group/btn">
                      <Input placeholder="16 digit No KK" maxLength={16} {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* No Regis Akta (Optional) */}
          <FormField
            control={form.control}
            name="birth_certificate_no"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>No. Registrasi Akta Lahir <span className="text-muted-foreground font-normal">(Opsional)</span></FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="Contoh: 3374-LU-..." {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* NISN (Optional) */}
          <FormField
            control={form.control}
            name="nisn"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>NISN <span className="text-muted-foreground font-normal">(Jika ada)</span></FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="Nomor Induk Siswa Nasional" {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>
      </div>

      {/* --- DATA PELENGKAP --- */}
      <div className="space-y-6 pt-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-4 text-amber-600 dark:text-amber-500">
          <BookOpen className="h-5 w-5" /> Data Pelengkap
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Anak Ke */}
           <FormField
            control={form.control}
            name="child_order"
            render={({ field }) => (
              <FormItem>
                 <LabelInputContainer>
                  <FormLabel>Anak ke-</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input type="number" min={1} {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* Tempat Tinggal */}
          <FormField
            control={form.control}
            name="living_arrangement"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Tempat Tinggal</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Bersama Orang Tua">Bersama Orang Tua</SelectItem>
                      <SelectItem value="Wali">Wali</SelectItem>
                      <SelectItem value="Kos">Kos</SelectItem>
                      <SelectItem value="Asrama">Asrama</SelectItem>
                      <SelectItem value="Panti Asuhan">Panti Asuhan</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* Transportasi */}
          <FormField
            control={form.control}
            name="transport_mode"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Moda Transportasi</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Jalan Kaki">Jalan Kaki</SelectItem>
                      <SelectItem value="Antar Jemput">Antar Jemput Sekolah</SelectItem>
                      <SelectItem value="Kendaraan Pribadi">Kendaraan Pribadi</SelectItem>
                      <SelectItem value="Angkutan Umum">Angkutan Umum</SelectItem>
                      <SelectItem value="Ojek">Ojek</SelectItem>
                      <SelectItem value="Sepeda">Sepeda</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

         {/* Berkebutuhan Khusus */}
         <FormField
            control={form.control}
            name="special_needs"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Berkebutuhan Khusus</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "Tidak"}>
                    <FormControl>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Tidak">Tidak</SelectItem>
                      <SelectItem value="Netra">Netra</SelectItem>
                      <SelectItem value="Rungu">Rungu</SelectItem>
                      <SelectItem value="Grahita Ringan">Grahita Ringan</SelectItem>
                      <SelectItem value="Grahita Sedang">Grahita Sedang</SelectItem>
                      <SelectItem value="Daksa Ringan">Daksa Ringan</SelectItem>
                      <SelectItem value="Daksa Sedang">Daksa Sedang</SelectItem>
                      <SelectItem value="Laras">Laras</SelectItem>
                      <SelectItem value="Wicara">Wicara</SelectItem>
                      <SelectItem value="Hiperaktif">Hiperaktif</SelectItem>
                      <SelectItem value="Cerdas Istimewa">Cerdas Istimewa</SelectItem>
                      <SelectItem value="Bakat Istimewa">Bakat Istimewa</SelectItem>
                      <SelectItem value="Kesulitan Belajar">Kesulitan Belajar</SelectItem>
                      <SelectItem value="Lainnya">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        
        {/* Previous School */}
        <FormField
          control={form.control}
          name="previous_school"
          render={({ field }) => (
            <FormItem>
              <LabelInputContainer>
                <FormLabel>Asal Sekolah (TK/RA/KB) <span className="text-muted-foreground font-normal">(Opsional)</span></FormLabel>
                <FormControl>
                  <div className="relative group/btn">
                    <Input placeholder="Nama sekolah sebelumnya" {...field} className={inputClass} />
                    <BottomGradient />
                  </div>
                </FormControl>
                <FormMessage />
              </LabelInputContainer>
            </FormItem>
          )}
        />
      </div>

      {/* --- KESEJAHTERAAN --- */}
      <div className="space-y-6 pt-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 border-b pb-4 text-amber-600 dark:text-amber-500">
          <FileText className="h-5 w-5" /> Kesejahteraan Peserta Didik
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="has_kps_pkh"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Penerima KPS / PKH
                  </FormLabel>
                  <FormDescription>
                    Centang jika siswa memiliki Kartu Perlindungan Sosial atau Program Keluarga Harapan
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="has_kip"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/50 dark:bg-zinc-900/50">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Penerima KIP (Kartu Indonesia Pintar)
                  </FormLabel>
                  <FormDescription>
                     Centang jika siswa memiliki Kartu Indonesia Pintar
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
