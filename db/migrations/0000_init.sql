CREATE TABLE `academic_years` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`semester` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_code_unique` ON `subjects` (`code`);--> statement-breakpoint
CREATE TABLE `alumni` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text,
	`nisn` text,
	`nis` text,
	`full_name` text NOT NULL,
	`gender` text,
	`birth_place` text,
	`birth_date` text,
	`graduation_year` text NOT NULL,
	`graduation_date` integer,
	`final_class` text,
	`photo` text,
	`parent_name` text,
	`parent_phone` text,
	`current_address` text,
	`current_phone` text,
	`current_email` text,
	`next_school` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alumni_nisn_unique` ON `alumni` (`nisn`);--> statement-breakpoint
CREATE INDEX `idx_alumni_nisn` ON `alumni` (`nisn`);--> statement-breakpoint
CREATE INDEX `idx_alumni_graduation_year` ON `alumni` (`graduation_year`);--> statement-breakpoint
CREATE INDEX `idx_alumni_final_class` ON `alumni` (`final_class`);--> statement-breakpoint
CREATE INDEX `idx_alumni_full_name` ON `alumni` (`full_name`);--> statement-breakpoint
CREATE TABLE `alumni_document_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`is_required` integer DEFAULT false,
	`max_file_size_mb` integer DEFAULT 5,
	`allowed_types` text DEFAULT '["application/pdf","image/jpeg","image/png"]',
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alumni_document_types_code_unique` ON `alumni_document_types` (`code`);--> statement-breakpoint
CREATE TABLE `alumni_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`alumni_id` text NOT NULL,
	`document_type_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`document_number` text,
	`issue_date` text,
	`verification_status` text DEFAULT 'pending',
	`verified_by` text,
	`verified_at` integer,
	`verification_notes` text,
	`notes` text,
	`uploaded_by` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`alumni_id`) REFERENCES `alumni`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_type_id`) REFERENCES `alumni_document_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_alumni_documents_alumni_id` ON `alumni_documents` (`alumni_id`);--> statement-breakpoint
CREATE INDEX `idx_alumni_documents_type_id` ON `alumni_documents` (`document_type_id`);--> statement-breakpoint
CREATE INDEX `idx_alumni_documents_verification` ON `alumni_documents` (`verification_status`);--> statement-breakpoint
CREATE TABLE `document_pickups` (
	`id` text PRIMARY KEY NOT NULL,
	`alumni_id` text NOT NULL,
	`document_type_id` text,
	`recipient_name` text NOT NULL,
	`recipient_relation` text,
	`recipient_id_number` text,
	`recipient_phone` text,
	`pickup_date` integer NOT NULL,
	`signature_path` text,
	`photo_proof_path` text,
	`notes` text,
	`handed_over_by` text,
	`created_at` integer,
	FOREIGN KEY (`alumni_id`) REFERENCES `alumni`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_type_id`) REFERENCES `alumni_document_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`handed_over_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_document_pickups_alumni_id` ON `document_pickups` (`alumni_id`);--> statement-breakpoint
CREATE INDEX `idx_document_pickups_date` ON `document_pickups` (`pickup_date`);--> statement-breakpoint
CREATE TABLE `disposisi` (
	`id` text PRIMARY KEY NOT NULL,
	`surat_masuk_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`instruction` text NOT NULL,
	`deadline` text,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` integer,
	`completed_note` text,
	`created_at` integer,
	FOREIGN KEY (`surat_masuk_id`) REFERENCES `surat_masuk`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_disp_surat` ON `disposisi` (`surat_masuk_id`);--> statement-breakpoint
