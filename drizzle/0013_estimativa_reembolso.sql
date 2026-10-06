ALTER TABLE `recurring_entries` ADD `reimburse_pct` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_entries` ADD `reimburse_lag_days` integer;