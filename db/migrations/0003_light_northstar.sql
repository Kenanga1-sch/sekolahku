CREATE TABLE `tabungan_hutang` (
	`id` text PRIMARY KEY NOT NULL,
	`siswa_id` text NOT NULL,
	`nama_barang` text NOT NULL,
	`kategori` text DEFAULT 'lainnya' NOT NULL,
	`nominal` integer NOT NULL,
	`jumlah` integer DEFAULT 1 NOT NULL,
	`dicatat_oleh` text NOT NULL,
	`tanggal_ambil` integer,
	`catatan` text,
	`status` text DEFAULT 'aktif' NOT NULL,
	`dilunaskan_dari` text,
	`tanggal_lunas` integer,
	`dilunaskan_oleh` text,
	`tahun_ajaran` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`siswa_id`) REFERENCES `tabungan_siswa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dicatat_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dilunaskan_oleh`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_hutang_siswa` ON `tabungan_hutang` (`siswa_id`);--> statement-breakpoint
CREATE INDEX `idx_hutang_status` ON `tabungan_hutang` (`status`);--> statement-breakpoint
CREATE INDEX `idx_hutang_tahun` ON `tabungan_hutang` (`tahun_ajaran`);