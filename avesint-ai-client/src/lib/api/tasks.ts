// avesint-ai-client/src/lib/api/tasks.ts
import { api } from './client'

export type TaskStatus = 'new' | 'in_progress' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'
export type TaskRole = 'analyst' | 'duty_officer' | 'section_lead' | 'commander'

export interface TaskDto {
    id: string
    title: string
    description: string | null
    status: TaskStatus
    priority: TaskPriority
    role: TaskRole | null
    assigneeId: string | null
    assigneeCallsign: string | null
    assigneeRank: string | null
    assigneeUnit: string | null
    targetId: string | null
    eventId: string | null
    parentTaskId: string | null
    createdAt: string
    updatedAt: string
    dueAt: string | null
    createdBy: string | null
    updatedBy: string | null
    archived: boolean
}

export interface ListTasksParams {
    page?: number
    pageSize?: number
    status?: TaskStatus[]
    priority?: TaskPriority[]
    role?: TaskRole[]
    assigneeCallsign?: string
    onlyMine?: boolean
    parentTaskId?: string
    archived?: boolean
}

export interface ListTasksResponse {
    items: TaskDto[]
    page: number
    pageSize: number
    total: number
}

export interface CreateTaskInput {
    title: string
    description?: string
    status?: TaskStatus
    priority?: TaskPriority
    role?: TaskRole
    assigneeId?: string
    assigneeCallsign?: string
    assigneeRank?: string
    assigneeUnit?: string
    targetId?: string
    eventId?: string
    dueAt?: string
    parentTaskId?: string
}

export type UpdateTaskInput = Partial<CreateTaskInput>

export async function listTasks(params: ListTasksParams): Promise<ListTasksResponse> {
    const res = await api.get<ListTasksResponse>('/tasks', {
        params: {
            page: params.page,
            pageSize: params.pageSize,
            status: params.status,
            priority: params.priority,
            role: params.role,
            assignee: params.assigneeCallsign,
            archived:
                typeof params.archived === 'boolean'
                    ? String(params.archived)
                    : undefined,
        },
    })
    return res.data
}

export async function getTask(id: string): Promise<TaskDto> {
    const res = await api.get<TaskDto>(`/tasks/${id}`)
    return res.data
}

export async function createTask(input: CreateTaskInput): Promise<TaskDto> {
    const res = await api.post<TaskDto>('/tasks', input)
    return res.data
}

export async function updateTask(
    id: string,
    input: Partial<TaskDto>,
): Promise<TaskDto> {
    const res = await api.patch<TaskDto>(`/tasks/${id}`, input)
    return res.data
}

/**
 * Архівація задачі.
 * На бекенді це DELETE /tasks/:id, який виставляє archived = true.
 * Якщо задача вже в архіві, бекенд поверне 400 "Task is already archived".
 */
export async function deleteTask(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`)
}