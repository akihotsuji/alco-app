CREATE TABLE `ai_usage` (
	`user_id` text NOT NULL,
	`used_on` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `used_on`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`drink_type` text NOT NULL,
	`producer` text,
	`origin` text,
	`vintage` integer,
	`purchased_on` text,
	`price_jpy` integer,
	`shop` text,
	`storage` text,
	`memo` text,
	`status` text DEFAULT 'sealed' NOT NULL,
	`opened_on` text,
	`consumed_at` integer,
	`consumed_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bottles_drink_type_check" CHECK(drink_type IN ('wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other')),
	CONSTRAINT "bottles_status_check" CHECK(status IN ('sealed', 'opened', 'consumed'))
);
--> statement-breakpoint
CREATE INDEX `bottles_user_status_idx` ON `bottles` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `bottles_user_type_idx` ON `bottles` (`user_id`,`drink_type`);--> statement-breakpoint
CREATE INDEX `bottles_user_consumed_idx` ON `bottles` (`user_id`,`consumed_at`);--> statement-breakpoint
CREATE TABLE `drink_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`drunk_at` integer NOT NULL,
	`drunk_on` text NOT NULL,
	`drink_type` text NOT NULL,
	`drink_name` text,
	`volume_ml` integer NOT NULL,
	`abv_percent` real NOT NULL,
	`alcohol_g` real NOT NULL,
	`memo` text,
	`my_drink_id` text,
	`bottle_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`my_drink_id`) REFERENCES `my_drinks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "drink_logs_drink_type_check" CHECK(drink_type IN ('wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);
--> statement-breakpoint
CREATE INDEX `drink_logs_user_drunk_on_idx` ON `drink_logs` (`user_id`,`drunk_on`);--> statement-breakpoint
CREATE INDEX `drink_logs_user_drunk_at_idx` ON `drink_logs` (`user_id`,`drunk_at`);--> statement-breakpoint
CREATE INDEX `drink_logs_my_drink_id_idx` ON `drink_logs` (`my_drink_id`);--> statement-breakpoint
CREATE INDEX `drink_logs_user_bottle_idx` ON `drink_logs` (`user_id`,`bottle_id`);--> statement-breakpoint
CREATE TABLE `my_drinks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`drink_type` text NOT NULL,
	`volume_ml` integer NOT NULL,
	`abv_percent` real NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "my_drinks_drink_type_check" CHECK(drink_type IN ('wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);
--> statement-breakpoint
CREATE INDEX `my_drinks_user_sort_idx` ON `my_drinks` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`bottle_id` text,
	`tasting_note_id` text,
	`drink_log_id` text,
	`kind` text DEFAULT 'photo' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tasting_note_id`) REFERENCES `tasting_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drink_log_id`) REFERENCES `drink_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photos_owner_check" CHECK((bottle_id IS NOT NULL) + (tasting_note_id IS NOT NULL) + (drink_log_id IS NOT NULL) <= 1),
	CONSTRAINT "photos_kind_check" CHECK(kind IN ('photo', 'cutout'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_r2_key_uidx` ON `photos` (`r2_key`);--> statement-breakpoint
CREATE INDEX `photos_user_created_idx` ON `photos` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `photos_bottle_sort_idx` ON `photos` (`bottle_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `photos_note_sort_idx` ON `photos` (`tasting_note_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `photos_log_idx` ON `photos` (`drink_log_id`);--> statement-breakpoint
CREATE TABLE `tasting_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bottle_id` text,
	`drink_name` text NOT NULL,
	`drink_type` text NOT NULL,
	`tasted_on` text NOT NULL,
	`appearance` text,
	`aroma` text,
	`taste` text,
	`finish` text,
	`rating_x10` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasting_notes_drink_type_check" CHECK(drink_type IN ('wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);
--> statement-breakpoint
CREATE INDEX `tasting_notes_user_tasted_on_idx` ON `tasting_notes` (`user_id`,`tasted_on`);--> statement-breakpoint
CREATE INDEX `tasting_notes_user_bottle_idx` ON `tasting_notes` (`user_id`,`bottle_id`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);