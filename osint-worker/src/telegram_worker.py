#!/usr/bin/env python
# osint-worker/src/telegram_worker.py

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from dotenv import load_dotenv
from telethon import TelegramClient, events

# ==============================
# 0) Logging
# ==============================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ==============================
# 1) ENV
# ==============================

load_dotenv()

TG_MAX_CONCURRENCY = int(os.getenv("TG_MAX_CONCURRENCY", "3") or "3")
TG_MAX_CONCURRENCY = max(TG_MAX_CONCURRENCY, 1)
_PROCESS_SEM = asyncio.Semaphore(TG_MAX_CONCURRENCY)

TG_API_ID = int(os.getenv("TG_API_ID", "0"))
TG_API_HASH = os.getenv("TG_API_HASH") or ""
TG_SESSION_NAME = os.getenv("TG_SESSION_NAME", "osint_session")

AVESINT_API_URL = (os.getenv("AVESINT_API_URL", "http://localhost:3000/api") or "").strip()
AVESINT_API_KEY = os.getenv("AVESINT_API_KEY") or ""

OLLAMA_URL = (os.getenv("OLLAMA_URL", "http://localhost:11434") or "").strip()
LLM_MODEL = (os.getenv("LLM_MODEL", "gemma3:12b") or "").strip()


SLANG_SOLDIERS_REGEX = re.compile(
    r"\b(хлопчик(и|ів|ам|ами)?|мальчик(и|ов|ам|ами)?)\b",
    re.IGNORECASE,
)

MILITARY_CONTEXT_REGEX = re.compile(
    r"\b(зсу|всу|військ|військов|бійц|підрозділ|позиці(я|ї)|окоп|штурм|удар|обстріл|дрон|fpv|ппо)\b",
    re.IGNORECASE,
)

CHILD_EXPLICIT_REGEX = re.compile(
    r"\b(дитин(а|и|і|ою|ам|ах)|діти|школяр(і|ів|ям|ями)|неповнолітн(і|іх|им|ими)|малолітн(і|іх))\b",
    re.IGNORECASE,
)


TG_CHANNELS_ENV: List[str] = [
    c.strip().lstrip("@")
    for c in (os.getenv("TG_CHANNELS") or "").split(",")
    if c.strip()
]

CHANNEL_REFRESH_INTERVAL_SEC = int(os.getenv("TG_CHANNEL_REFRESH_INTERVAL_SEC", "10") or "10")
CHANNEL_REFRESH_INTERVAL_SEC = max(CHANNEL_REFRESH_INTERVAL_SEC, 5)

SOURCE_CATEGORY_MAP_JSON = (os.getenv("OSINT_SOURCE_CATEGORY_MAP_JSON") or "").strip()
try:
    SOURCE_CATEGORY_OVERRIDES: Dict[str, str] = (
        json.loads(SOURCE_CATEGORY_MAP_JSON) if SOURCE_CATEGORY_MAP_JSON else {}
    )
except Exception:
    SOURCE_CATEGORY_OVERRIDES = {}

ALLOWED_SOURCE_CATEGORIES = {"official", "osint-team", "local-news", "enemy-prop", "unknown"}

YOUTUBE_REGEX = re.compile(
    r"(https?://(?:www\.)?(?:youtube\.com|youtu\.be)/\S+)",
    re.IGNORECASE,
)

