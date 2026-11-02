"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "./forms";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

function useResetOnSuccess(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function NewClientForm({ action: boundAction }: { action: Action }) {
  const [state, action] = useActionState(boundAction, undefined);
  return (
    <form action={action} className="card grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label className="label" htmlFor="client-name">Name</label>
        <input id="client-name" name="name" className="input" required maxLength={100} />
      </div>
      <div>
        <label className="label" htmlFor="client-email">Email</label>
        <input id="client-email" name="email" type="email" className="input" required />
      </div>
      <SubmitButton pendingText="Adding…">Add client</SubmitButton>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PageForm({
  action: boundAction,
  defaults,
  submitLabel,
}: {
  action: Action;
  defaults?: { title: string; shootDate: string | null; notes: string };
  submitLabel: string;
}) {
  const [state, action] = useActionState(boundAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="page-title">Page name</label>
          <input
            id="page-title"
            name="title"
            className="input"
            required
            maxLength={200}
            placeholder="e.g. Engagement shoot"
            defaultValue={defaults?.title}
          />
        </div>
        <div>
          <label className="label" htmlFor="page-date">Shoot date</label>
          <input id="page-date" name="shootDate" type="date" className="input" defaultValue={defaults?.shootDate ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="page-notes">Notes for the client</label>
        <textarea id="page-notes" name="notes" className="input min-h-20" maxLength={5000} defaultValue={defaults?.notes} />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function PaymentForm({
  action: boundAction,
  pages,
}: {
  action: Action;
  pages: { id: string; title: string }[];
}) {
  const [state, action] = useActionState(boundAction, undefined);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <label className="label" htmlFor="pay-desc">Description</label>
          <input id="pay-desc" name="description" className="input" required maxLength={200} placeholder="Deposit" />
        </div>
        <div>
          <label className="label" htmlFor="pay-amount">Amount</label>
          <input id="pay-amount" name="amount" type="number" min="0.01" step="0.01" className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="pay-currency">Currency</label>
          <select id="pay-currency" name="currency" className="input" defaultValue="USD">
            {["USD", "CAD", "EUR", "GBP", "AUD"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      {pages.length > 0 && (
        <div>
          <label className="label" htmlFor="pay-page">For shoot (optional)</label>
          <select id="pay-page" name="pageId" className="input" defaultValue="">
            <option value="">—</option>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Sending…">Send payment request</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
