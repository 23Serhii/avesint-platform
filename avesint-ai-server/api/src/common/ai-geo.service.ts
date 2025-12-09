import { Injectable, Logger } from '@nestjs/common';

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

type LlmGeoExtraction = {
  query: string; // рядок для геокодера
};

@Injectable()
export class AiGeoService {
  private readonly logger = new Logger(AiGeoService.name);

  // Локальний Ollama з Gemma (як у osint-worker)
  private readonly ollamaUrl =
    process.env.OLLAMA_URL ?? 'http://localhost:11434';
  private readonly model = process.env.LLM_MODEL ?? 'gemma3:12b';

  // Геокодер Nominatim (OpenStreetMap)
  private readonly nominatimUrl =
    process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org';

  // 🔹 Примітивний кеш: "LLM‑рядок для геокодера" → GeoPoint | null
  //    Щоб не ходити в Nominatim по одному й тому ж тексту.
  private readonly geoCache = new Map<string, GeoPoint | null>();

  /**
   * Основний метод геолокації:
   * 1) LLM (Gemma) витягує з тексту одну головну локацію у вигляді фрази.
   * 2) Цю фразу геокодимо через Nominatim → lat/lng.
   * 3) Якщо все впало / не спрацювало — повертаємо null.
   */
  async extractLocation(fullText: string): Promise<GeoPoint | null> {
    const text = fullText ?? '';
    const trimmed = text.trim();
    if (!trimmed) return null;

    // 1. Просимо Gemma витягнути одну локацію для геокодера
    let llmResult: LlmGeoExtraction | null = null;
    try {
      llmResult = await this.extractLocationWithLlm(trimmed);
    } catch (err) {
      this.logger.warn(
        `AiGeo: LLM extraction failed: ${(err as Error).message}`,
      );
    }

    const query = llmResult?.query?.trim();
    if (!query) {
      // LLM не дав нічого адекватного → нема geo
      this.logger.debug?.('AiGeo: LLM did not return a geo-query');
      return null;
    }

    // 🔹 2. Спершу шукаємо в кеші
    if (this.geoCache.has(query)) {
      const cached = this.geoCache.get(query) ?? null;
      this.logger.debug?.(
        `AiGeo: cache hit for "${query}" -> ${
          cached ? `${cached.latitude}, ${cached.longitude}` : 'null'
        }`,
      );
      return cached;
    }

    // 3. Геокодимо цю фразу через Nominatim
    try {
      const point = await this.geocodeWithNominatim(query);

      // Запамʼятовуємо в кеші: навіть null, щоб не повторювати безплідні запити
      this.geoCache.set(query, point ?? null);

      if (point) {
        this.logger.debug?.(
          `AiGeo: Nominatim resolved "${query}" -> ${point.latitude}, ${point.longitude}`,
        );
        return point;
      }
    } catch (err) {
      this.logger.warn(
        `AiGeo: Nominatim geocoding failed for "${query}": ${
          (err as Error).message
        }`,
      );
    }

    // 4. Нічого не знайшли
    return null;
  }

  /**
   * Крок 1: Gemma витягує з повного OSINT‑тексту одну основну геолокацію
   * у вигляді короткої фрази для геокодера.
   */
  private async extractLocationWithLlm(
    text: string,
  ): Promise<LlmGeoExtraction | null> {
    const prompt = `
Ти OSINT-аналітик. Отримав текст повідомлення про військову/політичну подію
(українською, російською чи англійською).

Завдання:
- Визначити одну основну географічну локацію події.
- Сформувати короткий рядок для геокодера (населений пункт + область/регіон + країна),
  наприклад:
  - "район н.п. Стоянка, Київська область, Україна"
  - "Брянская область, Россия"
  - "район Мелитополя, Запорожская область, Украина"
  - "район Донецка, Донецкая область, Украина"
- Якщо місце не згадується взагалі — повернути JSON null.

Поверни ТІЛЬКИ JSON формату:
{
  "query": "рядок для геокодера"
}

Або null, якщо місце визначити неможливо.

Текст:
"""${text}"""
`;

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
      this.logger.warn(
        `AiGeo LLM error: ${resp.status} ${resp.statusText} – ${body}`,
      );
      return null;
    }

    const data: any = await resp.json();
    const raw = (data?.response ?? '').trim();
    if (!raw) return null;

    const lowered = raw.toLowerCase();
    if (lowered.startsWith('я не зможу') || lowered.startsWith('i cannot')) {
      return null;
    }

    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return null;
    }

    const jsonStr = raw.slice(start, end + 1);
    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    if (parsed === null) return null;

    const query = typeof parsed.query === 'string' ? parsed.query.trim() : '';
    if (!query) return null;

    return { query };
  }

  /**
   * Крок 2: виклик Nominatim (OpenStreetMap) для геокодування фрази.
   * Повертає перший збіг як GeoPoint.
   */
  private async geocodeWithNominatim(query: string): Promise<GeoPoint | null> {
    const url = new URL(`${this.nominatimUrl.replace(/\/$/, '')}/search`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '1');

    const resp = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Важливо: user-agent, інакше публічний Nominatim може ругатися
        'User-Agent': 'avesint-osint-geocoder/1.0',
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(
        `Nominatim error: ${resp.status} ${resp.statusText} – ${body}`,
      );
    }

    const json: any = await resp.json();
    if (!Array.isArray(json) || json.length === 0) {
      return null;
    }

    const first = json[0];

    // 🔹 Якщо це надто велика територія (наприклад, ціла область) –
    // не ставимо точку, щоб не брехати про точне місце.
    const bbox = first.boundingbox as
      | [string, string, string, string]
      | undefined;
    if (bbox && bbox.length === 4) {
      const [latMinStr, latMaxStr, lonMinStr, lonMaxStr] = bbox;
      const latMin = Number(latMinStr);
      const latMax = Number(latMaxStr);
      const lonMin = Number(lonMinStr);
      const lonMax = Number(lonMaxStr);

      if (
        !Number.isNaN(latMin) &&
        !Number.isNaN(latMax) &&
        !Number.isNaN(lonMin) &&
        !Number.isNaN(lonMax)
      ) {
        const dLat = Math.abs(latMax - latMin);
        const dLon = Math.abs(lonMax - lonMin);

        // поріг можна підкрутити; 2° ~ 200 км
        if (dLat > 2 || dLon > 2) {
          this.logger.debug?.(
            `AiGeo: bounding box too large for "${query}" (dLat=${dLat.toFixed(
              2,
            )}, dLon=${dLon.toFixed(2)}), skipping geo`,
          );
          return null;
        }
      }
    }

    const latNum = Number(first.lat);
    const lonNum = Number(first.lon);

    if (
      Number.isNaN(latNum) ||
      Number.isNaN(lonNum) ||
      latNum < -90 ||
      latNum > 90 ||
      lonNum < -180 ||
      lonNum > 180
    ) {
      return null;
    }

    return { latitude: latNum, longitude: lonNum };
  }
}
