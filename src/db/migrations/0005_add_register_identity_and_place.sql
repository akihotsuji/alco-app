ALTER TABLE `drink_logs` ADD `producer` text;--> statement-breakpoint
ALTER TABLE `drink_logs` ADD `origin` text;--> statement-breakpoint
ALTER TABLE `drink_logs` ADD `variety` text;--> statement-breakpoint
ALTER TABLE `drink_logs` ADD `vintage` integer;--> statement-breakpoint
ALTER TABLE `drink_logs` ADD `place_name` text;--> statement-breakpoint
ALTER TABLE `drink_logs` ADD `place_lat` real;--> statement-breakpoint
ALTER TABLE `drink_logs` ADD `place_lng` real;--> statement-breakpoint
ALTER TABLE `tasting_notes` ADD `producer` text;--> statement-breakpoint
ALTER TABLE `tasting_notes` ADD `origin` text;--> statement-breakpoint
ALTER TABLE `tasting_notes` ADD `variety` text;