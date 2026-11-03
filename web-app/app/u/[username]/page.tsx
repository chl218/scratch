import Link from "next/link";
import { notFound } from "next/navigation";
import { and, inArray, isNull } from "drizzle-orm";
import { resolveArea } from "@/lib/area";
import { isLocked } from "@/lib/access";
import { getDb, schema } from "@/lib/db";
import { formatDate } from "@/lib/shared";
import { LibrarySearch } from "@/components/LibrarySearch";

export const metadata = { title: "My studio" };

// Client area home (F17): their shoots and the library search (F4).
export default async function ClientAreaHome(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const sp = await props.searchParams;
  const area = await resolveArea(username);
  if (!area) notFound();

  const open = area.pages.filter(({ page }) => !isLocked(page));
  const db = await getDb();
  const onPages = open.length
    ? await db
        .select({ pageId: schema.referencePictures.pageId, photoId: schema.referencePictures.photoId })
        .from(schema.referencePictures)
        .where(
          and(
            inArray(schema.referencePictures.pageId, open.map((p) => p.page.id)),
            isNull(schema.referencePictures.hiddenAt),
          ),
        )
    : [];

  const linkFor = (p: (typeof area.pages)[number]) =>
    p.key.startsWith("t:") ? `/c/${p.key.slice(2)}` : p.page.linkToken ? `/c/${p.page.linkToken}` : null;

  return (
    <div className="space-y-12">
      <section className="space-y-3" aria-labelledby="shoots-heading">
        <h2 id="shoots-heading" className="text-[24px] font-semibold">Shoots</h2>
        {area.pages.length === 0 ? (
          <p className="text-loupe">
            Nothing here yet.{" "}
            <Link href="/book" className="font-semibold text-graphite underline underline-offset-4">Book a shoot</Link> to get started.
          </p>
        ) : (
          <ul className="divide-y divide-sleeve border-y border-sleeve">
            {area.pages.map((p) => {
              const href = linkFor(p);
              return (
                <li key={p.page.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                  {href ? (
                    <Link href={href} className="text-lg font-semibold hover:underline">{p.page.title}</Link>
                  ) : (
                    <span className="text-lg font-semibold">{p.page.title}</span>
                  )}
                  <span className="text-sm text-loupe">
                    {p.page.shootDate ? formatDate(p.page.shootDate) : "Date to be set"}
                    {isLocked(p.page) ? ". Your photos are ready" : ". Choosing references"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {area.pages.length > 0 && (
        <LibrarySearch
          username={area.client.username!}
          mediaKey={area.pages[0].key}
          initialPageId={typeof sp.page === "string" ? sp.page : undefined}
          pages={open.map((p) => ({
            id: p.page.id,
            title: p.page.title,
            key: p.key,
            photoIds: onPages.filter((r) => r.pageId === p.page.id && r.photoId).map((r) => r.photoId!),
          }))}
        />
      )}
    </div>
  );
}
