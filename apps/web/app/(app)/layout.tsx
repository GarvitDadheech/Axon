import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { AuthGate } from "@/components/auth-gate";
import { AppShellBackground } from "@/components/dashboard/app-shell-bg";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <div className="relative min-h-screen bg-background">
        <AppShellBackground />
        <Sidebar />
        <Topbar />
        <main className="ml-60 pt-16 min-h-screen">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
