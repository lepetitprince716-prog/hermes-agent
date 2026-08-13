import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { cn } from '@/lib/utils'
import { readDir, type FileEntry } from '@/lib/projects'
import { $gatewayState } from '@/store/app'
import { $projects } from '@/store/projects'
import { FilePreviewSheet } from '@/components/FilePreviewSheet'

export default function FilesPage() {
  const { projectId } = useParams()
  const projects = useStore($projects)
  const gatewayState = useStore($gatewayState)
  const project = projects.find(p => p.id === projectId)
  const [path, setPath] = useState(() => project?.folders?.find(f => f.is_primary)?.path ?? project?.folders?.[0]?.path ?? '/')
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [previewPath, setPreviewPath] = useState<string | null>(null)

  const load = useCallback(async (p: string) => {
    setLoading(true)
    setErr(null)
    try {
      const res = await readDir(p)
      if (res.error) {
        setErr(res.error)
        setEntries([])
      } else {
        setEntries(res.entries ?? [])
        setPath(p)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  // gateway open 后才加载（auto-connect 是异步的，首帧可能还在 connecting）
  useEffect(() => {
    if (gatewayState === 'open') void load(path)
  }, [gatewayState, load, path])

  const parent = path === '/' ? null : path.split('/').slice(0, -1).join('/') || '/'

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <button
          onClick={() => parent && void load(parent)}
          disabled={!parent || loading}
          className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          ← 上级
        </button>
        <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{path}</div>
        <button onClick={() => void load(path)} disabled={loading} className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {loading ? '…' : '刷新'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {err ? (
          <div className="p-4 text-center text-sm text-red-500">{err}</div>
        ) : entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {loading ? '加载中…' : '空目录'}
          </div>
        ) : (
          <ul className="divide-y">
            {entries.map(e => (
              <li key={e.path}>
                <button
                  onClick={() => e.isDirectory ? void load(e.path) : setPreviewPath(e.path)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-muted/50"
                >
                  <span className="text-lg">{e.isDirectory ? '📁' : '📄'}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{e.name}</span>
                  {e.isDirectory ? <span className="text-muted-foreground">›</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewPath ? (
        <FilePreviewSheet
          path={previewPath}
          onClose={() => setPreviewPath(null)}
          onSaved={() => void load(path)}
        />
      ) : null}
    </div>
  )
}
