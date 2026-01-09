"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, CreditCard, MapPin, Calendar, Users, School } from "lucide-react";
import type { StudentFormValues } from "@/lib/validations/spmb";

interface StudentFormProps {
  form: UseFormReturn<StudentFormValues>;
}

export default function StudentForm({ form }: StudentFormProps) {
  return (
    <div className="space-y-6">
      {/* Full Name */}
      <FormField
        control={form.control}
        name="full_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nama Lengkap
            </FormLabel>
            <FormControl>
              <Input
                placeholder="Masukkan nama lengkap sesuai akta kelahiran"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* NIK */}
      <FormField
        control={form.control}
        name="nik"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              NIK (Nomor Induk Kependudukan)
            </FormLabel>
            <FormControl>
              <Input
                placeholder="16 digit NIK"
                maxLength={16}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Birth Place & Date Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="birth_place"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Tempat Lahir
              </FormLabel>
              <FormControl>
                <Input placeholder="Kota/Kabupaten" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="birth_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Tanggal Lahir
              </FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Gender */}
      <FormField
        control={form.control}
        name="gender"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Jenis Kelamin
            </FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis kelamin" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="L">Laki-laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Previous School */}
      <FormField
        control={form.control}
        name="previous_school"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <School className="h-4 w-4" />
              Asal Sekolah
            </FormLabel>
            <FormControl>
              <Input
                placeholder="Nama TK/Sekolah asal (jika ada)"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
