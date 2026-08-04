"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  AlertTriangle,
  ClipboardCheck,
  Wrench,
  CalendarClock,
  Fuel,
  Package,
  ShoppingCart,
  Store,
  Users,
  BadgeCheck,
  BarChart3,
  Plug,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vehicles", label: "Vehicles", icon: Truck },
  { href: "/issues", label: "Issues", icon: AlertTriangle },
  { href: "/inspections", label: "Inspections", icon: ClipboardCheck },
  { href: "/work-orders", label: "Work Orders", icon: Wrench },
  { href: "/reminders", label: "Reminders", icon: CalendarClock },
  { href: "/fuel", label: "Fuel & Energy", icon: Fuel },
  { href: "/parts", label: "Parts & Inventory", icon: Package },
  { href: "/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/renewals", label: "Renewals", icon: BadgeCheck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-[#18202c] bg-[#06090d]">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#a3e635] text-sm font-bold text-[#0b0f14]">
          A
        </div>
        <span className="text-base font-semibold tracking-tight text-[#f2f5f9]">
          AIlFleet
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-[#18202c] text-[#f2f5f9]"
                  : "text-[#9fb0c3] hover:bg-[#111827] hover:text-[#f2f5f9]"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? "text-[#bef264]" : "text-[#5d6b80] group-hover:text-[#9fb0c3]"
                }`}
              />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#18202c] px-4 py-3 text-xs text-[#5d6b80]">
        AIlFleet · Fleet Ops Platform
      </div>
    </aside>
  );
}
