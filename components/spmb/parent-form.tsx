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
import { Textarea } from "@/components/ui/textarea";
import { User, Phone, Mail, Home } from "lucide-react";
import type { ParentFormValues } from "@/lib/validations/spmb";

interface ParentFormProps {
  form: UseFormReturn<ParentFormValues>;
}

export default function ParentForm({ form }: ParentFormProps) {
  return (
    <div className="space-y-6">
      {/* Parent Name */}
      <FormField
        control={form.control}
        name="parent_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Nama Orang Tua / Wali
            </FormLabel>
            <FormControl>
              <Input
                placeholder="Masukkan nama lengkap orang tua/wali"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Phone & Email Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="parent_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Nomor HP
              </FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="parent_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="email@contoh.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Home Address */}
      <FormField
        control={form.control}
        name="home_address"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Alamat Rumah
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Masukkan alamat lengkap (RT/RW, Kelurahan, Kecamatan, Kota)"
                className="min-h-[100px]"
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
