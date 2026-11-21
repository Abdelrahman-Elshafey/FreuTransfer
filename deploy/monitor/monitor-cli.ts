// `node deploy/monitor/monitor-cli.ts [bucket-listing.txt]`: the daily check from outside
// (.github/workflows/monitor.yml). Asks the live site for a comparison in each direction, reads the
// off-site bucket's listing (`aws s3 ls` output, written by the workflow; missing = not listed),
// prints every problem as a GitHub error and exits 1, so the failed run e-mails the owner.
import { readFileSync } from "node:fs";
import { backupProblems, type CompareResult, comparisonProblems, DIRECTIONS } from "./checks.ts";

const site = process.env.SITE_URL;
if (!site) throw new Error("SITE_URL is required (e.g. https://freutransfer.aelshafey.com)");
const now = new Date();

async function compare(from: string, to: string): Promise<CompareResult> {
  const url = `${site}/v1/compare?from=${from}&to=${to}&amount=1000`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "FreuTransfer-monitor", accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    return { ok: true, data: await res.json() };
  } catch (error) {
    // Network failure or a broken body (TypeError), the timeout (DOMException), not JSON
    // (SyntaxError): all mean "no comparison". Anything else is a bug here and is thrown.
    if (
      error instanceof TypeError ||
      error instanceof DOMException ||
      error instanceof SyntaxError
    ) {
      return { ok: false, reason: String(error) };
    }
    throw error;
  }
}

/** File names from `aws s3 ls` lines ("2026-11-20 06:00:01  12345 freutransfer-….dump"). */
function listedNames(path: string | undefined): string[] | null {
  if (path === undefined) return null;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return null;
  }
  return text
    .split("\n")
    .map((line) => line.trim().split(/\s+/).at(-1) ?? "")
    .filter((name) => name !== "");
}

const problems: string[] = [];
for (const { from, to } of DIRECTIONS) {
  problems.push(...comparisonProblems(`${from}→${to}`, await compare(from, to), now));
}
problems.push(...backupProblems(listedNames(process.argv[2]), now));

if (problems.length === 0) {
  console.log(`monitor: all fine (${now.toISOString()})`);
} else {
  for (const problem of problems) console.log(`::error::${problem}`);
  process.exitCode = 1;
}
