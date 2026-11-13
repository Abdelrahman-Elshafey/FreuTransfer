-- AlterTable
ALTER TABLE "fee_schedules" ADD COLUMN     "withdrawn" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "source_kind" DROP NOT NULL,
ALTER COLUMN "fee_mode" DROP NOT NULL;


-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma can't express these rules).
-- ---------------------------------------------------------------------------

-- A row is either a price (rule-based or manual, as before) or a withdrawal: no prices, no
-- limits, and a reason. The explicit IS NOT NULL on source_kind and fee_mode matters: a CHECK
-- passes when its result is NULL, so without it a priced row with an empty source_kind would be
-- accepted.
ALTER TABLE "fee_schedules" DROP CONSTRAINT "fee_schedules_pricing_check";
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_pricing_check" CHECK (
  (
    NOT "withdrawn" AND "source_kind" IS NOT NULL AND "fee_mode" IS NOT NULL
    AND (
      ("source_kind" = 'rule_based' AND "fx_markup" IS NOT NULL AND "provider_rate" IS NULL AND "rate_captured_at" IS NULL)
      OR
      ("source_kind" = 'manual' AND "fx_markup" IS NULL AND "provider_rate" IS NOT NULL AND "rate_captured_at" IS NOT NULL)
    )
  )
  OR
  (
    "withdrawn" AND "source_kind" IS NULL AND "fee_mode" IS NULL
    AND "fixed_fee" = 0 AND "percent_fee" = 0 AND "min_fee" IS NULL AND "max_fee" IS NULL
    AND "max_amount" IS NULL AND "fx_markup" IS NULL AND "fx_markup_tier_up_to" IS NULL
    AND "fx_markup_above" IS NULL AND "fx_markup_tier_currency" IS NULL
    AND "provider_rate" IS NULL AND "rate_captured_at" IS NULL
    AND "note" IS NOT NULL AND btrim("note") <> ''
  )
);
