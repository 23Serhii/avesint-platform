import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type IntelligenceItemType = 'event' | 'osint';

export class IntelligenceItemDto {
  id!: string;
  type!: IntelligenceItemType;
  title!: string | null;
  summary!: string | null;
  time!: string; // ISO
  status!: string | null;
  confidence!: number | null;
  latitude!: number | null;
  longitude!: number | null;
  source!: string | null;
  externalRef!: string | null;

  // 🔹 Додаємо теги, які йтимуть у “Пропозицію AI”
  tags?: string[] | null;

  // 🔹 І повну AI‑класифікацію (те, що ти вже зберігаєш у meta.aiClassification)
  aiClassification?: {
    mainCategory: string;
    subCategories: string[];
    threatLevel: 'low' | 'medium' | 'high';
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    eventKind: 'fact' | 'assessment' | 'assumption' | 'forecast';
    tags: string[];
    confidence: number;
  } | null;
}
