// api/src/osint/dto/osint-ingest.dto.ts
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsIn,
  IsNumber,
} from 'class-validator';

export class OsintSourceDto {
  @IsString()
  externalId!: string; // "telegram:ChDambiev"

  @IsString()
  @IsIn(['telegram', 'news', 'website', 'osint_tool', 'other'])
  type!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  category?: string; // "enemy-prop" | "official" | ...
}

export class OsintItemDto {
  @IsString()
  externalId!: string; // "telegram:ChDambiev:987654"

  @IsString()
  kind!: 'text' | 'video' | 'image' | 'infra' | 'other';

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsNumber()
  credibility?: number;

  @IsISO8601()
  parseDate!: string;

  @IsOptional()
  @IsISO8601()
  eventDate?: string;

  @IsOptional()
  @IsString()
  rawUrl?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  meta?: Record<string, unknown>;
}

export class OsintIngestDto {
  source!: OsintSourceDto;
  item!: OsintItemDto;
}
