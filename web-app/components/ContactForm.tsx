"use client";

import { useActionState } from "react";
import { contactAction } from "@/app/actions/client";
import { FormMessage, SubmitButton } from "./forms";

export function ContactForm({ loggedInAs }: { loggedInAs?: string }) {
  const [state, action] = useActionState(contactAction, undefined);
  if (state?.ok) return <p className="text-lg">{state.ok}</p>;
  return (
    <form action={action} className="space-y-4">
      {loggedInAs ? (
        <p className="text-sm text-loupe">Sending as {loggedInAs}.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="contact-name">Name</label>
            <input id="contact-name" name="name" className="input" required maxLength={100} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="contact-email">Email</label>
            <input id="contact-email" name="email" type="email" className="input" required autoComplete="email" />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="contact-body">Message</label>
        <textarea id="contact-body" name="body" className="input min-h-36" required maxLength={5000} />
      </div>
      {/* Trap for bots: hidden from people and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </form>
  );
}
