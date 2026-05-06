FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY packages/shared ./packages/shared
COPY services/oracle-feeder ./services/oracle-feeder

RUN npm install
RUN npm run build --workspace=@ceres/shared
RUN npm run build --workspace=@ceres/oracle-feeder

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/services/oracle-feeder/dist ./services/oracle-feeder/dist
COPY --from=builder /app/services/oracle-feeder/package.json ./services/oracle-feeder/

WORKDIR /app/services/oracle-feeder

RUN npm install --production

CMD ["node", "dist/index.js"]
