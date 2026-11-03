import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { hasAdmin } from "@/lib/setup";
import { portfolioPhotos, portfolioTags } from "@/lib/data";
import { packMosaic, shuffle } from "@/lib/mosaic";
import { parseTags } from "@/lib/shared";
import { Mosaic, type MosaicItem } from "@/components/Mosaic";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

const MOSAIC_SIZE = 24;
const TOP_TAGS = 8;

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

  const href = (next: string[]) => (next.length ? `/?tags=${next.join(",")}` : "/");
  const pill = (t: string) => {
    const on = active.includes(t);
    return (
      <Link
        key={t}
        href={href(on ? active.filter((x) => x !== t) : [...active, t])}
        aria-pressed={on}
        className={`pill text-xs ${on ? "pill-on" : ""}`}
      >
        #{t}
      </Link>
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader current="/" />
      <section className="px-4 pb-4 sm:px-6" aria-label="Search the studio's work">
        <form action="/" className="flex max-w-xl gap-2">
          <label htmlFor="work-search" className="sr-only">
            Search the studio&apos;s work by tag
          </label>
          <input
            id="work-search"
            name="tags"
            list="portfolio-tags"
            className="input"
            placeholder="Search the studio's work: #portrait #golden"
            defaultValue={active.map((t) => `#${t}`).join(" ")}
          />
          <datalist id="portfolio-tags">
            {tags.map((t) => (
              <option key={t} value={`#${t}`} />
            ))}
          </datalist>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {/* The most used tags, plus any that are switched on; the rest fold away so photos stay near the top. */}
            {tags.filter((t, i) => i < TOP_TAGS || active.includes(t)).map(pill)}
            {tags.length > TOP_TAGS && (
              <details className="contents">
                <summary className="cursor-pointer list-none px-2 text-xs font-semibold text-loupe hover:text-graphite">More tags</summary>
                {tags.filter((t, i) => i >= TOP_TAGS && !active.includes(t)).map(pill)}
              </details>
            )}
          </div>
        )}
        {searching && (
          <p className="mt-3 text-sm text-loupe">
            {all.length === 0
              ? `Nothing tagged ${active.map((t) => `#${t}`).join(" and ")} yet.`
              : `${all.length} photo${all.length === 1 ? "" : "s"} tagged ${active.map((t) => `#${t}`).join(" and ")}, newest first.`}{" "}
            <Link href="/" className="font-semibold text-graphite underline underline-offset-4">
              Clear search
            </Link>
          </p>
        )}
      </section>

      {items.length > 0 ? (
        <Mosaic items={items} />
      ) : (
        !searching && (
          <section className="px-4 py-16 sm:px-6">
            <p className="display max-w-2xl text-[36px] sm:text-[48px]">The studio&apos;s work will hang here soon.</p>
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
