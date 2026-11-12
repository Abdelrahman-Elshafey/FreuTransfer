// scripts/deploy.sh, phase 1 (which commit may be deployed), run in a container against a
// throwaway git repository shaped like GitHub: a `dev` branch and another branch. Phase 2 needs
// Docker and .env.prod; reaching its first check ("set IMAGE_PREFIX") shows phase 1 let the
// commit through. Needs Docker, like the database tests.
import { fileURLToPath } from "node:url";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const deployScript = fileURLToPath(new URL("../scripts/deploy.sh", import.meta.url));
// Has git, sh and flock (busybox), like the server (Ubuntu: git, dash, util-linux flock).
const GIT_IMAGE = "alpine/git:2.52.0";

/**
 * /origin.git plays GitHub; /server is the copy on the server, cloned while dev had only `base`.
 *   base ── dev2        (dev; dev2 pushed after the server's clone: needs the fetch)
 *     └──── other       (another branch, never merged)
 */
const FIXTURE = `set -e
git config --global user.email test@example.com
git config --global user.name test
git config --global init.defaultBranch dev
git config --global advice.detachedHead false
git init -q --bare /origin.git
git clone -q /origin.git /work && cd /work
mkdir scripts && cp /deploy.sh scripts/deploy.sh
git add . && git commit -qm base && git push -q origin dev
git rev-parse HEAD > /base
git clone -q /origin.git /server
git checkout -qb other && echo other > other.txt && git add . && git commit -qm other && git push -q origin other
git rev-parse HEAD > /other
git checkout -q dev && echo dev2 > dev2.txt && git add . && git commit -qm dev2 && git push -q origin dev
git rev-parse HEAD > /dev2`;

describe("deploy.sh: which commits may be deployed", () => {
  let git: StartedTestContainer;
  const sha: Record<"base" | "other" | "dev2", string> = { base: "", other: "", dev2: "" };

  const run = (command: string) => git.exec(["sh", "-c", command]);
  /** Runs the server's deploy.sh for a commit, the way the forced SSH command does. */
  const deploy = (commit: string) =>
    git.exec(["sh", "/server/scripts/deploy.sh"], { env: { SSH_ORIGINAL_COMMAND: commit } });
  const serverHead = async () => (await run("git -C /server rev-parse HEAD")).stdout.trim();

  beforeAll(async () => {
    git = await new GenericContainer(GIT_IMAGE)
      .withEntrypoint(["sh", "-c"])
      .withCommand(["sleep 3600"])
      .withCopyFilesToContainer([{ source: deployScript, target: "/deploy.sh" }])
      .start();
    const fixture = await run(FIXTURE);
    expect(fixture.exitCode, fixture.output).toBe(0);
    for (const name of ["base", "other", "dev2"] as const) {
      sha[name] = (await run(`cat /${name}`)).stdout.trim();
      expect(sha[name]).toMatch(/^[0-9a-f]{40}$/);
    }
  }, 120_000);

  afterAll(async () => {
    await git?.stop();
  });

  it("refuses a commit that is only on another branch, and stays where it was", async () => {
    const before = await serverHead();

    const result = await deploy(sha.other);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(`deploy: ${sha.other} is not a commit on dev`);
    expect(await serverHead()).toBe(before);
    // Its version of the script never ran: phase 2 was not reached.
    expect(result.output).not.toContain("set IMAGE_PREFIX");
  });

  it("deploys the newest dev commit, fetched from GitHub", async () => {
    const result = await deploy(sha.dev2);

    expect(await serverHead()).toBe(sha.dev2);
    expect(result.stderr).toContain("deploy: set IMAGE_PREFIX in .env.prod"); // phase 2 reached
  });

  it("deploys an older dev commit (a rollback)", async () => {
    const result = await deploy(sha.base);

    expect(await serverHead()).toBe(sha.base);
    expect(result.stderr).toContain("deploy: set IMAGE_PREFIX in .env.prod");
  });

  it("refuses a well-formed commit id that GitHub doesn't have", async () => {
    const before = await serverHead();
    const unknown = "0123456789abcdef0123456789abcdef01234567";

    const result = await deploy(unknown);

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(`deploy: ${unknown} is not a commit on dev`);
    expect(await serverHead()).toBe(before);
  });
});
