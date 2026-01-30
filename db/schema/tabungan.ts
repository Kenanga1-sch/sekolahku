import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { students } from "./students";

// ==========================================
// Tabungan Kelas (Class) Table
// ==========================================

export const tabunganKelas = sqliteTable("tabungan_kelas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  nama: text("nama").notNull(),
  waliKelas: text("wali_kelas").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

// ==========================================
// Tabungan Siswa (Student) Table
// ==========================================

export const tabunganSiswa = sqliteTable(
  "tabungan_siswa",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    studentId: text("student_id").references(() => students.id), // Link to master students
    nisn: text("nisn").unique().notNull(),
    nama: text("nama").notNull(),
    kelasId: text("kelas_id")
      .notNull()
      .references(() => tabunganKelas.id),
    saldoTerakhir: integer("saldo_terakhir").default(0).notNull(),
    qrCode: text("qr_code").unique().notNull(),
    foto: text("foto"), // file path
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    kelasIdx: index("idx_siswa_kelas").on(table.kelasId),
    qrCodeIdx: index("idx_siswa_qr_code").on(table.qrCode),
    studentIdIdx: index("idx_siswa_student_id").on(table.studentId),
    isActiveIdx: index("idx_siswa_is_active").on(table.isActive),
  })
);

// ==========================================
// Tabungan Setoran (Settlement) Table
// ==========================================

export const setoranStatusEnum = ["pending", "verified", "rejected"] as const;
export const setoranTipeEnum = ["setor_ke_bendahara", "tarik_dari_bendahara"] as const;

export const tabunganSetoran = sqliteTable(
  "tabungan_setoran",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    guruId: text("guru_id")
      .notNull()
      .references(() => users.id),
    bendaharaId: text("bendahara_id").references(() => users.id),
    tipe: text("tipe", { enum: setoranTipeEnum }).notNull(),
    totalNominal: integer("total_nominal").notNull(), // System total
    nominalFisik: integer("nominal_fisik"), // Actual cash received
    selisih: integer("selisih").default(0), // totalNominal - nominalFisik
    status: text("status", { enum: setoranStatusEnum })
      .default("pending")
      .notNull(),
    catatan: text("catatan"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    guruIdx: index("idx_setoran_guru").on(table.guruId),
    statusIdx: index("idx_setoran_status").on(table.status),
  })
);

// ==========================================
// Tabungan Brankas (Treasury Ledger) Table
// ==========================================

export const brankasTipeEnum = ["cash", "bank"] as const;

