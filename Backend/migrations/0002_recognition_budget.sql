-- The current recognition path reserves spend here before calling Orca. The
-- table was referenced by worker/lib/budget.ts but omitted from the replaced
-- baseline, so a cache miss failed before reaching the model.
CREATE TABLE IF NOT EXISTS `budget` (
  `day` text PRIMARY KEY NOT NULL,
  `used` integer NOT NULL DEFAULT 0,
  CONSTRAINT `budget_used_check` CHECK(`used` >= 0)
);
