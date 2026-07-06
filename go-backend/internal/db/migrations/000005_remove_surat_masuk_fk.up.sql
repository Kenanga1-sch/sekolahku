PRAGMA foreign_keys = OFF;

CREATE TABLE `surat_masuk_new` (
	`id` text PRIMARY KEY NOT NULL,
	`agenda_number` text NOT NULL,
	`original_number` text NOT NULL,
	`sender` text NOT NULL,
	`subject` text NOT NULL,
	`date_of_letter` text NOT NULL,
	`received_at` integer NOT NULL,
	`classification_code` text,
	`file_path` text NOT NULL,
	`status` text DEFAULT 'Menunggu Disposisi' NOT NULL,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);

INSERT INTO `surat_masuk_new` (`id`, `agenda_number`, `original_number`, `sender`, `subject`, `date_of_letter`, `received_at`, `classification_code`, `file_path`, `status`, `notes`, `created_at`, `updated_at`)
SELECT `id`, `agenda_number`, `original_number`, `sender`, `subject`, `date_of_letter`, `received_at`, `classification_code`, `file_path`, `status`, `notes`, `created_at`, `updated_at` FROM `surat_masuk`;

DROP TABLE `surat_masuk`;

ALTER TABLE `surat_masuk_new` RENAME TO `surat_masuk`;

PRAGMA foreign_keys = ON;
