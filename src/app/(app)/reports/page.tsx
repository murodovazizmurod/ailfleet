import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  DollarSign,
  Fuel,
  Gauge,
  Package,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type ReportCard = {
  href?: string;
  title: string;
  description: string;
  icon: typeof BarChart3;
};

const CATEGORIES: { category: string; reports: ReportCard[] }[] = [
  {
    category: "Vehicles",
    reports: [
      {
        href: "/reports/operating-costs",
        title: "Operating Costs Summary",
        description: "Fuel, service and other expenses per vehicle with cost per meter.",
        icon: DollarSign,
      },
      {
        href: "/reports/vehicle-status",
        title: "Vehicle Status Summary",
        description: "Fleet counts by status with the full vehicle list.",
        icon: Truck,
      },
    ],
  },
  {
    category: "Service",
    reports: [
      {
        href: "/reports/service-history",
        title: "Service History",
        description: "All service entries with tasks, vendors and totals.",
        icon: Wrench,
      },
      {
        href: "/reports/work-order-status",
        title: "Work Order Status Summary",
        description: "Work order counts by status and the underlying list.",
        icon: Gauge,
      },
    ],
  },
  {
    category: "Issues",
    reports: [
      {
        href: "/reports/issues-list",
        title: "Issues List",
        description: "Reported issues filterable by status, priority and source.",
        icon: AlertTriangle,
      },
    ],
  },
  {
    category: "Fuel",
    reports: [
      {
        href: "/reports/fuel-summary",
        title: "Fuel Summary",
        description: "Per-vehicle fill-ups, volume, spend, economy and price per unit.",
        icon: Fuel,
      },
    ],
  },
  {
    category: "Parts",
    reports: [
      {
        href: "/reports/parts-activity",
        title: "Parts Activity",
        description: "Inventory adjustment log with reasons and quantities.",
        icon: Package,
      },
    ],
  },
  {
    category: "Contacts",
    reports: [
      {
        title: "Contact Renewal Reminders",
        description: "License, certification and training renewals. Coming soon.",
        icon: Users,
      },
    ],
  },
];

function ReportCardView({ report }: { report: ReportCard }) {
  const Icon = report.icon;
  const body = (
    <div
      className={`flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 ${
        report.href ? "transition-shadow hover:shadow-sm" : "opacity-60"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <Icon className="h-4 w-4 text-indigo-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{report.title}</p>
        <p className="mt-1 text-sm text-slate-500">{report.description}</p>
      </div>
    </div>
  );
  return report.href ? (
    <Link href={report.href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Filterable summaries across vehicles, service, issues, fuel and parts — every report exports to CSV."
      />
      <div className="space-y-8">
        {CATEGORIES.map(({ category, reports }) => (
          <section key={category}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((r) => (
                <ReportCardView key={r.title} report={r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
