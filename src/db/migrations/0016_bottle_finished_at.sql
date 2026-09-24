PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cellar_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`cellar_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`bottle_id` text,
	`bottle_name` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cellar_id`) REFERENCES `cellars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "cellar_activity_action_check" CHECK(action IN ('bottle_created', 'bottle_updated', 'bottle_photo_changed', 'bottle_consumed', 'bottle_restored', 'bottle_finished', 'bottle_reopened', 'bottle_moved_in', 'bottle_moved_out', 'bottle_deleted', 'member_joined', 'member_left', 'member_removed', 'owner_transferred', 'cellar_renamed', 'invite_created', 'invite_revoked'))
);
--> statement-breakpoint
INSERT INTO `__new_cellar_activity`("id", "cellar_id", "actor_user_id", "action", "bottle_id", "bottle_name", "created_at") SELECT "id", "cellar_id", "actor_user_id", "action", "bottle_id", "bottle_name", "created_at" FROM `cellar_activity`;--> statement-breakpoint
DROP TABLE `cellar_activity`;--> statement-breakpoint
ALTER TABLE `__new_cellar_activity` RENAME TO `cellar_activity`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `cellar_activity_cellar_created_idx` ON `cellar_activity` (`cellar_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `bottles` ADD `finished_at` integer;--> statement-breakpoint
ALTER TABLE `bottles` ADD `finished_on` text;--> statement-breakpoint
CREATE INDEX `bottles_cellar_finished_idx` ON `bottles` (`cellar_id`,`finished_at`);--> statement-breakpoint
-- 既存の貯蔵庫（開栓済み）は飲み切り扱いで残す。開栓日時（consumed_*）はそのまま（spec/features/bottle-tasting.md 6 章）
UPDATE `bottles` SET `finished_at` = `consumed_at`, `finished_on` = `consumed_on` WHERE `status` = 'consumed';