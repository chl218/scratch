import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { allTags, searchPhotos } from "@/lib/data";
import { parseTags } from "@/lib/shared";
import { Uploader } from "@/components/Uploader";
import { LibraryGrid } from "@/components/LibraryGrid";

export const metadata = { title: "Library" };

// F1 (upload & tag) and F2 (search by tag).
export default async function LibraryPage(props: PageProps<"/admin/library">) {
  await requireAdmin();
  const sp = await props.searchParams;
  const active = parseTags(typeof sp.tags === "string" ? sp.tags : "");
  const [photos, tags] = await Promise.all([searchPhotos(active), allTags()]);

  const hrefFor = (next: string[]) => (next.length ? `/admin/library?tags=${next.join(",")}` : "/admin/library");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Photo library</h1>
      <Uploader endpoint="/api/admin/photos" withTags />

      <section className="space-y-3">
        <form action="/admin/library" className="flex gap-2">
          <input
            name="tags"
            className="input"
            placeholder="Search by tags, e.g. #moody #portrait"
            defaultValue={active.map((t) => `#${t}`).join(" ")}
          />
          <button type="submit" className="btn-primary">Search</button>
          {active.length > 0 && (
            <Link href="/admin/library" className="btn-secondary">Clear</Link>
          )}
        </form>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = active.includes(t.name);
              return (
                <Link
                  key={t.name}
                  href={hrefFor(on ? active.filter((x) => x !== t.name) : [...active, t.name])}
                  className={`pill text-xs ${on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white hover:bg-stone-100"}`}
                >
                  #{t.name} <span className="opacity-60">{t.count}</span>
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-sm text-stone-600">
          {photos.length} photo{photos.length === 1 ? "" : "s"}
          {active.length > 0 && <> tagged {active.map((t) => `#${t}`).join(" + ")}</>}
        </p>
      </section>

      <LibraryGrid photos={photos} />
    </div>
  );
}