export const tabunganBrankas = sqliteTable("tabungan_brankas", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  nama: text("nama").notNull(), // e.g., "Brankas Sekolah", "Bank BRI"
  tipe: text("tipe", { enum: brankasTipeEnum }).default("cash").notNull(),
  saldo: integer("saldo").default(0).notNull(),
  picId: text("pic_id").references(() => users.id), // PIC / Bendahara
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const brankasTransaksiTipeEnum = [
  "setor_ke_bank",
  "tarik_dari_bank",
  "setor_ke_koperasi",
  "tarik_dari_koperasi"
] as const;

export const tabunganBrankasTransaksi = sqliteTable("tabungan_brankas_transaksi", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  tipe: text("tipe", { enum: brankasTransaksiTipeEnum }).notNull(),
  nominal: integer("nominal").notNull(),
  userId: text("user_id").references(() => users.id),
  catatan: text("catatan"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const tabunganBrankasRelations = relations(tabunganBrankas, ({ one }) => ({
  pic: one(users, {
    fields: [tabunganBrankas.picId],
    references: [users.id],
  }),
}));

// ==========================================
// Tabungan Transaksi (Transaction) Table
// ==========================================

export const transactionTypeEnum = ["setor", "tarik"] as const;
export const transactionStatusEnum = ["pending", "verified", "rejected"] as const;

export const tabunganTransaksi = sqliteTable(
  "tabungan_transaksi",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    siswaId: text("siswa_id")
      .notNull()
      .references(() => tabunganSiswa.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // Link to daily settlement (Setoran)
    setoranId: text("setoran_id").references(() => tabunganSetoran.id),
    
    tipe: text("tipe", { enum: transactionTypeEnum }).notNull(),
    nominal: integer("nominal").notNull(),
    status: text("status", { enum: transactionStatusEnum })
      .default("verified") // Direct verification by teacher
      .notNull(),
    catatan: text("catatan"),
    
    // Deprecated but kept for compatibility/history
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: integer("verified_at", { mode: "timestamp" }),
    
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date()
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    siswaIdx: index("idx_transaksi_siswa").on(table.siswaId),
    statusIdx: index("idx_transaksi_status").on(table.status),
    setoranIdx: index("idx_transaksi_setoran").on(table.setoranId),
    createdIdx: index("idx_transaksi_created").on(table.createdAt),
  })
);

// ==========================================
// Relations
// ==========================================

export const tabunganKelasRelations = relations(tabunganKelas, ({ one, many }) => ({
  waliKelasUser: one(users, {
    fields: [tabunganKelas.waliKelas],
    references: [users.id],
  }),
  siswa: many(tabunganSiswa),
}));

export const tabunganSiswaRelations = relations(
  tabunganSiswa,
  ({ one, many }) => ({
    kelas: one(tabunganKelas, {
      fields: [tabunganSiswa.kelasId],
      references: [tabunganKelas.id],
    }),
    transaksi: many(tabunganTransaksi),
  })
);

export const tabunganSetoranRelations = relations(tabunganSetoran, ({ one, many }) => ({
  guru: one(users, {
    fields: [tabunganSetoran.guruId],
    references: [users.id],
    relationName: "guruSetoran",
  }),
  bendahara: one(users, {
    fields: [tabunganSetoran.bendaharaId],
    references: [users.id],
    relationName: "bendaharaSetoran",
  }),
  transaksi: many(tabunganTransaksi),
}));

export const tabunganTransaksiRelations = relations(
  tabunganTransaksi,
  ({ one }) => ({
    siswa: one(tabunganSiswa, {
      fields: [tabunganTransaksi.siswaId],
      references: [tabunganSiswa.id],
    }),
    user: one(users, {
      fields: [tabunganTransaksi.userId],
      references: [users.id],
    }),
    setoran: one(tabunganSetoran, {
      fields: [tabunganTransaksi.setoranId],
      references: [tabunganSetoran.id],
    }),
    verifier: one(users, {
      fields: [tabunganTransaksi.verifiedBy],
      references: [users.id],
    }),
  })
);

// ==========================================
// Types
// ==========================================

export type TabunganKelas = typeof tabunganKelas.$inferSelect;
export type NewTabunganKelas = typeof tabunganKelas.$inferInsert;
export type TabunganSiswa = typeof tabunganSiswa.$inferSelect;
export type NewTabunganSiswa = typeof tabunganSiswa.$inferInsert;
export type TabunganTransaksi = typeof tabunganTransaksi.$inferSelect;
export type NewTabunganTransaksi = typeof tabunganTransaksi.$inferInsert;
export type TabunganSetoran = typeof tabunganSetoran.$inferSelect;
export type NewTabunganSetoran = typeof tabunganSetoran.$inferInsert;
export type TabunganBrankas = typeof tabunganBrankas.$inferSelect;
export type NewTabunganBrankas = typeof tabunganBrankas.$inferInsert;
export type TransactionType = (typeof transactionTypeEnum)[number];
export type TransactionStatus = (typeof transactionStatusEnum)[number];
export type SetoranStatus = (typeof setoranStatusEnum)[number];
export type SetoranTipe = (typeof setoranTipeEnum)[number];
export type BrankasTipe = (typeof brankasTipeEnum)[number];
export type BrankasTransaksiTipe = (typeof brankasTransaksiTipeEnum)[number];
export type TabunganBrankasTransaksi = typeof tabunganBrankasTransaksi.$inferSelect;
export type NewTabunganBrankasTransaksi = typeof tabunganBrankasTransaksi.$inferInsert;
