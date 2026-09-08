PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bottles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bottles_drink_type_check" CHECK(drink_type IN ('wine_red', 'wine_white', 'wine_rose', 'wine_sparkling', 'wine_orange', 'wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other')),
	CONSTRAINT "bottles_status_check" CHECK(status IN ('sealed', 'consumed'))
);
--> statement-breakpoint
INSERT INTO `__new_bottles`("id", "user_id", "name", "drink_type", "producer", "origin", "variety", "vintage", "purchased_on", "price_jpy", "shop", "stored_on", "storage", "memo", "status", "consumed_at", "consumed_on", "created_at", "updated_at") SELECT "id", "user_id", "name", "drink_type", "producer", "origin", "variety", "vintage", "purchased_on", "price_jpy", "shop", "stored_on", "storage", "memo", "status", "consumed_at", "consumed_on", "created_at", "updated_at" FROM `bottles`;--> statement-breakpoint
DROP TABLE `bottles`;--> statement-breakpoint
ALTER TABLE `__new_bottles` RENAME TO `bottles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bottles_user_status_idx` ON `bottles` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `bottles_user_type_idx` ON `bottles` (`user_id`,`drink_type`);--> statement-breakpoint
CREATE INDEX `bottles_user_consumed_idx` ON `bottles` (`user_id`,`consumed_at`);--> statement-breakpoint
CREATE TABLE `__new_drink_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`drunk_at` integer NOT NULL,
	`drunk_on` text NOT NULL,
	`drink_type` text NOT NULL,
	`drink_name` text,
	`producer` text,
	`origin` text,
	`variety` text,
	`vintage` integer,
	`volume_ml` integer NOT NULL,
	`abv_percent` real NOT NULL,
	`alcohol_g` real NOT NULL,
	`memo` text,
	`place_name` text,
	`place_lat` real,
	`place_lng` real,
	`my_drink_id` text,
	`bottle_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`my_drink_id`) REFERENCES `my_drinks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "drink_logs_drink_type_check" CHECK(drink_type IN ('wine_red', 'wine_white', 'wine_rose', 'wine_sparkling', 'wine_orange', 'wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);
--> statement-breakpoint
INSERT INTO `__new_drink_logs`("id", "user_id", "drunk_at", "drunk_on", "drink_type", "drink_name", "producer", "origin", "variety", "vintage", "volume_ml", "abv_percent", "alcohol_g", "memo", "place_name", "place_lat", "place_lng", "my_drink_id", "bottle_id", "created_at", "updated_at") SELECT "id", "user_id", "drunk_at", "drunk_on", "drink_type", "drink_name", "producer", "origin", "variety", "vintage", "volume_ml", "abv_percent", "alcohol_g", "memo", "place_name", "place_lat", "place_lng", "my_drink_id", "bottle_id", "created_at", "updated_at" FROM `drink_logs`;--> statement-breakpoint
DROP TABLE `drink_logs`;--> statement-breakpoint
ALTER TABLE `__new_drink_logs` RENAME TO `drink_logs`;--> statement-breakpoint
CREATE INDEX `drink_logs_user_drunk_on_idx` ON `drink_logs` (`user_id`,`drunk_on`);--> statement-breakpoint
CREATE INDEX `drink_logs_user_drunk_at_idx` ON `drink_logs` (`user_id`,`drunk_at`);--> statement-breakpoint
CREATE INDEX `drink_logs_my_drink_id_idx` ON `drink_logs` (`my_drink_id`);--> statement-breakpoint
CREATE INDEX `drink_logs_user_bottle_idx` ON `drink_logs` (`user_id`,`bottle_id`);--> statement-breakpoint
CREATE TABLE `__new_my_drinks` (
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
	CONSTRAINT "my_drinks_drink_type_check" CHECK(drink_type IN ('wine_red', 'wine_white', 'wine_rose', 'wine_sparkling', 'wine_orange', 'wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);
--> statement-breakpoint
INSERT INTO `__new_my_drinks`("id", "user_id", "name", "drink_type", "volume_ml", "abv_percent", "sort_order", "created_at", "updated_at") SELECT "id", "user_id", "name", "drink_type", "volume_ml", "abv_percent", "sort_order", "created_at", "updated_at" FROM `my_drinks`;--> statement-breakpoint
DROP TABLE `my_drinks`;--> statement-breakpoint
ALTER TABLE `__new_my_drinks` RENAME TO `my_drinks`;--> statement-breakpoint
CREATE INDEX `my_drinks_user_sort_idx` ON `my_drinks` (`user_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `__new_tasting_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
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
	FOREIGN KEY (`bottle_id`) REFERENCES `bottles`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "tasting_notes_drink_type_check" CHECK(drink_type IN ('wine_red', 'wine_white', 'wine_rose', 'wine_sparkling', 'wine_orange', 'wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other'))
);
--> statement-breakpoint
INSERT INTO `__new_tasting_notes`("id", "user_id", "bottle_id", "drink_name", "drink_type", "vintage", "producer", "origin", "variety", "tasted_on", "appearance", "aroma", "taste", "finish", "rating_x10", "created_at", "updated_at") SELECT "id", "user_id", "bottle_id", "drink_name", "drink_type", "vintage", "producer", "origin", "variety", "tasted_on", "appearance", "aroma", "taste", "finish", "rating_x10", "created_at", "updated_at" FROM `tasting_notes`;--> statement-breakpoint
DROP TABLE `tasting_notes`;--> statement-breakpoint
ALTER TABLE `__new_tasting_notes` RENAME TO `tasting_notes`;--> statement-breakpoint
CREATE INDEX `tasting_notes_user_tasted_on_idx` ON `tasting_notes` (`user_id`,`tasted_on`);--> statement-breakpoint
CREATE INDEX `tasting_notes_user_bottle_idx` ON `tasting_notes` (`user_id`,`bottle_id`);