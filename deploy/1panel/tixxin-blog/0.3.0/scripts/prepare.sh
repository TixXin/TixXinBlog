#!/bin/bash
# TixXinBlog 1Panel 应用的公共准备步骤，由 init.sh（安装前）与 upgrade.sh（升级、启动新容器前）调用。
#   - 首次生成数据库密码、签名密钥与初始化令牌，写入 data/secrets/（之后永不覆盖）；
#   - 创建持久化目录并修正媒体目录属主；
#   - 选定并记录项目内部网络子网，写回 .env 供编排插值，可信代理与该子网同源。
# 1Panel 以应用安装目录为工作目录、在宿主机上以 root 执行本脚本；也可在该目录手动执行 bash scripts/init.sh。
set -euo pipefail

APP_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$APP_DIR"

# API 镜像以 node 用户（node:alpine 的 UID/GID 1000）写入媒体目录。
MEDIA_OWNER=1000:1000
# 与 compose.production.yaml 的缺省子网一致；被占用时依次向下尝试。
SUBNET_FIRST=250
SUBNET_LAST=200

info() { printf '[TixXinBlog] %s\n' "$*"; }
fail() {
  printf '[TixXinBlog] 错误：%s\n' "$*" >&2
  exit 1
}

# 读取 .env 中的值：1Panel 写成 KEY="value"、KEY='value' 或 KEY=123，取最后一次出现并去掉外层引号。
env_value() {
  [ -f .env ] || return 0
  awk -v key="$1" '
    index($0, key "=") == 1 { value = substr($0, length(key) + 2) }
    END {
      if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) value = substr(value, 2, length(value) - 2)
      print value
    }
  ' .env
}

# 在 .env 中设置一个键：已有则替换，没有则追加；保留文件原有权限与其余内容。
set_env_value() {
  local key=$1 value=$2 temp
  temp=$(mktemp "$APP_DIR/.env.tixxin.XXXXXX")
  if [ -f .env ]; then
    awk -v key="$1" -v line="$key=\"$value\"" '
      index($0, key "=") == 1 { if (!done) print line; done = 1; next }
      { print }
      END { if (!done) print line }
    ' .env > "$temp"
  else
    printf '%s="%s"\n' "$key" "$value" > "$temp"
  fi
  cat "$temp" > .env
  rm -f "$temp"
}

random_hex() {
  local bytes=$1 value
  value=$(openssl rand -hex "$bytes" 2> /dev/null || true)
  [ -n "$value" ] || value=$(od -An -N"$bytes" -tx1 /dev/urandom | tr -d ' \n')
  printf '%s' "$value" | grep -Eq "^[0-9a-f]{$((bytes * 2))}\$" || fail '随机密钥生成失败'
  printf '%s' "$value"
}

check_site_host() {
  local host
  host=$(env_value SITE_HOST)
  [ -n "$host" ] || fail '.env 中缺少 SITE_HOST（站点域名）'
  # 只接受主机名或 IP，可带端口；不要包含 https:// 或路径。
  printf '%s' "$host" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$' ||
    fail "站点域名格式不正确：${host}（只填写域名，例如 blog.example.com，不带 https:// 与路径）"
}

prepare_directories() {
  mkdir -p data/postgres data/media data/secrets
  chmod 700 data/secrets
  if [ "$(id -u)" = 0 ]; then
    chown -R "$MEDIA_OWNER" data/media
  fi
}

# 密钥只在两份文件都不存在时生成；数据库目录已有数据而密钥缺失时拒绝继续，避免以新密码对接旧库。
prepare_secrets() {
  local app_env=data/secrets/app.env postgres_env=data/secrets/postgres.env
  if [ -f "$app_env" ] && [ -f "$postgres_env" ]; then
    info '沿用已有密钥（data/secrets/）'
    return 0
  fi
  if [ -f "$app_env" ] || [ -f "$postgres_env" ]; then
    fail "data/secrets/ 中只找到部分密钥文件，请从备份恢复 app.env 与 postgres.env 后重试"
  fi
  if [ -n "$(ls -A data/postgres 2> /dev/null)" ]; then
    fail 'data/postgres 已有数据库文件但缺少 data/secrets/，请从备份恢复密钥文件，不要重新生成'
  fi
  local password jwt token
  # 数据库密码 64 位十六进制、签名密钥 96 位、初始化令牌 48 位，与一键安装脚本一致。
  password=$(random_hex 32)
  jwt=$(random_hex 48)
  token=$(random_hex 24)
  (
    umask 077
    printf 'POSTGRES_PASSWORD=%s\n' "$password" > "$postgres_env"
    {
      printf 'DATABASE_URL=postgres://tixxin:%s@postgres:5432/tixxin_blog\n' "$password"
      printf 'JWT_ACCESS_SECRET=%s\n' "$jwt"
      printf 'SETUP_TOKEN=%s\n' "$token"
    } > "$app_env"
  )
  info '已生成数据库密码、签名密钥与初始化令牌（data/secrets/）'
}

