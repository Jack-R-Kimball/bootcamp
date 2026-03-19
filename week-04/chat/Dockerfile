FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/lib/server ./src/lib/server
COPY server.ts ./
RUN mkdir -p data

ENV PORT=4323
EXPOSE 4323
CMD ["node", "--loader", "ts-node/esm", "server.ts"]
