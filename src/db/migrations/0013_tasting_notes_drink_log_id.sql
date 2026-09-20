ALTER TABLE `tasting_notes` ADD `drink_log_id` text REFERENCES drink_logs(id) ON DELETE CASCADE;--> statement-breakpoint
CREATE TABLE `__note_stub_logs` (
	`note_id` text PRIMARY KEY NOT NULL,
	`log_id` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__note_stub_logs` (`note_id`, `log_id`)
SELECT
	`id`,
	lower(
		hex(randomblob(4)) || '-' ||
		hex(randomblob(2)) || '-' ||
		'4' || substr(hex(randomblob(2)), 2) || '-' ||
		substr('89ab', 1 + abs(random()) % 4, 1) || substr(hex(randomblob(2)), 2) || '-' ||
		hex(randomblob(6))
	)
FROM `tasting_notes`
WHERE `drink_log_id` IS NULL;--> statement-breakpoint
INSERT INTO `drink_logs` (
	`id`,
	`user_id`,
	`drunk_at`,
	`drunk_on`,
	`drink_type`,
	`drink_name`,
	`producer`,
	`origin`,
	`variety`,
	`vintage`,
	`volume_ml`,
	`abv_percent`,
	`alcohol_g`,
	`memo`,
	`bottle_id`,
	`created_at`,
	`updated_at`
)
SELECT
	s.`log_id`,
	n.`user_id`,
	CAST((julianday(n.`tasted_on` || ' 11:00:00') - 2440587.5) * 86400000 AS INTEGER),
	n.`tasted_on`,
	n.`drink_type`,
	n.`drink_name`,
	n.`producer`,
	n.`origin`,
	n.`variety`,
	n.`vintage`,
	CASE n.`drink_type`
		WHEN 'beer' THEN 350
		WHEN 'whisky' THEN 30
		WHEN 'sake' THEN 180
		WHEN 'shochu' THEN 60
		WHEN 'cocktail' THEN 120
		WHEN 'other' THEN 100
		ELSE 125
	END,
	CASE n.`drink_type`
		WHEN 'beer' THEN 5.0
		WHEN 'whisky' THEN 40.0
		WHEN 'sake' THEN 15.0
		WHEN 'shochu' THEN 25.0
		WHEN 'cocktail' THEN 15.0
		WHEN 'other' THEN 0.0
		ELSE 12.0
	END,
	CASE n.`drink_type`
		WHEN 'beer' THEN 14.0
		WHEN 'whisky' THEN 9.6
		WHEN 'sake' THEN 21.6
		WHEN 'shochu' THEN 12.0
		WHEN 'cocktail' THEN 14.4
		WHEN 'other' THEN 0.0
		ELSE 12.0
	END,
	'テイスティングノートから移行',
	n.`bottle_id`,
	n.`created_at`,
	n.`updated_at`
FROM `tasting_notes` n
INNER JOIN `__note_stub_logs` s ON s.`note_id` = n.`id`;--> statement-breakpoint
UPDATE `tasting_notes`
SET `drink_log_id` = (
	SELECT `log_id` FROM `__note_stub_logs` WHERE `note_id` = `tasting_notes`.`id`
)
WHERE `drink_log_id` IS NULL;--> statement-breakpoint
DROP TABLE `__note_stub_logs`;--> statement-breakpoint
CREATE TABLE `__note_photo_keep` (
	`photo_id` text PRIMARY KEY NOT NULL,
	`tasting_note_id` text NOT NULL
);--> statement-breakpoint
INSERT INTO `__note_photo_keep` (`photo_id`, `tasting_note_id`)
SELECT `id`, `tasting_note_id` FROM `photos` WHERE `tasting_note_id` IS NOT NULL;--> statement-breakpoint
UPDATE `photos` SET `tasting_note_id` = NULL WHERE `tasting_note_id` IS NOT NULL;--> statement-breakpoint
CREATE TABLE `__new_tasting_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`drink_log_id` text NOT NULL,
	`bottle_id` text,
	`drink_name` text NOT NULL,
	`drink_type` text NOT NULL,
	`vintage` integer,
	`producer` text,
	`origin` text,
	`variety` text,
	`tasted_on` text NOT NULL,
	`appearance` text,
	`aroma` text,
	`taste` text,
	`finish` text,
	`rating_x10` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`drink_log_id`) REFERENCES `drink_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasting_notes_drink_type_check" CHECK(drink_type IN ('wine_red', 'wine_white', 'wine_rose', 'wine_sparkling', 'wine_orange', 'wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);--> statement-breakpoint
INSERT INTO `__new_tasting_notes` (
	`id`,
	`user_id`,
	`drink_log_id`,
	`bottle_id`,
	`drink_name`,
	`drink_type`,
	`vintage`,
	`producer`,
	`origin`,
	`variety`,
	`tasted_on`,
	`appearance`,
	`aroma`,
	`taste`,
	`finish`,
	`rating_x10`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`user_id`,
	`drink_log_id`,
	`bottle_id`,
	`drink_name`,
	`drink_type`,
	`vintage`,
	`producer`,
	`origin`,
	`variety`,
	`tasted_on`,
	`appearance`,
	`aroma`,
	`taste`,
	`finish`,
	`rating_x10`,
	`created_at`,
	`updated_at`
FROM `tasting_notes`;--> statement-breakpoint
DROP TABLE `tasting_notes`;--> statement-breakpoint
ALTER TABLE `__new_tasting_notes` RENAME TO `tasting_notes`;--> statement-breakpoint
CREATE UNIQUE INDEX `tasting_notes_drink_log_uidx` ON `tasting_notes` (`drink_log_id`);--> statement-breakpoint
CREATE INDEX `tasting_notes_user_tasted_on_idx` ON `tasting_notes` (`user_id`,`tasted_on`);--> statement-breakpoint
CREATE INDEX `tasting_notes_user_bottle_idx` ON `tasting_notes` (`user_id`,`bottle_id`);--> statement-breakpoint
UPDATE `photos`
SET `tasting_note_id` = (
	SELECT `tasting_note_id` FROM `__note_photo_keep` WHERE `photo_id` = `photos`.`id`
)
WHERE `id` IN (SELECT `photo_id` FROM `__note_photo_keep`);--> statement-breakpoint
DROP TABLE `__note_photo_keep`;
