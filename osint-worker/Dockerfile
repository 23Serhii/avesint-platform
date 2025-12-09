# osint-worker/Dockerfile

FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY .env ./

# Telethon сесію можна мапити як volume
VOLUME ["/app"]

CMD ["python", "-m", "src.telegram_worker"]