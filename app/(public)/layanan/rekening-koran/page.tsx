"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { goPost } from "@/lib/api-client";
import { Loader2, Search, Printer, RefreshCw, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  nisn: z.string().min(10, "NISN harus 10 digit"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Wajib diisi"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Pilih bulan terlebih dahulu"),
});

type SchemaType = z.infer<typeof schema>;

interface StatementMutation {
  date: string;
  refId: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  category: string;
}

interface StatementData {
  student: { id: string; nama: string; nisn: string; kelas: string | null };
  period: { start: string; end: string };
  openingBalance: number;
  mutations: StatementMutation[];
  summary: { totalCredit: number; totalDebit: number; closingBalance: number };
  verificationHash: string;
  generatedAt: string;
}

const formatRupiah = (num: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num);

const monthLabel = (month: string) => {
  try {
    return format(new Date(`${month}-01T00:00:00`), "MMMM yyyy", { locale: idLocale });
  } catch {
    return month;
  }
};

export default function LayananRekeningKoranPage() {
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [viewedMonth, setViewedMonth] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm<SchemaType>({
    resolver: zodResolver(schema),
    defaultValues: {
      nisn: "",
      birthDate: "",
      month: new Date().toISOString().slice(0, 7),
    },
  });

  const onSubmit = async (values: SchemaType) => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await goPost<{ data: StatementData }>(
        "/api/public/tabungan/statement",
        { identifier: values.nisn, birthDate: values.birthDate, month: values.month },
      );
      const st = data.data;
      if (!st || typeof st !== "object" || !st.student || !Array.isArray(st.mutations)) {
        toast.error("Bentuk data rekening koran tidak dikenal");
        return;
      }
      setStatement(st);
      setViewedMonth(values.month);
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengambil rekening koran");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStatement(null);
    setViewedMonth("");
  };

  return (
    <div className="container max-w-2xl py-12 px-4">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Rekening Koran</h1>
        <p className="text-muted-foreground">
          Lihat riwayat transaksi tabungan siswa per bulan.
        </p>
      </div>

      {statement ? (
        <div className="print-area space-y-4">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .print-area, .print-area * { visibility: visible; }
              .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            }
          `}</style>
          <Card className="border-t-4 border-t-green-600 shadow-xl print:shadow-none print:border-t-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{statement.student.nama}</CardTitle>
              <CardDescription className="print:hidden">
                Mutasi {monthLabel(viewedMonth)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">NISN</p>
                  <p className="font-medium">{statement.student.nisn || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kelas</p>
                  <p className="font-medium">{statement.student.kelas || "-"}</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 print:bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                      <th className="px-3 py-2 text-left font-medium">Keterangan</th>
                      <th className="px-3 py-2 text-right font-medium">Masuk</th>
                      <th className="px-3 py-2 text-right font-medium">Keluar</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-2 text-muted-foreground" colSpan={4}>
                        Saldo awal
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {formatRupiah(statement.openingBalance)}
                      </td>
                    </tr>
                    {statement.mutations.length === 0 ? (
                      <tr className="border-t">
                        <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                          Tidak ada transaksi pada bulan ini
                        </td>
                      </tr>
                    ) : (
                      statement.mutations.map((m) => (
                        <tr key={m.refId} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {format(new Date(m.date), "d MMM", { locale: idLocale })}
                          </td>
                          <td className="px-3 py-2">{m.description}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                            {m.credit > 0 ? formatRupiah(m.credit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                            {m.debit > 0 ? formatRupiah(m.debit) : "-"}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatRupiah(m.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30 print:bg-gray-100">
                      <td className="px-3 py-2 font-semibold" colSpan={2}>
                        Total
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatRupiah(statement.summary.totalCredit)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatRupiah(statement.summary.totalDebit)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {formatRupiah(statement.summary.closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2 print:hidden">
              <Button variant="outline" onClick={reset} className="w-full sm:w-auto">
                <RefreshCw className="mr-2 h-4 w-4" /> Lihat Data Lain
              </Button>
              <Button onClick={() => window.print()} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" /> Cetak
              </Button>
            </CardFooter>
          </Card>
          <p className="text-xs text-center text-muted-foreground print:hidden">
            Kode verifikasi dokumen: {statement.verificationHash}
          </p>
        </div>
      ) : (
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-green-600" /> Data Siswa
            </CardTitle>
            <CardDescription>
              Masukkan NISN dan tanggal lahir siswa untuk melihat mutasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nisn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NISN</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" placeholder="10 digit NISN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal Lahir</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="month"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bulan Mutasi</FormLabel>
                        <FormControl>
                          <Input type="month" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Tampilkan Rekening Koran
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
