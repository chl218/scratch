"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "./forms";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** A form wired to a server action, showing its result, optionally clearing itself on success. */
function ActionForm({
  action: bound,
  children,
  submit,
  className = "space-y-3",
  resetOnSuccess = false,
}: {
  action: Action;
  children: ReactNode;
  submit: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, action] = useActionState(bound, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={action} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{submit}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export function NewClientForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submit="Add client" className="panel grid gap-3 sm:grid-cols-2">
      <Field id="client-name" label="Name">
        <input id="client-name" name="name" className="input" required maxLength={100} />
      </Field>
      <Field id="client-email" label="Email">
        <input id="client-email" name="email" type="email" className="input" required />
      </Field>
    </ActionForm>
  );
}

export function ClientDetailsForm({ action, name, username }: { action: Action; name: string; username: string }) {
  return (
    <ActionForm action={action} submit="Save">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="cd-name" label="Name">
          <input id="cd-name" name="name" className="input" defaultValue={name} required maxLength={100} />
        </Field>
        <Field id="cd-username" label="Client area address">
          <div className="flex items-center gap-1">
            <span className="text-sm text-loupe">/u/</span>
            <input id="cd-username" name="username" className="input" defaultValue={username} required maxLength={34} />
          </div>
        </Field>
      </div>
    </ActionForm>
  );
}

export function PageForm({
  action,
  defaults,
  submitLabel,
}: {
  action: Action;
  defaults?: { title: string; shootDate: string | null; notes: string; favouritesLimit: number | null };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submit={submitLabel}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="page-title" label="Page name">
          <input id="page-title" name="title" className="input" required maxLength={200} placeholder="e.g. Engagement shoot" defaultValue={defaults?.title} />
        </Field>
        <Field id="page-date" label="Shoot date">
          <input id="page-date" name="shootDate" type="date" className="input" defaultValue={defaults?.shootDate ?? ""} />
        </Field>
        <Field id="page-favs" label="Favourites limit (optional)">
          <input id="page-favs" name="favouritesLimit" inputMode="numeric" className="input" placeholder="No limit" defaultValue={defaults?.favouritesLimit ?? ""} />
        </Field>
      </div>
      <Field id="page-notes" label="Notes for the client">
        <textarea id="page-notes" name="notes" className="input min-h-20" maxLength={5000} defaultValue={defaults?.notes} />
      </Field>
    </ActionForm>
  );
}

export function InviteAdminForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submit="Invite admin" resetOnSuccess className="grid gap-3 sm:grid-cols-2">
      <Field id="inv-name" label="Name">
        <input id="inv-name" name="name" className="input" required maxLength={100} />
      </Field>
      <Field id="inv-email" label="Email">
        <input id="inv-email" name="email" type="email" className="input" required />
      </Field>
    </ActionForm>
  );
}

export type ProfileDefaults = {
  displayName: string;
  roleTitle: string;
  bio: string;
  yearsExperience: number | null;
  specialties: string;
  visible: boolean;
};

export function ProfileForm({ action, userId, defaults, photoUrl }: { action: Action; userId: string; defaults: ProfileDefaults; photoUrl: string | null }) {
  return (
    <div className="grid gap-4 md:grid-cols-[160px_1fr]">
      <PortraitUpload userId={userId} photoUrl={photoUrl} />
      <ActionForm action={action} submit="Save profile">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`p-name-${userId}`} label="Display name">
            <input id={`p-name-${userId}`} name="displayName" className="input" defaultValue={defaults.displayName} required maxLength={100} />
          </Field>
          <Field id={`p-role-${userId}`} label="Role">
            <input id={`p-role-${userId}`} name="roleTitle" className="input" defaultValue={defaults.roleTitle} placeholder="Lead photographer" maxLength={100} />
          </Field>
          <Field id={`p-years-${userId}`} label="Years of experience">
            <input id={`p-years-${userId}`} name="yearsExperience" inputMode="numeric" className="input" defaultValue={defaults.yearsExperience ?? ""} />
          </Field>
          <Field id={`p-spec-${userId}`} label="Specialties">
            <input id={`p-spec-${userId}`} name="specialties" className="input" defaultValue={defaults.specialties} placeholder="window light, film, couples" maxLength={300} />
          </Field>
        </div>
        <Field id={`p-bio-${userId}`} label="Short bio">
          <textarea id={`p-bio-${userId}`} name="bio" className="input min-h-24" defaultValue={defaults.bio} maxLength={1200} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="visible" defaultChecked={defaults.visible} />
          Show on the Meet the Team page
        </label>
      </ActionForm>
    </div>
  );
}

function PortraitUpload({ userId, photoUrl }: { userId: string; photoUrl: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <div className="space-y-2">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- media route
        <img src={photoUrl} alt="Portrait" className="aspect-[4/5] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/5] w-full items-center justify-center bg-sleeve text-xs text-loupe">No portrait</div>
      )}
      <label className="btn-secondary w-full">
        {busy ? "Uploading…" : "Upload portrait"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError("");
            start(async () => {
              const body = new FormData();
              body.set("file", file);
              const res = await fetch(`/api/admin/team/${userId}/photo`, { method: "POST", body });
              if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "Upload failed.");
              router.refresh();
            });
          }}
        />
      </label>
      {error && <p className="error-note">⚠ {error}</p>}
    </div>
  );
}

