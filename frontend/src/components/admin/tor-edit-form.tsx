"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import type { ActionResult } from "@/lib/action-result";
import { withStepUp } from "@/lib/passkeys-client";

/**
 * The TOR edit form, submitted from the browser rather than as a full-page
 * post, so a save the backend answers with a step-up request can stop for a
 * fresh passkey check and then retry (ASVS 7.5.3). The fields stay server-rendered
 * and are passed in as children; while the save runs they are disabled, not
 * reset, so a refusal leaves the admin's edits in place.
 */
export function TorEditForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: React.ReactNode;
}) {
  const tp = useTranslations("Passkeys");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setRefusal(null);
        startTransition(async () => {
          // A successful save redirects from the server action, so only a refusal comes back.
          const result = await withStepUp(
            () => action(formData),
            (failed) =>
              failed.message ??
              (failed.reason === "cancelled" ? tp("cancelled") : failed.reason === "unsupported" ? tp("unsupported") : tp("stepUpFailed")),
          );
          if (result?.error) setRefusal(result.error);
        });
      }}
    >
      <fieldset disabled={isPending} className="min-w-0 space-y-5 disabled:opacity-60">
        {children}
      </fieldset>
      {refusal && (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {refusal}
        </p>
      )}
    </form>
  );
}
