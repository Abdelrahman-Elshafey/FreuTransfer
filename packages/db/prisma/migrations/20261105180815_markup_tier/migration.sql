-- AlterTable
ALTER TABLE "fee_schedules" ADD COLUMN     "fx_markup_above" DECIMAL(20,10),
ADD COLUMN     "fx_markup_tier_up_to" DECIMAL(20,10);

-- Hand-written: a markup tier is all or nothing, and only for rule-based schedules.
-- The explicit IS NOT NULL matters: a CHECK passes when its result is NULL, so without it
-- a half-filled tier (one column NULL) would be accepted.
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_markup_tier_check" CHECK (
  ("fx_markup_tier_up_to" IS NULL AND "fx_markup_above" IS NULL)
  OR (
    "source_kind" = 'rule_based'
    AND "fx_markup_tier_up_to" IS NOT NULL AND "fx_markup_above" IS NOT NULL
    AND "fx_markup_tier_up_to" > 0
    AND "fx_markup_above" >= 0 AND "fx_markup_above" < 1
  )
);
