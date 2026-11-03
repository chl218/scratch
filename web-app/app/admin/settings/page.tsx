import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_EMAIL_PREFS } from "@/lib/db/schema";
import { getSettings } from "@/lib/booking";
import { updateEmailPrefsAction, updateStudioSettingsAction } from "@/app/actions/team";
import { EmailPrefsForm, StudioSettingsForm } from "@/components/AdminForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireAdmin();
  const db = await getDb();
  const [[row], settings] = await Promise.all([
    db.select({ prefs: schema.users.emailPrefs }).from(schema.users).where(eq(schema.users.id, me.id)),
    getSettings(),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="display text-[36px]">Settings</h1>
      <section className="panel space-y-3">
        <h2 className="font-semibold">Emails you get</h2>
        <p className="text-sm text-loupe">For clients you&apos;re assigned to{me.isSuperAdmin ? ", and all clients as the Super Admin" : ""}.</p>
        <EmailPrefsForm action={updateEmailPrefsAction} prefs={{ ...DEFAULT_EMAIL_PREFS, ...row?.prefs }} />
      </section>
      {me.isSuperAdmin ? (
        <section className="panel space-y-3">
          <h2 className="font-semibold">Studio</h2>
          <StudioSettingsForm action={updateStudioSettingsAction} defaults={settings} />
        </section>
      ) : (
        <p className="text-sm text-loupe">
          Studio settings (time zone {settings.timeZone}, a {settings.bufferMinutes}-minute gap between bookings) are set by the Super Admin.
        </p>
      )}
    </div>
  );
}
