-- Wellie is pre-launch. This baseline intentionally replaces the previous
-- wellness schema and carries no compatibility or data-conversion path.
DROP TABLE IF EXISTS `meal_evals`;--> statement-breakpoint
DROP TABLE IF EXISTS `account_partitions`;--> statement-breakpoint
DROP TABLE IF EXISTS `identities`;--> statement-breakpoint
DROP TABLE IF EXISTS `sessions`;--> statement-breakpoint
DROP TABLE IF EXISTS `table_reactions`;--> statement-breakpoint
DROP TABLE IF EXISTS `table_posts`;--> statement-breakpoint
DROP TABLE IF EXISTS `table_members`;--> statement-breakpoint
DROP TABLE IF EXISTS `tables`;--> statement-breakpoint
DROP TABLE IF EXISTS `corpus_items`;--> statement-breakpoint
DROP TABLE IF EXISTS `corpus_consents`;--> statement-breakpoint
DROP TABLE IF EXISTS `corpus_objects`;--> statement-breakpoint
DROP TABLE IF EXISTS `meal_media`;--> statement-breakpoint
DROP TABLE IF EXISTS `media_objects`;--> statement-breakpoint
DROP TABLE IF EXISTS `recognitions`;--> statement-breakpoint
DROP TABLE IF EXISTS `events`;--> statement-breakpoint
DROP TABLE IF EXISTS `accounts`;--> statement-breakpoint
DROP TABLE IF EXISTS `app_metadata`;--> statement-breakpoint
DROP TABLE IF EXISTS `check_ins`;--> statement-breakpoint
DROP TABLE IF EXISTS `devices`;--> statement-breakpoint
DROP TABLE IF EXISTS `goals`;--> statement-breakpoint
DROP TABLE IF EXISTS `meals`;--> statement-breakpoint
DROP TABLE IF EXISTS `measurements`;--> statement-breakpoint
DROP TABLE IF EXISTS `messages`;--> statement-breakpoint
DROP TABLE IF EXISTS `plan_meals`;--> statement-breakpoint
DROP TABLE IF EXISTS `plan_sessions`;--> statement-breakpoint
DROP TABLE IF EXISTS `plans`;--> statement-breakpoint
DROP TABLE IF EXISTS `users`;--> statement-breakpoint
DROP TABLE IF EXISTS `workouts`;--> statement-breakpoint

