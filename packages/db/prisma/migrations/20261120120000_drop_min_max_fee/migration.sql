-- No provider has a minimum or maximum fee, so the columns go (ADR 0015). Hand-written: Prisma
-- would drop the columns only, and Postgres then drops every CHECK constraint naming them too
-- (fee_schedules_amounts_check, fee_schedules_pricing_check), so both come back without them.

-- History is evidence (append-only): never drop a value that was stored. Stops the migration if
-- any row has one; such a row would need its own decision.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "fee_schedules" WHERE "min_fee" IS NOT NULL OR "max_fee" IS NOT NULL) THEN
    RAISE EXCEPTION 'fee_schedules has rows with min_fee or max_fee: not dropped (ADR 0015)';
  END IF;
END;
$$;

ALTER TABLE "fee_schedules" DROP CONSTRAINT "fee_schedules_amounts_check";
ALTER TABLE "fee_schedules" DROP CONSTRAINT "fee_schedules_pricing_check";

-- AlterTable
ALTER TABLE "fee_schedules" DROP COLUMN "max_fee",
DROP COLUMN "min_fee";

ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_amounts_check" CHECK (
  "fixed_fee" >= 0 AND "percent_fee" >= 0
  AND ("fx_markup" IS NULL OR ("fx_markup" >= 0 AND "fx_markup" < 1))
  AND ("provider_rate" IS NULL OR "provider_rate" > 0)
);
-- As in 20261113180000_withdrawn_fee_schedule, without the two columns.
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
    AND "fixed_fee" = 0 AND "percent_fee" = 0
    AND "max_amount" IS NULL AND "fx_markup" IS NULL AND "fx_markup_tier_up_to" IS NULL
    AND "fx_markup_above" IS NULL AND "fx_markup_tier_currency" IS NULL
    AND "provider_rate" IS NULL AND "rate_captured_at" IS NULL
    AND "note" IS NOT NULL AND btrim("note") <> ''
  )
);
