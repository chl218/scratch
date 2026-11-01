import hooksData from "@/data/hooks.json";

export const CATEGORIES = [
  "Security",
  "Formatting",
  "Testing",
  "Notifications",
  "Git",
  "Logging & Monitoring",
  "Productivity",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Hook {
  id: string;
  name: string;
  category: Category;
  description: string;
  repoUrl: string;
}

// Where the "Add a hook" link points (PR against data/hooks.json).
export const CONTRIBUTE_URL = "https://github.com/chl218/scratch";

const ID_PATTERN = /^[a-z0-9-]+$/;
const NAME_MAX = 60;
const DESCRIPTION_MAX = 200;

function isGitHubUrl(value: string): boolean {
  if (!value.startsWith("https://github.com/")) return false;
  try {
    return new URL(value).hostname === "github.com";
  } catch {
    return false;
  }
}

/**
 * Validates the raw JSON. Throws with the entry id and field name so a bad
 * entry fails `next build` with a clear message.
 */
export function validateHooks(raw: unknown): Hook[] {
  if (!Array.isArray(raw)) {
    throw new Error("data/hooks.json must be a JSON array");
  }

  const seen = new Set<string>();

  return raw.map((entry: unknown, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`hooks.json[${index}]: entry must be an object`);
    }
    const e = entry as Record<string, unknown>;
    const label = typeof e.id === "string" ? `"${e.id}"` : `[${index}]`;
    const fail = (field: string, problem: string): never => {
      throw new Error(`hooks.json ${label}: "${field}" ${problem}`);
    };

    for (const field of ["id", "name", "category", "description", "repoUrl"]) {
      if (typeof e[field] !== "string" || e[field] === "") {
        fail(field, "is required and must be a non-empty string");
      }
    }

    const { id, name, category, description, repoUrl } = e as Record<
      string,
      string
    >;

    if (!ID_PATTERN.test(id)) fail("id", "must match ^[a-z0-9-]+$");
    if (seen.has(id)) fail("id", "is a duplicate");
    seen.add(id);
    if (name.length > NAME_MAX) fail("name", `must be ≤ ${NAME_MAX} characters`);
    if (!(CATEGORIES as readonly string[]).includes(category)) {
      fail("category", `must be one of: ${CATEGORIES.join(", ")}`);
    }
    if (description.length > DESCRIPTION_MAX) {
      fail("description", `must be ≤ ${DESCRIPTION_MAX} characters`);
    }
    if (!isGitHubUrl(repoUrl)) {
      fail("repoUrl", "must be an https://github.com/ URL");
    }

    return { id, name, category: category as Category, description, repoUrl };
  });
}

/** All hooks, validated and sorted alphabetically by name (case-insensitive). */
export function getHooks(): Hook[] {
  return validateHooks(hooksData).sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

/** "owner/repo" from a GitHub URL, for display. */
export function repoLabel(repoUrl: string): string {
  const [owner, repo] = new URL(repoUrl).pathname.split("/").filter(Boolean);
  return repo ? `${owner}/${repo}` : (owner ?? repoUrl);
}
