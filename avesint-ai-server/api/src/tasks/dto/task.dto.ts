// src/tasks/dto/task.dto.ts
import type { Task } from '../task.entity';

export type TaskStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskRole =
  | 'section_lead'
  | 'recon'
  | 'intel'
  | 'fire_support'
  | 'other';

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  role: TaskRole | null;

  assigneeId: string | null;
  assigneeCallsign: string | null;
  assigneeRank: string | null;
  assigneeUnit: string | null;

  targetId: string | null;
  eventId: string | null;

  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
}

export function mapTaskToDto(t: Task): TaskDto {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    role: (t.role as TaskRole | null) ?? null,
    assigneeId: t.assigneeId ?? null,
    assigneeCallsign: t.assigneeCallsign ?? null,
    assigneeRank: t.assigneeRank ?? null,
    assigneeUnit: t.assigneeUnit ?? null,
    targetId: t.targetId ?? null,
    eventId: t.eventId ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
  };
}
