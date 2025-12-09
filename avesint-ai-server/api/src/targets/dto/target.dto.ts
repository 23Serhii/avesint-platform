// src/targets/dto/target.dto.ts
import type { Target } from '../target.entity';

export type TargetStatus =
  | 'candidate'
  | 'observed'
  | 'confirmed'
  | 'tasked'
  | 'engaged'
  | 'destroyed';

export type TargetPriority = 'low' | 'medium' | 'high' | 'critical';

export interface TargetDto {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  status: TargetStatus;
  priority: TargetPriority | null;
  latitude: number | null;
  longitude: number | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export function mapTargetToDto(t: Target): TargetDto {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? null,
    type: t.type ?? null,
    status: t.status as TargetStatus,
    priority: (t.priority as TargetPriority | null) ?? null,
    latitude: t.latitude !== null ? Number(t.latitude) : null,
    longitude: t.longitude !== null ? Number(t.longitude) : null,
    firstSeenAt: t.firstSeenAt.toISOString(),
    lastSeenAt: t.lastSeenAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
