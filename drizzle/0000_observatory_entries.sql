CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`station` text NOT NULL,
	`author` text NOT NULL,
	`revision` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`topic` text NOT NULL,
	`edited` integer NOT NULL,
	`published_title` text,
	`published_body` text,
	`published_topic` text,
	`published` integer,
	`has_draft` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entries_public` ON `entries` (`station`,`published`);--> statement-breakpoint
CREATE INDEX `entries_drafts` ON `entries` (`author`,`station`,`has_draft`,`edited`);