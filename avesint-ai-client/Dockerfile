FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
# Для дев-середовища білд не запускаємо, достатньо dev‑сервера
# RUN npm run build

# Дев-сервер Vite
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]