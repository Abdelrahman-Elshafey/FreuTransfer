import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GenericContainer,
  Network,
  type StartedNetwork,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LOCALE_CODES } from "./i18n/locales.ts";
import { type PageId, pageFromPath, pagePath } from "./pages.ts";

// Every page; typed against PageId both ways, so adding a page without listing it here fails.
const PAGE_IDS = ["home", "methodology", "privacy"] as const satisfies readonly PageId[];
type Unlisted = Exclude<PageId, (typeof PAGE_IDS)[number]>;
const allListed: [Unlisted] extends [never] ? true : never = true;
void allListed;

// The production nginx config (apps/web/nginx.conf + security-headers.conf) in the production
// nginx image, started in Docker: the headers and the request limit are checked on real
// responses, not by reading the config. Docker must be running (like the database tests).

const web = new URL("../", import.meta.url);
// The image the web Dockerfile serves from, read from there so the two can't drift apart.
const image = /^FROM (nginxinc\/nginx-unprivileged:\S+)$/m.exec(
  readFileSync(new URL("Dockerfile", web), "utf8"),
)?.[1];

let network: StartedNetwork;
let api: StartedTestContainer;
let nginx: StartedTestContainer;
let base: string;

beforeAll(async () => {
  if (!image) throw new Error("no nginx image in apps/web/Dockerfile");
  // A stand-in "api" on a shared network (nginx.conf finds it through Docker's DNS, as in
  // compose): it answers 200, so a request the limit lets through gets a real answer.
  network = await new Network().start();
  api = await new GenericContainer(image)
    .withNetwork(network)
    .withNetworkAliases("api")
    .withCopyContentToContainer([
      {
        content: "server { listen 3000; location / { return 200 '{}'; } }",
        target: "/etc/nginx/conf.d/default.conf",
      },
    ])
    .withWaitStrategy(Wait.forListeningPorts())
    .start();
  nginx = await new GenericContainer(image)
    .withNetwork(network)
    .withCopyFilesToContainer([
      {
        source: fileURLToPath(new URL("nginx.conf", web)),
        target: "/etc/nginx/conf.d/default.conf",
      },
      {
        source: fileURLToPath(new URL("security-headers.conf", web)),
        target: "/etc/nginx/security-headers.conf",
      },
    ])
    .withCopyContentToContainer([
      { content: "<!doctype html><title>t</title>", target: "/usr/share/nginx/html/index.html" },
      { content: "export {};", target: "/usr/share/nginx/html/assets/app-abc123.js" },
    ])
    .withExposedPorts(8080)
    .withWaitStrategy(Wait.forListeningPorts())
    .start();
  base = `http://${nginx.getHost()}:${nginx.getMappedPort(8080)}`;
}, 120_000);

afterAll(async () => {
  await nginx?.stop();
  await api?.stop();
  await network?.stop();
});

const SECURITY_HEADERS = [
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
];

describe("nginx (apps/web/nginx.conf)", () => {
  it.each([
    ["/", 200, "no-cache"],
    ["/assets/app-abc123.js", 200, "public, max-age=31536000, immutable"],
    ["/missing", 404, null],
  ])(
    "sends every security header on %s (%i), next to its own Cache-Control",
    async (path, status, cache) => {
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(status);
      for (const header of SECURITY_HEADERS) expect(res.headers.get(header), header).not.toBeNull();
      expect(res.headers.get("cache-control")).toBe(cache);
    },
  );

  // Language paths (docs/adr/0005): every page in every language the page knows is served the
  // page (pages.ts makes the paths, so a new page or slug fails here until nginx.conf has it).
  const pagePaths = LOCALE_CODES.flatMap((code) => PAGE_IDS.map((page) => pagePath(code, page)));
  it.each([
    ...pagePaths,
    ...pagePaths.map((path) => (path.endsWith("/") ? path.slice(0, -1) : `${path}/`)),
  ])("serves the page on %s, with the security headers and no-cache", async (path) => {
    expect(pageFromPath(path), "a path the page itself knows").not.toBeNull();
    const res = await fetch(`${base}${path}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<!doctype html>");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    for (const header of SECURITY_HEADERS) expect(res.headers.get(header), header).not.toBeNull();
  });

  // Addresses under our languages that name no page: the page (it shows "not found" in that
  // language) with a real 404, so search engines don't index them. Includes another language's
  // word for a page (/en/methodik), which the page doesn't know either.
  it.each(["/de/xyz", "/en/methodik", "/fr/privacy", "/it/metodologia/x", "/en/assets/x.js"])(
    "answers 404 with the page for %s, with the security headers",
    async (path) => {
      expect(pageFromPath(path), "a path the page itself doesn't know").toBeNull();
      const res = await fetch(`${base}${path}`);
      expect(res.status).toBe(404);
      expect(await res.text()).toContain("<!doctype html>");
      for (const header of SECURITY_HEADERS) expect(res.headers.get(header), header).not.toBeNull();
    },
  );

  it.each(["/es/", "/DE/", "/dex/"])(
    "answers 404 for %s (not one of our languages)",
    async (path) => {
      expect((await fetch(`${base}${path}`)).status).toBe(404);
    },
  );

  it("allows only this site's own scripts, styles, fonts and API calls", async () => {
    const csp = (await fetch(`${base}/`)).headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("limits each visitor's API requests and answers 429 as a problem, other visitors unaffected", async () => {
    // 40 requests at once from one visitor (as Cloudflare names it): 1 + a burst of 20 reach the
    // API, the rest are refused.
    const visitor = { "cf-connecting-ip": "203.0.113.7" };
    const responses = await Promise.all(
      Array.from({ length: 40 }, () => fetch(`${base}/v1/compare`, { headers: visitor })),
    );
    const refused = responses.filter((r) => r.status === 429);
    const passed = responses.filter((r) => r.status === 200);
    // 10 r/s also refills a few slots while the 40 arrive: "about" 21 pass, never all 40.
    expect(passed.length).toBeGreaterThanOrEqual(21);
    expect(refused.length).toBeGreaterThanOrEqual(10);
    expect(passed.length + refused.length).toBe(40);
    const [first] = refused;
    expect(first?.headers.get("content-type")).toBe("application/problem+json");
    expect(await first?.json()).toEqual({
      type: "about:blank",
      title: "Too Many Requests",
      status: 429,
    });
    expect(first?.headers.get("content-security-policy")).not.toBeNull();

    // Another visitor at the same moment is not limited by the first one's requests.
    const other = await fetch(`${base}/v1/compare`, {
      headers: { "cf-connecting-ip": "203.0.113.8" },
    });
    expect(other.status).toBe(200);
  });
});
