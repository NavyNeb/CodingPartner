# --- build the static site ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

# --- run: no npm dependencies needed, the server uses only Node built-ins (node:http, node:sqlite) ---
FROM node:22-slim
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data DIST_DIR=/app/dist TRUST_PROXY=1
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/lib/syncMerge.ts ./src/lib/syncMerge.ts
COPY package.json ./
RUN rm -rf server/test && mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.ts"]
