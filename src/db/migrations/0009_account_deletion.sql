CREATE TABLE `account_deletion_photo_tasks` (
	`r2_key` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`status` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`lease_until` integer,
	`last_error_code` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "account_deletion_photo_tasks_status_check" CHECK(status IN ('pending', 'leased', 'succeeded'))
);
--> statement-breakpoint
CREATE INDEX `account_deletion_photo_tasks_due_idx` ON `account_deletion_photo_tasks` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `account_deletion_records` (
	`user_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`deleted_at` integer NOT NULL,
	`replicated_at` integer
);
--> statement-breakpoint
CREATE TABLE `account_deletion_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photo_object_reservations` (
	`r2_key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`lease_until` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photo_object_reservations_user_lease_idx` ON `photo_object_reservations` (`user_id`,`lease_until`);