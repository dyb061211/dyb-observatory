CREATE TABLE `github_repository_pages` (
	`page` integer PRIMARY KEY NOT NULL,
	`repositories` text NOT NULL,
	`has_next` integer NOT NULL,
	`etag` text,
	`synced_at` integer NOT NULL,
	`next_check_at` integer NOT NULL,
	`stale` integer NOT NULL
);
