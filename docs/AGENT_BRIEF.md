# AIlFleet — Module Implementation Brief

You are building one module of AIlFleet, a fleet-management platform (Fleetio competitor).
The foundation already exists. **Read these files before writing any code:**

1. `prisma/schema.prisma` — full data model (SQLite; enum-likes are Strings)
2. `src/lib/enums.ts` — enum definitions + labels/colors (use these, don't redefine)
3. `src/lib/format.ts` — money/num/meter/shortDate/dateTime/relative/vehicleTitle helpers
4. `src/lib/db.ts` — Prisma client singleton (`import { db } from "@/lib/db"`)
5. `src/components/ui/` — StatusBadge, PageHeader, StatCard, EmptyState, DataTable (+Td),
   Card (+FieldRow), Button (+ButtonLink), Tabs, FormField (Field/TextInput/TextArea/Select/EnumSelect)
6. `src/components/Sidebar.tsx` — nav routes (do not edit)
7. `docs/FEATURES.md` + your module's research doc in `docs/research/`

## Stack rules
- Next.js 16 App Router, React 19, Tailwind v4, TypeScript strict. **No new npm deps** —
  recharts, lucide-react, date-fns, zod are installed.
- Server components by default. **In Next 16, `params` and `searchParams` are Promises —
  always `await` them**: `const { id } = await params;`
- Mutations via server actions in `src/app/(app)/<module>/actions.ts` with `"use server"` at top.
  Use plain `<form action={myAction}>` + FormData. After mutations: `revalidatePath(...)`;
  after create: `redirect(...)` to the detail page.
- Client components only where interactivity demands it (`"use client"` — charts, dynamic line-item
  editors). Keep them in the module folder or `src/components/`.
- DB is seeded — build against real data. Don't modify `prisma/schema.prisma` or the seed.
- Sequential record numbers (Issue.number, WorkOrder.number, PurchaseOrder.number): compute
  `(max ?? 0) + 1` via `db.x.aggregate({ _max: { number: true } })` inside the action.
- JSON blob columns (specs, customFields, classifications, events, labels, config): parse with
  `JSON.parse` defensively (`try/catch` or `?? "[]"`).

## Page conventions
- List page: `src/app/(app)/<module>/page.tsx` — PageHeader (title + "+ New" ButtonLink),
  StatCards row when meaningful, Tabs for status filters driven by `?status=` searchParam,
  DataTable with linked rows (`<Link className="text-indigo-600 hover:underline">`).
- Detail: `<module>/[id]/page.tsx` — PageHeader with entity name + StatusBadge, two-column grid
  (`grid gap-4 lg:grid-cols-3`): left 2 cols = main cards, right = meta/FieldRow cards. `notFound()`
  if missing.
- Create: `<module>/new/page.tsx` — Card with form grid (`grid gap-4 sm:grid-cols-2`), Field
  wrappers, submit Button. Server component page + server action is enough; no client validation.
- Empty lists → EmptyState with a call-to-action.
- Every page exports `export const dynamic = "force-dynamic";` (SQLite data changes at runtime).

## Look & feel
Slate/indigo palette on white cards (`rounded-xl border border-slate-200 bg-white`), page bg
slate-50. Dense but airy tables. Use lucide icons sparingly (16px, text-slate-400). Charts:
recharts in a `"use client"` component, indigo/emerald/amber/red series, no gridline clutter,
`<ResponsiveContainer>` with fixed height ~260px.

## Quality bar
- `npx tsc --noEmit` must pass for your files. Run it before finishing.
- Prisma relation names come from the schema — check field names there, not from memory.
- Actions must handle missing/blank optional FormData fields (empty string → null).
- Do NOT touch files outside your assigned folders (except reading).
