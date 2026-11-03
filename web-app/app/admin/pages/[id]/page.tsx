import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { pageReferences, pageShootPhotos } from "@/lib/data";
import { appUrl } from "@/lib/tokens";
import { sectionOn } from "@/lib/sections";
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
import { AdminReferences, AdminShootPhotos, AutoRefresh, CopyLink } from "@/components/AdminPageBoard";

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
  const [references, shootPhotos] = await Promise.all([pageReferences(id, { includeHidden: true }), pageShootPhotos(id)]);
  const locked = page.shootPhotosVisible;

  return (
    <div className="max-w-6xl space-y-8">
      <AutoRefresh pageId={page.id} />
      <div>
        {sectionOn("clients") ? (
          <Link href={`/admin/clients/${client.id}`} className="text-sm text-loupe hover:text-graphite">{client.name}</Link>
        ) : (
          <p className="text-sm text-loupe">{client.name}</p>
        )}
        <h1 className="display text-[36px]">{page.title}</h1>
        <p className="text-sm text-loupe">
          {locked
            ? "Locked: the client sees only Your Photos. Accepted references were saved for them."
            : "Open: the client is choosing reference pictures."}
        </p>
      </div>

      <section className="panel space-y-3">
        <h2 className="font-semibold">Private link</h2>
        {page.linkToken ? (
          <>
            <CopyLink url={appUrl(`/c/${page.linkToken}`)} />
            <p className="text-xs text-loupe">Anyone with this link can choose references, favourite and download. It doesn&apos;t expire.</p>
          </>
        ) : (
          <p className="error-note">
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
            <ActionButton className="btn-danger" action={revokeLinkAction.bind(null, page.id)} confirm="Turn off the private link? It stops working right away.">
              Turn off link
            </ActionButton>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Reference pictures{locked ? " (hidden from the client)" : ""}</h2>
        <AdminReferences pageId={page.id} references={references} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your Photos</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-loupe">{locked ? "Visible to the client" : "Hidden from the client"}</span>
            <ActionButton
              className={locked ? "btn-secondary" : "btn-primary"}
              action={setShootVisibilityAction.bind(null, page.id, !locked)}
              confirm={
                locked
                  ? "Hide Your Photos and unlock the page? The client sees their reference pictures again."
                  : "Show Your Photos to the client? This locks the page: reference pictures are hidden and accepted ones are saved. They'll get an email."
              }
            >
              {locked ? "Hide and unlock" : "Show to client and lock"}
            </ActionButton>
            {shootPhotos.length > 0 && (
              <a className="btn-secondary" href={`/download/${encodeURIComponent(`p:${page.id}`)}`}>Download all</a>
            )}
          </div>
        </div>
        <Uploader endpoint={`/api/admin/pages/${page.id}/shoot`} afterBatch={finishShootUploadAction.bind(null, page.id)} label="Upload Shoot Photos" />
        <AdminShootPhotos pageId={page.id} photos={shootPhotos} />
      </section>

      <details className="panel">
        <summary className="cursor-pointer font-semibold">Page details</summary>
        <div className="space-y-6 pt-4">
          <PageForm
            action={updatePageAction.bind(null, page.id)}
            defaults={{ title: page.title, shootDate: page.shootDate, notes: page.notes, favouritesLimit: page.favouritesLimit }}
            submitLabel="Save"
          />
          <ActionButton
            className="btn-danger"
            action={deletePageAction.bind(null, page.id)}
            confirm="Delete this page, its choices, comments and Shoot Photos? This can't be undone."
          >
            Delete page
          </ActionButton>
        </div>
      </details>
    </div>
  );
}
