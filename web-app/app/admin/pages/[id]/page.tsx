import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { pageInspirations, pageShootPhotos } from "@/lib/data";
import { appUrl } from "@/lib/tokens";
import {
  deletePageAction,
  finishShootUploadAction,
  regenerateLinkAction,
  revokeLinkAction,
  setShootVisibilityAction,
  updatePageAction,
} from "@/app/actions/admin";
import { PageForm } from "@/components/AdminForms";
import { ActionButton } from "@/components/ActionButton";
import { Uploader } from "@/components/Uploader";
import { AdminInspirations, AdminShootPhotos, AutoRefresh, CopyLink } from "@/components/AdminPageBoard";

export const metadata = { title: "Client page" };

export default async function AdminClientPage(props: PageProps<"/admin/pages/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [row] = await db
    .select({ page: schema.clientPages, client: schema.clients })
    .from(schema.clientPages)
    .innerJoin(schema.clients, eq(schema.clients.id, schema.clientPages.clientId))
    .where(eq(schema.clientPages.id, id));
  if (!row) notFound();
  const { page, client } = row;
  const [inspirations, shootPhotos] = await Promise.all([pageInspirations(id), pageShootPhotos(id)]);

  return (
    <div className="space-y-8">
      <AutoRefresh />
      <div>
        <Link href={`/admin/clients/${client.id}`} className="text-sm text-stone-500 hover:text-stone-900">
          ← {client.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">Private link</h2>
        {page.linkToken ? (
          <>
            <CopyLink url={appUrl(`/c/${page.linkToken}`)} />
            <p className="text-xs text-stone-500">Anyone with this link can view and choose photos. It doesn&apos;t expire.</p>
          </>
        ) : (
          <p className="text-sm text-amber-800">
            The link is turned off. {client.userId ? "The client can still open this page from their account." : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <ActionButton
            action={regenerateLinkAction.bind(null, page.id)}
            confirm={page.linkToken ? "Make a new link? The old link will stop working." : undefined}
          >
            {page.linkToken ? "Make a new link" : "Turn link on"}
          </ActionButton>
          {page.linkToken && (
            <ActionButton
              className="btn-danger"
              action={revokeLinkAction.bind(null, page.id)}
              confirm="Turn off the private link? It will stop working right away."
            >
              Turn off link
            </ActionButton>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Inspirations</h2>
        <AdminInspirations pageId={page.id} inspirations={inspirations} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Shoot photos (&ldquo;Your Photos&rdquo;)</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm ${page.shootPhotosVisible ? "text-emerald-700" : "text-stone-500"}`}>
              {page.shootPhotosVisible ? "Visible to client" : "Hidden from client"}
            </span>
            <ActionButton
              className={page.shootPhotosVisible ? "btn-secondary" : "btn-primary"}
              action={setShootVisibilityAction.bind(null, page.id, !page.shootPhotosVisible)}
              confirm={
                page.shootPhotosVisible
                  ? undefined
                  : "Show the shoot photos to the client? They'll get an email about any new photos."
              }
            >
              {page.shootPhotosVisible ? "Hide" : "Show to client"}
            </ActionButton>
            {shootPhotos.length > 0 && (
              <a className="btn-secondary" href={`/download/${encodeURIComponent(`p:${page.id}`)}`}>
                Download all
              </a>
            )}
          </div>
        </div>
        <Uploader
          endpoint={`/api/admin/pages/${page.id}/shoot`}
          afterBatch={finishShootUploadAction.bind(null, page.id)}
          label="Upload shoot photos"
        />
        <AdminShootPhotos pageId={page.id} photos={shootPhotos} />
      </section>

      <details className="card">
        <summary className="cursor-pointer font-semibold">Page details</summary>
        <div className="space-y-6 pt-4">
          <PageForm
            action={updatePageAction.bind(null, page.id)}
            defaults={{ title: page.title, shootDate: page.shootDate, notes: page.notes }}
            submitLabel="Save"
          />
          <ActionButton
            className="btn-danger"
            action={deletePageAction.bind(null, page.id)}
            confirm="Delete this page, its choices, comments and shoot photos? This can't be undone."
          >
            Delete page
          </ActionButton>
        </div>
      </details>
    </div>
  );
}
