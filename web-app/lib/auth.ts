import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getDb, schema } from "./db";
import { hashToken, newToken } from "./tokens";

const COOKIE = "mb_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  isSuperAdmin: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<void> {
  const db = await getDb();
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token)));
  }
  jar.delete(COOKIE);
}

/** The logged-in user, or null. Cached for the length of one request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      isSuperAdmin: schema.users.isSuperAdmin,
      disabled: schema.users.disabled,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, hashToken(token)), gt(schema.sessions.expiresAt, new Date())));
  if (!row || row.disabled) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, isSuperAdmin: row.isSuperAdmin };
});

/** The client record of the logged-in client, or null. */
export const getCurrentClient = cache(async () => {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") return null;
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.userId, user.id));
  return client ? { user, client } : null;
});

/** Where a user lands after logging in. */
export function homeFor(user: CurrentUser, username?: string | null): string {
  if (user.role === "admin") return "/admin";
  return username ? `/u/${username}` : "/";
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/login");
  return user;
}

export async function requireSuperAdmin(): Promise<CurrentUser> {
  const user = await requireAdmin();
  if (!user.isSuperAdmin) redirect("/admin");
  return user;
}

/** The logged-in client and their client record. */
export async function requireClient() {
  const found = await getCurrentClient();
  if (!found) redirect("/login");
  return found;
}

/** Same as requireAdmin, but throws instead of redirecting (for actions and API routes). */
export async function assertAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") throw new Error("Not authorized");
  return user;
}

export async function assertSuperAdmin(): Promise<CurrentUser> {
  const user = await assertAdmin();
  if (!user.isSuperAdmin) throw new Error("Only the Super Admin can do this");
  return user;
}
