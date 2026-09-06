PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bottles` (
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
	`consumed_at` integer,
	`consumed_on` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "bottles_drink_type_check" CHECK(drink_type IN ('wine', 'beer', 'whisky', 'sake', 'shochu', 'cocktail', 'other')),
	CONSTRAINT "bottles_status_check" CHECK(status IN ('sealed', 'consumed'))
);
--> statement-breakpoint
INSERT INTO `__new_bottles`("id", "user_id", "name", "drink_type", "producer", "origin", "vintage", "purchased_on", "price_jpy", "shop", "storage", "memo", "status", "consumed_at", "consumed_on", "created_at", "updated_at") SELECT "id", "user_id", "name", "drink_type", "producer", "origin", "vintage", "purchased_on", "price_jpy", "shop", "storage", "memo", CASE WHEN "status" = 'opened' THEN 'sealed' ELSE "status" END, "consumed_at", "consumed_on", "created_at", "updated_at" FROM `bottles`;--> statement-breakpoint
DROP TABLE `bottles`;--> statement-breakpoint
ALTER TABLE `__new_bottles` RENAME TO `bottles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bottles_user_status_idx` ON `bottles` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `bottles_user_type_idx` ON `bottles` (`user_id`,`drink_type`);--> statement-breakpoint
CREATE INDEX `bottles_user_consumed_idx` ON `bottles` (`user_id`,`consumed_at`);