// Versions that must be written in more than one file (Docker can't read them from another
// file), so this test keeps the copies equal (CLAUDE.md rule 5).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** Every `FROM node:<version>-...` in a Dockerfile. */
const nodeImages = (dockerfile: string) =>
  [...read(dockerfile).matchAll(/^FROM node:([\d.]+)-/gm)].map((match) => match[1]);

const postgresImage = (composeFile: string) =>
  read(composeFile).match(/image: (postgres:\S+)/)?.[1];

describe("deploy versions", () => {
  const nodeVersion = read(".node-version").trim();

  it.each(["apps/api/Dockerfile", "apps/web/Dockerfile"])(
    "%s builds on the Node version from .node-version",
    (dockerfile) => {
      const versions = nodeImages(dockerfile);
      expect(versions.length).toBeGreaterThan(0);
      expect(new Set(versions)).toEqual(new Set([nodeVersion]));
    },
  );

  it("production and the database tests run the same Postgres as development", () => {
    const development = postgresImage("docker-compose.yml");
    expect(development).toBeDefined();
    expect(postgresImage("compose.prod.yml")).toBe(development);
    const testContainer = read("packages/db/src/test-database.ts").match(
      /PostgreSqlContainer\("([^"]+)"\)/,
    )?.[1];
    expect(testContainer).toBe(development);
  });
});
