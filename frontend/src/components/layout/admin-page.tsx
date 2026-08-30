import { ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/layout/app-sidebar";

export function AdminPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <main className="flex min-h-screen flex-col bg-zinc-50/50">
        <header className="shrink-0 border-b border-zinc-200 bg-white px-8 py-7">
          <div className="mx-auto w-full max-w-[1400px]">
            <div className="mb-1 flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
              <span className="flex items-center gap-1 rounded-md bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                <ShieldAlert size={12} />
                Admin
              </span>
            </div>
            <p className="text-sm text-ink-muted">{description}</p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-6">{children}</div>
      </main>
    </AppShell>
  );
}
