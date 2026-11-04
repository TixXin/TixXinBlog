#!/usr/bin/env bash
# @file install-smoke.sh
# @description 一键安装冒烟：用本次构建的镜像与本地部署包运行 install.sh --local --yes，验收站点与初始化接口，
#   再执行 tixxin backup 与同版本 tixxin update，确认幂等且数据不丢；Linux 上另跑一轮 install.sh --behind-proxy，
#   以 Nginx 模拟面板（443、自签证书、原样引用生成的配置片段）验收外部反向代理模式。
#   结束后只清理本次创建的容器、卷、网络、镜像标签与目录。
#   输入镜像：SMOKE_WEB_IMAGE、SMOKE_API_IMAGE、SMOKE_MIGRATION_IMAGE、SMOKE_WORKER_IMAGE（本机已存在的标签）。
#   可选：SMOKE_PROJECT、SMOKE_HTTP_PORT（默认 18080）、SMOKE_HTTPS_PORT（默认 18443）、SMOKE_KEEP=1 保留现场；
#   SMOKE_PROXY_BIND=127.0.0.1:<端口> 让代理模式一轮改用指定端口（默认测试自动选择，从 3456 起）。
set -euo pipefail

root=$(cd "$(dirname "$0")/../.." && pwd -P)
: "${SMOKE_WEB_IMAGE:?请指定 SMOKE_WEB_IMAGE}"
: "${SMOKE_API_IMAGE:?请指定 SMOKE_API_IMAGE}"
: "${SMOKE_MIGRATION_IMAGE:?请指定 SMOKE_MIGRATION_IMAGE}"
: "${SMOKE_WORKER_IMAGE:?请指定 SMOKE_WORKER_IMAGE}"
project=${SMOKE_PROJECT:-tixxin-install-smoke-$$}
http_port=${SMOKE_HTTP_PORT:-18080}
https_port=${SMOKE_HTTPS_PORT:-18443}
prefix="tixxin-install-smoke/$project"
version="$(sed -n 's/^  "version": "\(.*\)",$/\1/p' "$root/package.json" | head -n 1)-smoke"
work=$(mktemp -d)
site=$work/site
origin=https://localhost:$https_port
tagged=()
proxy_project=$project-proxy
proxy_site=$work/proxy-site
proxy_domain=proxy-smoke.localhost
proxy_nginx=$project-nginx

# 正式模式（含 --behind-proxy）需要 root：CI 使用免密 sudo，容器内已是 root 时直接执行。
as_root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -n "$@"; fi; }

log() { printf '\n[install-smoke] %s\n' "$*"; }
fail() {
  printf '[install-smoke] 失败：%s\n' "$*" >&2
  exit 1
}

# 只清理带本次项目标签的资源与本脚本打的镜像标签；从不使用 down -v。
cleanup() {
  local code=$?
  if [ "${SMOKE_KEEP:-0}" = 1 ]; then
    log "保留现场：项目 ${project}，目录 $work"
    return "$code"
  fi
  if [ "$code" != 0 ] && [ -f "$site/.env" ]; then
    (cd "$site" && docker compose --profile worker --profile maintenance ps -a) || true
    (cd "$site" && docker compose --profile worker --profile maintenance logs --tail 80) || true
  fi
  if [ "$code" != 0 ] && [ -f "$proxy_site/.env" ]; then
    (cd "$proxy_site" && as_root docker compose --profile worker --profile maintenance logs --tail 80) || true
    docker logs --tail 40 "$proxy_nginx" 2> /dev/null || true
  fi
  local id name
  docker rm -f "$proxy_nginx" > /dev/null 2>&1 || true
  for name in "$project" "$proxy_project"; do
    docker ps -aq --filter "label=com.docker.compose.project=$name" | while read -r id; do docker rm -f "$id" > /dev/null; done
    docker ps -aq --filter "label=tixxin.backup-export=$name" | while read -r id; do docker rm -f "$id" > /dev/null; done
    docker volume ls -q --filter "label=com.docker.compose.project=$name" | while read -r id; do docker volume rm "$id" > /dev/null; done
    docker network ls -q --filter "label=com.docker.compose.project=$name" | while read -r id; do docker network rm "$id" > /dev/null; done
  done
  local image
  for image in ${tagged[@]+"${tagged[@]}"}; do docker rmi "$image" > /dev/null 2>&1 || true; done
  # 代理模式一轮以 root 写入安装目录。
  if [ -d "$proxy_site" ]; then as_root rm -rf "$proxy_site" || true; fi
  rm -rf "$work"
  return "$code"
}
trap cleanup EXIT

