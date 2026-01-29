
import { db } from "@/db";
import { contactMessages } from "@/db/schema/misc";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Mail, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import RefreshButton from "@/components/refresh-button"; // We will create this

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const messages = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-800 to-zinc-500 dark:from-white dark:to-zinc-500">
            Pesan Masuk
          </h1>
          <p className="text-muted-foreground mt-2">
            Daftar pesan dari formulir kontak website.
          </p>
        </div>
        <RefreshButton />
      </div>

      <Card className="border-none shadow-xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <CardTitle>Daftar Pesan</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50/50 dark:bg-white/5">
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Pengirim</TableHead>
                  <TableHead>Subjek</TableHead>
                  <TableHead>Pesan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada pesan masuk.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg) => (
                    <TableRow key={msg.id} className="group hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors">
                      <TableCell className="w-[180px] font-medium text-muted-foreground">
                        {msg.createdAt
                          ? format(new Date(msg.createdAt), "dd MMM yyyy HH:mm", {
                              locale: id,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="w-[250px]">
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {msg.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {msg.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="w-[200px] font-medium">
                        {msg.subject}
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <p className="truncate text-muted-foreground group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                          {msg.message}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
