CREATE TABLE `library_qr_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`date` text NOT NULL,
	`start_sequence` integer NOT NULL,
	`end_sequence` integer NOT NULL,
	`batch_size` integer NOT NULL,
	`created_at` integer,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `idx_qr_batch_prefix_date` ON `library_qr_batches` (`prefix`,`date`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_library_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text,
	`guest_name` text,
	`institution` text,
	`purpose` text,
	`date` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `library_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_library_visits`("id", "member_id", "guest_name", "institution", "purpose", "date", "timestamp", "created_at") SELECT "id", "member_id", "guest_name", "institution", "purpose", "date", "timestamp", "created_at" FROM `library_visits`;--> statement-breakpoint
DROP TABLE `library_visits`;--> statement-breakpoint
ALTER TABLE `__new_library_visits` RENAME TO `library_visits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_visit_member_date` ON `library_visits` (`member_id`,`date`);