CREATE INDEX `idx_disp_to_user` ON `disposisi` (`to_user_id`);--> statement-breakpoint
CREATE TABLE `klasifikasi_surat` (
	`code` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `surat_keluar` (
	`id` text PRIMARY KEY NOT NULL,
	`mail_number` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`date_of_letter` text NOT NULL,
	`classification_code` text,
	`file_path` text,
	`final_file_path` text,
	`status` text DEFAULT 'Draft' NOT NULL,
	`created_by` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`classification_code`) REFERENCES `klasifikasi_surat`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surat_keluar_mail_number_unique` ON `surat_keluar` (`mail_number`);--> statement-breakpoint
CREATE INDEX `idx_sk_number` ON `surat_keluar` (`mail_number`);--> statement-breakpoint
CREATE INDEX `idx_sk_date` ON `surat_keluar` (`date_of_letter`);--> statement-breakpoint
CREATE INDEX `idx_sk_recipient` ON `surat_keluar` (`recipient`);--> statement-breakpoint
CREATE TABLE `surat_masuk` (
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
	`updated_at` integer,
	FOREIGN KEY (`classification_code`) REFERENCES `klasifikasi_surat`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `surat_masuk_agenda_number_unique` ON `surat_masuk` (`agenda_number`);--> statement-breakpoint
CREATE INDEX `idx_sm_agenda` ON `surat_masuk` (`agenda_number`);--> statement-breakpoint
CREATE INDEX `idx_sm_date` ON `surat_masuk` (`received_at`);--> statement-breakpoint
CREATE INDEX `idx_sm_sender` ON `surat_masuk` (`sender`);--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text DEFAULT 'hadir' NOT NULL,
	`check_in_time` integer,
	`recorded_by` text,
	`record_method` text DEFAULT 'manual' NOT NULL,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_record_session` ON `attendance_records` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_record_student` ON `attendance_records` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_record_status` ON `attendance_records` (`status`);--> statement-breakpoint
CREATE INDEX `idx_attendance_session_student` ON `attendance_records` (`session_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`class_id` text,
	`class_name` text NOT NULL,
	`teacher_id` text,
	`teacher_name` text,
	`status` text DEFAULT 'open' NOT NULL,
	`opened_at` integer,
	`closed_at` integer,
	`notes` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_attendance_session_date` ON `attendance_sessions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_attendance_session_class` ON `attendance_sessions` (`class_name`);--> statement-breakpoint
CREATE INDEX `idx_attendance_session_status` ON `attendance_sessions` (`status`);--> statement-breakpoint
CREATE TABLE `attendance_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_settings_key_unique` ON `attendance_settings` (`key`);--> statement-breakpoint
CREATE TABLE `class_journals` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`date` integer DEFAULT (unixepoch()),
	`class_name` text NOT NULL,
	`subject` text NOT NULL,
	`tp_ids` text,
	`notes` text,
	`student_attendance` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `curriculum_cp` (
	`id` text PRIMARY KEY NOT NULL,
	`fase` text NOT NULL,
	`subject` text NOT NULL,
	`element` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `p5_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`student_id` text NOT NULL,
	`dimension` text NOT NULL,
	`predicate` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`project_id`) REFERENCES `p5_projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `p5_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`theme` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`dimensions` text,
	`grade_level` integer NOT NULL,
	`semester` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `student_grades` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`tp_id` text NOT NULL,
	`score` integer,
	`type` text NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tp_id`) REFERENCES `teacher_tp`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teacher_tp` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`cp_id` text,
	`code` text NOT NULL,
	`content` text NOT NULL,
	`semester` integer NOT NULL,
	`subject` text NOT NULL,
	`grade_level` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cp_id`) REFERENCES `curriculum_cp`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teaching_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`tp_id` text NOT NULL,
	`topic` text NOT NULL,
	`activities` text,
	`allocation_map` text,
	`assessment_plan` text,
	`media_links` text,
	`status` text DEFAULT 'DRAFT',
	`supervisor_feedback` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`tp_id`) REFERENCES `teacher_tp`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employee_details` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nip` text,
	`nuptk` text,
	`nik` text,
	`employment_status` text,
	`job_type` text,
	`join_date` text,
	`is_homeroom` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_employee_user_id` ON `employee_details` (`user_id`);--> statement-breakpoint
CREATE TABLE `finance_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`account_number` text,
	`description` text,
	`is_system` integer DEFAULT false,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	`updated_at` integer DEFAULT (strftime('%s', 'now'))
);
--> statement-breakpoint
CREATE TABLE `finance_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`type` text NOT NULL,
	`account_id_source` text,
	`account_id_dest` text,
	`category_id` text,
	`amount` real NOT NULL,
	`description` text,
	`proof_image` text,
	`status` text DEFAULT 'APPROVED' NOT NULL,
	`ref_table` text,
	`ref_id` text,
	`created_by` text,
	`created_at` integer DEFAULT (strftime('%s', 'now')),
	FOREIGN KEY (`account_id_source`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id_dest`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `finance_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`image_url` text NOT NULL,
	`public_id` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `inventory_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`category` text DEFAULT 'OTHER' NOT NULL,
	`price` integer DEFAULT 0,
	`quantity` integer DEFAULT 1,
	`room_id` text,
	`condition_good` integer DEFAULT 1,
	`condition_light_damaged` integer DEFAULT 0,
	`condition_heavy_damaged` integer DEFAULT 0,
	`condition_lost` integer DEFAULT 0,
	`purchase_date` integer,
	`notes` text,
	`status` text DEFAULT 'ACTIVE',
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `inventory_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`changes` text,
	`user_id` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`category` text DEFAULT 'LAINNYA' NOT NULL,
	`unit` text DEFAULT 'Pcs' NOT NULL,
	`min_stock` integer DEFAULT 5,
	`current_stock` integer DEFAULT 0,
	`location` text,
	`price` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_items_code_unique` ON `inventory_items` (`code`);--> statement-breakpoint
