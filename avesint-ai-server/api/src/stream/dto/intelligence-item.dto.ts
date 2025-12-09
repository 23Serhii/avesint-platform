// api/src/stream/dto/intelligence-item.dto.ts
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export type IntelligenceItemType = 'event' | 'osint';

export class IntelligenceItemDto {
  id!: string;
  type!: IntelligenceItemType;
  title!: string | null;
  summary!: string | null;
  time!: string; // ISO string
  status!: string | null;
  confidence!: number | null;
  latitude!: number | null;
  longitude!: number | null;
  source!: string | null;
  externalRef!: string | null;

  // 🔹 базові / AI‑теги для цього айтема
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[] | null;

  // 🔹 AI‑класифікація (те, що кладе AiClassificationService)
  @IsOptional()
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

export class StreamQueryDto {
  @IsOptional()
  @IsIn(['event', 'osint'])
  type?: IntelligenceItemType;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}

export class StreamResponseDto {
  items!: IntelligenceItemDto[];
  page!: number;
  limit!: number;
}

// 🔹 Статус, який ми очікуємо з боку аналітика (і з фронта)
export type ReviewStatus = 'pending' | 'confirmed' | 'disproved';

export class ReviewStreamItemDto {
  @IsIn(['pending', 'confirmed', 'disproved'])
  status!: ReviewStatus;

  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3'])
  priority?: 'P0' | 'P1' | 'P2' | 'P3';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  comment?: string;
}
