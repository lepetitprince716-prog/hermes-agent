import { atom } from 'nanostores'

import type { ProjectInfo } from '@/types/hermes'

export const $projects = atom<ProjectInfo[]>([])
export const $projectsLoading = atom(false)
export const $projectsError = atom<string | null>(null)
export const $activeProjectId = atom<null | string>(null)

export function setProjects(payload: { projects: ProjectInfo[]; active_id: null | string }): void {
  $projects.set(payload.projects ?? [])
  $activeProjectId.set(payload.active_id ?? null)
}