CREATE TABLE `account_partitions` (
	`partition_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`linked_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_partitions_account_idx` ON `account_partitions` (`account_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `corpus_consents` (
	`account_id` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`policy_version` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `corpus_items` (
	`source_user` text NOT NULL,
	`meal_id` text NOT NULL,
	`source_photo_hash` text NOT NULL,
	`corpus_hash` text NOT NULL,
	`consent_policy_version` text NOT NULL,
	`consent_captured_at` integer NOT NULL,
	`crop_method` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`source_user`, `meal_id`),
	CONSTRAINT "corpus_items_source_hash_check" CHECK(length("corpus_items"."source_photo_hash") = 64),
	CONSTRAINT "corpus_items_corpus_hash_check" CHECK(length("corpus_items"."corpus_hash") = 64)
);
--> statement-breakpoint
CREATE INDEX `corpus_items_user_idx` ON `corpus_items` (`source_user`);--> statement-breakpoint
CREATE INDEX `corpus_items_object_idx` ON `corpus_items` (`corpus_hash`);--> statement-breakpoint
CREATE TABLE `corpus_objects` (
	`corpus_hash` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text NOT NULL,
	`stored_at` text,
	CONSTRAINT "corpus_objects_hash_check" CHECK(length("corpus_objects"."corpus_hash") = 64),
	CONSTRAINT "corpus_objects_size_check" CHECK("corpus_objects"."byte_size" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `corpus_objects_key_idx` ON `corpus_objects` (`object_key`);--> statement-breakpoint
CREATE INDEX `corpus_objects_orphans_idx` ON `corpus_objects` (`created_at`,`stored_at`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`device_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`received_at` text NOT NULL,
	CONSTRAINT "events_payload_json_check" CHECK(json_valid("events"."payload_json"))
);
--> statement-breakpoint
CREATE INDEX `events_account_cursor_idx` ON `events` (`account_id`,`recorded_at`,`id`);--> statement-breakpoint
CREATE INDEX `events_account_kind_idx` ON `events` (`account_id`,`kind`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `identities` (
	`provider` text NOT NULL,
	`subject` text NOT NULL,
	`account_id` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`provider`, `subject`),
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `identities_account_idx` ON `identities` (`account_id`);--> statement-breakpoint
CREATE TABLE `meal_evals` (
	`event_id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`device_id` text NOT NULL,
	`meal_id` text NOT NULL,
	`photo_hash` text NOT NULL,
	`prompt_version` text NOT NULL,
	`raw_model_json` text NOT NULL,
	`initial_items_json` text NOT NULL,
	`final_items_json` text NOT NULL,
	`other_meals_visible` integer NOT NULL,
	`was_corrected` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "meal_evals_initial_json_check" CHECK(json_valid("meal_evals"."initial_items_json")),
	CONSTRAINT "meal_evals_final_json_check" CHECK(json_valid("meal_evals"."final_items_json")),
	CONSTRAINT "meal_evals_raw_json_check" CHECK(json_valid("meal_evals"."raw_model_json")),
	CONSTRAINT "meal_evals_hash_check" CHECK(length("meal_evals"."photo_hash") = 64)
);
--> statement-breakpoint
CREATE INDEX `meal_evals_account_created_idx` ON `meal_evals` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `meal_evals_prompt_idx` ON `meal_evals` (`prompt_version`,`created_at`);--> statement-breakpoint
CREATE INDEX `meal_evals_meal_idx` ON `meal_evals` (`meal_id`,`recorded_at`);--> statement-breakpoint
CREATE TABLE `meal_media` (
	`account_id` text NOT NULL,
	`meal_id` text NOT NULL,
	`photo_hash` text,
	`event_id` text NOT NULL,
	`recorded_at` integer NOT NULL,
	PRIMARY KEY(`account_id`, `meal_id`)
);
--> statement-breakpoint
CREATE INDEX `meal_media_reference_idx` ON `meal_media` (`account_id`,`photo_hash`);--> statement-breakpoint
CREATE TABLE `media_objects` (
	`account_id` text NOT NULL,
	`photo_hash` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`created_at` text NOT NULL,
	`stored_at` text,
	PRIMARY KEY(`account_id`, `photo_hash`),
	CONSTRAINT "media_objects_hash_check" CHECK(length("media_objects"."photo_hash") = 64),
	CONSTRAINT "media_objects_size_check" CHECK("media_objects"."byte_size" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_objects_key_idx` ON `media_objects` (`object_key`);--> statement-breakpoint
CREATE INDEX `media_objects_orphans_idx` ON `media_objects` (`created_at`,`stored_at`);--> statement-breakpoint
CREATE TABLE `recognitions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`photo_hash` text,
	`input_fingerprint` text NOT NULL,
	`prompt_version` text NOT NULL,
	`model` text NOT NULL,
	`result_json` text NOT NULL,
	`raw_model_json` text NOT NULL,
	`provider_request_id` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "recognitions_result_json_check" CHECK(json_valid("recognitions"."result_json")),
	CONSTRAINT "recognitions_raw_json_check" CHECK(json_valid("recognitions"."raw_model_json")),
	CONSTRAINT "recognitions_hash_check" CHECK("recognitions"."photo_hash" IS NULL OR length("recognitions"."photo_hash") = 64),
	CONSTRAINT "recognitions_input_tokens_check" CHECK("recognitions"."input_tokens" >= 0),
	CONSTRAINT "recognitions_output_tokens_check" CHECK("recognitions"."output_tokens" >= 0),
	CONSTRAINT "recognitions_latency_check" CHECK("recognitions"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recognitions_cache_idx` ON `recognitions` (`account_id`,`input_fingerprint`,`prompt_version`,`model`);--> statement-breakpoint
CREATE INDEX `recognitions_account_created_idx` ON `recognitions` (`account_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`device_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_account_idx` ON `sessions` (`account_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `tables` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`creator_account` text NOT NULL,
	`invite_code` text NOT NULL,
	`invite_expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tables_invite_idx` ON `tables` (`invite_code`);--> statement-breakpoint
CREATE TABLE `table_members` (
	`table_id` text NOT NULL,
	`account_id` text NOT NULL,
	`member_id` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	`last_read_seq` integer DEFAULT 0 NOT NULL,
	`show_photos` integer DEFAULT true NOT NULL,
	`show_nutrition` integer DEFAULT false NOT NULL,
	`show_body_goals` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`table_id`, `account_id`),
	CONSTRAINT "table_members_role_check" CHECK("table_members"."role" IN ('creator', 'member'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `table_members_member_idx` ON `table_members` (`table_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `table_members_account_idx` ON `table_members` (`account_id`);--> statement-breakpoint
CREATE TABLE `table_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`table_id` text NOT NULL,
	`seq` integer NOT NULL,
	`author_account` text NOT NULL,
	`author_member_id` text NOT NULL,
	`author_name` text NOT NULL,
	`kind` text NOT NULL,
	`reply_to_post_id` text,
	`meal_id` text,
	`dish_name` text,
	`body` text,
	`ingredients_json` text,
	`photo_object_key` text,
	`photo_mime` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "table_posts_kind_check" CHECK("table_posts"."kind" IN ('share', 'message')),
	CONSTRAINT "table_posts_ingredients_check" CHECK("table_posts"."ingredients_json" IS NULL OR json_valid("table_posts"."ingredients_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `table_posts_seq_idx` ON `table_posts` (`table_id`,`seq`);--> statement-breakpoint
CREATE INDEX `table_posts_author_idx` ON `table_posts` (`author_account`);--> statement-breakpoint
CREATE TABLE `table_reactions` (
	`post_id` text NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`post_id`, `account_id`, `kind`),
	CONSTRAINT "table_reactions_kind_check" CHECK("table_reactions"."kind" IN ('olive', 'heart'))
);
--> statement-breakpoint
CREATE INDEX `table_reactions_account_idx` ON `table_reactions` (`account_id`);
