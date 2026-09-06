DROP INDEX `categories_name_unique`;--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_id` integer REFERENCES categories(id);