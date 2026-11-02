"use client";

import { useEffect, useState, useTransition } from "react";
import { addCommentAction, getCommentsAction, type CommentTarget } from "@/app/actions/board";
import type { CommentView } from "@/lib/data";
import { formatDateTime } from "@/lib/shared";

/** Comments on one photo of a client page (F5). */
export function Comments({
  accessKey,
  target,
  onCountChange,
}: {
  accessKey: string;
  target: CommentTarget;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const targetId = "inspirationId" in target ? target.inspirationId : target.shootPhotoId;

  useEffect(() => {
    let cancelled = false;
    getCommentsAction(accessKey, target)
      .then((c) => !cancelled && setComments(c))
      .catch(() => !cancelled && setComments([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the photo changes
  }, [accessKey, targetId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    startTransition(async () => {
      try {
        const updated = await addCommentAction(accessKey, target, body);
        setComments(updated);
        onCountChange?.(updated.length);
        setBody("");
      } catch {
        setError("Couldn't post the comment. Please try again.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="mb-2 text-sm font-semibold">Comments</h3>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {comments === null && <p className="text-sm text-stone-500">Loading…</p>}
        {comments?.length === 0 && <p className="text-sm text-stone-500">No comments yet.</p>}
        {comments?.map((c) => (
          <div key={c.id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-medium">{c.authorType === "admin" ? "Photographer" : c.authorName}</span>
              <span className="text-xs text-stone-500">{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-stone-700">{c.body}</p>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 space-y-2">
        <textarea
          className="input min-h-16"
          placeholder="Add a comment…"
          value={body}
          maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary" disabled={pending || !body.trim()}>
          {pending ? "Posting…" : "Post comment"}
        </button>
      </form>
    </div>
  );
}
