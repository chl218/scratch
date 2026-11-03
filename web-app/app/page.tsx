import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasAdmin } from "@/lib/setup";
import { portfolioPhotos, portfolioTags } from "@/lib/data";
import { packMosaic, shuffle } from "@/lib/mosaic";
import { parseTags } from "@/lib/shared";
import { Mosaic, type MosaicItem } from "@/components/Mosaic";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { TagSearch } from "@/components/TagSearch";

const MOSAIC_SIZE = 24;

// Public landing page (F13): the studio's work as an interlocking mosaic,
// reshuffled on every visit, with a tag search over portfolio photos only.
export default async function Home(props: PageProps<"/">) {
  await connection();
  if (!(await hasAdmin())) redirect("/setup");
  const sp = await props.searchParams;
  const active = parseTags(typeof sp.tags === "string" ? sp.tags : "");
  const searching = active.length > 0;

  const [all, tags] = await Promise.all([portfolioPhotos(active), portfolioTags()]);
  const chosen = searching ? all : shuffle(all).slice(0, MOSAIC_SIZE);
  const layouts = [2, 4, 6].map((cols) => packMosaic(chosen, cols, !searching));
  const items: MosaicItem[] = chosen.map((p, i) => {
    const style: Record<string, string> = {};
    [2, 4, 6].forEach((cols, k) => {
      const place = layouts[k][i];
      if (!place) style[`--d${cols}`] = "none";
      else {
        style[`--c${cols}`] = `${place.col} / span ${place.w}`;
        style[`--r${cols}`] = `${place.row} / span ${place.h}`;
      }
    });
    return { kind: p.kind, id: p.id, title: p.title, focusX: p.focusX, focusY: p.focusY, style };
  });

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader current="/" />
      {/* Search sits quietly above the photos; tags are suggested while typing (portfolio tags only). */}
      <section className="px-4 pb-6 sm:px-8 lg:px-11" aria-label="Search the studio's work">
        <TagSearch key={active.join(",")} action="/" initial={active} tags={tags} placeholder="Search the studio's work by tag" quiet />
        {searching && (
          <p className="mt-3 text-sm text-loupe">
            {all.length === 0
              ? `Nothing tagged ${active.map((t) => `#${t}`).join(" and ")} yet.`
              : `${all.length} photo${all.length === 1 ? "" : "s"} tagged ${active.map((t) => `#${t}`).join(" and ")}, newest first.`}{" "}
            <Link href="/" className="text-graphite underline underline-offset-4">
              Clear search
            </Link>
          </p>
        )}
      </section>

      {items.length > 0 ? (
        <Mosaic items={items} />
      ) : (
        !searching && (
          <section className="px-4 py-16 sm:px-8 lg:px-11">
            <p className="display max-w-2xl text-[28px] sm:text-[36px]">The studio&apos;s work will hang here soon.</p>
            <p className="mt-4 max-w-xl text-loupe">
              In the meantime, <Link href="/team" className="font-semibold text-graphite underline underline-offset-4">meet the team</Link> or{" "}
              <Link href="/book" className="font-semibold text-graphite underline underline-offset-4">book a shoot</Link>.
            </p>
          </section>
        )
      )}
      <SiteFooter />
    </div>
  );
}
