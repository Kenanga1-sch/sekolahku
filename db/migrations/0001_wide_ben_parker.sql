CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_detail_id` text NOT NULL,
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
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_loans_employee` ON `loans` (`employee_detail_id`);--> statement-breakpoint
CREATE INDEX `idx_loans_status` ON `loans` (`status`);--> statement-breakpoint
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
CREATE INDEX `idx_installments_status` ON `loan_installments` (`status`);