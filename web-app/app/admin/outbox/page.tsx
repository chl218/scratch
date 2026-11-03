import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { readOutbox, usingLocalOutbox } from "@/lib/mail";
import { formatDateTime } from "@/lib/shared";

export const metadata = { title: "Outbox" };

// Local development only: emails are saved to .mail/ instead of being sent.
export default async function OutboxPage() {
  await requireAdmin();
  if (!usingLocalOutbox()) notFound();
  const mails = await readOutbox();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-[36px]">Outbox</h1>
        <p className="text-sm text-loupe">
          Emails aren&apos;t really sent while running locally. They&apos;re saved here (and in the <code>.mail/</code> folder)
          so you can check them and open the links. Set <code>SMTP_URL</code> to send real emails.
        </p>
      </div>
      {mails.length === 0 ? (
        <p className="text-sm text-loupe">No emails yet.</p>
      ) : (
        <ul className="space-y-3">
          {mails.map((m) => (
            <li key={m.file} className="panel space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{m.subject}</p>
                <p className="text-xs text-loupe">{formatDateTime(m.sentAt)}</p>
              </div>
              <p className="text-xs text-loupe">To: {m.to}</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-graphite">
                {linkify(m.text)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} className="text-graphite underline" target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
