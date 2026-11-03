"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { addCommentAction, getCommentsAction, type CommentTarget } from "@/app/actions/board";
import type { CommentView } from "@/lib/data";
import { formatDateTime } from "@/lib/shared";

export type CommentPermission =
  | { canComment: true }
  | { canComment: false; loginHref: string; hasAccount: boolean };

/** Comments on one photo of a client page (F5). Anyone with access reads; only logged-in people write. */
export function Comments({
  accessKey,
  target,
  permission,
  onCountChange,
}: {
  accessKey: string;
  target: CommentTarget;
  permission: CommentPermission;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<CommentView[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const targetId = "referencePictureId" in target ? target.referencePictureId : target.shootPhotoId;

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
        const res = await addCommentAction(accessKey, target, body);
        if (res.error || !res.comments) {
          setError(res.error ?? "The comment wasn't posted. Try again.");
          return;
        }
        setComments(res.comments);
        onCountChange?.(res.comments.length);
        setBody("");
      } catch {
        setError("The comment wasn't posted. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="mb-2 text-sm font-semibold">Comments</h3>
      <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
        {comments === null && <p className="text-sm text-loupe">Loading…</p>}
        {comments?.length === 0 && <p className="text-sm text-loupe">No comments yet.</p>}
        {comments?.map((c) => (
          <div key={c.id} className="text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{c.authorName}</span>
              {c.authorType === "admin" && <span className="text-xs text-marker">Studio</span>}
              <span className="text-xs text-loupe">{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      {permission.canComment ? (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <label htmlFor={`comment-${targetId}`} className="sr-only">Add a comment</label>
          <textarea
            id={`comment-${targetId}`}
            className="input min-h-16"
            placeholder="Add a comment…"
            value={body}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
          />
          {error && <p className="error-note" role="alert">⚠ {error}</p>}
          <button type="submit" className="btn-primary" disabled={pending || !body.trim()}>
            {pending ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : permission.hasAccount ? (
        <p className="mt-3 text-sm">
          <Link href={permission.loginHref} className="font-semibold underline underline-offset-4">Log in to comment</Link>
        </p>
      ) : (
        <p className="mt-3 text-sm text-loupe">Ask the studio for an invite to comment.</p>
      )}
    </div>
  );
}
