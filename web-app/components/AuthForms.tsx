"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  loginAction,
  requestResetAction,
  setupAdminAction,
  type FormState,
} from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "./forms";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="input" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Logging in…">Log in</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot" className="text-loupe underline underline-offset-4 hover:text-graphite">Forgot your password?</Link>
      </p>
    </form>
  );
}

export function SetupForm() {
  const [state, action] = useActionState(setupAdminAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input id="name" name="name" autoComplete="name" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password (8+ characters)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} className="input" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Creating…">Create the Super Admin account</SubmitButton>
    </form>
  );
}

export function PasswordForm({
  action: boundAction,
  submitLabel,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, action] = useActionState(boundAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">New password (8+ characters)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} className="input" required />
      </div>
      <div>
        <label className="label" htmlFor="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} className="input" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{submitLabel}</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState(requestResetAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" className="input" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send reset link</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="text-loupe underline underline-offset-4 hover:text-graphite">Back to log in</Link>
      </p>
    </form>
  );
}
