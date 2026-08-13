import { atom } from 'nanostores'

import type { BoardInfo, KanbanColumn } from '@/lib/kanban'

export const $kanbanBoards = atom<BoardInfo[]>([])
export const $kanbanCurrentBoard = atom<string | null>(null)
export const $kanbanColumns = atom<KanbanColumn[]>([])
export const $kanbanLoading = atom(false)
export const $kanbanError = atom<string | null>(null)
/** 最近一次成功刷新的时间戳（秒），用于"N 秒前更新"显示 */
export const $kanbanRefreshedAt = atom<number | null>(null)
