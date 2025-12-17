// api/src/common/ai-classification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { AiClassification } from './ai-classification.types';

@Injectable()
export class AiClassificationService {
  private readonly logger = new Logger(AiClassificationService.name);

  // Локальний Ollama (як у osint-worker)
  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434';
  // Модель Gemma
  private readonly model = process.env.LLM_MODEL ?? 'gemma3:12b'; // можеш підставити свою дефолтну

  /**
   * Класифікація OSINT‑тексту за наперед заданими категоріями
   * через локальну Gemma (Ollama).
   */
  async classify(text: string): Promise<AiClassification | null> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return null;

    const prompt = `
Ти OSINT-аналітик штабу. Отримуєш текст OSINT‑повідомлення (українська/російська/англійська).
Твоє завдання — класифікувати подію та оцінити її за наперед заданою схемою.
Важливе правило про двозначні слова/сленг:
- "хлопчики"/"мальчики" у військовому/пропагандистському контексті часто означають військових (іронія/зневага).
- НЕ інтерпретуй як дітей, якщо немає явних маркерів неповнолітніх (вік, "діти", "школярі", "неповнолітні" тощо).
- Якщо неясно — використовуй нейтральне формулювання в tags/subCategories і знижуй confidence.


Поверни СТРОГО JSON такого формату:

{
  "mainCategory": "military_activity | strikes_threats | infrastructure | territorial | political_info | social | technical_meta | other",
  "subCategories": ["...", "..."],
  "threatLevel": "low | medium | high",
  "priority": "P0 | P1 | P2 | P3",
  "eventKind": "fact | assessment | assumption | forecast",
  "tags": ["...", "..."],
  "confidence": 0.0
}

Пояснення полів:
- mainCategory, subCategories — як у схемі військової аналітики (рух колон / бої / удари / інфраструктура / ІПСО / цивільні події тощо).
- threatLevel — рівень загрози.
- priority:
  - P0 — негайна увага (масований удар, критична загроза, стратегічна авіація перед ударом тощо);
  - P1 — важливо;
  - P2 — середнє;
  - P3 — низьке.
- eventKind:
  - fact — зафіксований факт (відео/фото, очевидці);
  - assessment — аналітична оцінка;
  - assumption — припущення;
  - forecast — прогноз.
- tags — короткі теги українською, нижній регістр.

Якщо класифікація неможлива — поверни JSON null.

Текст для класифікації:
"""${trimmed}"""
`;

    try {
      const resp = await fetch(
        `${this.ollamaUrl.replace(/\/$/, '')}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt,
            stream: false,
          }),
        },
      );

      if (!resp.ok) {
        const body = await resp.text();
        this.logger.error(
          `Ollama classification error: ${resp.status} ${resp.statusText} – ${body}`,
        );
        return null;
      }

      const data: any = await resp.json();
      const raw = (data?.response ?? '').trim();

      if (!raw) {
        this.logger.warn('AI classification: empty response from Ollama');
        return null;
      }

      const lowered = raw.toLowerCase();
      if (lowered.startsWith('я не зможу') || lowered.startsWith('i cannot')) {
        this.logger.warn('AI classification: model refused to answer');
        return null;
      }

      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) {
        this.logger.warn(
          `AI classification: no JSON object in response: ${raw}`,
        );
        return null;
      }

      const jsonStr = raw.slice(start, end + 1);
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        this.logger.warn(
          `AI classification: failed to parse JSON from response: ${jsonStr}`,
        );
        return null;
      }

      if (parsed === null) return null;

      const result: AiClassification = {
        mainCategory: parsed.mainCategory ?? 'other',
        subCategories: Array.isArray(parsed.subCategories)
          ? parsed.subCategories.map(String)
          : [],
        threatLevel: parsed.threatLevel ?? 'medium',
        priority: parsed.priority ?? 'P2',
        eventKind: parsed.eventKind ?? 'fact',
        tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.7,
      };

      return result;
    } catch (e) {
      this.logger.error('AI classification exception', e);
      return null;
    }
  }
}
