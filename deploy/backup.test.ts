// The backup scripts (deploy/backup/*.sh), run in the same images production uses (read from
// compose.prod.yml), so pg_dump, the shell and rclone are the real ones. Needs Docker, like the
// database tests.
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { composeImages } from "./repo-file.ts";

const scripts = fileURLToPath(new URL("./backup", import.meta.url));
const [postgresImage] = composeImages("compose.prod.yml", "postgres");
const [rcloneImage] = composeImages("compose.prod.yml", "rclone/rclone");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The name backup.sh gives a dump taken `ago` milliseconds before now:
 * freutransfer-YYYYMMDD-HHMMSS.dump in UTC. E.g. 2026-11-12T09:21:41.123Z →
 * "freutransfer-20261112-092141.dump" (ISO string without "-", ":", "T" and the milliseconds).
 */
function dumpName(ago: number): string {
  const iso = new Date(Date.now() - ago).toISOString(); // "2026-11-12T09:21:41.123Z"
  const digits = iso.slice(0, 19).replace(/[-:]/g, ""); //  "20261112T092141"
  return `freutransfer-${digits.replace("T", "-")}.dump`;
}

/** Runs a shell command in the container (exit code and output in the result). */
async function sh(
  container: StartedTestContainer,
  command: string,
  env: Record<string, string> = {},
) {
  return container.exec(["sh", "-c", command], { env });
}

/** The file names in a folder of the container, sorted. */
async function files(container: StartedTestContainer, dir: string) {
  const { output } = await sh(container, `ls -1 ${dir}`);
  return output.split("\n").filter(Boolean).sort();
}

/** Creates empty files with these names in a folder of the container. */
async function touch(container: StartedTestContainer, dir: string, names: string[]) {
  await sh(container, `cd ${dir} && touch ${names.map((name) => `'${name}'`).join(" ")}`);
}

describe("backup.sh", () => {
  let db: StartedPostgreSqlContainer;
  let env: Record<string, string>;

  beforeAll(async () => {
    expect(postgresImage).toBeDefined();
    db = await new PostgreSqlContainer(postgresImage as string)
      .withCopyDirectoriesToContainer([{ source: scripts, target: "/scripts" }])
      .start();
    env = {
      PGHOST: "127.0.0.1",
      PGUSER: db.getUsername(),
      PGPASSWORD: db.getPassword(),
      PGDATABASE: db.getDatabase(),
      BACKUP_KEEP_DAYS: "14",
    };
    // Data a restore must bring back exactly: a decimal at the database's full precision and
    // text in another language.
    const created = await sh(
      db,
      `psql -v ON_ERROR_STOP=1 -c "create table quote (id int primary key, rate numeric(20,10), city text);
        insert into quote values (1, 1.0937000001, 'Zürich'), (2, 0.9143, 'Genève');"`,
      env,
    );
    expect(created.exitCode, created.output).toBe(0);
  }, 120_000);

  afterAll(async () => {
    await db?.stop();
  });

  beforeEach(async () => {
    await sh(db, "rm -rf /backups && mkdir /backups");
  });

  it("writes one finished dump, named with the UTC time, that restores to the same data", async () => {
    const before = dumpName(0);
    const result = await sh(db, "sh /scripts/backup.sh", env);
    const after = dumpName(0);
    expect(result.exitCode, result.output).toBe(0);

    const written = await files(db, "/backups");
    expect(written).toHaveLength(1); // no .tmp left behind
    const [name] = written as [string];
    // Taken between `before` and `after` (same format, so comparing as text compares the times).
    expect(name >= before && name <= after, `${name} not between ${before} and ${after}`).toBe(
      true,
    );

    const restored = await sh(
      db,
      `createdb restore_check && pg_restore --no-owner -d restore_check /backups/${name} &&
       psql -d restore_check -tA -c "select id, rate, city from quote order by id"`,
      env,
    );
    expect(restored.exitCode, restored.output).toBe(0);
    expect(restored.stdout.trim().split("\n")).toEqual([
      "1|1.0937000001|Zürich",
      "2|0.9143000000|Genève", // numeric(20,10) shows all 10 decimals
    ]);
    await sh(db, "dropdb restore_check", env);
  });

  it("fails loudly when pg_dump fails, leaves no partial file and keeps the older dumps", async () => {
    // 30 days old: would be deleted after a successful dump (BACKUP_KEEP_DAYS=14).
    const old = dumpName(30 * DAY);
    await touch(db, "/backups", [old]);

    // A database that doesn't exist (a wrong password wouldn't do: inside the Postgres image,
    // connections from 127.0.0.1 are trusted without one).
    const result = await sh(db, "sh /scripts/backup.sh", { ...env, PGDATABASE: "missing" });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("backup: FAILED");
    expect(await files(db, "/backups")).toEqual([old]);
  });

  it("after a successful dump, deletes dumps older than BACKUP_KEEP_DAYS and nothing else", async () => {
    // BACKUP_KEEP_DAYS=14: 14 days + 1 hour is past the limit, 14 days − 1 hour is not.
    const tooOld = dumpName(14 * DAY + HOUR);
    const recent = dumpName(14 * DAY - HOUR);
    // Not dumps of this script: never deleted, whatever their age.
    const others = ["notes.txt", "freutransfer-manual.dump", `${dumpName(20 * DAY)}.tmp`];
    await touch(db, "/backups", [tooOld, recent, ...others]);

    const result = await sh(db, "sh /scripts/backup.sh", env);

    expect(result.exitCode, result.output).toBe(0);
    expect(result.stdout).toContain(`backup: removed ${tooOld}`);
    const left = await files(db, "/backups");
    expect(left).not.toContain(tooOld);
    expect(left).toEqual(expect.arrayContaining([recent, ...others]));
    expect(left).toHaveLength(5); // recent + 3 others + the new dump
  });
});

