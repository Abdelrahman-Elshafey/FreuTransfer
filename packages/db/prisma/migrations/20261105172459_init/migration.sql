-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('bank', 'fintech', 'money_transfer_operator');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('rule_based', 'manual');

-- CreateEnum
CREATE TYPE "FeeMode" AS ENUM ('deducted', 'on_top');

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "website" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corridors" (
    "id" TEXT NOT NULL,
    "source_currency" CHAR(3) NOT NULL,
    "target_currency" CHAR(3) NOT NULL,

    CONSTRAINT "corridors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mid_market_rates" (
    "id" BIGSERIAL NOT NULL,
    "base" CHAR(3) NOT NULL,
    "quote" CHAR(3) NOT NULL,
    "rate" DECIMAL(20,10) NOT NULL,
    "source" TEXT NOT NULL,
    "as_of" DATE NOT NULL,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "mid_market_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fee_schedules" (
    "id" BIGSERIAL NOT NULL,
    "provider_id" TEXT NOT NULL,
    "corridor_id" TEXT NOT NULL,
    "source_kind" "SourceKind" NOT NULL,
    "fee_mode" "FeeMode" NOT NULL,
    "fixed_fee" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "percent_fee" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "min_fee" DECIMAL(20,10),
    "max_fee" DECIMAL(20,10),
    "fx_markup" DECIMAL(20,10),
    "provider_rate" DECIMAL(20,10),
    "rate_captured_at" TIMESTAMPTZ(3),
    "source_url" TEXT NOT NULL,
    "checked_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "corridors_source_currency_target_currency_key" ON "corridors"("source_currency", "target_currency");

-- CreateIndex
CREATE INDEX "mid_market_rates_base_quote_as_of_idx" ON "mid_market_rates"("base", "quote", "as_of" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "mid_market_rates_base_quote_source_as_of_key" ON "mid_market_rates"("base", "quote", "source", "as_of");

-- CreateIndex
CREATE INDEX "fee_schedules_corridor_id_provider_id_checked_at_idx" ON "fee_schedules"("corridor_id", "provider_id", "checked_at" DESC);

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_corridor_id_fkey" FOREIGN KEY ("corridor_id") REFERENCES "corridors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma can't express these rules).
-- ---------------------------------------------------------------------------

-- Data rules for fee schedules (ADR 0003):
-- rule-based rows carry a markup and no rate; manual rows carry a rate and when it was read.
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_pricing_check" CHECK (
  ("source_kind" = 'rule_based' AND "fx_markup" IS NOT NULL AND "provider_rate" IS NULL AND "rate_captured_at" IS NULL)
  OR
  ("source_kind" = 'manual' AND "fx_markup" IS NULL AND "provider_rate" IS NOT NULL AND "rate_captured_at" IS NOT NULL)
);
ALTER TABLE "fee_schedules" ADD CONSTRAINT "fee_schedules_amounts_check" CHECK (
  "fixed_fee" >= 0 AND "percent_fee" >= 0
  AND ("min_fee" IS NULL OR "min_fee" >= 0)
  AND ("max_fee" IS NULL OR "max_fee" >= 0)
  AND ("min_fee" IS NULL OR "max_fee" IS NULL OR "min_fee" <= "max_fee")
  AND ("fx_markup" IS NULL OR ("fx_markup" >= 0 AND "fx_markup" < 1))
  AND ("provider_rate" IS NULL OR "provider_rate" > 0)
);
ALTER TABLE "mid_market_rates" ADD CONSTRAINT "mid_market_rates_rate_check" CHECK ("rate" > 0 AND "base" <> "quote");
ALTER TABLE "corridors" ADD CONSTRAINT "corridors_currencies_check" CHECK ("source_currency" <> "target_currency");

-- Append-only: history is evidence, so the database itself refuses UPDATE and DELETE.
-- Corrections are new rows; the newest row wins.
CREATE FUNCTION "forbid_update_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER "mid_market_rates_append_only"
  BEFORE UPDATE OR DELETE ON "mid_market_rates"
  FOR EACH ROW EXECUTE FUNCTION "forbid_update_delete"();

CREATE TRIGGER "fee_schedules_append_only"
  BEFORE UPDATE OR DELETE ON "fee_schedules"
  FOR EACH ROW EXECUTE FUNCTION "forbid_update_delete"();
