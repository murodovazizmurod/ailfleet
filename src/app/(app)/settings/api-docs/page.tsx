import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, Td } from "@/components/ui/DataTable";
import { ButtonLink } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

const ENDPOINTS: { path: string; methods: string; description: string }[] = [
  { path: "/api/v1", methods: "GET", description: "API metadata & resource index" },
  { path: "/api/v1/vehicles", methods: "GET, POST", description: "List / create vehicles" },
  { path: "/api/v1/vehicles/:id", methods: "GET, PATCH", description: "Fetch / update a vehicle" },
  { path: "/api/v1/issues", methods: "GET, POST", description: "List / create issues (POST fires issue.created webhook)" },
  { path: "/api/v1/issues/:id", methods: "GET, PATCH", description: "Fetch / update an issue" },
  { path: "/api/v1/work-orders", methods: "GET, POST", description: "List / create work orders" },
  { path: "/api/v1/work-orders/:id", methods: "GET", description: "Fetch a work order with lines" },
  { path: "/api/v1/fuel-entries", methods: "GET, POST", description: "List / create fuel entries" },
  { path: "/api/v1/fuel-entries/:id", methods: "GET", description: "Fetch a fuel entry" },
  { path: "/api/v1/parts", methods: "GET, POST", description: "List / create parts" },
  { path: "/api/v1/parts/:id", methods: "GET", description: "Fetch a part with stock levels" },
  { path: "/api/v1/service-entries", methods: "GET, POST", description: "List / create service entries" },
  { path: "/api/v1/service-entries/:id", methods: "GET", description: "Fetch a service entry" },
  { path: "/api/v1/contacts", methods: "GET, POST", description: "List / create contacts" },
  { path: "/api/v1/contacts/:id", methods: "GET", description: "Fetch a contact" },
  { path: "/api/v1/vendors", methods: "GET, POST", description: "List / create vendors" },
  { path: "/api/v1/vendors/:id", methods: "GET", description: "Fetch a vendor" },
  { path: "/api/v1/meter-entries", methods: "GET, POST", description: "List / create meter entries" },
  { path: "/api/v1/meter-entries/:id", methods: "GET", description: "Fetch a meter entry" },
];

const CURL_EXAMPLE = `curl -s "https://your-host/api/v1/vehicles?per_page=25" \\
  -H "Authorization: Token aif_your_token_here"

# create an issue
curl -s -X POST "https://your-host/api/v1/issues" \\
  -H "Authorization: Token aif_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{"vehicleId": "<vehicle_id>", "summary": "Brake pads worn", "priority": "high"}'`;

export default function ApiDocsPage() {
  return (
    <div>
      <PageHeader
        title="API Reference"
        subtitle="AIlFleet REST API v1 — authentication, pagination and endpoints."
        actions={<ButtonLink href="/settings" variant="secondary">Back to settings</ButtonLink>}
      />

      <div className="space-y-4">
        <Card title="Authentication">
          <p className="text-sm text-slate-600">
            Every request must include an API token created on the{" "}
            <span className="font-medium text-slate-800">Settings</span> page, passed in the{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">Authorization</code>{" "}
            header:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-[#06090d] p-3 font-mono text-xs text-[#cdd6e2]">
            Authorization: Token aif_your_token_here
          </pre>
          <p className="mt-3 text-sm text-slate-600">
            Tokens are shown once at creation and stored hashed. Requests with a missing, invalid or
            revoked token receive <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">401</code>{" "}
            with a JSON error body.
          </p>
        </Card>

        <Card title="Pagination">
          <p className="text-sm text-slate-600">
            List endpoints use cursor pagination. Pass{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">?per_page=</code>{" "}
            (default 50, max 100) to control page size. Responses have the shape{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
              {'{ "records": [...], "next_cursor": "..." }'}
            </code>
            . When <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">next_cursor</code>{" "}
            is non-null, request the next page with{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
              ?start_cursor=&lt;next_cursor&gt;
            </code>
            . A null cursor means you have reached the end. Records are ordered by id ascending.
          </p>
        </Card>

        <Card title="Errors & validation">
          <p className="text-sm text-slate-600">
            Create/update bodies are validated; invalid payloads return{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">422</code> with an{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">issues</code> array
            describing each problem. Unknown ids return{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">404</code>.
          </p>
        </Card>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Endpoints</h2>
          <DataTable headers={["Endpoint", "Methods", "Description"]}>
            {ENDPOINTS.map((e) => (
              <tr key={e.path} className="hover:bg-slate-50">
                <Td className="font-mono text-xs">{e.path}</Td>
                <Td className="whitespace-nowrap font-mono text-xs">{e.methods}</Td>
                <Td>{e.description}</Td>
              </tr>
            ))}
          </DataTable>
        </div>

        <Card title="Example">
          <pre className="overflow-x-auto rounded-lg bg-[#06090d] p-3 font-mono text-xs leading-relaxed text-[#cdd6e2]">
            {CURL_EXAMPLE}
          </pre>
        </Card>
      </div>
    </div>
  );
}