export function EmailPrefsForm({ action, prefs }: { action: Action; prefs: { messages: boolean; activity: boolean; bookings: boolean } }) {
  return (
    <ActionForm action={action} submit="Save">
      {(
        [
          ["messages", "Client messages and contact form"],
          ["activity", "Activity digest (choices, comments, favourites)"],
          ["bookings", "Bookings made, moved or cancelled"],
        ] as const
      ).map(([key, text]) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={key} defaultChecked={prefs[key]} />
          {text}
        </label>
      ))}
    </ActionForm>
  );
}

export function StudioSettingsForm({
  action,
  defaults,
}: {
  action: Action;
  defaults: { timeZone: string; bufferMinutes: number; cancelCutoffHours: number; digestDelayMinutes: number };
}) {
  return (
    <ActionForm action={action} submit="Save studio settings">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="s-tz" label="Studio time zone">
          <input id="s-tz" name="timeZone" className="input" defaultValue={defaults.timeZone} placeholder="America/Los_Angeles" />
        </Field>
        <Field id="s-buf" label="Gap between bookings (minutes)">
          <input id="s-buf" name="bufferMinutes" inputMode="numeric" className="input" defaultValue={defaults.bufferMinutes} />
        </Field>
        <Field id="s-cut" label="Clients can change bookings until (hours before)">
          <input id="s-cut" name="cancelCutoffHours" inputMode="numeric" className="input" defaultValue={defaults.cancelCutoffHours} />
        </Field>
        <Field id="s-dig" label="Activity digest after (minutes of quiet)">
          <input id="s-dig" name="digestDelayMinutes" inputMode="numeric" className="input" defaultValue={defaults.digestDelayMinutes} />
        </Field>
      </div>
    </ActionForm>
  );
}

export function SessionTypeForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submit="Add session type" resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field id="st-name" label="Name">
          <input id="st-name" name="name" className="input" required maxLength={100} placeholder="Portrait" />
        </Field>
        <Field id="st-len" label="Length (minutes)">
          <input id="st-len" name="durationMinutes" inputMode="numeric" className="input" required placeholder="60" />
        </Field>
      </div>
      <Field id="st-desc" label="Description">
        <input id="st-desc" name="description" className="input" maxLength={500} placeholder="One location, about 40 edited photos" />
      </Field>
    </ActionForm>
  );
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function HoursForm({ action, rules }: { action: Action; rules: { weekday: number; startTime: string; endTime: string }[] }) {
  return (
    <ActionForm action={action} submit="Save hours">
      <div className="grid gap-2">
        {WEEKDAYS.map((day, i) => {
          const r = rules.find((x) => x.weekday === i);
          return (
            <div key={day} className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex w-32 items-center gap-2">
                <input type="checkbox" name={`on${i}`} defaultChecked={Boolean(r)} />
                {day}
              </label>
              <input aria-label={`${day} start`} name={`start${i}`} type="time" step={1800} className="input w-32" defaultValue={r?.startTime ?? "09:00"} />
              <span className="text-loupe">to</span>
              <input aria-label={`${day} end`} name={`end${i}`} type="time" step={1800} className="input w-32" defaultValue={r?.endTime ?? "17:00"} />
            </div>
          );
        })}
      </div>
    </ActionForm>
  );
}

export function TimeOffForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submit="Add time off" resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="to-start" label="First day">
          <input id="to-start" name="startDate" type="date" className="input" required />
        </Field>
        <Field id="to-end" label="Last day">
          <input id="to-end" name="endDate" type="date" className="input" />
        </Field>
        <Field id="to-note" label="Note">
          <input id="to-note" name="note" className="input" maxLength={200} placeholder="Holiday" />
        </Field>
      </div>
    </ActionForm>
  );
}

export function RescheduleForm({
  action,
  admins,
  defaults,
}: {
  action: Action;
  admins: { id: string; name: string }[];
  defaults: { date: string; time: string; adminId: string };
}) {
  return (
    <ActionForm action={action} submit="Move booking" className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <Field id="rs-date" label="Date">
        <input id="rs-date" name="date" type="date" className="input" defaultValue={defaults.date} required />
      </Field>
      <Field id="rs-time" label="Time">
        <input id="rs-time" name="time" type="time" className="input" defaultValue={defaults.time} required />
      </Field>
      <Field id="rs-admin" label="With">
        <select id="rs-admin" name="adminId" className="input" defaultValue={defaults.adminId}>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </Field>
    </ActionForm>
  );
}

/** Adds an assigned admin to a client (F12). */
export function AssignAdmin({ admins, assign }: { admins: { id: string; name: string }[]; assign: (adminId: string) => Promise<void> }) {
  const [adminId, setAdminId] = useState(admins[0]?.id ?? "");
  const [busy, start] = useTransition();
  if (admins.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="assign-admin" className="sr-only">Admin to assign</label>
      <select id="assign-admin" className="input w-auto" value={adminId} onChange={(e) => setAdminId(e.target.value)}>
        {admins.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <button type="button" className="btn-secondary" disabled={busy || !adminId} onClick={() => start(() => assign(adminId))}>
        {busy ? "Assigning…" : "Assign"}
      </button>
    </div>
  );
}
