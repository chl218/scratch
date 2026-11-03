"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/auth";
import { formatDateTime } from "@/lib/shared";
import { FormMessage, SubmitButton } from "./forms";

export type ThreadMessage = {
  id: string;
  sender: "admin" | "client";
  senderName: string;
  body: string;
  createdAt: string;
  unread: boolean;
};

/** The conversation between the studio and one client (F10). Admins appear by name with a Studio label. */
export function MessageThread({
  messages,
  me,
  action,
}: {
  messages: ThreadMessage[];
  me: "admin" | "client";
  action: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="panel flex flex-col gap-4">
      <div className="max-h-[60vh] min-h-40 space-y-3 overflow-auto">
        {messages.length === 0 && <p className="text-sm text-loupe">No messages yet. Say hello.</p>}
        {messages.map((m) => {
          const mine = m.sender === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-[6px] px-4 py-2 text-sm ${
                  mine ? "bg-graphite text-on-graphite" : "border border-sleeve bg-table"
                } ${m.unread && !mine ? "border-l-2 border-l-marker" : ""}`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-xs opacity-70">
                  {mine ? "You" : m.senderName}
                  {m.sender === "admin" && !mine && " (Studio)"}, {formatDateTime(m.createdAt)}
                  {m.unread && !mine && ". New"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form ref={formRef} action={formAction} className="space-y-2">
        <label htmlFor="message-body" className="sr-only">Message</label>
        <textarea id="message-body" name="body" className="input min-h-20" placeholder="Write a message…" maxLength={5000} required />
        <div className="flex items-center gap-3">
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
          <FormMessage state={state?.error ? state : undefined} />
        </div>
      </form>
    </div>
  );
}
