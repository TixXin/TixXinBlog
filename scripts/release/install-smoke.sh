#!/usr/bin/env bash
# @file install-smoke.sh
# @description 一键安装冒烟：用本次构建的镜像与本地部署包运行 install.sh --local --yes，验收站点与初始化接口，
#   再执行 tixxin backup 与同版本 tixxin update，确认幂等且数据不丢；结束后只清理本次创建的容器、卷、网络、镜像标签与目录。
#   输入镜像：SMOKE_WEB_IMAGE、SMOKE_API_IMAGE、SMOKE_MIGRATION_IMAGE、SMOKE_WORKER_IMAGE（本机已存在的标签）。
#   可选：SMOKE_PROJECT、SMOKE_HTTP_PORT（默认 18080）、SMOKE_HTTPS_PORT（默认 18443）、SMOKE_KEEP=1 保留现场。
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
  local id
  docker ps -aq --filter "label=com.docker.compose.project=$project" | while read -r id; do docker rm -f "$id" > /dev/null; done
  docker ps -aq --filter "label=tixxin.backup-export=$project" | while read -r id; do docker rm -f "$id" > /dev/null; done
  docker volume ls -q --filter "label=com.docker.compose.project=$project" | while read -r id; do docker volume rm "$id" > /dev/null; done
  docker network ls -q --filter "label=com.docker.compose.project=$project" | while read -r id; do docker network rm "$id" > /dev/null; done
  local image
  for image in ${tagged[@]+"${tagged[@]}"}; do docker rmi "$image" > /dev/null 2>&1 || true; done
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
      printf '%s' "$body" | grep -q "\"needsSetup\":$expected" || fail "setup/status 应返回 needsSetup=${expected}：$body"
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
printf '%s\n' "$headers" | grep -qi "^x-tixxin-release: $version\$" || fail '升级后版本头不符'
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
curl_site -o /dev/null -D - "$origin/api/v1/posts?pageSize=1" | tr -d '\r' | grep -qi "^x-tixxin-release: $next\$" ||
  fail '跨版本升级后版本头不符'
if "$site/deploy/tixxin" rollback "$version" --yes --no-pull > "$work/rollback.log" 2>&1; then
  fail '缺少 --database-compatible 的回退未被拒绝'
fi
"$site/deploy/tixxin" rollback "$version" --database-compatible --yes --no-pull
curl_site -o /dev/null -D - "$origin/api/v1/posts?pageSize=1" | tr -d '\r' | grep -qi "^x-tixxin-release: $version\$" ||
  fail '回退后版本头不符'
[ "$(psql_value 'select count(*) from admin_user')" = "$admins_before" ] || fail '升级与回退后管理员数量变化'
[ "$(docker volume inspect --format '{{.CreatedAt}}' "${project}_database")" = "$volume_before" ] || fail '数据库卷被重建'

log "通过：安装、拒绝覆盖、备份、同版本升级、失败升级、跨版本升级与回退（${version}）"
