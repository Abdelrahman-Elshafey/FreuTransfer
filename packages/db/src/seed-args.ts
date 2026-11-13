/** The seed command was called in a way it refuses (unknown argument, drafts in production). */
export class SeedArgsError extends Error {
  override name = "SeedArgsError";
}

/**
 * Reads the arguments of `pnpm db:seed [--include-drafts]`.
 * Drafts are for a local preview only: they are refused in production, because the database
 * does not store the review status, so a loaded draft would look exactly like verified data.
 */
export function parseSeedArgs(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): { readonly includeDrafts: boolean } {
  // A lone "--" is how some pnpm/npm versions separate their own arguments from the script's.
  const unknown = args.filter((a) => a !== "--include-drafts" && a !== "--");
  if (unknown.length > 0) {
    throw new SeedArgsError(
      `Unknown argument: ${unknown.join(" ")}. Only --include-drafts exists.`,
    );
  }
  const includeDrafts = args.includes("--include-drafts");
  if (includeDrafts && env.NODE_ENV === "production") {
    throw new SeedArgsError("--include-drafts is not allowed in production: only verified data");
  }
  return { includeDrafts };
}
