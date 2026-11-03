import "server-only";
import { cookies } from "next/headers";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "./db";

// Browsers remember which private links they've opened, so a link visitor can
// reach that client's area at /u/<username> without logging in (F17).
// Revoking or regenerating a link makes its token invalid, which removes access.

const COOKIE = "mb_links";
const MAX = 20;

function parse(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(".").filter((t) => /^[\w-]{20,100}$/.test(t));
}

/** Tokens this browser has opened. */
export async function rememberedTokens(): Promise<string[]> {
  return parse((await cookies()).get(COOKIE)?.value);
}

/** Call from a server action or route handler (cookies can't be set while rendering). */
export async function rememberToken(token: string): Promise<void> {
  const jar = await cookies();
  const tokens = [token, ...parse(jar.get(COOKIE)?.value).filter((t) => t !== token)].slice(0, MAX);
  jar.set(COOKIE, tokens.join("."), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Valid links this browser has opened for one client: page id → token. */
export async function linkedPagesFor(clientId: string): Promise<Map<string, string>> {
  const tokens = await rememberedTokens();
  const map = new Map<string, string>();
  if (tokens.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select({ id: schema.clientPages.id, token: schema.clientPages.linkToken })
    .from(schema.clientPages)
    .where(
      and(
        eq(schema.clientPages.clientId, clientId),
        isNotNull(schema.clientPages.linkToken),
        inArray(schema.clientPages.linkToken, tokens),
      ),
    );
  for (const r of rows) map.set(r.id, r.token!);
  return map;
}

/** Clients whose links this browser has opened (for the "My studio" link in the header). */
export async function linkedClients(): Promise<{ id: string; name: string; username: string | null }[]> {
  const tokens = await rememberedTokens();
  if (tokens.length === 0) return [];
  const db = await getDb();
  return db
    .selectDistinct({ id: schema.clients.id, name: schema.clients.name, username: schema.clients.username })
    .from(schema.clientPages)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
    .where(inArray(schema.clientPages.linkToken, tokens));
}