curl_site() { curl --cacert "$site/local-ca.crt" -sS --proto '=https' --max-time 15 "$@"; }

psql_value() {
  (cd "$site" && docker compose exec -T postgres psql -U tixxin -d tixxin_blog -tAc "$1") | tr -d '[:space:]'
}

# 初始化向导状态必须可读，且 needsSetup 与预期一致；404 或其他状态直接判为失败。
check_setup_status() {
  local expected=$1 response status body
  response=$(curl_site -w '\n%{http_code}' "$origin/api/v1/setup/status")
  status=$(printf '%s' "$response" | tail -n 1)
  body=$(printf '%s' "$response" | sed '$d')
  case $status in
    200)
      grep -q "\"needsSetup\":$expected" <<< "$body" || fail "setup/status 应返回 needsSetup=${expected}：$body"
      log "setup/status needsSetup=$expected"
      ;;
    *) fail "setup/status 返回 $status" ;;
  esac
}

log "标记本次镜像为 $prefix-*:$version"
for pair in "web:$SMOKE_WEB_IMAGE" "api:$SMOKE_API_IMAGE" "migration:$SMOKE_MIGRATION_IMAGE" "worker:$SMOKE_WORKER_IMAGE"; do
  docker tag "${pair#*:}" "$prefix-${pair%%:*}:$version"
  tagged+=("$prefix-${pair%%:*}:$version")
done
grep -E '^(POSTGRES_IMAGE|CADDY_IMAGE)=' "$root/deploy/production.env.example" | cut -d= -f2- | while read -r image; do
  docker image inspect "$image" > /dev/null 2>&1 || docker pull --quiet "$image" > /dev/null
done

log '生成本地部署包'
bash "$root/scripts/release/package-deploy.sh" --version "$version" --repository TixXin/TixXinBlog \
  --image-prefix "$prefix" --output "$work/download/v$version"

install_args=(--local --yes --dir "$site" --version "$version" --download-base "file://$work/download"
  --no-pull --project "$project" --http-port "$http_port" --https-port "$https_port"
  --subnet "${SMOKE_SUBNET:-172.31.247.0/24}")

log '首次安装：install.sh --local --yes'
bash "$work/download/v$version/install.sh" "${install_args[@]}" | tee "$work/install.log"

[ "$(stat -c %a "$site/.env" 2> /dev/null || stat -f %Lp "$site/.env")" = 600 ] || fail '.env 权限不是 600'
grep -Eq '^POSTGRES_PASSWORD=[0-9a-f]{64}$' "$site/.env" || fail '数据库密码格式不符'
grep -Eq '^JWT_ACCESS_SECRET=[0-9a-f]{96}$' "$site/.env" || fail '签名密钥格式不符'
grep -Eq '^SETUP_TOKEN=[0-9a-f]{48}$' "$site/.env" || fail '初始化令牌格式不符'
grep -qx "TIXXIN_NETWORK_SUBNET=${SMOKE_SUBNET:-172.31.247.0/24}" "$site/.env" || fail '内部子网未写入 .env'

[ "$(curl_site -o /dev/null -w '%{http_code}' "$origin/")" = 200 ] || fail '首页未返回 200'
[ "$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:$http_port/")" = 302 ] || fail 'HTTP 未跳转到 HTTPS'
check_setup_status true

log '已有安装必须拒绝覆盖'
if bash "$work/download/v$version/install.sh" "${install_args[@]}" > "$work/reinstall.log" 2>&1; then
  fail '重复安装未被拒绝'
fi
grep -q 'tixxin update' "$work/reinstall.log" || fail '拒绝覆盖时未提示 tixxin update'

log '用打印出的令牌走浏览器初始化向导接口'
setup_token=$(sed -n 's/^SETUP_TOKEN=//p' "$site/.env")
grep -Fq "$origin/setup?token=$setup_token" "$work/install.log" || fail '安装输出未包含初始化链接'
smoke_password=$(openssl rand -hex 16)
setup_body=$(printf '{"token":"%s","username":"smoke-owner","password":"%s","siteName":"Smoke Blog","locale":"zh-CN"}' \
  "$setup_token" "$smoke_password")
