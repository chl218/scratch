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
        <h1 className="text-2xl font-semibold tracking-tight">Outbox</h1>
        <p className="text-sm text-stone-600">
          Emails aren&apos;t really sent while running locally. They&apos;re saved here (and in the <code>.mail/</code> folder)
          so you can check them and open the links. Set <code>SMTP_URL</code> to send real emails.
        </p>
      </div>
      {mails.length === 0 ? (
        <p className="text-sm text-stone-500">No emails yet.</p>
      ) : (
        <ul className="space-y-3">
          {mails.map((m) => (
            <li key={m.file} className="card space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-medium">{m.subject}</p>
                <p className="text-xs text-stone-500">{formatDateTime(m.sentAt)}</p>
              </div>
              <p className="text-xs text-stone-500">To: {m.to}</p>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-stone-700">
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
      <a key={i} href={part} className="text-sky-700 underline" target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
