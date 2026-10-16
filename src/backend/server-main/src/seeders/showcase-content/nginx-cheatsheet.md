我的服务器上 Nginx 配置文件已经改过不知道多少遍了，每次改都是现查：反向代理的头怎么传、HTTPS 的参数怎么写、SPA 的路由为什么 404。查完下次又忘。这次趁着把博客迁到新服务器，把这些年真正用到的配置整理成一份速查，放在这里，以后改配置直接来翻。顺便把踩过的坑也记下来，每一条都是真的花过时间的。

环境：Ubuntu 24.04，Nginx 1.26，证书用 certbot 签的 Let's Encrypt。配置文件按站点拆在 `/etc/nginx/sites-available/` 下，软链到 `sites-enabled/`。

顺便回答一个常被问到的问题：为什么不用 Caddy。我试过，自动证书确实省心，但我的服务器上除了博客还跑着几个老项目，它们的配置都是 Nginx 的，迁移的收益抵不过风险。而且 Nginx 的问题网上基本都能搜到答案，出了事排查起来心里有底。等哪天把老项目都下线了再考虑。

## 反向代理：博客的后端

最常用的场景，把 `/api/` 转发给跑在 3000 端口的 NestJS：

```nginx
upstream blog_api {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 443 ssl;
    http2 on;
    server_name blog.example.com;

    location /api/ {
        proxy_pass http://blog_api;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 20m;
    }
}
```

几个坑：

- **`proxy_pass` 结尾有没有斜杠意义完全不同。** `proxy_pass http://blog_api;` 会把 `/api/posts` 原样转发；`proxy_pass http://blog_api/;` 会把 location 匹配的 `/api/` 去掉，转发 `/posts`。我的后端路由本身带 `/api` 前缀，所以不加斜杠。改这个之前先想清楚后端期望的路径是什么。
- **`keepalive` 要配合 `proxy_http_version 1.1` 和清空 `Connection` 头。** 不然每个请求都新建到后端的 TCP 连接，高峰期会看到大量 TIME_WAIT。
- **`client_max_body_size` 默认只有 1MB。** 后台传图片报 413，十有八九是这个。
- **`X-Forwarded-For` 后端要信任。** NestJS 里要开 `trust proxy`，不然拿到的访客 IP 永远是 127.0.0.1，限流就全打在一个 IP 上了。

## HTTPS：证书和重定向

HTTP 全部跳到 HTTPS，证书由 certbot 自动续：

```nginx
server {
    listen 80;
    server_name blog.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    http2 on;
    server_name blog.example.com;

    ssl_certificate     /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

- **`listen 443 ssl http2` 这种写法在 1.25.1 之后废弃了**，要拆成 `listen 443 ssl;` 和 `http2 on;` 两行。旧写法还能用但会打 warning。
- **acme-challenge 那个 location 必须在 301 之前且能走 HTTP**，否则续期的时候 certbot 访问不到验证文件。
- **HSTS 加之前想清楚**。一旦浏览器记住了 `max-age`，这一年内这个域名就不能再走 HTTP 了，连子域名一起。本地调试的时候我吃过亏。
- **`add_header` 的继承规则很反直觉**：子 location 里只要写了任何一个 `add_header`，父级的全部失效。所以安全头我统一放在一个单独的文件里，用 `include` 在每个需要的 location 里引一次。

## gzip 和 brotli

```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_comp_level 5;
gzip_types
    text/plain text/css text/javascript application/javascript
    application/json application/xml image/svg+xml font/woff2;
