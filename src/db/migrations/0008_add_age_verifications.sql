CREATE TABLE `age_verifications` (
	`user_id` text PRIMARY KEY NOT NULL,
	`birth_on` text NOT NULL,
	`verified_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