setup_status=$(curl_site -o "$work/setup.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Origin: $origin" --data "$setup_body" "$origin/api/v1/setup")
[ "$setup_status" = 201 ] || fail "初始化向导提交返回 ${setup_status}：$(cat "$work/setup.json")"
check_setup_status false
reuse_status=$(curl_site -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Origin: $origin" --data "$setup_body" "$origin/api/v1/setup")
[ "$reuse_status" = 404 ] || fail "初始化完成后再次提交应返回 404，实际 $reuse_status"
login_status=$(curl_site -o "$work/login.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Origin: $origin" --data "$(printf '{"username":"smoke-owner","password":"%s"}' "$smoke_password")" \
  "$origin/api/v1/auth/login")
[ "$login_status" = 200 ] || fail "新账号登录返回 ${login_status}：$(cat "$work/login.json")"
log '向导初始化与新账号登录通过'
admins_before=$(psql_value 'select count(*) from admin_user')
migrations_before=$(psql_value 'select count(*) from mikro_orm_migrations')
volume_before=$(docker volume inspect --format '{{.CreatedAt}}' "${project}_database")
[ "$admins_before" = 1 ] || fail "管理员数量应为 1，实际 $admins_before"

log 'tixxin status'
"$site/deploy/tixxin" status

log 'tixxin backup'
"$site/deploy/tixxin" backup --no-pull
backup=$(find "$site/backups" -mindepth 1 -maxdepth 1 -type d -name 'backup-manual-*' | head -n 1)
[ -n "$backup" ] && [ -f "$backup/manifest.json" ] && [ -f "$backup/database.dump" ] || fail '备份目录不完整'
grep -q '"format": "tixxin-full-backup"' "$backup/manifest.json" || fail '备份清单格式不符'

log '同版本 tixxin update（幂等）'
next_subnet=${SMOKE_NEXT_SUBNET:-172.31.248.0/24}
"$site/deploy/tixxin" update "$version" --yes --no-pull --subnet "$next_subnet"
grep -qx "TIXXIN_NETWORK_SUBNET=$next_subnet" "$site/.env" || fail '升级未写入新的内部子网'
[ "$(find "$site/backups" -mindepth 1 -maxdepth 1 -type d -name 'backup-manual-*' | wc -l | tr -d ' ')" -ge 2 ] ||
  fail '升级前未生成新备份'
[ "$(psql_value 'select count(*) from admin_user')" = "$admins_before" ] || fail '升级后管理员数量变化'
[ "$(psql_value 'select count(*) from mikro_orm_migrations')" = "$migrations_before" ] || fail '同版本升级产生了新迁移记录'
[ "$(docker volume inspect --format '{{.CreatedAt}}' "${project}_database")" = "$volume_before" ] || fail '数据库卷被重建'
headers=$(curl_site -o /dev/null -D - "$origin/api/v1/posts?pageSize=1" | tr -d '\r')
grep -qi "^x-tixxin-release: $version\$" <<< "$headers" || fail '升级后版本头不符'
check_setup_status false
"$site/deploy/tixxin" status

log '缺少镜像的升级必须失败且不改动站点'
broken=$version-missing-images
bash "$root/scripts/release/package-deploy.sh" --version "$broken" --repository TixXin/TixXinBlog \
  --image-prefix "$prefix" --output "$work/download/v$broken" > /dev/null
if "$site/deploy/tixxin" update "$broken" --yes --no-pull --skip-backup > "$work/broken.log" 2>&1; then
  fail '缺少镜像的升级未失败'
fi
grep -q '未被修改' "$work/broken.log" || fail '失败提示未说明站点未被修改'
[ ! -e "$site/.tixxin.lock" ] || fail '失败后未释放操作锁'
grep -qx "RELEASE_VERSION=$version" "$site/.env" || fail '失败的升级改动了 .env 版本'

log '跨版本升级与应用回退'
next=$version-next
for name in web api migration worker; do
  docker tag "$prefix-$name:$version" "$prefix-$name:$next"
  tagged+=("$prefix-$name:$next")
done
bash "$root/scripts/release/package-deploy.sh" --version "$next" --repository TixXin/TixXinBlog \
  --image-prefix "$prefix" --output "$work/download/v$next" > /dev/null
"$site/deploy/tixxin" update "$next" --yes --no-pull
# 先取完整响应头再匹配：grep -q 提前退出会让 tr 收到 SIGPIPE，pipefail 下把命中判为失败。
headers=$(curl_site -o /dev/null -D - "$origin/api/v1/posts?pageSize=1" | tr -d '\r')
grep -qi "^x-tixxin-release: $next\$" <<< "$headers" || fail '跨版本升级后版本头不符'
if "$site/deploy/tixxin" rollback "$version" --yes --no-pull > "$work/rollback.log" 2>&1; then
  fail '缺少 --database-compatible 的回退未被拒绝'
fi
"$site/deploy/tixxin" rollback "$version" --database-compatible --yes --no-pull
headers=$(curl_site -o /dev/null -D - "$origin/api/v1/posts?pageSize=1" | tr -d '\r')
grep -qi "^x-tixxin-release: $version\$" <<< "$headers" || fail '回退后版本头不符'
[ "$(psql_value 'select count(*) from admin_user')" = "$admins_before" ] || fail '升级与回退后管理员数量变化'
[ "$(docker volume inspect --format '{{.CreatedAt}}' "${project}_database")" = "$volume_before" ] || fail '数据库卷被重建'

log "通过：安装、拒绝覆盖、备份、同版本升级、失败升级、跨版本升级与回退（${version}）"

# ---------- 外部反向代理模式 ----------

if [ "$(uname -s)" != Linux ]; then
  log '跳过外部反向代理模式：正式安装只支持 Linux'
  exit 0
fi

log '外部反向代理模式安装：install.sh --behind-proxy --yes'
as_root bash "$work/download/v$version/install.sh" --behind-proxy --yes --domain "$proxy_domain" --dir "$proxy_site" \
  --version "$version" --download-base "file://$work/download" --no-pull --project "$proxy_project" \
  --subnet "${SMOKE_PROXY_SUBNET:-172.31.249.0/24}" ${SMOKE_PROXY_BIND:+--bind "$SMOKE_PROXY_BIND"} | tee "$work/proxy-install.log"
proxy_env() { as_root sed -n "s/^$1=//p" "$proxy_site/.env"; }
[ "$(proxy_env TIXXIN_MODE)" = proxy ] || fail '代理模式未写入 TIXXIN_MODE=proxy'
proxy_port=$(proxy_env PROXY_PORT)
case $proxy_port in '' | *[!0-9]*) fail "代理模式端口不合法：$proxy_port" ;; esac
[ -z "$(docker ps -q --filter "label=com.docker.compose.project=$proxy_project" --filter label=com.docker.compose.service=edge)" ] ||
  fail '代理模式不应启动自带 Caddy'
