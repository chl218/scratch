import Link from "next/link";
import { allTags, searchPhotos } from "@/lib/data";
import { parseTags } from "@/lib/shared";
import { LibraryGrid } from "@/components/LibraryGrid";
import { TagSearch } from "@/components/TagSearch";

export const metadata = { title: "Library" };

// F2: search the library by tag (all tags must match), and open a picture to edit it.
export default async function LibraryPage(props: PageProps<"/admin/library">) {
  const sp = await props.searchParams;
  const active = parseTags(typeof sp.tags === "string" ? sp.tags : "");
  const [photos, tags] = await Promise.all([searchPhotos(active), allTags()]);

  return (
    <>
      <section className="space-y-3">
        <TagSearch key={active.join(",")} action="/admin/library" initial={active} tags={tags} />
        <p className="text-sm text-loupe">
          {photos.length} picture{photos.length === 1 ? "" : "s"}
          {active.length > 0 && (
            <>
              {" "}tagged {active.map((t) => `#${t}`).join(" + ")}.{" "}
              <Link href="/admin/library" className="font-semibold text-graphite underline underline-offset-4">Clear search</Link>
            </>
          )}
        </p>
      </section>
      <LibraryGrid photos={photos} />
    </>
  );
}
