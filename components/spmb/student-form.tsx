
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  GENDER_OPTIONS,
  RELIGION_OPTIONS,
  LIVING_ARRANGEMENT_OPTIONS,
  TRANSPORT_OPTIONS,
  TRAVEL_TIME_OPTIONS,
  SPECIAL_NEEDS_OPTIONS,
  HOBBIES,
  AMBITIONS
} from "./form-constants";

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
                  <FormControl>
                      <SearchableSelect
                        items={GENDER_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih..."
                        className={selectTriggerClass}
                      />
                  </FormControl>
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
                  <FormControl>
                      <SearchableSelect
                        items={RELIGION_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih Agama"
                        className={selectTriggerClass}
                      />
                  </FormControl>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      <Input 
                        type="number" 
                        min={1} 
                        {...field} 
                        value={field.value ?? ""} 
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))} 
                        className={inputClass} 
                      />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />

          {/* Sibling Count */}
          <FormField
            control={form.control}
            name="sibling_count"
            render={({ field }) => (
              <FormItem>
                 <LabelInputContainer>
                  <FormLabel>Jumlah Saudara Kandung</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input 
                        type="number" 
                        min={0} 
                        placeholder="Jml" 
                        {...field} 
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? undefined : parseInt(e.target.value))} 
                        className={inputClass} 
                      />
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
                    <FormControl>
                      <SearchableSelect
                        items={LIVING_ARRANGEMENT_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih..."
                        className={selectTriggerClass}
                      />
                    </FormControl>
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
                    <FormControl>
                      <SearchableSelect
                        items={TRANSPORT_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih..."
                        className={selectTriggerClass}
                      />
                    </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

        {/* Dapodik Extra Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
             {/* Waktu Tempuh */}
            <FormField
              control={form.control}
              name="travel_time"
              render={({ field }) => (
                <FormItem>
                  <LabelInputContainer>
                  <FormLabel>Waktu Tempuh</FormLabel>
                      <FormControl>
                      <SearchableSelect
                        items={TRAVEL_TIME_OPTIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih..."
                        className={selectTriggerClass}
                      />
                      </FormControl>
                    <FormMessage />
                  </LabelInputContainer>
                </FormItem>
              )}
            />

             {/* Hobi */}
             <FormField
              control={form.control}
              name="hobby"
              render={({ field }) => (
                <FormItem>
                  <LabelInputContainer>
                  <FormLabel>Hobi</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        items={HOBBIES}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih hobi..."
                        className={selectTriggerClass}
                      />
                    </FormControl>
                    <FormMessage />
                  </LabelInputContainer>
                </FormItem>
              )}
            />

            {/* Cita-cita */}
            <FormField
              control={form.control}
              name="ambition"
              render={({ field }) => (
                <FormItem>
                  <LabelInputContainer>
                  <FormLabel>Cita-cita</FormLabel>
                     <FormControl>
                       <SearchableSelect
                        items={AMBITIONS}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Pilih cita-cita..."
                        className={selectTriggerClass}
                      />
                     </FormControl>
                    <FormMessage />
                  </LabelInputContainer>
                </FormItem>
              )}
            />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
           {/* Physical Data */}
           <FormField
            control={form.control}
            name="height"
            render={({ field }) => (
              <FormItem>
                 <LabelInputContainer>
                  <FormLabel>Tinggi (cm)</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input type="number" min={0} {...field} onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseInt(e.target.value))} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                 <LabelInputContainer>
                  <FormLabel>Berat (kg)</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input type="number" min={0} {...field} onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseInt(e.target.value))} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           <FormField
            control={form.control}
            name="head_circumference"
            render={({ field }) => (
              <FormItem>
                 <LabelInputContainer>
                  <FormLabel>Lingkar Kepala (cm)</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input type="number" min={0} {...field} onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseInt(e.target.value))} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
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
                    <FormControl>
                        <SearchableSelect
                            items={SPECIAL_NEEDS_OPTIONS}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Pilih..."
                            className={selectTriggerClass}
                        />
                    </FormControl>
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