```

- `gzip_types` 默认只有 `text/html`，JS 和 CSS 都要手动列。
- `gzip_comp_level` 5 是性价比的拐点，再高 CPU 翻倍、体积只小一两个百分点。
- `font/woff2` 其实不用压，它本身就是压缩过的，列上也没坏处。
- brotli 需要额外编译模块，Ubuntu 的仓库版本没带。我的做法是构建时用 Nuxt 预生成 `.br` 文件，然后用 `gzip_static on` 的兄弟 `brotli_static on`——这个也需要模块。最后放弃了，gzip 够用，博客的首屏 JS 压完 90KB 左右，brotli 再省十几 KB 意义不大。

## 静态资源缓存

Nuxt 构建产物的文件名带 hash，可以放心缓存一年；HTML 不缓存：

```nginx
location /_nuxt/ {
    root /var/www/blog/.output/public;
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

location ~* \.(ico|png|jpg|jpeg|webp|avif|svg|woff2)$ {
    root /var/www/blog/.output/public;
    expires 30d;
    add_header Cache-Control "public";
}

location = /index.html {
    add_header Cache-Control "no-cache";
}
```

- `immutable` 是关键，它告诉浏览器“在有效期内连条件请求都不用发”。没有它，用户每次刷新还是会发一堆 304。
- 带 hash 的文件缓存一年没问题，但图片这种文件名不变的只敢给 30 天，改了图片还得等缓存过期或者改文件名。
- `expires` 和 `add_header Cache-Control` 同时写时，`expires` 生成的 `max-age` 会被后面的 `add_header` 追加而不是替换，响应头里会出现两个 Cache-Control。用其中一个就行，我现在只用 `add_header`。

## SPA 路由与 SSR 回退

博客是 SSR 的，但后台 `/admin` 那部分是纯客户端渲染的。两种模式的配置不一样。

纯 SPA 的经典写法：

```nginx
location /admin/ {
    root /var/www/blog/dist;
    try_files $uri $uri/ /admin/index.html;
}
```

`try_files` 依次尝试：真实文件、目录、最后回退到 `index.html` 交给前端路由。刷新 `/admin/posts/3` 不再 404。

SSR 的站点则是把所有非静态请求转给 Node 进程：

```nginx
location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

踩过的坑是 `root` 和 `alias` 的区别。`location /admin/ { root /var/www/dist; }` 会去找 `/var/www/dist/admin/xxx`，而 `alias /var/www/dist/;` 会把 `/admin/` 替换掉，找 `/var/www/dist/xxx`。构建产物的目录结构决定用哪个，我因为这个 404 过不止一次。

## location 匹配顺序

配置多了之后，最常见的“为什么这条规则不生效”几乎都是 location 匹配顺序的问题。规则是这样的：先看精确匹配 `=`，命中就直接用；然后看前缀匹配，找出最长的那个，如果它带 `^~` 就直接用；否则再按配置文件里的顺序逐个试正则 `~` 和 `~*`，第一个命中的生效；正则全都不中，才回到刚才那个最长前缀。

这意味着两件事。第一，正则 location 的优先级高于普通前缀，所以上面那条匹配图片后缀的正则会抢走 `/_nuxt/` 下面的图片请求，导致它们只缓存 30 天而不是一年。解决办法是给 `/_nuxt/` 加上 `^~`，让它不再往下试正则。第二，正则之间按书写顺序生效，调整顺序就可能改变行为，所以我的习惯是正则 location 尽量少，能用前缀解决的都用前缀。

## 排查 502 和 504

博客上线后出过几次 502，每次原因都不一样，整理一下排查顺序：

1. 先看 Nginx 的错误日志 `/var/log/nginx/error.log`，里面会写清楚是连不上上游（connect() failed）还是上游关了连接（upstream prematurely closed）。前者通常是后端进程没起来或者端口写错，后者多半是后端崩了或者超时。
2. 如果是 504，看 `proxy_read_timeout`。博客的内容包导入接口要跑十几秒，默认 60 秒够用，但有一次数据量大跑了两分钟，就被 Nginx 掐了。单独给那个 location 放宽到 300 秒，不要全局改。
3. 后端是 Node 的话，检查它监听的是 `127.0.0.1` 还是 `0.0.0.0`。Docker 里跑的后端如果只监听回环地址，宿主机上的 Nginx 是连不上的。
4. 还有一次是磁盘满了，Nginx 写不了临时文件，返回的也是 502。`df -h` 看一眼，日志没有轮转把盘撑满了。

另外 `$host` 和 `$http_host` 的区别也坑过我一次：前者取的是 `server_name` 匹配后的值、不带端口，后者原样取请求头。后端生成绝对链接的时候如果用了带端口的开发地址，传 `$http_host` 才对。

## 日志、限流和几条杂项

**日志加上耗时**。默认的日志格式没有响应时间，排查慢请求时抓瞎。自定义一个格式：

```nginx
log_format timed '$remote_addr - [$time_local] "$request" $status '
                 '$body_bytes_sent "$http_referer" rt=$request_time '
                 'ut=$upstream_response_time';
access_log /var/log/nginx/blog.access.log timed;
```

`rt` 是 Nginx 看到的总耗时，`ut` 是后端的耗时，两个一减就知道时间花在哪了。

**简单限流**。对留言和登录接口按 IP 限一下，挡掉大部分脚本：

```nginx
limit_req_zone $binary_remote_addr zone=api_write:10m rate=5r/s;

location /api/guestbook {
    limit_req zone=api_write burst=10 nodelay;
    proxy_pass http://blog_api;
}
```

**改完必跑**：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` 只检查语法，不检查逻辑，`proxy_pass` 写错端口它不会告诉你。`reload` 是平滑重载，不会断连接；`restart` 会。

**配置被覆盖找不到原因**的时候，`nginx -T` 会把所有生效的配置（包括 include 进来的）打印出来，比一个个文件翻快多了。

**几个默认值要记住**：`client_max_body_size 1m`、`proxy_read_timeout 60s`、`keepalive_timeout 75s`、`server_tokens on`（会在响应头暴露版本号，建议关掉）。

这份速查我会持续更新。配置这东西没什么深奥的，就是坑多，踩一个记一个。
