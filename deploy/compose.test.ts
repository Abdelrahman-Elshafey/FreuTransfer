// compose.prod.yml as Docker Compose itself reads it (`docker compose config`), so the checks see
// the final configuration, not the YAML text. Needs Docker, like the database tests.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Service = {
  image?: string;
  restart?: string;
  healthcheck?: { disable?: boolean };
};

const composeFile = fileURLToPath(new URL("../compose.prod.yml", import.meta.url));
const config = JSON.parse(
  execFileSync("docker", ["compose", "-f", composeFile, "config", "--format", "json"], {
    // compose.prod.yml refuses to load without it (`:?`); the value doesn't matter here.
    env: { ...process.env, POSTGRES_PASSWORD: "test-only" },
    encoding: "utf8",
  }),
) as { services: Record<string, Service> };

describe("compose.prod.yml", () => {
  it("switches off the API's health check in every other long-running service of the API image", () => {
    // The API image checks /health on port 3000. Another long-running command in that image would
    // count as unhealthy, and `up --wait` (scripts/deploy.sh) would fail every deploy.
    const apiImage = config.services.api?.image;
    expect(apiImage).toMatch(/freutransfer-api:/);
    const others = Object.entries(config.services).filter(
      ([name, s]) => name !== "api" && s.image === apiImage && s.restart !== "no",
    );
    expect(others.map(([name]) => name)).toEqual(["collect"]);
    for (const [, service] of others) expect(service.healthcheck?.disable).toBe(true);
  });
});
