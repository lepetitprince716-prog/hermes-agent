import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'

import { cn, formatRelativeTime } from '@/lib/utils'
import { createProject, deleteProject, fetchProjects, setActiveProject, updateProject } from '@/lib/projects'
import { $gatewayState } from '@/store/app'
import { $activeProjectId, $projects, $projectsError, $projectsLoading } from '@/store/projects'
import type { ProjectInfo } from '@/types/hermes'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const projects = useStore($projects)
  const loading = useStore($projectsLoading)
  const err = useStore($projectsError)
  const activeId = useStore($activeProjectId)
  const gatewayState = useStore($gatewayState)
  const [showNew, setShowNew] = useState(false)

  // gateway 连接就绪后才拉取（auto-connect 是异步的，首帧可能还在 connecting）
  useEffect(() => {
    if (gatewayState === 'open') void fetchProjects()
  }, [gatewayState])

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <button onClick={() => void fetchProjects()} disabled={loading} className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {loading ? '刷新中…' : '刷新'}
        </button>
        <button onClick={() => setShowNew(true)} className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
          ＋ 新建
        </button>
        {err ? <span className="truncate text-xs text-red-500">{err}</span> : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {loading ? '加载中…' : '暂无项目，去新建一个吧'}
          </div>
        ) : (
          <ul className="divide-y">
            {projects.map(p => (
              <ProjectRow key={p.id} project={p} active={p.id === activeId} onNavigate={navigate} />
            ))}
          </ul>
        )}
      </div>

      {showNew ? <NewProjectSheet onClose={() => setShowNew(false)} /> : null}
    </div>
  )
}

function ProjectRow({ project, active, onNavigate }: { project: ProjectInfo; active: boolean; onNavigate: (path: string) => void }) {
  const [showActions, setShowActions] = useState(false)
  const folders = project.folders ?? []
  const primary = folders.find(f => f.is_primary) ?? folders[0]

  return (
    <li>
      <div className="flex w-full items-center gap-3 px-3 py-3">
        <button
          onClick={() => onNavigate(`/projects/${project.id}`)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
            style={{
              background: project.color ? `${project.color}20` : 'var(--dt-muted)',
              color: project.color ?? 'var(--dt-foreground)',
            }}
          >
            {project.icon ?? project.name?.[0]?.toUpperCase() ?? '·'}
          </span>
          <span className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{project.name}</span>
              {active ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">当前</span> : null}
              {project.archived ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">已归档</span> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {project.description ?? primary?.path ?? project.slug}
              {primary ? ` · ${folders.length} 个文件夹` : ''}
            </div>
          </span>
        </button>
        <button
          onClick={() => setShowActions(true)}
          className="shrink-0 rounded-full border bg-muted px-2.5 py-1.5 text-xs"
          aria-label="操作"
        >
          ⋯
        </button>
      </div>
      {showActions ? <ProjectActionsSheet project={project} active={active} onClose={() => setShowActions(false)} /> : null}
    </li>
  )
}

function ProjectActionsSheet({ project, active, onClose }: { project: ProjectInfo; active: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const doAction = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setErr(null)
    try { await fn(); onClose() } catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="safe-bottom relative flex max-h-[70dvh] flex-col rounded-t-2xl border-t bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{project.name}</h2>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">关闭</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {err ? <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div> : null}
          <div className="space-y-2">
            <ActionRow
              label={active ? '取消当前项目' : '设为当前项目'}
              onClick={() => doAction(() => setActiveProject(active ? null : project.id))}
              disabled={busy}
            />
            <ActionRow
              label={project.archived ? '取消归档' : '归档项目'}
              onClick={() => doAction(() => updateProject(project.id, { archived: !project.archived }))}
              disabled={busy}
            />
            <ActionRow
              label="删除项目"
              danger
              onClick={() => doAction(() => deleteProject(project.id))}
              disabled={busy}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionRow({ label, danger, onClick, disabled }: { label: string; danger?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
        danger ? 'border-red-300 text-red-600 active:bg-red-500/10' : 'bg-background active:bg-muted/60',
        disabled && 'opacity-40',
      )}
    >
      {label}
    </button>
  )
}

function NewProjectSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [path, setPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0

  const submit = async () => {
    if (!canSubmit || busy) return
    setBusy(true)
    setErr(null)
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        folders: path.trim() ? [{ path: path.trim(), is_primary: true }] : [],
        primary_path: path.trim() || undefined,
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="safe-bottom relative flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">新建项目</h2>
          <button onClick={onClose} className="rounded-full bg-muted px-3 py-1 text-xs font-medium">关闭</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {err ? <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div> : null}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">名称 *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="我的项目"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">描述</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="可选"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">主文件夹路径</label>
              <input
                value={path}
                onChange={e => setPath(e.target.value)}
                placeholder="/Users/you/project"
                className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">留空则仅创建项目记录，不关联文件夹</p>
            </div>
            <button
              onClick={() => void submit()}
              disabled={!canSubmit || busy}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? '创建中…' : '创建项目'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
