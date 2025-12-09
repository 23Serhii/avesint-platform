#!/usr/bin/env python
# osint-worker/src/telegram_worker.py
import os
import re
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Any, List

import requests
from dotenv import load_dotenv
from telethon import TelegramClient, events

# ==============================
# 1. ENV / базові налаштування
# ==============================

load_dotenv()

TG_API_ID = int(os.getenv("TG_API_ID", "0"))
TG_API_HASH = os.getenv("TG_API_HASH") or ""
TG_SESSION_NAME = os.getenv("TG_SESSION_NAME", "osint_session")

# Якщо TG_CHANNELS не порожній – використовуємо його як явний список каналів,
# інакше тягнемо список активних джерел з бекенда.
TG_CHANNELS_ENV: List[str] = [
    c.strip()
    for c in (os.getenv("TG_CHANNELS") or "").split(",")
    if c.strip()
]

AVESINT_API_URL = os.getenv("AVESINT_API_URL", "http://localhost:3000/api")
AVESINT_API_KEY = os.getenv("AVESINT_API_KEY") or ""

# LLM / Ollama
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
LLM_MODEL = os.getenv("LLM_MODEL", "gemma3:12b")

YOUTUBE_REGEX = re.compile(
    r"(https?://(?:www\.)?(?:youtube\.com|youtu\.be)/\S+)",
    re.IGNORECASE,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ==============================
# 2. Telegram client
# ==============================

client = TelegramClient(TG_SESSION_NAME, TG_API_ID, TG_API_HASH)


# ==============================
# 3. Допоміжні функції
# ==============================

def _build_backend_base_url() -> str:
    """
    Нормалізує AVESINT_API_URL до форми з /api.
    """
    base_raw = AVESINT_API_URL.strip().rstrip("/")
    if re.search(r"/api$", base_raw) is not None:
        return base_raw
    return base_raw + "/api"


def _build_backend_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if AVESINT_API_KEY:
        headers["X-Internal-Api-Key"] = AVESINT_API_KEY
    return headers


def fetch_active_telegram_channels() -> List[str]:
    """
    Тягнемо активні джерела з бекенда та повертаємо список username/handle
    для Telethon.

    Беремо всі isActive=true, а handle витягуємо з:
      - поля handle (без @),
      - або externalId, якщо починається з "telegram:".
    """
    base_with_api = _build_backend_base_url()
    url = f"{base_with_api}/osint/sources"

    params = {
        "isActive": "true",
    }

    try:
        resp = requests.get(
            url, params=params, headers=_build_backend_headers(), timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logging.error(
            "Failed to fetch active OSINT sources from backend (%s)", e
        )
        return []

    if not isinstance(data, list):
        logging.error(
            "Unexpected /osint/sources response format (expected list): %r", data
        )
        return []

    channels: List[str] = []
    for src in data:
        handle = (src.get("handle") or "").strip()
        if handle.startswith("@"):
            handle = handle[1:]

        if not handle:
            external_id = (src.get("externalId") or "").strip()
            if external_id.startswith("telegram:"):
                handle = external_id.split(":", 1)[1]

        handle = handle.strip()
        if handle:
            channels.append(handle)

    channels = sorted(set(channels))
    return channels


# ==============================
# 4. LLM: класифікація через Gemma/Ollama
# ==============================

def _llm_fallback(text: str, source_category: str) -> Dict[str, Any]:
    """
    Фолбек, якщо LLM не відпрацював / відмовився / повернув сміття.
    """
    return {
        "type": "info",
        "priority": "low",
        "category": "infoop",
        "credibility": 0.2 if source_category != "enemy-prop" else 0.1,
        "summary": text[:200] + ("..." if len(text) > 200 else ""),
        "eventDate": None,
        "tags": [],
    }


def call_ollama_classify(text: str, source_category: str) -> Dict[str, Any]:
    """
    Виклик локального Ollama (gemma3:12b) для класифікації / summary.

    Завжди повертає валідний dict:
    - або JSON від моделі,
    - або fallback.
    """
    prompt = f"""
Ти — старший офіцер розвідки (G2/J2) Обʼєднаного штабу оборони України, який працює в аналітичній OSINT‑платформі AVESINT.

Вхід:
- Короткі текстові повідомлення (пости Telegram, новини, зведення, заяви посадовців, пропагандистські повідомлення тощо) українською, російською або англійською.
- Джерело має категорію "{source_category}" (наприклад: "enemy-prop" — ворожа пропаганда / анонімні канали; "osint-team" — наші аналітики; "official" — офіційні органи влади тощо).

Загальний контекст:
- Повномасштабна війна РФ проти України з 2014 року, ескалація з 24.02.2022.
- Основні театри бойових дій: Схід (Харківська, Луганська, Донецька обл.), Південь (Запорізька, Херсонська, Миколаївська обл.), Північ (Сумська, Чернігівська), глибина РФ (Брянська, Курська, Бєлгородська, Ростовська, Краснодарський край тощо), тимчасово окуповані території (ТОТ) України, Чорне й Азовське моря, міжнародний повітряний простір.
- Типові обʼєкти: міста, села, військові частини, аеродроми, склади БК, логістичні вузли, обʼєкти критичної інфраструктури (енергетика, транспорт, звʼязок).
- Часто зустрічаються:
  - фактичні повідомлення з фронту (ураження цілей, просування, відступи, ротації, обстріли);
  - пересування колон/техніки (танки, ББМ, артилерія, РСЗВ, засоби ППО, БПЛА);
  - інформаційно‑психологічні операції, пропаганда, дезінформація;
  - політичні / дипломатичні заяви, які можуть мати військове значення.

Твоє завдання:
1. Витягти сутність події з тексту: ЩО сталося, ДЕ, КОЛИ (якщо згадується), ПРОТИ КОГО / КИМ.
2. Оцінити тип події, її категорію та пріоритет для штабу.
3. Оцінити достовірність (credibility) в діапазоні 0.0–1.0 з урахуванням:
   - типу джерела ("{source_category}");
   - стилю тексту (спостереження, офіційне повідомлення, чутки, пропаганда);
   - наявності конкретних фактів (час, місце, тип техніки, підтвердження з інших джерел тощо).
4. Надати коротке, але інформативне резюме українською мовою (2–3 речення), орієнтоване на українського офіцера‑аналітика.
   - НЕ копіюй текст повідомлення дослівно.
   - Узагальнюй, нормалізуй терміни ("російські війська", "Сили оборони України", "обстріл", "передова", "ТОТ" тощо).
   - Уникай емоційних/пропагандистських формулювань типу "орки", "нацисти" тощо — замінюй на нейтральні військові терміни.

Класифікація:

1) "type" (тип події):
   Обери ОДНЕ значення:
   - "equipment_movement"  — рух/пересування техніки, колон, БК, укріплень;
   - "strike"              — удар/обстріл/влучання (ракети, БПЛА, артилерія, авіаудар);
   - "alert"              — попередження/оголошена тривога/очікуваний удар;
   - "threat"             — загроза (підготовка до удару, розгортання засобів ураження, загроза КІ, диверсій тощо);
   - "info"               — інформаційне повідомлення (ситреп, зведення, заяви), яке не містить явної бойової дії;
   - "disinfo"            — ймовірна дезінформація / пропаганда без фактичного підтвердження;
   - "other"              — інше (якщо жодне з вищенаведених не підходить).

2) "priority" (пріоритет обробки для штабу):
   Обери ОДНЕ значення:
   - "critical" — подія, що потенційно вимагає негайного реагування (масований удар, загроза КІ, прорив оборони, великий наступ тощо);
   - "high"     — важлива подія з суттєвими наслідками (рух великих колон, розгортання стратегічної авіації, підготовка до удару);
   - "medium"   — значуща, але не критична подія (локальні обстріли, ротації, тактичні пересування);
   - "low"      — фонове / довідкове повідомлення чи сумнівні дані.

3) "category" (оперативна категорія):
   Обери ОДНЕ значення:
   - "movement"  — переміщення сил/засобів, логістика, передислокація;
   - "combat"    — безпосередні бойові дії, удари, обстріли, зіткнення;
   - "threat"    — загрози майбутніх дій (загроза КІ, підготовка сил, концентрація);
   - "infoop"    — інформаційно‑психологічна операція, пропаганда, ІПсО, інформаційний вплив;
   - "other"     — інше.

4) "credibility" (достовірність):
   - Дійсне число від 0.0 до 1.0.
   - Приблизні орієнтири:
     - 0.1–0.3 : низька (ворожі/анонімні канали без підтверджень, явна пропаганда);
     - 0.3–0.6 : середня (OSINT‑джерела без прямих підтверджень, але з фактологією);
     - 0.6–0.85: висока (кілька підтверджень, відомі репутаційні джерела);
     - 0.85–1.0: дуже висока (офіційні заяви + верифіковані дані, власні сенсори тощо).

5) "summary":
   - Коротке резюме українською (2–3 речення).
   - Без зайвих деталей, але з вказанням СУТІ події, сторін конфлікту та приблизної локації.
   - НЕ використовуй неекрановані лапки " всередині рядка. Краще заміни на одинарні лапки або взагалі без лапок.

6) "eventDate":
   - Якщо з тексту явно випливає точний або приблизний час події (дата/час) — поверни ISO‑рядок у форматі "YYYY-MM-DDTHH:MM:SSZ" або "YYYY-MM-DD".
   - Якщо точний час не відомий — поверни null.

7) "tags":
   - Масив ключових слів (українською), напр. ["Покровськ", "штурмові дії", "вуличні бої", "ІПсО"].
   - Уникай лапок " усередині тегів.

ВИХІД:
ПОВЕРНИ СТРОГО ОДИН JSON‑ОБʼЄКТ БЕЗ ЖОДНОГО ДОДАТКОВОГО ТЕКСТУ ДО АБО ПІСЛЯ НЬОГО.
НЕ використовуй розриви рядків усередині значень рядків, не пиши пояснень, не додавай коментарів.

Формат:
{{
  "type": "equipment_movement | strike | alert | threat | info | disinfo | other",
  "priority": "low | medium | high | critical",
  "category": "movement | combat | threat | infoop | other",
  "credibility": 0.0,
  "summary": "короткий опис українською (2-3 речення)",
  "eventDate": null,
  "tags": ["..."]
}}

Текст для аналізу:
{text}
"""

    try:
        resp = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = (data.get("response") or "").strip()
    except Exception as e:
        logging.warning("LLM request failed (%s), using fallback", e)
        return _llm_fallback(text=text, source_category=source_category)

    lowered = raw.lower()

    if not raw or lowered.startswith("я не зможу") or lowered.startswith("i cannot"):
        logging.warning(
            "LLM returned non-informative text, using fallback. raw=%r", raw
        )
        return _llm_fallback(text=text, source_category=source_category)

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        logging.warning("LLM response is not valid JSON, using fallback. raw=%r", raw)
        return _llm_fallback(text=text, source_category=source_category)

    json_str = raw[start : end + 1]
    try:
        parsed = json.loads(json_str)
    except json.JSONDecodeError:
        logging.warning(
            "Failed to parse JSON from LLM, using fallback. json_str=%r",
            json_str,
        )
        return _llm_fallback(text=text, source_category=source_category)

    parsed.setdefault("type", "info")
    parsed.setdefault("priority", "low")
    parsed.setdefault("category", "infoop")
    parsed.setdefault(
        "credibility",
        0.2 if source_category != "enemy-prop" else 0.1,
    )
    parsed.setdefault(
        "summary",
        text[:200] + ("..." if len(text) > 200 else ""),
        )
    parsed.setdefault("eventDate", None)
    parsed.setdefault("tags", [])

    return parsed


# ==============================
# 5. Формування OsintIngestDto
# ==============================

def build_osint_payload(
        *,
        channel: str,
        message_id: int,
        text: str,
        published_at: datetime,
        media_url: Optional[str],
        llm_result: Dict[str, Any],
        youtube_url: Optional[str],
) -> Dict[str, Any]:
    parse_dt = datetime.now(timezone.utc)
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    parse_iso = parse_dt.isoformat()
    event_date_raw = llm_result.get("eventDate")
    event_iso: Optional[str] = None
    if isinstance(event_date_raw, str) and event_date_raw.strip():
        try:
            event_iso = datetime.fromisoformat(event_date_raw).astimezone(
                timezone.utc
            ).isoformat()
        except Exception:
            event_iso = None

    source_external_id = f"telegram:{channel}"
    item_external_id = f"telegram:{channel}:{message_id}"

    tags = llm_result.get("tags") or []
    if not isinstance(tags, list):
        tags = [str(tags)]
    tags = [str(t) for t in tags]

    kind = "text"
    language = "ru"

    item_type = str(llm_result.get("type") or "info")
    item_category = str(llm_result.get("category") or "infoop")
    item_priority = llm_result.get("priority")
    if item_priority not in ("low", "medium", "high", "critical"):
        item_priority = "low"

    credibility = llm_result.get("credibility")
    try:
        credibility = float(credibility)
    except Exception:
        credibility = 0.2 if item_category != "enemy-prop" else 0.1

    summary = str(llm_result.get("summary") or text[:200])

    raw_url = (
        f"https://t.me/{channel}/{message_id}"
        if channel and channel != "unknown"
        else None
    )

    meta: Dict[str, Any] = {
        "telegram": {
            "channel": channel,
            "messageId": message_id,
            "publishedAt": published_at.isoformat(),
        }
    }
    if youtube_url:
        meta["youtubeUrl"] = youtube_url
    if media_url and media_url != raw_url:
        meta["originalMediaUrl"] = media_url

    return {
        "source": {
            "externalId": source_external_id,
            "type": "telegram",
            "name": channel or "unknown",
            "url": raw_url,
            "category": item_category,
        },
        "item": {
            "externalId": item_external_id,
            "kind": kind,
            "title": None,
            "content": text,
            "summary": summary,
            "language": language,
            "priority": item_priority,
            "type": item_type,
            "category": item_category,
            "tags": tags,
            "credibility": credibility,
            "parseDate": parse_iso,
            "eventDate": event_iso,
            "rawUrl": raw_url,
            "mediaUrl": media_url,
            "meta": meta,
        },
    }


# ==============================
# 6. Відправка на бекенд
# ==============================

def send_to_backend(payload: Dict[str, Any]) -> None:
    if not AVESINT_API_URL:
        logging.error("AVESINT_API_URL не налаштований, скіпаю надсилання")
        return

    base_with_api = _build_backend_base_url()
    url = f"{base_with_api}/osint/ingest"

    logging.info("Sending OSINT payload to %s", url)
    try:
        resp = requests.post(
            url,
            json=payload,
            headers=_build_backend_headers(),
            timeout=30,
        )
        if resp.status_code < 400:
            logging.info("Sent OSINT item, backend response: %s", resp.text)
        else:
            logging.error(
                "Backend returned error %s: %s", resp.status_code, resp.text
            )
    except Exception as e:
        logging.error("Failed to send to backend (%s)", e)


# ==============================
# 7. Хендлер нових повідомлень
# ==============================

async def handle_new_message(event: events.NewMessage.Event) -> None:
    msg = event.message
    if msg is None:
        return

    text = msg.message or ""
    if not text.strip():
        return

    chat = msg.chat or event.chat
    channel_username = None
    if chat:
        channel_username = getattr(chat, "username", None) or getattr(
            chat, "title", None
        )
    channel_username = channel_username or "unknown"

    logging.info(
        "New message %s in %s: %s",
        msg.id,
        channel_username,
        text[:80].replace("\n", " "),
    )

    yt_match = YOUTUBE_REGEX.search(text)
    youtube_url = yt_match.group(1) if yt_match else None

    source_category = (
        "enemy-prop"
        if channel_username.lower() == "chdambiev".lower()
        else "osint-team"
    )

    llm_res = call_ollama_classify(text, source_category=source_category)

    media_url: Optional[str] = None
    if msg.media:
        media_url = f"https://t.me/{channel_username}/{msg.id}"

    payload = build_osint_payload(
        channel=channel_username,
        message_id=msg.id,
        text=text,
        published_at=msg.date,
        media_url=media_url,
        llm_result=llm_res,
        youtube_url=youtube_url,
    )

    send_to_backend(payload)


# ==============================
# 8. main
# ==============================

async def main() -> None:
    if not TG_API_ID or not TG_API_HASH:
        raise RuntimeError("TG_API_ID/TG_API_HASH не задані у .env")

    # 1) Визначаємо список каналів
    if TG_CHANNELS_ENV:
        channels = TG_CHANNELS_ENV
        logging.info("Using TG_CHANNELS from .env: %s", channels)
    else:
        channels = fetch_active_telegram_channels()
        if not channels:
            logging.warning(
                "Немає жодного активного Telegram-каналу: "
                "TG_CHANNELS порожній і бекенд не повернув активних osint_sources "
                "(isActive=true, externalId~'telegram:'). "
                "Воркер запущений, але не слухає жоден канал."
            )
        else:
            logging.info("Using active telegram channels from backend: %s", channels)

    logging.info("Starting Telegram OSINT worker. Channels: %s", channels)
    logging.info("Using local Ollama at %s with model %s", OLLAMA_URL, LLM_MODEL)

    await client.start()
    me = await client.get_me()
    logging.info(
        "Logged in to Telegram as %s",
        getattr(me, "username", None) or me.id,
        )

    if channels:
        client.add_event_handler(
            handle_new_message,
            events.NewMessage(chats=channels),
        )
        logging.info("Registered Telegram handler for channels: %s", channels)
    else:
        logging.info("No channels configured: Telegram handler is not registered.")

    logging.info("OSINT Telegram worker started, waiting for messages...")
    # Навіть якщо хендлерів немає, тримаємо клієнт живим
    await client.run_until_disconnected()

if __name__ == "__main__":
    import asyncio

    asyncio.run(main())