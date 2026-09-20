CREATE TABLE `bottle_registration_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cellar_id` text NOT NULL,
	`share_cancelled_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `bottle_registration_batches_user_idx` ON `bottle_registration_batches` (`user_id`);--> statement-breakpoint
CREATE TABLE `friend_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_invitations_token_hash_uidx` ON `friend_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `friend_invitations_owner_idx` ON `friend_invitations` (`owner_user_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `friend_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_user_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`invitation_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`requester_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitation_id`) REFERENCES `friend_invitations`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "friend_requests_status_check" CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled')),
	CONSTRAINT "friend_requests_not_self_check" CHECK(requester_user_id != recipient_user_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friend_requests_pending_pair_uidx` ON `friend_requests` (`requester_user_id`,`recipient_user_id`) WHERE "friend_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `friend_requests_recipient_idx` ON `friend_requests` (`recipient_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `friend_requests_requester_idx` ON `friend_requests` (`requester_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `friendship_epochs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_low_id` text NOT NULL,
	`user_high_id` text NOT NULL,
	`accepted_at` integer NOT NULL,
	`ended_at` integer,
	`ended_reason` text,
	FOREIGN KEY (`user_low_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_high_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "friendship_epochs_order_check" CHECK(user_low_id < user_high_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendship_epochs_active_pair_uidx` ON `friendship_epochs` (`user_low_id`,`user_high_id`) WHERE "friendship_epochs"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `friendship_epochs_pair_idx` ON `friendship_epochs` (`user_low_id`,`user_high_id`);--> statement-breakpoint
CREATE TABLE `opening_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bottle_id` text NOT NULL,
	`cellar_id` text NOT NULL,
	`opened_at` integer NOT NULL,
	`opened_on` text NOT NULL,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opening_events_active_bottle_uidx` ON `opening_events` (`bottle_id`) WHERE "opening_events"."cancelled_at" IS NULL;--> statement-breakpoint
CREATE INDEX `opening_events_user_idx` ON `opening_events` (`user_id`,`opened_at`);--> statement-breakpoint
CREATE TABLE `reaction_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`emoji` text NOT NULL,
	`label` text NOT NULL,
	`sort_order` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reaction_types_code_uidx` ON `reaction_types` (`code`);--> statement-breakpoint
CREATE TABLE `social_avatars` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_avatars_r2_key_uidx` ON `social_avatars` (`r2_key`);--> statement-breakpoint
CREATE INDEX `social_avatars_user_idx` ON `social_avatars` (`user_id`);--> statement-breakpoint
CREATE TABLE `social_blocks` (
	`blocker_user_id` text NOT NULL,
	`blocked_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`blocker_user_id`, `blocked_user_id`),
	FOREIGN KEY (`blocker_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "social_blocks_not_self_check" CHECK(blocker_user_id != blocked_user_id)
);
--> statement-breakpoint
CREATE INDEX `social_blocks_blocked_idx` ON `social_blocks` (`blocked_user_id`);--> statement-breakpoint
CREATE TABLE `social_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_user_id` text NOT NULL,
	`actor_user_id` text,
	`type` text NOT NULL,
	`target_kind` text,
	`target_id` text,
	`dedup_key` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "social_notifications_type_check" CHECK(type IN ('friend_request', 'friend_accepted', 'reaction'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_notifications_dedup_uidx` ON `social_notifications` (`recipient_user_id`,`dedup_key`);--> statement-breakpoint
CREATE INDEX `social_notifications_recipient_idx` ON `social_notifications` (`recipient_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `social_notifications_unread_idx` ON `social_notifications` (`recipient_user_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `social_operation_keys` (
	`actor_user_id` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_json` text NOT NULL,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`actor_user_id`, `operation_key`),
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_operation_keys_created_idx` ON `social_operation_keys` (`created_at`);--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`author_user_id` text NOT NULL,
	`kind` text NOT NULL,
	`published_at` integer NOT NULL,
	`content_updated_at` integer NOT NULL,
	`drink_log_id` text,
	`opening_event_id` text,
	`registration_batch_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drink_log_id`) REFERENCES `drink_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opening_event_id`) REFERENCES `opening_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`registration_batch_id`) REFERENCES `bottle_registration_batches`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "social_posts_kind_check" CHECK(kind IN ('drink_log', 'cellar_add', 'opening', 'opening_with_log', 'cellar_batch'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_drink_log_uidx` ON `social_posts` (`drink_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_opening_uidx` ON `social_posts` (`opening_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_posts_batch_uidx` ON `social_posts` (`registration_batch_id`);--> statement-breakpoint
CREATE INDEX `social_posts_author_published_idx` ON `social_posts` (`author_user_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `social_post_items` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "social_post_items_kind_check" CHECK(source_kind IN ('drink_log', 'bottle', 'opening_event', 'tasting_note'))
);
--> statement-breakpoint
CREATE INDEX `social_post_items_post_idx` ON `social_post_items` (`post_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `social_post_items_source_idx` ON `social_post_items` (`source_kind`,`source_id`);--> statement-breakpoint
CREATE TABLE `social_post_recipients` (
	`post_id` text NOT NULL,
	`viewer_user_id` text NOT NULL,
	`friendship_epoch_id` text NOT NULL,
	PRIMARY KEY(`post_id`, `viewer_user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`viewer_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`friendship_epoch_id`) REFERENCES `friendship_epochs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `social_post_recipients_viewer_idx` ON `social_post_recipients` (`viewer_user_id`,`post_id`);--> statement-breakpoint
CREATE INDEX `social_post_recipients_epoch_idx` ON `social_post_recipients` (`friendship_epoch_id`);--> statement-breakpoint
CREATE TABLE `social_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`share_default_on` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`nickname` text NOT NULL,
	`avatar_mode` text DEFAULT 'mascot' NOT NULL,
	`mascot_color` text NOT NULL,
	`avatar_id` text,
	`profile_completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`avatar_id`) REFERENCES `social_avatars`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "social_profiles_avatar_mode_check" CHECK(avatar_mode IN ('mascot', 'uploaded'))
);
--> statement-breakpoint
CREATE TABLE `social_reactions` (
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`reaction_type_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `user_id`),
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reaction_type_id`) REFERENCES `reaction_types`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `social_reactions_post_type_idx` ON `social_reactions` (`post_id`,`reaction_type_id`);--> statement-breakpoint
ALTER TABLE `bottles` ADD `registration_batch_id` text;--> statement-breakpoint
CREATE INDEX `bottles_registration_batch_idx` ON `bottles` (`registration_batch_id`);--> statement-breakpoint
INSERT INTO `reaction_types` (`id`, `code`, `emoji`, `label`, `sort_order`, `is_active`, `updated_at`) VALUES
	('11111111-1111-4111-8111-111111111111', 'like', '😊', 'いいね', 10, 1, 0),
	('22222222-2222-4222-8222-222222222222', 'delicious', '😍', 'おいしそう', 20, 1, 0),
	('33333333-3333-4333-8333-333333333333', 'want_to_try', '🤤', '飲んでみたい', 30, 1, 0),
	('44444444-4444-4444-8444-444444444444', 'surprised', '😮', 'びっくり', 40, 1, 0),
	('55555555-5555-4555-8555-555555555555', 'celebrate', '🥳', 'おめでとう', 50, 1, 0),
	('66666666-6666-4666-8666-666666666666', 'cheers', '🥂', '乾杯', 60, 1, 0),
	('77777777-7777-4777-8777-777777777777', 'curious', '👀', '気になる', 70, 1, 0);