def normalize_text_for_llm(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return t

    # Якщо "хлопчики/мальчики" в очевидно військовому контексті, і нема явних маркерів дітей —
    # нормалізуємо термін, щоб LLM не “поїхала” в сторону дітей.
    if SLANG_SOLDIERS_REGEX.search(t) and MILITARY_CONTEXT_REGEX.search(t) and not CHILD_EXPLICIT_REGEX.search(t):
        t = SLANG_SOLDIERS_REGEX.sub("військові", t)

    return t

# ==============================
# 2) Telegram client
# ==============================

client = TelegramClient(TG_SESSION_NAME, TG_API_ID, TG_API_HASH)

# ==============================
# 3) Backend helpers
# ==============================

def _normalize_handle(handle: str) -> str:
    h = (handle or "").strip()
    if h.startswith("@"):
        h = h[1:]
    if h.lower().startswith("handle:"):
        h = h.split(":", 1)[1].strip()
    return h.strip()

def _extract_handle_from_external_id(external_id: str) -> Optional[str]:
    """
    Підтримує формати:
      - telegram:<username>
      - telegram:handle:<username>
      - telegram:chatid:<id>  -> handle відсутній (None)
    """
    ext = (external_id or "").strip()
    if not ext.startswith("telegram:"):
        return None

    rest = ext.split(":", 1)[1].strip()
    if not rest:
        return None

    lower = rest.lower()
    if lower.startswith("handle:"):
        return _normalize_handle(rest.split(":", 1)[1]) or None

    if lower.startswith("chatid:"):
        return None

    return _normalize_handle(rest) or None

def _channel_identity(chat: Any) -> Tuple[str, Optional[str]]:
    """
    Returns:
      - stable_source_external_id: stable identifier for source.externalId
      - public_handle: telegram username for t.me links (may be None)
    """
    if not chat:
        return ("telegram:unknown", None)

    username = getattr(chat, "username", None)
    if isinstance(username, str) and username.strip():
        handle = _normalize_handle(username)
        return (f"telegram:handle:{handle.lower()}", handle)

    chat_id = getattr(chat, "id", None)
    if isinstance(chat_id, int):
        return (f"telegram:chatid:{chat_id}", None)

    return ("telegram:unknown", None)

def _build_backend_base_url() -> str:
    base_raw = AVESINT_API_URL.strip().rstrip("/")
    if re.search(r"/api$", base_raw) is not None:
        return base_raw
    return base_raw + "/api"

def _build_backend_headers() -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if AVESINT_API_KEY:
        headers["X-Internal-Api-Key"] = AVESINT_API_KEY
    return headers

def fetch_active_telegram_sources() -> List[Dict[str, Any]]:
    base = _build_backend_base_url()
    url = f"{base}/osint/sources"

    try:
        resp = requests.get(
            url,
            params={"isActive": "true"},
            headers=_build_backend_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logging.error("Failed to fetch active OSINT sources from backend (%s)", e)
        return []

    if not isinstance(data, list):
        logging.error("Unexpected /osint/sources response format: %r", data)
        return []

    out: List[Dict[str, Any]] = []
    for src in data:
        if not isinstance(src, dict):
            continue

        raw_handle = str(src.get("handle") or "")
        external_id = str(src.get("externalId") or "").strip()

        handle = _normalize_handle(raw_handle)
        if not handle and external_id:
            from_ext = _extract_handle_from_external_id(external_id)
            if from_ext:
                handle = from_ext

        handle = _normalize_handle(handle)
        if not handle:
            continue

        category = src.get("category")
        category = category.strip() if isinstance(category, str) and category.strip() else None

        out.append(
            {
                "handle": handle,
                "externalId": external_id or f"telegram:{handle}",
                "category": category,
            }
        )

    return out

SOURCE_CATEGORY_BY_HANDLE: Dict[str, Optional[str]] = {}

def refresh_backend_source_map(*, log_if_changed: bool = True) -> None:
    sources = fetch_active_telegram_sources()
    m: Dict[str, Optional[str]] = {}
    for s in sources:
        h = _normalize_handle(str(s.get("handle") or "")).lower()
        if not h:
            continue
        m[h] = s.get("category")

    global SOURCE_CATEGORY_BY_HANDLE
    prev = SOURCE_CATEGORY_BY_HANDLE
    SOURCE_CATEGORY_BY_HANDLE = m

    if log_if_changed and prev != m:
        logging.info("Loaded %d active sources from backend", len(SOURCE_CATEGORY_BY_HANDLE))

def resolve_source_category(handle: str) -> str:
    key = _normalize_handle(handle).lower()

    ov = SOURCE_CATEGORY_OVERRIDES.get(key)
    if isinstance(ov, str) and ov in ALLOWED_SOURCE_CATEGORIES:
        return ov

    backend_cat = SOURCE_CATEGORY_BY_HANDLE.get(key)
    if isinstance(backend_cat, str) and backend_cat in ALLOWED_SOURCE_CATEGORIES:
        return backend_cat

    return "unknown"

# ==============================
# 4) LLM classify (blocking)
# ==============================

def _llm_fallback(text: str, source_category: str) -> Dict[str, Any]:
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
    text = normalize_text_for_llm(text)

    prompt = f"""
Ти OSINT-аналітик.

Джерело має категорію "{source_category}" (official|osint-team|local-news|enemy-prop|unknown).

Поверни СТРОГО один JSON:
{{
  "type": "equipment_movement | strike | alert | threat | info | disinfo | other",
  "priority": "low | medium | high | critical",
  "category": "movement | combat | threat | infoop | other",
  "credibility": 0.0,
  "summary": "коротко українською (2-3 речення)",
  "eventDate": null,
  "tags": ["..."]
}}

Текст:
{text}
"""
    try:
        resp = requests.post(
            f"{OLLAMA_URL.rstrip('/')}/api/generate",
            json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        raw = (data.get("response") or "").strip()
    except Exception as e:
        logging.warning("LLM request failed (%s), using fallback", e)
        return _llm_fallback(text=text, source_category=source_category)

    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1:
        return _llm_fallback(text=text, source_category=source_category)

    try:
        parsed = json.loads(raw[start : end + 1])
    except Exception:
        return _llm_fallback(text=text, source_category=source_category)

    if not isinstance(parsed, dict):
        return _llm_fallback(text=text, source_category=source_category)

    parsed.setdefault("type", "info")
    parsed.setdefault("priority", "low")
    parsed.setdefault("category", "infoop")
    parsed.setdefault("credibility", 0.2 if source_category != "enemy-prop" else 0.1)
    parsed.setdefault("summary", text[:200] + ("..." if len(text) > 200 else ""))
    parsed.setdefault("eventDate", None)
    parsed.setdefault("tags", [])

    return parsed

# ==============================
# 5) Payload + send (blocking)
# ==============================

def build_osint_payload(
    *,
    channel_handle: str,
    message_id: int,
    text: str,
    published_at: datetime,
    media_url: Optional[str],
    llm_result: Dict[str, Any],
    youtube_url: Optional[str],
    source_category: str,
    source_external_id: str,
) -> Dict[str, Any]:
    parse_dt = datetime.now(timezone.utc)
    published_at = published_at.astimezone(timezone.utc)

    parse_iso = parse_dt.isoformat()

    event_date_raw = llm_result.get("eventDate")
    event_iso: Optional[str] = None
    if isinstance(event_date_raw, str) and event_date_raw.strip():
        try:
            event_iso = datetime.fromisoformat(event_date_raw).astimezone(timezone.utc).isoformat()
        except Exception:
            event_iso = None

    item_external_id = f"{source_external_id}:msg:{message_id}"

    tags = llm_result.get("tags") or []
    if not isinstance(tags, list):
        tags = [str(tags)]
    tags = [str(t) for t in tags]

    item_priority = llm_result.get("priority")
    if item_priority not in ("low", "medium", "high", "critical"):
        item_priority = "low"

    try:
        credibility = float(llm_result.get("credibility"))
    except Exception:
        credibility = 0.2 if source_category != "enemy-prop" else 0.1

    summary = str(llm_result.get("summary") or text[:200])

    raw_url = (
        f"https://t.me/{channel_handle}/{message_id}"
        if channel_handle and channel_handle != "unknown"
        else None
    )

    meta: Dict[str, Any] = {
        "telegram": {
            "channel": channel_handle,
            "messageId": message_id,
            "publishedAt": published_at.isoformat(),
        },
        "sourceCategory": source_category,
    }
    if youtube_url:
        meta["youtubeUrl"] = youtube_url
    if media_url and media_url != raw_url:
        meta["originalMediaUrl"] = media_url

    return {
        "source": {
            "externalId": source_external_id,
            "type": "telegram",
            "name": channel_handle,
            "url": f"https://t.me/{channel_handle}"
            if channel_handle and channel_handle != "unknown"
            else None,
            "category": source_category,
        },
        "item": {
            "externalId": item_external_id,
            "kind": "text",
            "title": None,
            "content": text,
            "summary": summary,
            "language": "ru",
            "priority": item_priority,
            "type": str(llm_result.get("type") or "info"),
            "category": str(llm_result.get("category") or "infoop"),
            "tags": tags,
            "credibility": credibility,
            "parseDate": parse_iso,
            "eventDate": event_iso,
            "rawUrl": raw_url,
            "mediaUrl": media_url,
            "meta": meta,
        },
    }

def send_to_backend(payload: Dict[str, Any]) -> None:
    base = _build_backend_base_url()
    url = f"{base}/osint/ingest"

    resp = requests.post(
        url,
        json=payload,
        headers=_build_backend_headers(),
        timeout=30,
    )
    if resp.status_code < 400:
        logging.info("Sent OSINT item ok (%s)", payload.get("item", {}).get("externalId"))
    else:
        logging.error("Backend error %s: %s", resp.status_code, resp.text[:400])

# ==============================
# 6) Channel registration
# ==============================

def _channels_from_env() -> List[str]:
    channels = sorted({_normalize_handle(c) for c in TG_CHANNELS_ENV if _normalize_handle(c)})
    return [c for c in channels if c]

def _channels_from_backend_sources(sources: List[Dict[str, Any]]) -> List[str]:
    channels = sorted({_normalize_handle(str(s.get("handle") or "")) for s in sources})
    return [c for c in channels if c]

_REGISTERED_HANDLES: Set[str] = set()
_HANDLER_REGISTERED: bool = False

def _resolve_desired_channels() -> List[str]:
    if TG_CHANNELS_ENV:
        return _channels_from_env()
    return _channels_from_backend_sources(fetch_active_telegram_sources())

def _register_channels(channels: List[str], *, log: bool = True) -> None:
    global _REGISTERED_HANDLES, _HANDLER_REGISTERED

    normalized = sorted({_normalize_handle(c) for c in channels if _normalize_handle(c)})
    if not normalized:
        if log and not _HANDLER_REGISTERED:
            logging.info("No channels configured: Telegram handler is not registered.")
        return

    new_handles = [c for c in normalized if c.lower() not in _REGISTERED_HANDLES]
    if not new_handles:
        return

    client.add_event_handler(handle_new_message, events.NewMessage(chats=new_handles))
    for c in new_handles:
        _REGISTERED_HANDLES.add(c.lower())

    _HANDLER_REGISTERED = True
    if log:
        logging.info("Registered Telegram handler for NEW channels: %s", new_handles)

# ==============================
# 7) Telegram handler (async, non-blocking)
# ==============================

async def _process_message(
    *,
    text: str,
    msg_id: int,
    msg_date: datetime,
    has_media: bool,
    channel_handle: str,
    stable_source_external_id: str,
) -> None:
    async with _PROCESS_SEM:
        try:
            yt_match = YOUTUBE_REGEX.search(text)
            youtube_url = yt_match.group(1) if yt_match else None

            source_category = resolve_source_category(channel_handle)

            llm_res = await asyncio.to_thread(call_ollama_classify, text, source_category)

            media_url: Optional[str] = None
            if has_media and channel_handle and channel_handle != "unknown":
                media_url = f"https://t.me/{channel_handle}/{msg_id}"

            payload = build_osint_payload(
                channel_handle=channel_handle,
                message_id=msg_id,
                text=text,
                published_at=msg_date,
                media_url=media_url,
                llm_result=llm_res,
                youtube_url=youtube_url,
                source_category=source_category,
                source_external_id=stable_source_external_id,
            )

            await asyncio.to_thread(send_to_backend, payload)

        except Exception as e:
            logging.error("Failed to process message %s (%s)", msg_id, e)

async def handle_new_message(ev: events.NewMessage.Event) -> None:
    msg = ev.message
    if msg is None:
        return

    text = (msg.message or "").strip()
    if not text:
        return

    chat = msg.chat or ev.chat
    stable_source_external_id, public_handle = _channel_identity(chat)
    channel_handle = _normalize_handle(public_handle or getattr(chat, "title", None) or "unknown") or "unknown"

    logging.info(
        "New message %s in %s (%s): %s",
        msg.id,
        channel_handle,
        stable_source_external_id,
        text[:80].replace("\n", " "),
    )

    asyncio.create_task(
        _process_message(
            text=text,
            msg_id=msg.id,
            msg_date=msg.date,
            has_media=bool(msg.media),
            channel_handle=channel_handle,
            stable_source_external_id=stable_source_external_id,
        )
    )

# ==============================
# 8) main
# ==============================

async def main() -> None:
    if not TG_API_ID or not TG_API_HASH:
        raise RuntimeError("TG_API_ID/TG_API_HASH не задані у .env")

    refresh_backend_source_map(log_if_changed=True)

    await client.start()
    me = await client.get_me()
    logging.info("Logged in to Telegram as %s", getattr(me, "username", None) or me.id)

    channels = _resolve_desired_channels()
    _register_channels(channels, log=True)

    logging.info("OSINT Telegram worker started, waiting for messages...")
    await client.run_until_disconnected()

if __name__ == "__main__":
    asyncio.run(main())