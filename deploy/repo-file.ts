import { readFileSync } from "node:fs";

/** A file of this repository as text, by its path from the repository root. */
export const readRepoFile = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/** The images a compose file uses whose name starts with `name:` (e.g. "postgres"). */
export const composeImages = (composeFile: string, name: string) =>
  [...readRepoFile(composeFile).matchAll(new RegExp(`image: (${name}:\\S+)`, "g"))].map(
    (match) => match[1] as string,
  );
