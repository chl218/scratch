import { getCurrentClient } from "@/lib/auth";
import { ContactForm } from "@/components/ContactForm";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";

export const metadata = { title: "Contact" };

// Contact form (F16). Logged-in clients' notes go into their message conversation.
export default async function ContactPage() {
  const found = await getCurrentClient();
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader current="/contact" />
      <main className="w-full max-w-[1200px] px-4 py-8 sm:px-6">
        <h1 className="display text-[48px] sm:text-[72px]">Say hello</h1>
        <p className="mt-3 max-w-[60ch] text-loupe">
          {found
            ? "This goes straight into your conversation with the studio. You'll find the reply in your messages."
            : "Ask about a shoot, dates, or anything else. The studio replies by email."}
        </p>
        <div className="mt-8 max-w-xl">
          <ContactForm loggedInAs={found?.client.name} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
