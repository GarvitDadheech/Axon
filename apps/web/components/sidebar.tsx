"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PlusCircle, Store, Cable } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/publish", label: "Publish API", icon: PlusCircle },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/mcp", label: "MCP Integration", icon: Cable },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col border-r z-30"
      style={{ background: "hsl(var(--sidebar))", borderColor: "hsl(var(--sidebar-border))" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        <Image src="/logo.png" width={28} height={28} alt="Axon" className="rounded-md" />
        <span className="font-bold text-base tracking-tight text-foreground">Axon</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t text-xs text-muted-foreground" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
        Arbitrum Sepolia
      </div>
    </aside>
  );
}
