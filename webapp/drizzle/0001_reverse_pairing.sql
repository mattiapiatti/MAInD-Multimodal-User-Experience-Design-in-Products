DROP TABLE `pairing_codes`;--> statement-breakpoint
CREATE TABLE `pairing_sessions` (
	`code` text PRIMARY KEY NOT NULL,
	`hardware_id` text NOT NULL,
	`device_name` text,
	`user_id` text,
	`device_token` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`claimed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pairing_sessions_hardware_idx` ON `pairing_sessions` (`hardware_id`);
