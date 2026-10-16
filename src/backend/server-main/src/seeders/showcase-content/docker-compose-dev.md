四月初有个朋友想给博客贡献一个功能，我把仓库地址发给他，他花了一个晚上没跑起来。PostgreSQL 版本不对、本地的 5432 端口被别的项目占了、`.env` 里一个变量名我在上个月改过但文档没更新。最后他发了一句“要不你录个视频”，我意识到问题不在他，在我。一个项目如果需要一份三十行的“环境搭建说明”，那说明本来就不该让人手动搭。

这周末我把博客的本地开发环境整个搬进了 Docker Compose，目标只有一个：新人 clone 下来之后一条命令，三分钟内能看到页面。现在做到了，这篇记录一下怎么拆、怎么写、哪些地方折腾了比较久。

## 先决定哪些东西进容器

不是所有东西都适合进容器。我的原则是：有状态的、版本敏感的、安装麻烦的进容器；需要热更新、需要调试器、需要和编辑器配合的留在本机或者用挂载。

按这个原则拆下来：

| 服务         | 放哪           | 原因                                     |
| ------------ | -------------- | ---------------------------------------- |
| PostgreSQL   | 容器           | 版本固定、数据用卷隔离、不污染本机       |
| 本机邮件捕获 | 容器           | 只在开发时用，装在本机很多余             |
| NestJS 后端  | 容器，源码挂载 | 依赖 Node 25，不想要求每个人本机装       |
| Nuxt 前端    | 容器，源码挂载 | 同上，而且和后端同一个网络里调接口更方便 |
| pnpm store   | 命名卷         | 避免每次重建都重新下载依赖               |

前后端放进容器这一步我纠结了一下。好处是版本完全可控，坏处是 macOS 上 Docker 的文件系统性能一般，挂载源码之后热更新会慢。实测下来 Nuxt 的 HMR 从本机的大约 200 毫秒变成了 600 毫秒左右，能接受。如果有人觉得慢，`compose.yaml` 里只起数据库和邮件服务、前后端走本机也是支持的，用 profile 控制。

## compose.yaml

去掉注释后大概六十行，关键部分贴出来：

```yaml
name: tixxinblog-dev

services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: blog
      POSTGRES_PASSWORD: blog
      POSTGRES_DB: tixxin_blog
    ports:
      - '${DB_PORT:-5432}:5432'
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U blog -d tixxin_blog']
      interval: 3s
      timeout: 3s
      retries: 10

  mail:
    image: axllent/mailpit:v1.24
    ports:
      - '8025:8025'

  api:
    build:
      context: .
      dockerfile: deploy/dev.Dockerfile
    command: corepack pnpm --filter server-main dev
    env_file: src/backend/server-main/.env.docker
    environment:
      DATABASE_HOST: db
      SMTP_HOST: mail
      SMTP_PORT: 1025
    ports:
      - '3001:3001'
    volumes:
      - .:/workspace
      - pnpm-store:/root/.local/share/pnpm/store
      - /workspace/node_modules
    depends_on:
      db:
        condition: service_healthy
    profiles: [app]

  web:
    build:
      context: .
      dockerfile: deploy/dev.Dockerfile
    command: corepack pnpm --filter web-blog dev
    environment:
      NUXT_PUBLIC_API_BASE: http://api:3001
    ports:
      - '3000:3000'
    volumes:
      - .:/workspace
      - pnpm-store:/root/.local/share/pnpm/store
      - /workspace/node_modules
    depends_on:
      - api
    profiles: [app]

volumes:
  db-data:
  pnpm-store:
```

几个关键的决定：

`depends_on` 用了 `condition: service_healthy`，而不是简单的列表。没有健康检查的话，`api` 会在 PostgreSQL 还没准备好接受连接的时候就启动，然后连不上退出。加了 `pg_isready` 之后，`api` 一定等到数据库真的可用了才起。

`/workspace/node_modules` 这一行是一个匿名卷，作用是把容器里的 `node_modules` 和本机的隔开。原因是 macOS 本机如果装过依赖，里面会有 darwin 平台的二进制，挂进 Linux 容器直接报错。用匿名卷覆盖掉之后，容器里的 `node_modules` 是容器自己装的，本机的是本机的，互不干扰。

`profiles: [app]` 让前后端默认不启动。`docker compose up` 只起数据库和邮件，前后端走本机；`docker compose --profile app up` 才全部进容器。两种模式共用一份文件。

`DB_PORT` 用 `${DB_PORT:-5432}` 这种带默认值的写法，端口被占的人在 `.env` 里改一行就行，不用动 `compose.yaml`。开头朋友遇到的端口冲突就是这么解决的。

## 开发镜像

