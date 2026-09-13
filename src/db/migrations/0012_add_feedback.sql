CREATE TABLE `feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`category` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "feedbacks_category_check" CHECK(category IN ('improvement', 'bug', 'other'))
);
--> statement-breakpoint
CREATE INDEX `feedbacks_user_created_idx` ON `feedbacks` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `feedback_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`feedback_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`feedback_id`) REFERENCES `feedbacks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_photos_r2_key_uidx` ON `feedback_photos` (`r2_key`);
--> statement-breakpoint
CREATE INDEX `feedback_photos_feedback_idx` ON `feedback_photos` (`feedback_id`);
