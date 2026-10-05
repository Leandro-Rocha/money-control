CREATE TABLE `account_balance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`date` text NOT NULL,
	`balance` real NOT NULL,
	`source` text DEFAULT 'pluggy' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_reimbursements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_transaction_id` integer NOT NULL,
	`credit_transaction_id` integer NOT NULL,
	`amount` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`expense_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`credit_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `accounts` ADD `is_liquid` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `kind` text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_entries` ADD `frequency` text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_entries` ADD `interval_months` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_entries` ADD `start_month` text;--> statement-breakpoint
ALTER TABLE `recurring_entries` ADD `end_month` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `is_reimbursable` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `categories` SET `kind` = 'transfer' WHERE `name` IN ('Transferência', 'Transferencia', 'transferência', 'transferencia', 'Empréstimo', 'Emprestimo');--> statement-breakpoint
UPDATE `categories` SET `kind` = 'investment' WHERE `name` IN ('Variação Patrimonial', 'Variacao Patrimonial', 'Investimento', 'Investimentos');--> statement-breakpoint
UPDATE `categories` SET `kind` = 'card_payment' WHERE `name` IN ('Cartão', 'Cartao', 'cartão', 'cartao');--> statement-breakpoint
UPDATE `accounts` SET `is_liquid` = 1 WHERE `type` = 'investment' AND (`pluggy_account_id` LIKE '%#reserved:%' OR `name` LIKE '%Caixinha%' OR `name` LIKE '%Reserva%');--> statement-breakpoint
UPDATE `recurring_entries` SET `frequency` = 'yearly' WHERE `month` IS NOT NULL;
