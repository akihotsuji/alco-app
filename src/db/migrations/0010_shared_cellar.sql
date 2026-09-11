CREATE TABLE `cellars` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "cellars_kind_check" CHECK(kind IN ('personal', 'shared'))
);
--> statement-breakpoint
CREATE INDEX `cellars_owner_idx` ON `cellars` (`owner_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `cellars_personal_owner_uidx` ON `cellars` (`owner_user_id`) WHERE "cellars"."kind" = 'personal';--> statement-breakpoint
CREATE TABLE `user_cellar_slots` (
	`user_id` text PRIMARY KEY NOT NULL,
	`personal_cellar_id` text NOT NULL,
	`shared_cellar_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`personal_cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shared_cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_cellar_slots_personal_uidx` ON `user_cellar_slots` (`personal_cellar_id`);--> statement-breakpoint
CREATE TABLE `cellar_members` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cellar_members_cellar_user_uidx` ON `cellar_members` (`cellar_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `cellar_members_user_idx` ON `cellar_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `cellar_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_by` text,
	`expires_at` integer NOT NULL,
	`used_by` text,
	`used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cellar_invitations_token_hash_uidx` ON `cellar_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `cellar_invitations_cellar_idx` ON `cellar_invitations` (`cellar_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `cellar_owner_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`from_user_id` text,
	`to_user_id` text,
	`status` text NOT NULL,
	`expires_at` integer NOT NULL,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "cellar_transfers_status_check" CHECK(status IN ('pending', 'accepted', 'cancelled', 'expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cellar_transfers_pending_uidx` ON `cellar_owner_transfers` (`cellar_id`) WHERE "cellar_owner_transfers"."status" = 'pending';--> statement-breakpoint
CREATE INDEX `cellar_transfers_to_idx` ON `cellar_owner_transfers` (`to_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `cellar_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`bottle_id` text,
	`bottle_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "cellar_activity_action_check" CHECK(action IN ('bottle_created', 'bottle_updated', 'bottle_photo_changed', 'bottle_consumed', 'bottle_restored', 'bottle_moved_in', 'bottle_moved_out', 'bottle_deleted', 'member_joined', 'member_left', 'member_removed', 'owner_transferred', 'cellar_renamed', 'invite_created', 'invite_revoked'))
);
--> statement-breakpoint
CREATE INDEX `cellar_activity_cellar_created_idx` ON `cellar_activity` (`cellar_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cellar_idempotency` (
	`actor_user_id` text NOT NULL,
	`cellar_id` text NOT NULL,
	`operation_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`actor_user_id`, `cellar_id`, `operation_key`),
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cellar_idempotency_created_idx` ON `cellar_idempotency` (`created_at`);--> statement-breakpoint
CREATE TABLE `_personal_cellar_map` (
	`user_id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `_personal_cellar_map` (`user_id`, `cellar_id`)
SELECT
	`id`,
	lower(substr(hex(randomblob(4)), 1, 8) || '-' || substr(hex(randomblob(2)), 1, 4) || '-4' || substr(hex(randomblob(2)), 2, 3) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2, 3) || '-' || substr(hex(randomblob(6)), 1, 12))
FROM `user`;--> statement-breakpoint
INSERT INTO `cellars` (`id`, `kind`, `name`, `owner_user_id`, `revision`, `created_at`, `updated_at`)
SELECT
	m.`cellar_id`,
	'personal',
	'自分のセラー',
	m.`user_id`,
	1,
	u.`created_at`,
	u.`updated_at`
FROM `_personal_cellar_map` m
INNER JOIN `user` u ON u.`id` = m.`user_id`;--> statement-breakpoint
INSERT INTO `cellar_members` (`id`, `cellar_id`, `user_id`, `joined_at`)
SELECT
	lower(substr(hex(randomblob(4)), 1, 8) || '-' || substr(hex(randomblob(2)), 1, 4) || '-4' || substr(hex(randomblob(2)), 2, 3) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2, 3) || '-' || substr(hex(randomblob(6)), 1, 12)),
	m.`cellar_id`,
	m.`user_id`,
	u.`created_at`
FROM `_personal_cellar_map` m
INNER JOIN `user` u ON u.`id` = m.`user_id`;--> statement-breakpoint
INSERT INTO `user_cellar_slots` (`user_id`, `personal_cellar_id`, `shared_cellar_id`)
SELECT m.`user_id`, m.`cellar_id`, NULL
FROM `_personal_cellar_map` m;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`drink_type` text NOT NULL,
	`producer` text,
	`origin` text,
	`variety` text,
	`vintage` integer,
	`purchased_on` text,
	`price_jpy` integer,
	`shop` text,
	`stored_on` text,
	`storage` text,
	`memo` text,
	`status` text DEFAULT 'sealed' NOT NULL,
	`consumed_at` integer,
	`consumed_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "bottles_drink_type_check" CHECK(drink_type IN ('wine_red', 'wine_white', 'wine_rose', 'wine_sparkling', 'wine_orange', 'wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other')),
	CONSTRAINT "bottles_status_check" CHECK(status IN ('sealed', 'consumed'))
);
--> statement-breakpoint
INSERT INTO `__new_bottles`("id", "cellar_id", "created_by", "updated_by", "version", "name", "drink_type", "producer", "origin", "variety", "vintage", "purchased_on", "price_jpy", "shop", "stored_on", "storage", "memo", "status", "consumed_at", "consumed_on", "created_at", "updated_at")
SELECT
	b."id",
	m."cellar_id",
	b."user_id",
	b."user_id",
	1,
	b."name",
	b."drink_type",
	b."producer",
	b."origin",
	b."variety",
	b."vintage",
	b."purchased_on",
	b."price_jpy",
	b."shop",
	b."stored_on",
	b."storage",
	b."memo",
	b."status",
	b."consumed_at",
	b."consumed_on",
	b."created_at",
	b."updated_at"
FROM `bottles` b
INNER JOIN `_personal_cellar_map` m ON m.`user_id` = b.`user_id`;--> statement-breakpoint
DROP TABLE `bottles`;--> statement-breakpoint
ALTER TABLE `__new_bottles` RENAME TO `bottles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bottles_cellar_status_idx` ON `bottles` (`cellar_id`,`status`);--> statement-breakpoint
CREATE INDEX `bottles_cellar_type_idx` ON `bottles` (`cellar_id`,`drink_type`);--> statement-breakpoint
CREATE INDEX `bottles_cellar_consumed_idx` ON `bottles` (`cellar_id`,`consumed_at`);--> statement-breakpoint
CREATE TABLE `__new_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`cellar_id` text,
	`uploaded_by` text,
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
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tasting_note_id`) REFERENCES `tasting_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drink_log_id`) REFERENCES `drink_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photos_owner_check" CHECK((bottle_id IS NOT NULL) + (tasting_note_id IS NOT NULL) + (drink_log_id IS NOT NULL) <= 1),
	CONSTRAINT "photos_scope_check" CHECK((CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN cellar_id IS NOT NULL THEN 1 ELSE 0 END) = 1),
	CONSTRAINT "photos_bottle_scope_check" CHECK(bottle_id IS NULL OR (cellar_id IS NOT NULL AND user_id IS NULL)),
	CONSTRAINT "photos_personal_owner_check" CHECK((tasting_note_id IS NULL AND drink_log_id IS NULL) OR (user_id IS NOT NULL AND cellar_id IS NULL)),
	CONSTRAINT "photos_kind_check" CHECK(kind IN ('photo', 'cutout'))
);
--> statement-breakpoint
INSERT INTO `__new_photos`("id", "user_id", "cellar_id", "uploaded_by", "r2_key", "content_type", "byte_size", "width", "height", "bottle_id", "tasting_note_id", "drink_log_id", "kind", "sort_order", "created_at", "updated_at")
SELECT
	p."id",
	CASE WHEN p."bottle_id" IS NULL THEN p."user_id" ELSE NULL END,
	CASE WHEN p."bottle_id" IS NOT NULL THEN b."cellar_id" ELSE NULL END,
	p."user_id",
	p."r2_key",
	p."content_type",
	p."byte_size",
	p."width",
	p."height",
	p."bottle_id",
	p."tasting_note_id",
	p."drink_log_id",
	p."kind",
	p."sort_order",
	p."created_at",
	p."updated_at"
FROM `photos` p
LEFT JOIN `bottles` b ON b.`id` = p.`bottle_id`;--> statement-breakpoint
DROP TABLE `photos`;--> statement-breakpoint
ALTER TABLE `__new_photos` RENAME TO `photos`;--> statement-breakpoint
CREATE UNIQUE INDEX `photos_r2_key_uidx` ON `photos` (`r2_key`);--> statement-breakpoint
CREATE INDEX `photos_user_created_idx` ON `photos` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `photos_cellar_created_idx` ON `photos` (`cellar_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `photos_uploaded_created_idx` ON `photos` (`uploaded_by`,`created_at`);--> statement-breakpoint
CREATE INDEX `photos_bottle_sort_idx` ON `photos` (`bottle_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `photos_note_sort_idx` ON `photos` (`tasting_note_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `photos_log_idx` ON `photos` (`drink_log_id`);--> statement-breakpoint
DROP TABLE `_personal_cellar_map`;
