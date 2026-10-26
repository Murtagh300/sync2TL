# BlackVault server: Node 24 runs the TypeScript sources directly (type stripping)
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/blackvault.db \
    FLAGS_FILE=/config/flags.json
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY flags.json /config/flags.json
# no root at run time; the database lives on a volume
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8787/config > /dev/null || exit 1
CMD ["node", "src/main.ts"]