describe("offsite.sh", () => {
  let rclone: StartedTestContainer;
  // rclone's "local" backend stands in for R2: same commands, the "bucket" is a folder.
  const env = {
    OFFSITE_S3_BUCKET: "/bucket",
    OFFSITE_KEEP_DAYS: "30",
    RCLONE_CONFIG_R2_TYPE: "local",
    RCLONE_CONFIG_R2_ENDPOINT: "https://unused.example",
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: "unused",
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: "unused",
  };

  beforeAll(async () => {
    expect(rcloneImage).toBeDefined();
    rclone = await new GenericContainer(rcloneImage as string)
      .withEntrypoint(["sh", "-c"])
      .withCommand(["sleep 3600"])
      .withCopyDirectoriesToContainer([{ source: scripts, target: "/scripts" }])
      .start();
  }, 120_000);

  afterAll(async () => {
    await rclone?.stop();
  });

  beforeEach(async () => {
    await sh(rclone, "rm -rf /backups /bucket && mkdir /backups /bucket");
  });

  it("refuses to run without its settings and names what is missing", async () => {
    await touch(rclone, "/backups", [dumpName(0)]);

    const result = await sh(rclone, "sh /scripts/offsite.sh", {
      ...env,
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: "",
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("OFFSITE_S3_SECRET_ACCESS_KEY in .env.prod");
    expect(await files(rclone, "/bucket")).toEqual([]);
  });

  it("copies finished dumps only", async () => {
    const finished = dumpName(0);
    await touch(rclone, "/backups", [finished, `${dumpName(HOUR)}.tmp`, "notes.txt"]);

    const result = await sh(rclone, "sh /scripts/offsite.sh", env);

    expect(result.exitCode, result.output).toBe(0);
    expect(result.stdout).toContain("offsite: 1 dumps in r2:/bucket");
    expect(await files(rclone, "/bucket")).toEqual([finished]);
  });

  it("keeps copies whose dump is gone from the server, and deletes copies older than OFFSITE_KEEP_DAYS", async () => {
    // OFFSITE_KEEP_DAYS=30: 30 days + 1 hour is past the limit, 30 days − 1 hour is not.
    const tooOld = dumpName(30 * DAY + HOUR);
    const recent = dumpName(30 * DAY - HOUR); // no longer on the server (kept 14 days there)
    const today = dumpName(0);
    await touch(rclone, "/bucket", [tooOld, recent, "notes.txt"]);
    await touch(rclone, "/backups", [today]);

    const result = await sh(rclone, "sh /scripts/offsite.sh", env);

    expect(result.exitCode, result.output).toBe(0);
    expect(await files(rclone, "/bucket")).toEqual([recent, today, "notes.txt"].sort());
  });

  it("never deletes the newest copy, even when backups have stopped for longer than OFFSITE_KEEP_DAYS", async () => {
    const older = dumpName(45 * DAY);
    const newest = dumpName(40 * DAY);
    await touch(rclone, "/bucket", [older, newest]); // nothing new on the server

    const result = await sh(rclone, "sh /scripts/offsite.sh", env);

    expect(result.exitCode, result.output).toBe(0);
    expect(await files(rclone, "/bucket")).toEqual([newest]);
  });
});
