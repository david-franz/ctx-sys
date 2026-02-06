import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="py-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400">Overview of your ctx-sys usage</p>
          </div>
          <div className="flex gap-4">
            <Link
              href="/dashboard/settings"
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Settings
            </Link>
            <Link
              href="/dashboard/team"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-600 shadow-lg shadow-cyan-500/25"
            >
              Invite Team
            </Link>
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
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white">Token Savings Over Time</h3>
            <div className="mt-4 h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl">
              <div className="text-center">
                <p className="text-slate-400 dark:text-slate-500">Chart visualization</p>
                <p className="text-sm text-slate-300 dark:text-slate-600">Connect analytics to view data</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white">Query Types</h3>
            <div className="mt-4 h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl">
              <div className="text-center">
                <p className="text-slate-400 dark:text-slate-500">Chart visualization</p>
                <p className="text-sm text-slate-300 dark:text-slate-600">Connect analytics to view data</p>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Projects</h2>
            <Link href="/dashboard/projects/new" className="text-cyan-500 hover:text-cyan-600 font-medium">
              + Add Project
            </Link>
          </div>
          <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Queries</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Saved</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
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
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          <div className="mt-4 space-y-4">
            <ActivityItem
              time="2 min ago"
              action='Query: "How does authentication work?"'
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
              action='Decision recorded: "Use Redis for session caching"'
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
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className={`mt-1 text-sm ${positive ? 'text-green-500' : 'text-red-500'}`}>
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
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900 dark:text-white">{name}</div>
        <div className="text-sm text-slate-500 dark:text-slate-400">{path}</div>
      </td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{queries.toLocaleString()}</td>
      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{saved}</td>
      <td className="px-6 py-4">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
            status === 'Active'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          }`}
        >
          {status}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <Link href={`/dashboard/projects/${name}`} className="text-cyan-500 hover:text-cyan-600 font-medium">
          View
        </Link>
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
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div>
        <p className="text-slate-900 dark:text-white">{action}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {project} &middot; {time}
        </p>
      </div>
      {tokens && <p className="text-sm text-green-500 font-medium">{tokens}</p>}
    </div>
  );
}