published=$(docker port "$proxy_project-frontend-1" 3000/tcp)
[ "$published" = "127.0.0.1:$proxy_port" ] || fail "前端应只发布到 127.0.0.1:${proxy_port}，实际 $published"
headers=$(curl -sS --max-time 15 -o /dev/null -D - -H "Host: $proxy_domain" -H 'X-Forwarded-Proto: https' \
  "http://127.0.0.1:$proxy_port/api/v1/posts?pageSize=1" | tr -d '\r')
grep -qi "^x-tixxin-release: $version\$" <<< "$headers" || fail '代理模式本机入口版本头不符'
grep -q '公开入口：暂未通过' "$work/proxy-install.log" || fail '外层代理未配置时应报告公开入口暂未通过'
as_root test -f "$proxy_site/proxy/nginx.conf.example" || fail '未生成反代配置片段'

log '以 Nginx 模拟面板：443、自签证书、原样引用生成的配置片段'
mkdir -p "$work/nginx/conf"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=$proxy_domain" -addext "subjectAltName=DNS:$proxy_domain" \
  -keyout "$work/nginx/key.pem" -out "$work/nginx/cert.pem" 2> /dev/null
as_root cat "$proxy_site/proxy/nginx.conf.example" > "$work/nginx/snippet.conf"
cat > "$work/nginx/conf/default.conf" << EOF
server {
  listen 443 ssl;
  server_name $proxy_domain;
  ssl_certificate /work/cert.pem;
  ssl_certificate_key /work/key.pem;
  include /work/snippet.conf;
}
EOF
docker run -d --name "$proxy_nginx" --network host -v "$work/nginx/conf:/etc/nginx/conf.d:ro" -v "$work/nginx:/work:ro" \
  nginx:alpine > /dev/null
