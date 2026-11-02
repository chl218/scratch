import "server-only";

// Payment provider boundary (SPEC F11). Moodboard never sees card details;
// a provider does. Locally there is no provider: the client sees a note and
// the admin marks requests as paid by hand. To add Stripe (or another
// provider) later, implement PaymentProvider and return it from getProvider().

export type CheckoutRequest = {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  clientEmail: string;
};

export type CheckoutResult =
  | { kind: "redirect"; url: string }
  | { kind: "message"; message: string };

export interface PaymentProvider {
  name: string;
  startCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

const manualProvider: PaymentProvider = {
  name: "manual",
  async startCheckout() {
    return {
      kind: "message",
      message:
        "Online payment isn't set up yet. Please pay your photographer directly; they'll mark this request as paid.",
    };
  },
};

export function getProvider(): PaymentProvider {
  return manualProvider;
}

export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountCents / 100);
}
