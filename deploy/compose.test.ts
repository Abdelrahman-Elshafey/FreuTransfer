// compose.prod.yml as Docker Compose itself reads it (`docker compose config`), so the checks see
// the final configuration, not the YAML text. Needs Docker, like the database tests.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOCALE_CODES } from "../apps/web/src/i18n/locales.ts";
import { PAGES } from "../apps/web/src/i18n/pages/index.ts";

type Service = {
  image?: string;
  restart?: string;
  healthcheck?: { disable?: boolean };
  logging?: { driver?: string; options?: Record<string, string> };
  security_opt?: string[];
  cap_drop?: string[];
  cap_add?: string[];
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

  // The privacy page promises a limit on the logs; Docker keeps them forever unless told. Set here,
  // not only in the server's daemon.json, so the promise is in the code and on any server.
  it("limits every service's logs to what the privacy page states, in every language", () => {
    const mb = (size: string) => Number(size.replace(/m$/, ""));
    const limits = new Set(
      Object.values(config.services).map((s) => {
        const options = s.logging?.options ?? {};
        expect(s.logging?.driver).toBe("json-file");
        return mb(options["max-size"] ?? "") * Number(options["max-file"]);
      }),
    );
    expect(limits.size).toBe(1);
    const [total] = limits;
    expect(total).toBeGreaterThan(0);
    const legal = { name: "n", email: "e", hostingCountry: "c" };
    for (const code of LOCALE_CODES) {
      const text = JSON.stringify(PAGES[code].privacy(legal));
      // "30 MB" (fr: "30 Mo"), with a plain or a non-breaking space, not part of a longer number.
      expect(text, code).toMatch(new RegExp(String.raw`(?<!\d)${total}[\s  ]M[Bo]\b`));
    }
  });

  // SECURITY: a process that is taken over can't gain privileges (setuid programs) and holds no
  // Linux capabilities. Only Postgres's start script needs some, to hand its files to the postgres
  // user and switch to it; it then drops them itself.
  it("runs every service without new privileges and without capabilities (the database: only its own)", () => {
    for (const [name, s] of Object.entries(config.services)) {
      expect(s.security_opt, name).toContain("no-new-privileges:true");
      expect(s.cap_drop, name).toEqual(["ALL"]);
      expect(s.cap_add ?? [], name).toEqual(
        name === "db" ? ["CHOWN", "DAC_OVERRIDE", "FOWNER", "SETGID", "SETUID"] : [],
      );
    }
  });
});