proxy_origin=https://$proxy_domain
proxy_curl() { curl --cacert "$work/nginx/cert.pem" -sS --proto '=https' --max-time 15 "$@"; }
proxy_status() { as_root env CURL_CA_BUNDLE="$work/nginx/cert.pem" TIXXIN_NO_UPDATE_CHECK=1 "$proxy_site/deploy/tixxin" status 2>&1; }
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  [ "$(proxy_curl -o /dev/null -w '%{http_code}' "$proxy_origin/" 2> /dev/null)" = 200 ] && break
  [ "$attempt" = 10 ] && fail 'Nginx 模拟面板未就绪'
  sleep 1
done
proxy_status | tee "$work/proxy-status.log"
grep -q '公开入口：通过' "$work/proxy-status.log" || fail '配置片段生效后公开入口应通过'

log '经外层代理初始化、登录与刷新凭据'
proxy_token=$(proxy_env SETUP_TOKEN)
proxy_body=$(printf '{"token":"%s","username":"proxy-owner","password":"%s","siteName":"Proxy Smoke","locale":"zh-CN"}' \
  "$proxy_token" "$smoke_password")
[ "$(proxy_curl -o "$work/proxy-setup.json" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Origin: $proxy_origin" --data "$proxy_body" "$proxy_origin/api/v1/setup")" = 201 ] ||
  fail "经外层代理初始化失败：$(cat "$work/proxy-setup.json")"
[ "$(proxy_curl -c "$work/proxy-jar" -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -H "Origin: $proxy_origin" --data "$(printf '{"username":"proxy-owner","password":"%s"}' "$smoke_password")" \
  "$proxy_origin/api/v1/auth/login")" = 200 ] || fail '经外层代理登录失败'
grep -q '^#HttpOnly_[^[:space:]]*[[:space:]]FALSE[[:space:]]/api/v1/auth[[:space:]]TRUE[[:space:]]' "$work/proxy-jar" ||
  fail '刷新凭据应为 HttpOnly、Secure 且限定 /api/v1/auth'
[ "$(proxy_curl -b "$work/proxy-jar" -o /dev/null -w '%{http_code}' -X POST -H "Origin: $proxy_origin" \
  "$proxy_origin/api/v1/auth/refresh")" = 200 ] || fail '经外层代理刷新凭据失败'

log '访客地址取外层代理写入的最后一跳，伪造的前缀被丢弃'
proxy_curl -A "proxy-smoke-$$" -H 'X-Forwarded-For: 198.51.100.7' -o /dev/null "$proxy_origin/api/v1/posts?pageSize=1"
sleep 1
forwarded=$(cd "$proxy_site" && as_root docker compose logs --since 2m backend 2> /dev/null | grep "proxy-smoke-$$" |
  grep -o '"x-forwarded-for":"[^"]*"' | tail -n 1)
[ "$forwarded" = '"x-forwarded-for":"127.0.0.1"' ] || fail "后端收到的访客地址应为 127.0.0.1，实际 ${forwarded:-无}"

log '外层代理漏设 X-Forwarded-Proto 时 status 提示写操作 403'
sed '/X-Forwarded-Proto/d' "$work/nginx/snippet.conf" > "$work/nginx/snippet.tmp" && mv "$work/nginx/snippet.tmp" "$work/nginx/snippet.conf"
docker exec "$proxy_nginx" nginx -s reload > /dev/null
sleep 1
proxy_status > "$work/proxy-status-403.log" || true
grep -q '写操作被拒绝（403）' "$work/proxy-status-403.log" || fail "漏设协议头时应提示 403：$(cat "$work/proxy-status-403.log")"

log '代理模式拒绝回退到不支持该模式的版本'
legacy=$version-legacy
as_root cp -R "$proxy_site/releases/$version" "$proxy_site/releases/$legacy"
as_root rm "$proxy_site/releases/$legacy/deploy/compose.proxy.yaml"
if as_root "$proxy_site/deploy/tixxin" rollback "$legacy" --database-compatible --yes --no-pull --skip-backup \
  > "$work/proxy-rollback.log" 2>&1; then
  fail '回退到不支持代理模式的版本未被拒绝'
fi
grep -q '不支持外部反向代理模式' "$work/proxy-rollback.log" || fail '拒绝回退时未说明原因'
[ "$(proxy_env RELEASE_VERSION)" = "$version" ] || fail '被拒绝的回退改动了 .env 版本'

log "通过：外部反向代理模式安装、公开入口、初始化与登录、访客地址、403 提示与回退保护（${version}）"
