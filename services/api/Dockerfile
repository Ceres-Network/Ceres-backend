FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY packages/shared ./packages/shared
COPY services/api ./services/api

RUN npm install
RUN npm run build --workspace=@ceres/shared
RUN npm run build --workspace=@ceres/api

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/package.json ./services/api/

WORKDIR /app/services/api

RUN npm install --production

EXPOSE 3001

CMD ["node", "dist/index.js"]
