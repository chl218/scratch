"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/auth";
import { formatDateTime } from "@/lib/shared";
import { FormMessage, SubmitButton } from "./forms";

export type ThreadMessage = {
  id: string;
  sender: "admin" | "client";
  body: string;
  createdAt: string;
  unread: boolean;
};

/** A conversation between the photographer and one client (F10). */
export function MessageThread({
  messages,
  me,
  otherName,
  action,
}: {
  messages: ThreadMessage[];
  me: "admin" | "client";
  otherName: string;
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
    <div className="card flex flex-col gap-4">
      <div className="max-h-[60vh] min-h-40 space-y-3 overflow-auto">
        {messages.length === 0 && <p className="text-sm text-stone-500">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.sender === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  mine ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-900"
                } ${m.unread && !mine ? "ring-2 ring-sky-400" : ""}`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-xs ${mine ? "text-stone-300" : "text-stone-500"}`}>
                  {mine ? "You" : otherName} · {formatDateTime(m.createdAt)}
                  {m.unread && !mine && " · new"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form ref={formRef} action={formAction} className="space-y-2">
        <textarea name="body" className="input min-h-20" placeholder="Write a message…" maxLength={5000} required />
        <div className="flex items-center gap-3">
          <SubmitButton pendingText="Sending…">Send</SubmitButton>
          <FormMessage state={state?.error ? state : undefined} />
        </div>
      </form>
    </div>
  );
}
