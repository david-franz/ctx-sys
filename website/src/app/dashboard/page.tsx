export default function DashboardPage() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Overview of your ctx-sys usage</p>
          </div>
          <div className="flex gap-4">
            <a
              href="/dashboard/settings"
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Settings
            </a>
            <a
              href="/dashboard/team"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Invite Team
            </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Queries This Week"
            value="1,234"
            change="+12%"
            positive={true}
          />
          <StatCard
            title="Tokens Saved"
            value="2.4M"
            change="+8%"
            positive={true}
          />
          <StatCard
            title="Cost Saved"
            value="$72.00"
            change="+15%"
            positive={true}
          />
          <StatCard
            title="Avg Relevance"
            value="94%"
            change="+2%"
            positive={true}
          />
        </div>

        {/* Charts Section */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Token Savings Over Time</h3>
            <div className="mt-4 h-64 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500">Chart placeholder - integrate with analytics</p>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900">Query Types</h3>
            <div className="mt-4 h-64 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500">Chart placeholder - integrate with analytics</p>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <a href="/dashboard/projects/new" className="text-indigo-600 hover:text-indigo-500">
              + Add Project
            </a>
          </div>
          <div className="mt-4 rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Queries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saved</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <ProjectRow
                  name="my-app"
                  path="/Users/dev/projects/my-app"
                  queries={456}
                  saved="$24.50"
                  status="Active"
                />
                <ProjectRow
                  name="api-server"
                  path="/Users/dev/projects/api-server"
                  queries={312}
                  saved="$18.20"
                  status="Active"
                />
                <ProjectRow
                  name="mobile-app"
                  path="/Users/dev/projects/mobile-app"
                  queries={89}
                  saved="$5.30"
                  status="Stale"
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <div className="mt-4 space-y-4">
            <ActivityItem
              time="2 min ago"
              action="Query: &quot;How does authentication work?&quot;"
              project="my-app"
              tokens="3,200 tokens saved"
            />
            <ActivityItem
              time="15 min ago"
              action="Indexed 12 files after commit abc123"
              project="api-server"
              tokens=""
            />
            <ActivityItem
              time="1 hour ago"
              action="Decision recorded: &quot;Use Redis for session caching&quot;"
              project="my-app"
              tokens=""
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  change,
  positive
}: {
  title: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className={`mt-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {change} from last week
      </p>
    </div>
  );
}

function ProjectRow({
  name,
  path,
  queries,
  saved,
  status
}: {
  name: string;
  path: string;
  queries: number;
  saved: string;
  status: string;
}) {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900">{name}</div>
        <div className="text-sm text-gray-500">{path}</div>
      </td>
      <td className="px-6 py-4 text-gray-600">{queries.toLocaleString()}</td>
      <td className="px-6 py-4 text-gray-600">{saved}</td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            status === 'Active'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {status}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <a href={`/dashboard/projects/${name}`} className="text-indigo-600 hover:text-indigo-500">
          View
        </a>
      </td>
    </tr>
  );
}

function ActivityItem({
  time,
  action,
  project,
  tokens
}: {
  time: string;
  action: string;
  project: string;
  tokens: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <div>
        <p className="text-gray-900">{action}</p>
        <p className="text-sm text-gray-500">
          {project} &middot; {time}
        </p>
      </div>
      {tokens && <p className="text-sm text-green-600">{tokens}</p>}
    </div>
  );
}
