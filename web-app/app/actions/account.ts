"use server";

// Actions for a logged-in client: messaging (F10) and payments (F11).

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { appUrl } from "@/lib/tokens";
import { getProvider, type CheckoutResult } from "@/lib/payments";
import type { FormState } from "./auth";

async function currentClient() {
  const user = await getCurrentUser();
  if (!user || user.role !== "client") throw new Error("Not logged in");
  const db = await getDb();
  const [client] = await db.select().from(schema.clients).where(eq(schema.clients.userId, user.id));
  if (!client) throw new Error("Not logged in");
  return client;
}

export async function clientSendMessageAction(_prev: FormState, form: FormData): Promise<FormState> {
  const client = await currentClient();
  const body = z.string().trim().min(1).max(5000).safeParse(form.get("body"));
  if (!body.success) return { error: "Write a message first." };

  const db = await getDb();
  await db.insert(schema.messages).values({ clientId: client.id, sender: "client", body: body.data });
  await notifyAdmins(
    "message",
    `New message from ${client.name}`,
    `${client.name} wrote:\n\n"${body.data.slice(0, 500)}"\n\nReply here: ${appUrl(`/admin/inbox/${client.id}`)}`,
  );
  refresh();
  return { ok: "Sent." };
}

export async function startPaymentAction(paymentId: string): Promise<CheckoutResult> {
  const client = await currentClient();
  z.string().uuid().parse(paymentId);
  const db = await getDb();
  const [payment] = await db
    .select()
    .from(schema.paymentRequests)
    .where(and(eq(schema.paymentRequests.id, paymentId), eq(schema.paymentRequests.clientId, client.id)));
  if (!payment || payment.status !== "pending") {
    return { kind: "message", message: "This payment request isn't open any more." };
  }
  return getProvider().startCheckout({
    id: payment.id,
    amountCents: payment.amountCents,
    currency: payment.currency,
    description: payment.description,
    clientEmail: client.email,
  });
}
