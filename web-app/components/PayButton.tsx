"use client";

import { useState, useTransition } from "react";
import { startPaymentAction } from "@/app/actions/account";

export function PayButton({ paymentId, label }: { paymentId: string; label: string }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function pay() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await startPaymentAction(paymentId);
        if (result.kind === "redirect") window.location.href = result.url;
        else setMessage(result.message);
      } catch {
        setMessage("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn-primary" onClick={pay} disabled={pending}>
        {pending ? "Starting…" : label}
      </button>
      {message && <p className="max-w-sm text-sm text-stone-600">{message}</p>}
    </div>
  );
}