CREATE TABLE `inventory_opname` (
	`id` text PRIMARY KEY NOT NULL,
	`date` integer NOT NULL,
	`room_id` text,
	`auditor_id` text,
	`items` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`note` text,
	`created_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `inventory_rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`description` text,
	`location` text,
	`pic_id` text,
	`created_at` integer,
	FOREIGN KEY (`pic_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`date` integer,
	`description` text,
	`recipient` text,
	`proof_image` text,
	`user_id` text,
	`created_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generated_letters` (
	`id` text PRIMARY KEY NOT NULL,
	`letter_number` text NOT NULL,
	`sequence_number` integer NOT NULL,
	`recipient` text,
	`template_id` text,
	`created_at` integer,
	FOREIGN KEY (`template_id`) REFERENCES `letter_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `letter_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'GENERAL' NOT NULL,
	`content` text,
	`file_path` text,
	`type` text DEFAULT 'EDITOR' NOT NULL,
	`paper_size` text DEFAULT 'A4' NOT NULL,
	`orientation` text DEFAULT 'portrait' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_template_name` ON `letter_templates` (`name`);--> statement-breakpoint
CREATE INDEX `idx_template_category` ON `letter_templates` (`category`);--> statement-breakpoint
CREATE TABLE `library_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_id` text NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`location` text,
	`condition` text DEFAULT 'Baik',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`catalog_id`) REFERENCES `library_catalog`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_asset_catalog` ON `library_assets` (`catalog_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_status` ON `library_assets` (`status`);--> statement-breakpoint
CREATE TABLE `library_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`isbn` text,
	`title` text NOT NULL,
	`author` text,
	`publisher` text,
	`year` integer,
	`category` text DEFAULT 'OTHER' NOT NULL,
	`description` text,
	`cover` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_catalog_isbn_unique` ON `library_catalog` (`isbn`);--> statement-breakpoint
CREATE INDEX `idx_catalog_isbn` ON `library_catalog` (`isbn`);--> statement-breakpoint
CREATE INDEX `idx_catalog_title` ON `library_catalog` (`title`);--> statement-breakpoint
CREATE TABLE `library_loans` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`item_id` text NOT NULL,
	`borrow_date` integer NOT NULL,
	`due_date` integer NOT NULL,
	`return_date` integer,
	`is_returned` integer DEFAULT false NOT NULL,
	`fine_amount` integer DEFAULT 0 NOT NULL,
	`fine_paid` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`member_id`) REFERENCES `library_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `library_assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loan_member` ON `library_loans` (`member_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_item` ON `library_loans` (`item_id`);--> statement-breakpoint
CREATE INDEX `idx_loan_is_returned` ON `library_loans` (`is_returned`);--> statement-breakpoint
CREATE TABLE `library_members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`student_id` text,
	`name` text NOT NULL,
	`class_name` text,
	`qr_code` text NOT NULL,
	`max_borrow_limit` integer DEFAULT 3 NOT NULL,
	`photo` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_members_qr_code_unique` ON `library_members` (`qr_code`);--> statement-breakpoint
CREATE INDEX `idx_member_qr_code` ON `library_members` (`qr_code`);--> statement-breakpoint
CREATE INDEX `idx_member_student_id` ON `library_members` (`student_id`);--> statement-breakpoint
CREATE TABLE `library_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`date` text NOT NULL,
	`timestamp` integer NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`member_id`) REFERENCES `library_members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_visit_member_date` ON `library_visits` (`member_id`,`date`);--> statement-breakpoint
CREATE TABLE `loan_installments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`installment_number` integer NOT NULL,
	`due_date` integer NOT NULL,
	`principal_amount` real NOT NULL,
	`interest_amount` real DEFAULT 0,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'UNPAID',
	`paid_at` integer,
	`payment_method` text,
	`notes` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_installments_loan` ON `loan_installments` (`loan_id`);--> statement-breakpoint
CREATE INDEX `idx_installments_due_date` ON `loan_installments` (`due_date`);--> statement-breakpoint
CREATE INDEX `idx_installments_status` ON `loan_installments` (`status`);--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_detail_id` text,
	`borrower_type` text DEFAULT 'EMPLOYEE' NOT NULL,
	`borrower_name` text,
	`description` text,
	`type` text NOT NULL,
	`amount_requested` real NOT NULL,
	`amount_approved` real,
	`tenor_months` integer NOT NULL,
	`admin_fee` real DEFAULT 0,
	`status` text DEFAULT 'PENDING',
	`rejection_reason` text,
	`notes` text,
	`disbursed_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`employee_detail_id`) REFERENCES `employee_details`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loans_employee` ON `loans` (`employee_detail_id`);--> statement-breakpoint
CREATE INDEX `idx_loans_status` ON `loans` (`status`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text,
	`excerpt` text,
	`category` text,
	`thumbnail` text,
	`is_published` integer DEFAULT false,
	`is_featured` integer DEFAULT false,
	`published_at` integer,
	`author_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `announcements_slug_unique` ON `announcements` (`slug`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`resource` text NOT NULL,
	`details` text,
	`user_id` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`is_read` integer DEFAULT false,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `school_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`school_name` text NOT NULL,
	`school_npsn` text,
	`school_address` text,
	`school_phone` text,
	`school_email` text,
	`school_website` text,
	`school_logo` text,
	`school_lat` real,
	`school_lng` real,
	`max_distance_km` real,
	`spmb_is_open` integer DEFAULT false,
	`current_academic_year` text DEFAULT '2025/2026',
	`principal_name` text,
	`principal_nip` text,
	`is_maintenance` integer DEFAULT false,
	`last_letter_number` integer DEFAULT 0,
	`letter_number_format` text DEFAULT '421/{nomor}/SDN1-KNG/{bulan}/{tahun}',
	`savings_treasurer_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`savings_treasurer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mutasi_out_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`destination_school` text NOT NULL,
	`reason` text NOT NULL,
	`reason_detail` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`downloaded_at` integer,
	`processed_at` integer,
	`completed_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_mutasi_out_student_id` ON `mutasi_out_requests` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_mutasi_out_status` ON `mutasi_out_requests` (`status`);--> statement-breakpoint
CREATE TABLE `mutasi_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_number` text NOT NULL,
	`student_name` text NOT NULL,
	`nisn` text NOT NULL,
	`gender` text NOT NULL,
	`origin_school` text NOT NULL,
	`origin_school_address` text,
	`target_grade` integer NOT NULL,
	`target_class_id` text,
	`parent_name` text NOT NULL,
	`whatsapp_number` text NOT NULL,
	`status_approval` text DEFAULT 'pending' NOT NULL,
	`status_delivery` text DEFAULT 'unsent' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`target_class_id`) REFERENCES `student_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mutasi_requests_registration_number_unique` ON `mutasi_requests` (`registration_number`);--> statement-breakpoint
CREATE INDEX `idx_mutasi_status` ON `mutasi_requests` (`status_approval`);--> statement-breakpoint
CREATE INDEX `idx_mutasi_created` ON `mutasi_requests` (`created_at`);--> statement-breakpoint
CREATE TABLE `admin_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`type` text DEFAULT 'info' NOT NULL,
	`category` text DEFAULT 'system' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`target_url` text,
	`is_read` integer DEFAULT false NOT NULL,
	`metadata` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `spmb_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`academic_year` text NOT NULL,
	`name` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`quota` integer DEFAULT 0,
	`is_active` integer DEFAULT false,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `spmb_registrants` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_number` text NOT NULL,
	`full_name` text NOT NULL,
	`student_name` text,
	`nisn` text,
	`student_nik` text NOT NULL,
	`kk_number` text NOT NULL,
	`birth_certificate_no` text,
	`birth_date` integer NOT NULL,
	`birth_place` text NOT NULL,
	`gender` text NOT NULL,
	`religion` text NOT NULL,
	`special_needs` text,
	`living_arrangement` text,
	`transport_mode` text,
	`child_order` integer,
	`has_kps_pkh` integer DEFAULT false,
	`has_kip` integer DEFAULT false,
	`previous_school` text,
	`address_street` text NOT NULL,
	`address_rt` text NOT NULL,
	`address_rw` text NOT NULL,
	`address_village` text NOT NULL,
	`postal_code` text,
	`address` text NOT NULL,
	`parent_name` text DEFAULT '-' NOT NULL,
	`parent_phone` text NOT NULL,
	`parent_email` text,
	`father_name` text,
	`father_nik` text,
	`father_birth_year` text,
	`father_education` text,
	`father_job` text,
	`father_income` text,
	`mother_name` text,
	`mother_nik` text,
	`mother_birth_year` text,
	`mother_education` text,
	`mother_job` text,
	`mother_income` text,
	`guardian_name` text,
	`guardian_nik` text,
	`guardian_birth_year` text,
	`guardian_education` text,
	`guardian_job` text,
	`guardian_income` text,
	`home_lat` real,
	`home_lng` real,
	`distance_to_school` real,
	`is_in_zone` integer DEFAULT false,
	`status` text DEFAULT 'draft',
	`notes` text,
	`priority_rank` integer,
	`priority_group` integer,
	`period_id` text,
	`documents` text,
	`verified_by` text,
	`verified_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`period_id`) REFERENCES `spmb_periods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `spmb_registrants_registration_number_unique` ON `spmb_registrants` (`registration_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `spmb_registrants_student_nik_unique` ON `spmb_registrants` (`student_nik`);--> statement-breakpoint
CREATE INDEX `idx_registrant_status` ON `spmb_registrants` (`status`);--> statement-breakpoint
CREATE INDEX `idx_registrant_created` ON `spmb_registrants` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_registrant_period` ON `spmb_registrants` (`period_id`);--> statement-breakpoint
CREATE TABLE `staff_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`degree` text,
	`position` text NOT NULL,
	`category` text NOT NULL,
	`photo_url` text,
	`nip` text,
	`quote` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_staff_category` ON `staff_profiles` (`category`);--> statement-breakpoint
CREATE INDEX `idx_staff_active` ON `staff_profiles` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_staff_order` ON `staff_profiles` (`display_order`);--> statement-breakpoint
CREATE TABLE `student_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'lainnya' NOT NULL,
	`file_url` text NOT NULL,
	`file_size` integer,
	`mime_type` text,
	`is_verified` integer DEFAULT false,
	`uploaded_at` integer,
	`uploaded_by` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_doc_student` ON `student_documents` (`student_id`);--> statement-breakpoint
CREATE TABLE `student_class_history` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`class_id` text,
	`class_name` text,
	`academic_year` text NOT NULL,
	`grade` integer,
	`status` text NOT NULL,
	`notes` text,
	`record_date` integer,
	`promoted_by` text,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `student_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_history_student` ON `student_class_history` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_history_year` ON `student_class_history` (`academic_year`);--> statement-breakpoint
CREATE TABLE `student_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`grade` integer NOT NULL,
	`academic_year` text NOT NULL,
	`teacher_name` text,
	`capacity` integer DEFAULT 28 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`nik` text,
	`nisn` text,
	`nis` text,
	`full_name` text NOT NULL,
	`gender` text,
	`birth_place` text,
	`birth_date` text,
	`religion` text,
	`address` text,
	`parent_name` text,
	`father_name` text,
	`father_nik` text,
	`mother_name` text,
	`mother_nik` text,
	`guardian_name` text,
	`guardian_nik` text,
	`guardian_job` text,
	`parent_phone` text,
	`class_name` text,
	`class_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`photo` text,
	`qr_code` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`meta_data` text,
	`enrolled_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`class_id`) REFERENCES `student_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_nik_unique` ON `students` (`nik`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_nisn_unique` ON `students` (`nisn`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_nis_unique` ON `students` (`nis`);--> statement-breakpoint
CREATE UNIQUE INDEX `students_qr_code_unique` ON `students` (`qr_code`);--> statement-breakpoint
CREATE INDEX `idx_student_nisn` ON `students` (`nisn`);--> statement-breakpoint
CREATE INDEX `idx_student_nis` ON `students` (`nis`);--> statement-breakpoint
CREATE INDEX `idx_student_qr_code` ON `students` (`qr_code`);--> statement-breakpoint
CREATE INDEX `idx_student_class_id` ON `students` (`class_id`);--> statement-breakpoint
CREATE INDEX `idx_student_status` ON `students` (`status`);--> statement-breakpoint
CREATE TABLE `tabungan_brankas` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`tipe` text DEFAULT 'cash' NOT NULL,
	`saldo` integer DEFAULT 0 NOT NULL,
	`pic_id` text,
	`updated_at` integer,
	FOREIGN KEY (`pic_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tabungan_brankas_transaksi` (
	`id` text PRIMARY KEY NOT NULL,
	`tipe` text NOT NULL,
	`nominal` integer NOT NULL,
	`user_id` text,
	`catatan` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tabungan_kelas` (
	`id` text PRIMARY KEY NOT NULL,
	`nama` text NOT NULL,
	`wali_kelas` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`wali_kelas`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tabungan_setoran` (
	`id` text PRIMARY KEY NOT NULL,
	`guru_id` text NOT NULL,
	`bendahara_id` text,
	`tipe` text NOT NULL,
	`total_nominal` integer NOT NULL,
	`nominal_fisik` integer,
	`selisih` integer DEFAULT 0,
	`status` text DEFAULT 'pending' NOT NULL,
	`catatan` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`guru_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bendahara_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_setoran_guru` ON `tabungan_setoran` (`guru_id`);--> statement-breakpoint
CREATE INDEX `idx_setoran_status` ON `tabungan_setoran` (`status`);--> statement-breakpoint
CREATE TABLE `tabungan_siswa` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text,
	`nisn` text NOT NULL,
	`nama` text NOT NULL,
	`kelas_id` text NOT NULL,
	`saldo_terakhir` integer DEFAULT 0 NOT NULL,
	`qr_code` text NOT NULL,
	`foto` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`kelas_id`) REFERENCES `tabungan_kelas`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tabungan_siswa_nisn_unique` ON `tabungan_siswa` (`nisn`);--> statement-breakpoint
CREATE UNIQUE INDEX `tabungan_siswa_qr_code_unique` ON `tabungan_siswa` (`qr_code`);--> statement-breakpoint
CREATE INDEX `idx_siswa_kelas` ON `tabungan_siswa` (`kelas_id`);--> statement-breakpoint
CREATE INDEX `idx_siswa_qr_code` ON `tabungan_siswa` (`qr_code`);--> statement-breakpoint
CREATE INDEX `idx_siswa_student_id` ON `tabungan_siswa` (`student_id`);--> statement-breakpoint
CREATE INDEX `idx_siswa_is_active` ON `tabungan_siswa` (`is_active`);--> statement-breakpoint
CREATE TABLE `tabungan_transaksi` (
	`id` text PRIMARY KEY NOT NULL,
	`siswa_id` text NOT NULL,
	`user_id` text NOT NULL,
	`setoran_id` text,
	`tipe` text NOT NULL,
	`nominal` integer NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`catatan` text,
	`verified_by` text,
	`verified_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`siswa_id`) REFERENCES `tabungan_siswa`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`setoran_id`) REFERENCES `tabungan_setoran`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_transaksi_siswa` ON `tabungan_transaksi` (`siswa_id`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_status` ON `tabungan_transaksi` (`status`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_setoran` ON `tabungan_transaksi` (`setoran_id`);--> statement-breakpoint
CREATE INDEX `idx_transaksi_created` ON `tabungan_transaksi` (`created_at`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`full_name` text NOT NULL,
	`nip_nisn` text,
	`phone` text,
	`address` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_user_id_unique` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text,
	`username` text,
	`password_hash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`full_name` text,
	`phone` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
