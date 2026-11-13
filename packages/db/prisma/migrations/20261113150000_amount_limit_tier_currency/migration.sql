-- AlterTable
ALTER TABLE "fee_schedules" ADD COLUMN     "fx_markup_tier_currency" CHAR(3),
ADD COLUMN     "max_amount" DECIMAL(20,10);


-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma can't express these rules).
-- ---------------------------------------------------------------------------

-- A maximum amount is a real limit, never zero or negative.
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_max_amount_check" CHECK (
  "max_amount" IS NULL OR "max_amount" > 0
);

-- A currency for the tier limit only together with a tier (fee_schedules_markup_tier_check keeps
-- the tier itself all or nothing).
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_markup_tier_currency_check" CHECK (
  "fx_markup_tier_currency" IS NULL OR "fx_markup_tier_up_to" IS NOT NULL
);
