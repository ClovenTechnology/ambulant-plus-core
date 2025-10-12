FROM node:20-bullseye-slim

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
CMD ["node","dist/index.js","--room","testroom","--identity","CaptionBot"]
