-- Restore the coach domain beside the recognition/event schema. These tables
-- intentionally use a coach_ prefix so they can coexist with the newer event
-- log and browser-session account model without rewriting recognition data.
CREATE TABLE IF NOT EXISTS `coach_profiles` (
  `account_id` text PRIMARY KEY NOT NULL,
  `display_name` text,
  `height_cm` real,
  `weight_kg` real,
  `birth_year` integer,
  `sex` text,
  `activity_level` text,
  `training_location` text,
  `equipment_json` text NOT NULL DEFAULT '[]',
  `sessions_per_week` integer,
  `time_zone` text,
  `onboarding_state` text NOT NULL DEFAULT 'collecting',
  `pending_suggestions_json` text NOT NULL DEFAULT '[]',
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_profiles_equipment_json_check` CHECK(json_valid(`equipment_json`)),
  CONSTRAINT `coach_profiles_suggestions_json_check` CHECK(json_valid(`pending_suggestions_json`))
);

CREATE TABLE IF NOT EXISTS `coach_goals` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `kind` text NOT NULL,
  `original_message` text NOT NULL,
  `target_value` real,
  `target_kind` text,
  `target_unit` text,
  `target_date` integer,
  `baseline_value` real,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `coach_goals_account_idx` ON `coach_goals` (`account_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `coach_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `role` text NOT NULL,
  `text` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `coach_messages_account_idx` ON `coach_messages` (`account_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `coach_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `version` integer NOT NULL,
  `status` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_plans_payload_json_check` CHECK(json_valid(`payload_json`))
);
CREATE INDEX IF NOT EXISTS `coach_plans_account_idx` ON `coach_plans` (`account_id`, `created_at`);

CREATE TABLE IF NOT EXISTS `coach_meals` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `logged_at` integer NOT NULL,
  `title` text NOT NULL,
  `summary` text NOT NULL,
  `kcal` integer NOT NULL,
  `protein_g` real NOT NULL,
  `carbs_g` real NOT NULL,
  `fat_g` real NOT NULL,
  `note` text,
  `photo_key` text,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `coach_meals_account_idx` ON `coach_meals` (`account_id`, `logged_at`);

CREATE TABLE IF NOT EXISTS `coach_check_ins` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `day` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  CONSTRAINT `coach_check_ins_payload_json_check` CHECK(json_valid(`payload_json`))
);
CREATE UNIQUE INDEX IF NOT EXISTS `coach_check_ins_day_idx` ON `coach_check_ins` (`account_id`, `day`);

CREATE TABLE IF NOT EXISTS `coach_measurements` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `weight_kg` real NOT NULL,
  `recorded_at` integer NOT NULL,
  `source` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `coach_measurements_account_idx` ON `coach_measurements` (`account_id`, `recorded_at`);

CREATE TABLE IF NOT EXISTS `coach_workouts` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `plan_session_id` text,
  `movement` text NOT NULL,
  `target_reps` integer,
  `completed_reps` integer NOT NULL DEFAULT 0,
  `started_at` integer NOT NULL,
  `completed_at` integer,
  `duration_sec` integer,
  `form_score` real,
  `status` text NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS `coach_workouts_account_idx` ON `coach_workouts` (`account_id`, `started_at`);
