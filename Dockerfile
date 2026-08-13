FROM node:22-alpine AS dependencies

WORKDIR /app

RUN npm install --global npm@11.6.2

COPY package.json package-lock.json ./
RUN npm ci


FROM dependencies AS build

COPY nest-cli.json tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build


FROM dependencies AS production-dependencies

RUN npm prune --omit=dev && npm cache clean --force


FROM dependencies AS migration

ENV NODE_ENV=production

COPY prisma.config.ts ./
COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]


FROM node:22-alpine AS production

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --from=build /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/src/main.js"]
