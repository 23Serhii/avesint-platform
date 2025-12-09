// api/src/common/ai-classification.types.ts

// Основні категорії, з якими працює AI
export type AiMainCategory =
  | 'military_activity'
  | 'strikes_threats'
  | 'infrastructure'
  | 'territorial'
  | 'political_info'
  | 'social'
  | 'technical_meta'
  | 'other';

// Рівень загрози
export type AiThreatLevel = 'low' | 'medium' | 'high';

// Пріоритет події
export type AiPriority = 'P0' | 'P1' | 'P2' | 'P3';

// Тип судження
export type AiEventKind = 'fact' | 'assessment' | 'assumption' | 'forecast';

// Основний обʼєкт, який ми кладемо в osint_items.meta.aiClassification
export interface AiClassification {
  mainCategory: AiMainCategory;
  subCategories: string[];
  threatLevel: AiThreatLevel;
  priority: AiPriority;
  eventKind: AiEventKind;
  tags: string[];
  confidence: number; // 0..1
}
