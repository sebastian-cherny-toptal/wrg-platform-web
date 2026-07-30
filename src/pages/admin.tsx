import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { api } from '../api/client'
import { Badge, Button, Card, PageHeader, StatePanel } from '../components/ui'

function tone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (['active', 'succeeded'].includes(status)) return 'success'
  if (['draft', 'invited', 'queued', 'running'].includes(status)) return 'warning'
  if (['failed', 'suspended'].includes(status)) return 'danger'
  return 'neutral'
}

function DataTable({
  headers,
  rows,
  loading,
  error,
  emptyMessage,
}: {
  headers: string[]
  rows: ReactNode[][] | undefined
  loading: boolean
  error: Error | null
  emptyMessage: string
}) {
  if (loading) return <StatePanel kind="loading" title="Loading records" message="Retrieving current administration data." />
  if (error) return <StatePanel kind="error" title="Records unavailable" message={error.message} />
  if (!rows?.length) return <StatePanel kind="empty" title="No records" message={emptyMessage} />
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-2xl text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
          <tr>{headers.map((header) => <th className="px-5 py-3" key={header}>{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, index) => <tr className="hover:bg-zinc-50" key={index}>{row.map((cell, cellIndex) => <td className="px-5 py-4" key={cellIndex}>{cell}</td>)}</tr>)}
        </tbody>
      </table>
    </Card>
  )
}

export function ProjectsPage() {
  const query = useQuery({ queryKey: ['admin-projects'], queryFn: api.admin.projects })
  return (
    <>
      <PageHeader title="Projects & Programs" description="Manage survey projects and their associated programs." actions={<Button>New project</Button>} />
      <div className="p-5 lg:p-8"><DataTable headers={['Project', 'Status', 'Programs', 'Action']} loading={query.isPending} error={query.error} emptyMessage="No projects have been created." rows={query.data?.map((item) => [<strong>{item.name}</strong>, <Badge tone={tone(item.status)}>{item.status}</Badge>, item.programs, <Button variant="ghost">View</Button>])} /></div>
    </>
  )
}

export function UsersPage() {
  const query = useQuery({ queryKey: ['admin-users'], queryFn: api.admin.users })
  return (
    <>
      <PageHeader title="Portal users" description="User identities, roles, and account state." actions={<Button>Invite user</Button>} />
      <div className="p-5 lg:p-8"><DataTable headers={['User', 'Email', 'Role', 'Status']} loading={query.isPending} error={query.error} emptyMessage="No users match this workspace." rows={query.data?.map((item) => [<strong>{item.displayName}</strong>, item.email, item.role, <Badge tone={tone(item.status)}>{item.status}</Badge>])} /></div>
    </>
  )
}

export function RolesPage() {
  const query = useQuery({ queryKey: ['admin-roles'], queryFn: api.admin.roles })
  return (
    <>
      <PageHeader title="Roles & permissions" description="Access is defined using the preserved WRG permission shortcodes." actions={<Button>New role</Button>} />
      <div className="p-5 lg:p-8"><DataTable headers={['Role', 'Users', 'Permissions']} loading={query.isPending} error={query.error} emptyMessage="No roles are configured." rows={query.data?.map((item) => [<strong>{item.name}</strong>, item.users, <div className="flex flex-wrap gap-1">{item.permissions.map((permission) => <Badge key={permission}>{permission}</Badge>)}</div>])} /></div>
    </>
  )
}

export function SyncJobsPage() {
  const query = useQuery({ queryKey: ['admin-sync-jobs'], queryFn: api.admin.syncJobs, refetchInterval: 15_000 })
  return (
    <>
      <PageHeader title="Sync jobs" description="Auditable Checkmarket and Zoho synchronization activity." actions={<Button>Request sync</Button>} />
      <div className="p-5 lg:p-8"><DataTable headers={['Source', 'Status', 'Requested', 'Job ID']} loading={query.isPending} error={query.error} emptyMessage="No synchronization jobs have been requested." rows={query.data?.map((item) => [<strong className="capitalize">{item.source}</strong>, <Badge tone={tone(item.status)}>{item.status}</Badge>, new Date(item.requestedAt).toLocaleString(), <code className="text-xs">{item.id}</code>])} /></div>
    </>
  )
}
