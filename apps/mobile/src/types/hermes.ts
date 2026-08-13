// Mobile 共享类型（照抄 desktop src/types/hermes.ts 的 projects 部分）

export interface ProjectFolder {
  path: string
  label: null | string
  is_primary: boolean
  added_at: number
}

export interface ProjectInfo {
  id: string
  slug: string
  name: string
  description: null | string
  icon: null | string
  color: null | string
  board_slug: null | string
  primary_path: null | string
  archived: boolean
  created_at: number
  folders: ProjectFolder[]
}

export interface ProjectsPayload {
  projects: ProjectInfo[]
  active_id: null | string
}
