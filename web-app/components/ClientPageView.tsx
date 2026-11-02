import type { PageAccess } from "@/lib/access";
import { pageInspirations, pageShootPhotos } from "@/lib/data";
import { formatDate } from "@/lib/shared";
import { ClientBoard } from "./ClientBoard";

/** Server part of a client page: loads the data, then hands it to ClientBoard. */
export async function ClientPageView({ access }: { access: PageAccess }) {
  const { page, client } = access;
  const [inspirations, shootPhotos] = await Promise.all([
    pageInspirations(page.id),
    page.shootPhotosVisible ? pageShootPhotos(page.id) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-stone-500">For {client.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
        {page.shootDate && <p className="text-sm text-stone-600">Shoot date: {formatDate(page.shootDate)}</p>}
        {page.notes && <p className="max-w-2xl whitespace-pre-wrap pt-2 text-sm text-stone-700">{page.notes}</p>}
      </header>
      {!page.shootPhotosVisible && (
        <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700">
          Accept the photos whose style you like and reject the ones you don&apos;t. Your choices save automatically, and
          you can change them any time.
        </p>
      )}
      <ClientBoard accessKey={access.key} inspirations={inspirations} shootPhotos={shootPhotos} />
    </div>
  );
}
