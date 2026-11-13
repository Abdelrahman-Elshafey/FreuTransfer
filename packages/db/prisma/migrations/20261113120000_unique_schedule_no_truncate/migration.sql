-- DropIndex
DROP INDEX "fee_schedules_corridor_id_provider_id_checked_at_idx";

-- CreateIndex
CREATE UNIQUE INDEX "fee_schedules_corridor_id_provider_id_checked_at_key" ON "fee_schedules"("corridor_id", "provider_id", "checked_at");

-- ---------------------------------------------------------------------------
-- Hand-written below this line (Prisma can't express these rules).
-- ---------------------------------------------------------------------------

-- Append-only, completed: the row triggers stop UPDATE and DELETE, but TRUNCATE fires no row
-- trigger, so each protected table needs a statement trigger as well. collector_runs too:
-- a run is never deleted.
CREATE TRIGGER "mid_market_rates_no_truncate"
  BEFORE TRUNCATE ON "mid_market_rates"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_update_delete"();

CREATE TRIGGER "fee_schedules_no_truncate"
  BEFORE TRUNCATE ON "fee_schedules"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_update_delete"();

CREATE TRIGGER "raw_observations_no_truncate"
  BEFORE TRUNCATE ON "raw_observations"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_update_delete"();

CREATE TRIGGER "collector_runs_no_truncate"
  BEFORE TRUNCATE ON "collector_runs"
  FOR EACH STATEMENT EXECUTE FUNCTION "forbid_update_delete"();