ip_to_int() {
  local IFS=. a b c d
  read -r a b c d <<< "$1"
  printf '%s' $(((a << 24) + (b << 16) + (c << 8) + d))
}

# 两个 IPv4 CIDR 是否重叠：按较短前缀比较网络号。
cidr_overlaps() {
  local left=$1 right=$2 left_ip left_prefix right_ip right_prefix prefix mask
  left_ip=$(ip_to_int "${left%/*}")
  left_prefix=${left#*/}
  right_ip=$(ip_to_int "${right%/*}")
  right_prefix=${right#*/}
  prefix=$((left_prefix < right_prefix ? left_prefix : right_prefix))
  mask=$(((0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF))
  [ $((left_ip & mask)) = $((right_ip & mask)) ]
}

# 宿主机上已占用的 IPv4 网段：全部 Docker 网络，以及（Linux 上）路由表中的直连网段。
used_subnets() {
  local ids
  ids=$(docker network ls -q 2> /dev/null) || fail '无法访问 Docker，无法检查网络子网'
  # shellcheck disable=SC2086 # 网络 ID 需要按空白拆分为多个参数。
  [ -z "$ids" ] || docker network inspect --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}' $ids
  if command -v ip > /dev/null 2>&1; then
    ip -4 route show 2> /dev/null | awk '$1 ~ /^[0-9.]+\/[0-9]+$/ { print $1 }'
  fi
}

prepare_subnet() {
  local recorded subnet candidate used item clash index
  recorded=''
  if [ -f data/network.env ]; then
    recorded=$(awk -F= '$1 == "TIXXIN_NETWORK_SUBNET" { value = $2 } END { print value }' data/network.env)
  fi
  if [ -n "$recorded" ]; then
    subnet=$recorded
    info "沿用内部网络子网 $subnet"
  else
    used=$(used_subnets | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$' || true)
    subnet=''
    for ((index = SUBNET_FIRST; index >= SUBNET_LAST; index--)); do
      candidate=172.31.$index.0/24
      clash=0
      for item in $used; do
        if cidr_overlaps "$candidate" "$item"; then
          clash=1
          break
        fi
      done
      if [ "$clash" = 0 ]; then
        subnet=$candidate
        break
      fi
    done
    [ -n "$subnet" ] || fail "172.31.$SUBNET_LAST.0–172.31.$SUBNET_FIRST.0 之间没有未占用的 /24，请在 data/network.env 写入 TIXXIN_NETWORK_SUBNET=<空闲私网/24> 后重试"
    printf 'TIXXIN_NETWORK_SUBNET=%s\n' "$subnet" > data/network.env
    info "选定内部网络子网 ${subnet}（记录于 data/network.env）"
  fi
  # 1Panel 升级时可能按表单参数重写 .env，这里每次补回，保证编排插值与记录一致。
  set_env_value TIXXIN_NETWORK_SUBNET "$subnet"
}

print_setup_hint() {
  local host token
  host=$(env_value SITE_HOST)
  token=$(awk -F= '$1 == "SETUP_TOKEN" { print $2 }' data/secrets/app.env)
  info '在 1Panel「网站」中为该域名创建反向代理到 http://127.0.0.1:'"$(env_value PANEL_APP_PORT_HTTP)"' 并启用 HTTPS 后，'
  info '打开下面的初始化链接创建博主账号（令牌也保存在应用目录 data/secrets/app.env 的 SETUP_TOKEN）：'
  info "  https://$host/setup?token=$token"
}
