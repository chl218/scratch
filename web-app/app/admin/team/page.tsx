import { asc, desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { formatDate } from "@/lib/shared";
import {
  decideAdminInviteAction,
  inviteAdminAction,
  moveProfileAction,
  setAdminDisabledAction,
  updateProfileAction,
} from "@/app/actions/team";
import { InviteAdminForm, ProfileForm } from "@/components/AdminForms";
import { ActionButton } from "@/components/ActionButton";

export const metadata = { title: "Team" };

// Admins, admin invites and approvals (F12), and team profiles (F14).
export default async function TeamAdmin() {
  const me = await requireAdmin();
  const db = await getDb();
  const [admins, invites] = await Promise.all([
    db
      .select({ u: schema.users, p: schema.teamProfiles })
      .from(schema.users)
      .leftJoin(schema.teamProfiles, eq(schema.teamProfiles.userId, schema.users.id))
      .where(eq(schema.users.role, "admin"))
      .orderBy(asc(schema.teamProfiles.sortOrder), asc(schema.users.name)),
    db
      .select({ i: schema.adminInvites, inviter: schema.users.name })
      .from(schema.adminInvites)
      .leftJoin(schema.users, eq(schema.users.id, schema.adminInvites.invitedBy))
      .orderBy(desc(schema.adminInvites.createdAt))
      .limit(20),
  ]);
  const pending = invites.filter(({ i }) => i.status === "pending");
  const editable = admins.filter(({ u }) => me.isSuperAdmin || u.id === me.id);

  return (
    <div className="max-w-5xl space-y-10">
      <h1 className="display text-[36px]">Team</h1>

      {me.isSuperAdmin && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Waiting for your approval</h2>
          <ul className="space-y-2">
            {pending.map(({ i, inviter }) => (
              <li key={i.id} className="panel flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{i.name}</span> <span className="text-loupe">{i.email}</span>
                  <span className="block text-sm text-loupe">Invited by {inviter ?? "an admin"} on {formatDate(i.createdAt)}</span>
                </span>
                <span className="flex gap-2">
                  <ActionButton className="btn-primary" action={decideAdminInviteAction.bind(null, i.id, true)}>Approve</ActionButton>
                  <ActionButton className="btn-danger" action={decideAdminInviteAction.bind(null, i.id, false)} confirm={`Decline the invite for ${i.name}?`}>
                    Decline
                  </ActionButton>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Admins</h2>
        <ul className="divide-y divide-sleeve border-y border-sleeve bg-sheet text-sm">
          {admins.map(({ u, p }, i) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className={u.disabled ? "text-loupe line-through" : ""}>
                <span className="font-semibold">{p?.displayName || u.name}</span> <span className="text-loupe">{u.email}</span>
                {u.isSuperAdmin && <span className="ml-2 text-xs text-marker">Super Admin</span>}
                {p?.visible ? <span className="ml-2 text-xs text-loupe">On the team page</span> : null}
              </span>
              {me.isSuperAdmin && (
                <span className="flex flex-wrap gap-1">
                  {i > 0 && (
                    <ActionButton className="btn-quiet" action={moveProfileAction.bind(null, u.id, -1)} pendingText="Moving…">
                      Move up
                    </ActionButton>
                  )}
                  {i < admins.length - 1 && (
                    <ActionButton className="btn-quiet" action={moveProfileAction.bind(null, u.id, 1)} pendingText="Moving…">
                      Move down
                    </ActionButton>
                  )}
                  {!u.isSuperAdmin && (
                    <ActionButton
                      className={u.disabled ? "btn-secondary" : "btn-danger"}
                      action={setAdminDisabledAction.bind(null, u.id, !u.disabled)}
                      confirm={u.disabled ? undefined : `Disable ${u.name}? They're logged out and removed from their clients.`}
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </ActionButton>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="panel space-y-2">
          <h3 className="font-semibold">Invite an admin</h3>
          {!me.isSuperAdmin && <p className="text-sm text-loupe">The Super Admin approves new admins before the invite goes out.</p>}
          <InviteAdminForm action={inviteAdminAction} />
        </div>
        {invites.some(({ i }) => i.status !== "pending") && (
          <p className="text-xs text-loupe">
            Recent invites:{" "}
            {invites
              .filter(({ i }) => i.status !== "pending")
              .map(({ i }) => `${i.name} (${i.status === "approved" ? "approved" : "declined"})`)
              .join(", ")}
          </p>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Meet the Team profiles</h2>
        {editable.map(({ u, p }) => (
          <div key={u.id} className="panel space-y-3">
            <h3 className="font-semibold">{u.id === me.id ? "Your profile" : p?.displayName || u.name}</h3>
            <ProfileForm
              action={updateProfileAction.bind(null, u.id)}
              userId={u.id}
              photoUrl={p?.photoKey ? `/media/team/${u.id}/thumb?v=${encodeURIComponent(p.photoKey.split("/").pop() ?? "")}` : null}
              defaults={{
                displayName: p?.displayName || u.name,
                roleTitle: p?.roleTitle ?? "",
                bio: p?.bio ?? "",
                yearsExperience: p?.yearsExperience ?? null,
                specialties: p?.specialties ?? "",
                visible: p?.visible ?? false,
              }}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
