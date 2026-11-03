import { connection } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = { title: "Meet the team" };

// Meet the Team (F14): each admin who chose to be shown, in the order the Super Admin set.
export default async function TeamPage() {
  await connection();
  const db = await getDb();
  const team = await db
    .select({ p: schema.teamProfiles })
    .from(schema.teamProfiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.teamProfiles.userId))
    .where(and(eq(schema.teamProfiles.visible, true), eq(schema.users.disabled, false)))
    .orderBy(asc(schema.teamProfiles.sortOrder));

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader current="/team" />
      <main className="w-full max-w-[1200px] px-4 py-8 sm:px-6">
        <h1 className="display text-[48px] sm:text-[72px]">Meet the team</h1>
        {team.length === 0 ? (
          <p className="mt-6 max-w-xl text-loupe">The team is still writing their introductions. Check back soon.</p>
        ) : (
          <ul className="mt-10 grid gap-x-10 gap-y-14 md:grid-cols-2">
            {team.map(({ p }) => (
              <li key={p.userId} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5">
                {p.photoKey ? (
                  // eslint-disable-next-line @next/next/no-img-element -- media route
                  <img
                    src={`/media/team/${p.userId}/thumb?v=${encodeURIComponent(p.photoKey.split("/").pop() ?? "")}`}
                    alt={`Portrait of ${p.displayName}`}
                    className="aspect-[4/5] w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-end bg-sleeve p-3">
                    <span className="display text-[36px] text-loupe">{p.displayName.slice(0, 1)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="display text-[36px]">{p.displayName}</h2>
                  {p.roleTitle && <p className="font-semibold">{p.roleTitle}</p>}
                  {(p.yearsExperience || p.specialties) && (
                    <p className="mt-1 text-sm text-loupe">
                      {p.yearsExperience ? `${p.yearsExperience} year${p.yearsExperience === 1 ? "" : "s"} behind the camera` : ""}
                      {p.yearsExperience && p.specialties ? ". " : ""}
                      {p.specialties ? `Loves ${p.specialties}.` : p.yearsExperience ? "." : ""}
                    </p>
                  )}
                  {p.bio && <p className="mt-3 max-w-[60ch] whitespace-pre-line">{p.bio}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