`deploy/dev.Dockerfile` 很短，只负责提供一个带 Node 和 pnpm 的环境，不复制源码，源码靠挂载：

```dockerfile
FROM node:25-alpine
RUN corepack enable
WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src/backend/server-main/package.json src/backend/server-main/
COPY src/frontend/web-blog/package.json src/frontend/web-blog/
RUN corepack pnpm install --frozen-lockfile
```

把几个 `package.json` 和 lock 文件单独 COPY 再 install，是为了利用层缓存，只要依赖没变就不会重新装。第一次构建大概两分半，之后改代码不触发重建，改依赖才会。

`corepack enable` 这一行让 `package.json` 里 `packageManager` 字段指定的 pnpm 版本自动生效，所有人用的都是 9.15.0，不会出现本机 pnpm 10 生成的 lock 和容器里不一致的情况。

## 一条命令

最后的入口是根目录 `package.json` 里的一个脚本，内部就是 `docker compose up --wait` 再跟一个迁移命令。`--wait` 会等所有带健康检查的服务都 healthy 再返回，所以迁移跑的时候数据库一定是好的。

新人的流程变成了三步：clone，复制一份 `.env.example`，跑脚本。我拿朋友的电脑试了一次，从 clone 到浏览器看到首页两分四十秒，其中两分钟在拉镜像和装依赖。

## 容器里的接口地址：SSR 和浏览器不是一回事

这一点我第一版写错了，上面的 `NUXT_PUBLIC_API_BASE: http://api:3001` 只对服务端渲染有效。Nuxt 在容器里做 SSR 的时候，`api` 这个主机名能通过 Compose 的内部网络解析到后端容器，没问题。但页面水合之后，浏览器发起的请求是从本机发出去的，本机不认识 `api` 这个名字，所有客户端请求全部失败，控制台一片红。

正确的做法是把两个地址分开：服务端用 `http://api:3001`，浏览器用 `http://localhost:3001`。Nuxt 的运行时配置可以区分 `runtimeConfig.apiBase`（只在服务端可见）和 `runtimeConfig.public.apiBase`（两端都可见），`$fetch` 的封装里按 `import.meta.server` 选一个。这样前端容器里 SSR 走内部网络，浏览器走映射出来的端口，两边都通。我在 `compose.yaml` 里给 `web` 服务加了 `NUXT_API_BASE_SERVER` 和 `NUXT_PUBLIC_API_BASE` 两个变量，默认值分别指向内部名和 localhost。

还有一个相关的细节是跨域。浏览器从 `localhost:3000` 请求 `localhost:3001`，端口不同算跨域。开发环境我没有去配 CORS，而是让 Nuxt 的 dev 服务器把 `/api` 代理到后端，浏览器看到的始终是同源。这个代理在生产环境由 Nginx 做，开发环境由 Nuxt 做，页面代码不用关心。

## 折腾比较久的几个地方

**文件监听。** 容器里的 Nuxt 一开始改代码没反应，因为 macOS 挂载进来的文件系统事件传不进 Linux。解法是给 Nuxt 和 Nest 的 dev 命令加上轮询模式，环境变量 `CHOKIDAR_USEPOLLING=1`，代价是 CPU 占用高一点。后来发现 Compose 自己的 `develop.watch` 配置可以把文件变化同步进容器，就不用轮询了，但它需要 Compose 2.22 以上，我在文档里标了版本要求。

**数据库数据。** `db-data` 卷会一直保留，`docker compose down` 不会删，`down -v` 才会。这是对的，但新人经常不知道，想重置数据库的时候只是重启了一下。我在文档里专门写了一段“怎么清库”，并且明确说清库之前先停掉所有在用它的服务。

**内存。** 三个容器加数据库在默认的 Docker Desktop 配置下偶尔被 OOM，把 Docker 的内存上限从 2GB 调到 4GB 之后没再出现过。这个也写进了文档。

**镜像里的时区。** 容器默认 UTC，后台显示的发布时间差了八小时。给所有服务加了 `TZ: Asia/Shanghai` 的环境变量，PostgreSQL 那边也顺手把 `timezone` 参数设成了同一个值，避免数据库和应用各算各的。

**镜像拉取速度。** 国内拉 Docker Hub 的镜像时快时慢，有一次 `postgres:17-alpine` 拉了十分钟。我在文档里加了一段怎么配镜像加速，并且把基础镜像的 tag 全部固定到具体版本，不用 `latest`，这样所有人拉到的东西都一样，也方便加速站缓存。

搬完之后最明显的变化不是我自己的体验，是 README 里那一段“环境准备”从三十多行变成了五行。朋友第二天重新 clone，二十分钟后发了第一个 PR。我觉得这件事值四月的一个周末。
