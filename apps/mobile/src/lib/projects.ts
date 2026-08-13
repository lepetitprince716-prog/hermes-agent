import { gatewayRequest } from '@/lib/gateway'
import { dashboardApi } from '@/lib/gateway-url'
import { $projects, $projectsLoading, $projectsError, setProjects } from '@/store/projects'
import type { ProjectInfo, ProjectsPayload } from '@/types/hermes'

// ── 项目 CRUD ─────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<void> {
  $projectsLoading.set(true)
  $projectsError.set(null)
  try {
    const res = await gatewayRequest<ProjectsPayload>('projects.list', {})
    setProjects(res)
  } catch (e) {
    $projectsError.set(e instanceof Error ? e.message : String(e))
  } finally {
    $projectsLoading.set(false)
  }
}

export async function createProject(input: {
  name: string
  description?: string
  folders?: Array<{ path: string; label?: string; is_primary?: boolean }>
  primary_path?: string
  slug?: string
  icon?: string
  color?: string
}): Promise<ProjectInfo | null> {
  const res = await gatewayRequest<{ project: ProjectInfo | null }>('projects.create', {
    name: input.name,
    description: input.description ?? null,
    folders: input.folders ?? [],
    primary_path: input.primary_path ?? null,
    slug: input.slug ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    use: false,
  })
  await fetchProjects() // 刷新列表
  return res.project ?? null
}

export async function updateProject(id: string, patch: Partial<Pick<ProjectInfo, 'name' | 'description' | 'icon' | 'color' | 'archived'>>): Promise<void> {
  await gatewayRequest('projects.update', { id, ...patch })
  await fetchProjects()
}

export async function deleteProject(id: string): Promise<void> {
  await gatewayRequest('projects.delete', { id })
  await fetchProjects()
}

export async function setActiveProject(id: null | string): Promise<void> {
  await gatewayRequest('projects.set_active', { id })
  await fetchProjects()
}

// ── 文件系统 ──────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface ReadDirResult {
  entries: FileEntry[]
  error?: string
}

export interface ReadFileResult {
  path: string
  text: string
  binary?: boolean
  byteSize?: number
  language?: string
  mimeType?: string
  truncated?: boolean
}

/** 列目录 —— 走 dashboard REST /api/fs/list（gateway RPC 无 fs 方法；desktop 远程模式同款路径） */
export async function readDir(path: string): Promise<ReadDirResult> {
  return dashboardApi<ReadDirResult>(`/api/fs/list?path=${encodeURIComponent(path)}`)
}

/** 读文本文件 */
export async function readFileText(path: string): Promise<ReadFileResult> {
  return dashboardApi<ReadFileResult>(`/api/fs/read-text?path=${encodeURIComponent(path)}`)
}

/** 读二进制文件（data URL） */
export async function readFileDataUrl(path: string): Promise<string> {
  const res = await dashboardApi<string | { dataUrl?: string }>(`/api/fs/read-data-url?path=${encodeURIComponent(path)}`)
  return typeof res === 'string' ? res : (res.dataUrl ?? '')
}

/** 写文本文件 */
export async function writeFileText(path: string, content: string): Promise<{ path: string }> {
  return dashboardApi<{ path: string }>('/api/fs/write-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
}
