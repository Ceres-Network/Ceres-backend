FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY packages/shared ./packages/shared
COPY services/indexer ./services/indexer

RUN npm install
RUN npm run build --workspace=@ceres/shared
RUN npm run build --workspace=@ceres/indexer

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/indexer/dist ./services/indexer/dist
COPY --from=builder /app/services/indexer/package.json ./services/indexer/

WORKDIR /app/services/indexer

RUN npm install --production

CMD ["node", "dist/index.js"]
