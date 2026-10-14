CREATE TABLE `pending_returns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`kind` text DEFAULT 'internal' NOT NULL,
	`from_account_id` integer,
	`to_account_id` integer,
	`counterpart` text,
	`origin_transaction_id` integer,
	`settled_at` text,
	`settled_transaction_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`from_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`origin_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`settled_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
