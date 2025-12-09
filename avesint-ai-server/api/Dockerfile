FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=development

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY nest-cli.json tsconfig*.json .env* ./

EXPOSE 3000

CMD ["npm", "run", "start:prod"]