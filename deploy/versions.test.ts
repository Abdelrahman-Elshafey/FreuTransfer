// Versions that must be written in more than one file (Docker can't read them from another
// file), so this test keeps the copies equal (CLAUDE.md rule 5).
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
});
