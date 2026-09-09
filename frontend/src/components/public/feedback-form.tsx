"use client";

import { Check, MessageSquare } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitFeedback, type FeedbackState } from "@/app/tor/[id]/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export function FeedbackForm({
  torId,
  labels,
}: {
  torId: string;
  labels: {
    heading: string;
    authorPlaceholder: string;
    textPlaceholder: string;
    submit: string;
    moderationNote: string;
    submitted: string;
  };
}) {
  const action = submitFeedback.bind(null, torId);
  const [state, formAction] = useActionState<FeedbackState, FormData>(action, {});

  if (state.submitted) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <Check size={16} />
          {labels.submitted}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-zinc-900">
        <MessageSquare size={18} className="text-zinc-400" />
        {labels.heading}
      </h2>

      <input
        name="author"
        placeholder={labels.authorPlaceholder}
        maxLength={200}
        className="mb-3 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
      />
      <textarea
        name="text"
        rows={4}
        maxLength={5000}
        placeholder={labels.textPlaceholder}
        className="w-full rounded-lg border border-zinc-200 p-3 text-sm outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
      />

      {state.error && <p className="mt-2 text-sm text-danger">{state.error}</p>}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-400">{labels.moderationNote}</p>
        <SubmitButton label={labels.submit} />
      </div>
    </form>
  );
}
