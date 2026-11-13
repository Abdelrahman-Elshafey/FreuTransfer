// Values that must be written in more than one file (Docker and GitHub Actions can't read them
// from another file), so these tests keep the copies equal (CLAUDE.md rule 5).
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { composeImages, readRepoFile } from "./repo-file.ts";

/** Every `FROM node:<version>-...` in a Dockerfile. */
const nodeImages = (dockerfile: string) =>
  [...readRepoFile(dockerfile).matchAll(/^FROM node:([\d.]+)-/gm)].map((match) => match[1]);

describe("deploy versions", () => {
  const nodeVersion = readRepoFile(".node-version").trim();

  it.each(["apps/api/Dockerfile", "apps/web/Dockerfile"])(
    "%s builds on the Node version from .node-version",
    (dockerfile) => {
      const versions = nodeImages(dockerfile);
      expect(versions.length).toBeGreaterThan(0);
      expect(new Set(versions)).toEqual(new Set([nodeVersion]));
    },
  );

  it("production (database and backups) and the database tests run the same Postgres as development", () => {
    const [development] = composeImages("docker-compose.yml", "postgres");
    expect(development).toBeDefined();
    // db and backup: pg_dump must be the same version as the server it dumps.
    expect(composeImages("compose.prod.yml", "postgres")).toEqual([development, development]);
    const testContainer = readRepoFile("packages/db/src/test-database.ts").match(
      /PostgreSqlContainer\("([^"]+)"\)/,
    )?.[1];
    expect(testContainer).toBe(development);
  });

  it("the collector names the same public address as CI's deploy check", () => {
    const site = readRepoFile(".github/workflows/ci.yml").match(/^ {2}SITE_URL: (\S+)$/m)?.[1];
    expect(site).toMatch(/^https:\/\//);
    const agent = readRepoFile("packages/collectors/src/frankfurter.ts").match(
      /const USER_AGENT = "[^"]*\(\+([^)]+)\)"/,
    )?.[1];
    expect(agent).toBe(site);
  });

  it.each(["apps/api/Dockerfile", "apps/web/Dockerfile"])(
    "%s copies every workspace package's manifest (so its install sees the same workspace as the lockfile)",
    (dockerfile) => {
      const workspace = ["apps", "packages"].flatMap((dir) =>
        readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => `${dir}/${entry.name}/package.json`),
      );
      const copied = [...readRepoFile(dockerfile).matchAll(/^COPY (\S+\/package\.json) /gm)].map(
        (match) => match[1],
      );
      expect(new Set(copied)).toEqual(new Set(workspace));
    },
  );
});
