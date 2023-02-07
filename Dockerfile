# build
FROM node:19

RUN mkdir -p /grafana-to-github
WORKDIR /grafana-to-github

COPY package.json ./
COPY tsconfig.json ./
COPY src ./src

RUN yarn install
RUN yarn build

# image
FROM node:19

RUN mkdir -p /grafana-to-github
WORKDIR /grafana-to-github

COPY package.json ./
RUN yarn install --production
COPY --from=0 /grafana-to-github/build ./build

CMD ["node", "build/index.js"]
