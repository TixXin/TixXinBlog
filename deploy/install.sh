#!/usr/bin/env bash
# @file install.sh
# @description TixXinBlog 一条命令安装：预检 → 询问域名与语言 → 下载并校验 Release 部署包 → 生成密钥与 .env →
#   拉取镜像 → 启动数据库 → 迁移 → 启动全部服务 → HTTPS 验收，最后打印初始化链接。
#   宿主机只需要 bash、curl、tar 与 Docker；不克隆仓库、不需要 Node，不收集或上报任何信息。
#   已有安装拒绝覆盖；失败保留现场，任何情况下都不执行 down -v。
set -euo pipefail

# 由 Release 工作流在打包时替换为本次发布的固定版本与仓库；未替换时按 GitHub latest 解析。
DEFAULT_VERSION='__TIXXIN_RELEASE_VERSION__'
DEFAULT_REPOSITORY='__TIXXIN_REPOSITORY__'

readonly VERSION_PATTERN='^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$'
readonly DEFAULT_DIR='/opt/tixxin-blog'
readonly DEFAULT_PROJECT='tixxin-production'

ASSUME_YES=0
LOCAL_MODE=0
NO_PULL=0
INSTALL_DOCKER=0
DOMAIN=''
LOCALE=''
INSTALL_DIR=''
VERSION=''
REGISTRY=''
DOWNLOAD_BASE=''
PROJECT=''
SUBNET=''
PUBLIC_IP_URL=''
HTTP_PORT=''
HTTPS_PORT=''
REPOSITORY=''
WORK_DIR=''
DIR_CREATED=0
LOG_FILE=''

info() { printf '%s\n' "$*"; }

# 经 sudo 安装时 .env 归 root（600），之后的管理命令同样需要 sudo
admin_prefix() {
  if [ "$(id -u)" = 0 ] && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then printf 'sudo '; fi
}

# 本机试用以普通用户运行时默认装到家目录，/opt 通常不可写
default_dir() {
  if [ "$LOCAL_MODE" = 1 ] && [ "$(id -u)" != 0 ] && [ -n "${HOME:-}" ]; then printf '%s' "$HOME/tixxin-blog"; else printf '%s' "$DEFAULT_DIR"; fi
}
step() { printf '\n==> %s\n' "$*"; }
warn() { printf '警告：%s\n' "$*" >&2; }
fail() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

usage() {
  cat << EOF
用法：install.sh [选项]

正式安装（Linux 服务器，需 root 或 sudo，域名已解析到本机，80/443 端口空闲）：
  curl -fsSL https://github.com/TixXin/TixXinBlog/releases/latest/download/install.sh -o install.sh
  sudo bash install.sh

本机试用（https://localhost:<端口>，Caddy 内部证书，无需域名）：
  bash install.sh --local

选项：
  --yes                 非交互：不询问，使用参数与默认值（正式安装须同时给出 --domain）
  --domain 域名         站点域名，例如 blog.example.com
  --locale zh-CN|en     站点默认语言（默认 zh-CN）
  --dir 目录            安装目录（默认 ${DEFAULT_DIR}；普通用户 --local 时默认 ~/tixxin-blog）
  --version 版本        安装的固定版本（默认：本脚本所属的发布版本）
  --registry 前缀       替换镜像前缀 ghcr.io/<所有者>/<仓库>，例如 registry.example.com/tixxin/tixxinblog
  --download-base 地址  替换部署包下载源（https:// 或 file://），文件位于 <地址>/v<版本>/
  --local               本机试用模式
  --http-port 端口      宿主机 HTTP 端口（正式默认 80，本机试用默认 8080）
  --https-port 端口     宿主机 HTTPS 端口（正式默认 443，本机试用默认 8443）
  --project 名称        Compose 项目名（默认 ${DEFAULT_PROJECT}，决定数据卷名称，安装后不可更改）
  --subnet CIDR         Compose 内部网络子网（私有地址段，如 172.31.250.0/24）；同机运行多套站点时各用一段
  --check-public-ip URL 额外访问该 https 地址获取本机出口 IP 用于核对域名解析（默认关闭；会把本机 IP 暴露给该服务）
  --no-pull             使用本机已有镜像，不拉取（离线或自建镜像）
  --install-docker      未安装 Docker 时直接运行 Docker 官方安装脚本（不再询问）
  -h, --help            显示本帮助
EOF
}

# ---------- 参数 ----------

need_value() { [ $# -ge 2 ] && [ -n "$2" ] || fail "$1 需要参数值"; }

parse_args() {
  while [ $# -gt 0 ]; do
    case $1 in
      -h | --help)
        usage
        exit 0
        ;;
      -y | --yes) ASSUME_YES=1 ;;
      --local) LOCAL_MODE=1 ;;
      --no-pull) NO_PULL=1 ;;
      --install-docker) INSTALL_DOCKER=1 ;;
      --domain | --locale | --dir | --version | --registry | --download-base | --project | --http-port | --https-port | --subnet | --check-public-ip)
        need_value "$@"
        case $1 in
          --domain) DOMAIN=$2 ;;
          --locale) LOCALE=$2 ;;
          --dir) INSTALL_DIR=$2 ;;
          --version) VERSION=$2 ;;
          --registry) REGISTRY=$2 ;;
          --download-base) DOWNLOAD_BASE=$2 ;;
          --project) PROJECT=$2 ;;
          --subnet) SUBNET=$2 ;;
          --check-public-ip) PUBLIC_IP_URL=$2 ;;
          --http-port) HTTP_PORT=$2 ;;
          --https-port) HTTPS_PORT=$2 ;;
        esac
        shift
        ;;
      *) fail "未知参数 ${1}（--help 查看用法）" ;;
    esac
    shift
  done
}

# ---------- 交互 ----------

has_tty() { [ -t 0 ] || { [ -r /dev/tty ] && (: < /dev/tty) 2> /dev/null; }; }

# 通过 curl | bash 运行时标准输入是脚本本身，交互统一从 /dev/tty 读取。
ask() {
  local prompt=$1 default=${2:-} answer
  has_tty || fail '当前不是交互终端；请使用 --yes 并通过参数提供域名等信息'
  if [ -n "$default" ]; then
    printf '%s [%s]: ' "$prompt" "$default" > /dev/tty
  else
    printf '%s: ' "$prompt" > /dev/tty
  fi
  IFS= read -r answer < /dev/tty || answer=''
  printf '%s' "${answer:-$default}"
}

ask_yes_no() {
  local answer
  answer=$(ask "$1 [y/N]")
  case $answer in y | Y | yes | YES) return 0 ;; *) return 1 ;; esac
}

# ---------- 预检 ----------

detect_platform() {
  local os arch
  os=$(uname -s)
  arch=$(uname -m)
  case $arch in
    x86_64 | amd64) ARCH=amd64 ;;
    aarch64 | arm64) ARCH=arm64 ;;
    *) fail "不支持的 CPU 架构 ${arch}（仅支持 amd64 与 arm64）" ;;
  esac
  if [ "$os" != Linux ]; then
    [ "$LOCAL_MODE" = 1 ] || fail '正式安装仅支持 Linux 服务器；在本机体验请使用 --local'
    warn "当前系统为 ${os}，仅用于本机试用"
  fi
  OS=$os
}

# 正式安装需要 root（写入 /opt、绑定 80/443、链接 /usr/local/bin）；本机试用只要求能访问 Docker 与安装目录。
ensure_root() {
  [ "$(id -u)" = 0 ] && return 0
  [ "$LOCAL_MODE" = 1 ] && return 0
  if command -v sudo > /dev/null 2>&1 && [ -f "$0" ] && [ -r "$0" ]; then
    info '需要 root 权限，使用 sudo 重新运行…'
    exec sudo bash "$0" "$@"
  fi
  fail '需要 root 权限：请使用 sudo bash install.sh 运行（或 curl … | sudo bash）'
}

require_tools() {
  local tool
  for tool in curl tar awk sed grep mktemp; do
    command -v "$tool" > /dev/null 2>&1 || fail "缺少命令 ${tool}，请先安装"
  done
  command -v sha256sum > /dev/null 2>&1 || command -v shasum > /dev/null 2>&1 || fail '缺少 sha256sum 或 shasum'
}

install_docker() {
  local script
  script=$(mktemp)
  info '下载 Docker 官方安装脚本 https://get.docker.com …'
  curl -fsSL --proto '=https' -o "$script" https://get.docker.com || fail 'Docker 安装脚本下载失败'
  sh "$script" || fail 'Docker 安装失败，请按 https://docs.docker.com/engine/install/ 手动安装'
  rm -f "$script"
}

require_docker() {
  if ! command -v docker > /dev/null 2>&1; then
    [ "$OS" = Linux ] || fail '未检测到 Docker；请先安装并启动 Docker Desktop'
    if [ "$INSTALL_DOCKER" = 1 ] || { [ "$ASSUME_YES" = 0 ] && ask_yes_no '未检测到 Docker，是否运行 Docker 官方安装脚本（get.docker.com）？'; }; then
      install_docker
    else
      info '请先安装 Docker Engine 与 Compose 插件：https://docs.docker.com/engine/install/'
      info '或重新运行本脚本并追加 --install-docker。'
      exit 1
    fi
  fi
  docker info > /dev/null 2>&1 || fail 'Docker 守护进程未运行或当前用户无权访问（可用 sudo 运行，或启动 Docker）'
  local compose_version major
  compose_version=$(docker compose version --short 2> /dev/null) || fail '缺少 Docker Compose v2 插件（docker compose）'
  major=${compose_version#v}
  major=${major%%.*}
  case $major in '' | *[!0-9]*) fail "无法识别 Compose 版本 $compose_version" ;; esac
  [ "$major" -ge 2 ] || fail "需要 Docker Compose v2 及以上，当前为 $compose_version"
  local server_arch
  server_arch=$(docker info --format '{{.Architecture}}' 2> /dev/null || true)
  case $server_arch in
    x86_64 | amd64 | aarch64 | arm64 | '') ;;
    *) fail "Docker 主机架构 $server_arch 不受支持" ;;
  esac
}

port_in_use() {
  local port=$1
  if command -v ss > /dev/null 2>&1; then
    ss -Hltn "sport = :$port" 2> /dev/null | grep -q .
  elif command -v lsof > /dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1
  elif command -v nc > /dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" > /dev/null 2>&1
  else
    return 1
  fi
}

check_port() {
  case $1 in '' | *[!0-9]*) fail "端口 $1 不合法" ;; esac
  [ "$1" -ge 1 ] && [ "$1" -le 65535 ] || fail "端口 $1 不合法"
  if port_in_use "$1"; then
    fail "端口 $1 已被占用；请停止占用该端口的服务$([ "$LOCAL_MODE" = 1 ] && printf '，或用 --http-port/--https-port 改用其他端口')"
  fi
}

# ---------- 配置收集 ----------

validate_domain() {
  printf '%s' "$1" | grep -Eq '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' ||
    fail "域名 $1 不合法（示例：blog.example.com，不含协议与路径）"
}

# 域名的 A 与 AAAA 解析结果，每行一个地址。
resolve_addresses() {
  if command -v getent > /dev/null 2>&1; then
    getent ahosts "$1" 2> /dev/null | awk '{ print $1 }' | sort -u
  elif command -v dig > /dev/null 2>&1; then
    { dig +short A "$1"; dig +short AAAA "$1"; } 2> /dev/null | grep -E '^[0-9a-fA-F.:]+$' | sort -u
  elif command -v host > /dev/null 2>&1; then
    host "$1" 2> /dev/null | awk '/has (IPv6 )?address/ { print $NF }' | sort -u
  fi
}

# 本机网卡上的全局地址（去掉前缀长度），只读本机信息，不访问任何外部服务。
local_addresses() {
  if command -v ip > /dev/null 2>&1; then
    ip -o addr show scope global 2> /dev/null | awk '{ split($4, a, "/"); print a[1] }'
  elif command -v hostname > /dev/null 2>&1 && hostname -I > /dev/null 2>&1; then
    hostname -I | tr ' ' '\n' | grep .
  elif command -v ifconfig > /dev/null 2>&1; then
    ifconfig 2> /dev/null | awk '$1 == "inet" || $1 == "inet6" { sub(/%.*/, "", $2); sub(/^addr:/, "", $2); print $2 }'
  fi | grep -Ev '^(127\.|::1$|fe80:)' | sort -u
}

# 私网、CGNAT、链路本地与 ULA 地址不能作为公网解析目标。
is_private_address() {
  printf '%s' "$1" | grep -Eq '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.|169\.254\.|f[cd][0-9a-fA-F]{2}:|fe80:)'
}

# 只做提示，不阻止安装。默认只与本机网卡地址比对；--check-public-ip 由使用者显式指定检测服务时才访问外部地址。
check_dns() {
  local addresses locals address public_local=0 public
  addresses=$(resolve_addresses "$1" || true)
  if [ -z "$addresses" ]; then
    warn "域名 $1 当前没有解析记录；HTTPS 证书需要域名解析到本机后才能签发"
    return 0
  fi
  locals=$(local_addresses || true)
  if [ -n "$PUBLIC_IP_URL" ]; then
    info "按 --check-public-ip 访问 $PUBLIC_IP_URL 获取本机出口 IP…"
    public=$(curl -fsS --proto '=https' --max-time 5 "$PUBLIC_IP_URL" 2> /dev/null | tr -d '[:space:]' || true)
    if printf '%s' "$public" | grep -Eq '^[0-9a-fA-F.:]+$'; then
      locals=$(printf '%s\n%s\n' "$locals" "$public" | grep . | sort -u)
    else
      warn '未能从指定检测服务取得出口 IP，仅与本机网卡地址比对'
    fi
  fi
  if printf '%s\n' "$addresses" | grep -Fxq -f <(printf '%s\n' "$locals" | grep .) 2> /dev/null; then
    info "域名 $1 已解析到本机地址"
    return 0
  fi
  while IFS= read -r address; do
    [ -n "$address" ] || continue
    is_private_address "$address" || public_local=1
  done <<< "$locals"
  if [ "$public_local" = 1 ]; then
    warn "域名 $1 解析到 $(printf '%s' "$addresses" | tr '\n' ' ')，与本机网卡地址不一致；若使用 CDN 或代理可忽略，否则证书签发会失败"
  else
    warn "无法确认域名是否指向本机（服务器可能位于 NAT 之后，网卡上没有公网地址）。域名解析到 $(printf '%s' "$addresses" | tr '\n' ' ')，请自行核对"
  fi
}

# Compose 内部网络（app）子网：写入 .env 的 TIXXIN_NETWORK_SUBNET；未指定时编排缺省 172.31.250.0/24，可信代理缺省随之取该子网。
validate_subnet() {
  local address prefix octet
  address=${1%/*}
  prefix=${1##*/}
  [ "$address/$prefix" = "$1" ] || fail "子网 $1 不合法（示例：172.31.250.0/24）"
  printf '%s' "$address" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' || fail "子网 $1 不合法（示例：172.31.250.0/24）"
  case $prefix in '' | *[!0-9]*) fail "子网 $1 前缀长度不合法" ;; esac
  [ "$prefix" -ge 8 ] && [ "$prefix" -le 28 ] || fail "子网 $1 前缀长度需在 8 到 28 之间"
  for octet in $(printf '%s' "$address" | tr '.' ' '); do
    [ "$octet" -le 255 ] || fail "子网 $1 地址不合法"
  done
  is_private_address "$address" || fail "子网 $1 必须是私有地址段"
}

collect_settings() {
  if [ "$LOCAL_MODE" = 1 ]; then
    [ -z "$DOMAIN" ] || [ "$DOMAIN" = localhost ] || fail '--local 模式固定使用 localhost，不能同时指定 --domain'
    DOMAIN=localhost
    HTTP_PORT=${HTTP_PORT:-8080}
    HTTPS_PORT=${HTTPS_PORT:-8443}
  else
    if [ -z "$DOMAIN" ]; then
      [ "$ASSUME_YES" = 0 ] || fail '非交互安装需要 --domain'
      DOMAIN=$(ask '站点域名（如 blog.example.com）')
    fi
    DOMAIN=$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')
    validate_domain "$DOMAIN"
    HTTP_PORT=${HTTP_PORT:-80}
    HTTPS_PORT=${HTTPS_PORT:-443}
  fi
  if [ -z "$LOCALE" ]; then
    if [ "$ASSUME_YES" = 1 ]; then
      LOCALE=zh-CN
    else
      case $(ask '站点语言：1) 中文 zh-CN  2) English en' 1) in
        2 | en | EN | English | english) LOCALE=en ;;
        1 | zh | zh-CN | zh-cn | 中文) LOCALE=zh-CN ;;
        *) fail '请选择 1 或 2' ;;
      esac
    fi
  fi
  case $LOCALE in zh-CN | en) ;; *) fail '--locale 只能为 zh-CN 或 en' ;; esac
  if [ -z "$INSTALL_DIR" ]; then
    if [ "$ASSUME_YES" = 1 ]; then INSTALL_DIR=$(default_dir); else INSTALL_DIR=$(ask '安装目录' "$(default_dir)"); fi
  fi
  case $INSTALL_DIR in /*) ;; *) INSTALL_DIR=$(pwd -P)/$INSTALL_DIR ;; esac
  INSTALL_DIR=${INSTALL_DIR%/}
  local ancestor=$INSTALL_DIR
  while [ ! -e "$ancestor" ]; do ancestor=$(dirname "$ancestor"); done
  [ -w "$ancestor" ] || fail "无权写入 ${ancestor}；请使用 sudo 运行，或用 --dir 指定可写目录"
  PROJECT=${PROJECT:-$DEFAULT_PROJECT}
  [ -z "$SUBNET" ] || validate_subnet "$SUBNET"
  case $PUBLIC_IP_URL in '' | https://*) ;; *) fail '--check-public-ip 只接受 https:// 地址' ;; esac
  printf '%s' "$PROJECT" | grep -Eq '^[a-z0-9][a-z0-9_-]+$' || fail '项目名只能包含小写字母、数字、下划线与连字符'
  [ "$HTTP_PORT" != "$HTTPS_PORT" ] || fail 'HTTP 与 HTTPS 端口不能相同'
  if [ "$LOCAL_MODE" = 1 ]; then
    if [ "$HTTPS_PORT" = 443 ]; then SITE_URL=https://localhost; else SITE_URL=https://localhost:$HTTPS_PORT; fi
    BIND_ADDRESS=127.0.0.1
  else
    [ "$HTTPS_PORT" = 443 ] || fail '正式安装的 HTTPS 端口必须为 443（证书签发与访客访问都依赖它）'
    SITE_URL=https://$DOMAIN
    BIND_ADDRESS=0.0.0.0
    check_dns "$DOMAIN"
  fi
}

# ---------- 版本与下载 ----------

normalize_version() {
  local version=${1#v}
  printf '%s' "$version" | grep -Eq "$VERSION_PATTERN" || fail "版本号 $1 不合法"
  case $version in latest | replace-with-git-sha) fail '必须使用可追溯的固定版本号' ;; esac
  printf '%s' "$version"
}

resolve_version() {
  case $DEFAULT_REPOSITORY in __*) REPOSITORY=TixXin/TixXinBlog ;; *) REPOSITORY=$DEFAULT_REPOSITORY ;; esac
  if [ -z "$VERSION" ]; then
    case $DEFAULT_VERSION in
      __*)
        [ -z "$DOWNLOAD_BASE" ] || fail '使用 --download-base 时请同时指定 --version'
        local effective
        effective=$(curl -fsSIL --proto '=https' -o /dev/null -w '%{url_effective}' "https://github.com/$REPOSITORY/releases/latest") ||
          fail '无法解析最新版本，请使用 --version 指定'
        VERSION=${effective##*/}
        ;;
      *) VERSION=$DEFAULT_VERSION ;;
    esac
  fi
  VERSION=$(normalize_version "$VERSION")
  DOWNLOAD_BASE=${DOWNLOAD_BASE%/}
  case $DOWNLOAD_BASE in '' | https://* | file://*) ;; *) fail '--download-base 只允许 https:// 或 file:// 地址' ;; esac
  if [ -n "$REGISTRY" ]; then
    REGISTRY=${REGISTRY%/}
    printf '%s' "$REGISTRY" | grep -Eq '^[a-z0-9][a-z0-9._:/-]*[a-z0-9]$' || fail '--registry 只能包含小写字母、数字与 . _ : / -'
  fi
}

sha256_of() {
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  else
    shasum -a 256 "$1" | awk '{ print $1 }'
  fi
}

# 先校验 SHA256 再解压；只接受预期路径的普通文件与目录。
download_package() {
  local base asset expected actual entry
  base=${DOWNLOAD_BASE:-https://github.com/$REPOSITORY/releases/download}
  asset="tixxin-blog-$VERSION.tar.gz"
  WORK_DIR=$(mktemp -d)
  info "下载 $base/v$VERSION/$asset"
  curl -fsSL --proto '=https,file' -o "$WORK_DIR/$asset" "$base/v$VERSION/$asset" || fail '部署包下载失败；国内网络可用 --download-base 指定可信下载源'
  curl -fsSL --proto '=https,file' -o "$WORK_DIR/SHA256SUMS" "$base/v$VERSION/SHA256SUMS" || fail 'SHA256SUMS 下载失败'
  expected=$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1 }' "$WORK_DIR/SHA256SUMS")
  actual=$(sha256_of "$WORK_DIR/$asset")
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || fail '部署包 SHA256 校验失败，已停止安装'
  info "SHA256 校验通过：$actual"
  while IFS= read -r entry; do
    case $entry in
      compose.production.yaml | deploy | deploy/ | deploy/*) ;;
      *) fail "部署包包含意外路径：$entry" ;;
    esac
    case $entry in */../* | ../* | */..) fail '部署包包含上级路径' ;; esac
  done < <(tar -tzf "$WORK_DIR/$asset")
  if tar -tvzf "$WORK_DIR/$asset" | cut -c1 | grep -qv '^[-d]$'; then fail '部署包包含链接或特殊文件'; fi
  mkdir "$WORK_DIR/package"
  tar -xzf "$WORK_DIR/$asset" -C "$WORK_DIR/package"
  for entry in compose.production.yaml deploy/Caddyfile deploy/Caddyfile.local deploy/compose.local.yaml \
    deploy/production.env.example deploy/tixxin deploy/package.env; do
    [ -f "$WORK_DIR/package/$entry" ] || fail "部署包缺少 $entry"
  done
  PACKAGE_VERSION=$(awk -F= '$1 == "TIXXIN_PACKAGE_VERSION" { print $2 }' "$WORK_DIR/package/deploy/package.env")
  [ "$PACKAGE_VERSION" = "$VERSION" ] || fail "部署包版本 $PACKAGE_VERSION 与请求版本 $VERSION 不一致"
  PACKAGE_IMAGE_PREFIX=$(awk -F= '$1 == "TIXXIN_IMAGE_PREFIX" { print $2 }' "$WORK_DIR/package/deploy/package.env")
  [ -n "$PACKAGE_IMAGE_PREFIX" ] || fail '部署包缺少镜像前缀'
}

# ---------- 已有安装检测 ----------

refuse_existing() {
  local reason=$1
  {
    printf '错误：%s。\n' "$reason"
    printf '安装脚本不会覆盖已有站点。已有站点请改用：tixxin update\n'
    printf '若要在同一台机器另装一套，请换用 --dir 与 --project。\n'
  } >&2
  exit 1
}

check_existing() {
  if [ -e "$INSTALL_DIR/.env" ] || [ -e "$INSTALL_DIR/compose.production.yaml" ]; then
    refuse_existing "安装目录 $INSTALL_DIR 已包含站点配置"
  fi
  if [ -d "$INSTALL_DIR" ] && [ -n "$(ls -A "$INSTALL_DIR" 2> /dev/null)" ]; then
    refuse_existing "安装目录 $INSTALL_DIR 非空"
  fi
  local name
  for name in database media certificates caddy-config backups; do
    if docker volume inspect "${PROJECT}_$name" > /dev/null 2>&1; then
      refuse_existing "数据卷 ${PROJECT}_$name 已存在"
    fi
  done
  if [ -n "$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT")" ] ||
    [ -n "$(docker ps -aq --filter "label=com.docker.compose.project=$PROJECT")" ]; then
    refuse_existing "Compose 项目 $PROJECT 已有容器或数据卷"
  fi
}

# ---------- 写入安装目录 ----------

random_hex() {
  local value
  value=$(openssl rand -hex "$1" 2> /dev/null || true)
  [ -n "$value" ] || value=$(od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n')
  printf '%s' "$value" | grep -Eq "^[0-9a-f]{$(($1 * 2))}\$" || fail '随机密钥生成失败'
  printf '%s' "$value"
}

# 以部署包中的环境模板为底稿，只替换安装需要的键，其余注释与缺省值保持原样。
write_env() {
  local prefix=${REGISTRY:-$PACKAGE_IMAGE_PREFIX} values env_temp compose_file
  compose_file=compose.production.yaml
  [ "$LOCAL_MODE" = 0 ] || compose_file=compose.production.yaml:deploy/compose.local.yaml
  values=$(mktemp)
  {
    printf 'RELEASE_PROJECT=%s\n' "$PROJECT"
    printf 'RELEASE_VERSION=%s\n' "$VERSION"
    printf 'WEB_IMAGE_REPOSITORY=%s-web\n' "$prefix"
    printf 'API_IMAGE_REPOSITORY=%s-api\n' "$prefix"
    printf 'MIGRATION_IMAGE_REPOSITORY=%s-migration\n' "$prefix"
    printf 'WORKER_IMAGE_REPOSITORY=%s-worker\n' "$prefix"
    # 数据库密码为 64 位十六进制、签名密钥 96 位、初始化令牌 48 位，满足 release.mjs 与后端校验。
    printf 'POSTGRES_PASSWORD=%s\n' "$(random_hex 32)"
    printf 'JWT_ACCESS_SECRET=%s\n' "$(random_hex 48)"
    printf 'SETUP_TOKEN=%s\n' "$(random_hex 24)"
    printf 'SITE_HOST=%s\n' "$DOMAIN"
    printf 'SITE_URL=%s\n' "$SITE_URL"
    printf 'HTTPS_BIND_ADDRESS=%s\n' "$BIND_ADDRESS"
    printf 'HTTP_PORT=%s\n' "$HTTP_PORT"
    printf 'HTTPS_PORT=%s\n' "$HTTPS_PORT"
    printf 'NUXT_PUBLIC_DEFAULT_LOCALE=%s\n' "$LOCALE"
    [ -z "$SUBNET" ] || printf 'TIXXIN_NETWORK_SUBNET=%s\n' "$SUBNET"
    printf 'COMPOSE_FILE=%s\n' "$compose_file"
    printf 'TIXXIN_MODE=%s\n' "$([ "$LOCAL_MODE" = 1 ] && echo local || echo public)"
    printf 'TIXXIN_REPOSITORY=%s\n' "$REPOSITORY"
    printf 'TIXXIN_DOWNLOAD_BASE=%s\n' "$DOWNLOAD_BASE"
  } > "$values"
  env_temp=$(umask 077 && mktemp "$INSTALL_DIR/.env.XXXXXX")
  awk '
    FNR == NR { split_at = index($0, "="); key = substr($0, 1, split_at - 1); wanted[key] = $0; order[++count] = key; next }
    {
      split_at = index($0, "=")
      key = split_at ? substr($0, 1, split_at - 1) : ""
      if (key in wanted) { if (!(key in written)) print wanted[key]; written[key] = 1; next }
      print
    }
    END {
      appended = 0
      for (i = 1; i <= count; i++) {
        if (order[i] in written) continue
        if (!appended) { print ""; print "# 一键安装写入：初始化令牌、Compose 文件与 tixxin 管理命令配置。"; appended = 1 }
        print wanted[order[i]]
      }
    }
  ' "$values" "$INSTALL_DIR/deploy/production.env.example" > "$env_temp"
  rm -f "$values"
  chmod 600 "$env_temp"
  mv "$env_temp" "$INSTALL_DIR/.env"
}

install_files() {
  mkdir -p "$INSTALL_DIR"
  DIR_CREATED=1
  mkdir -p "$INSTALL_DIR/releases" "$INSTALL_DIR/logs" "$INSTALL_DIR/backups"
  chmod 700 "$INSTALL_DIR/logs" "$INSTALL_DIR/backups"
  # 保留本版本部署包作为日后应用回退的来源。
  cp -R "$WORK_DIR/package" "$INSTALL_DIR/releases/$VERSION"
  cp "$WORK_DIR/package/compose.production.yaml" "$INSTALL_DIR/"
  mkdir -p "$INSTALL_DIR/deploy"
  cp "$WORK_DIR/package/deploy/"* "$INSTALL_DIR/deploy/"
  chmod 755 "$INSTALL_DIR/deploy/tixxin"
  write_env
}

link_command() {
  local target=/usr/local/bin/tixxin
  if [ "$(id -u)" != 0 ]; then
    LINK_HINT="$INSTALL_DIR/deploy/tixxin"
    return 0
  fi
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ -L "$target" ] && [ "$(readlink "$target")" = "$INSTALL_DIR/deploy/tixxin" ]; then
      LINK_HINT=tixxin
    else
      warn "$target 已存在且指向其他位置，未覆盖；请使用 $INSTALL_DIR/deploy/tixxin"
      LINK_HINT="$INSTALL_DIR/deploy/tixxin"
    fi
    return 0
  fi
  mkdir -p /usr/local/bin
  ln -s "$INSTALL_DIR/deploy/tixxin" "$target"
  LINK_HINT=tixxin
}

# ---------- 结束与失败 ----------

# shellcheck disable=SC2329 # 由 EXIT 陷阱调用。
on_exit() {
  local code=$?
  [ -z "$WORK_DIR" ] || rm -rf "$WORK_DIR"
  [ "$code" = 0 ] && return 0
  [ "$DIR_CREATED" = 1 ] || return 0
  local sudo_hint
  sudo_hint=$(admin_prefix)
  {
    info ''
    info '安装未完成。已保留安装目录、容器与数据卷，未删除任何数据。'
    [ -z "$LOG_FILE" ] || info "安装日志：$LOG_FILE"
    info '排查命令：'
    info "  ${sudo_hint}$INSTALL_DIR/deploy/tixxin status"
    info "  ${sudo_hint}$INSTALL_DIR/deploy/tixxin logs backend"
    info "  ${sudo_hint}$INSTALL_DIR/deploy/tixxin logs edge"
    info "  cd $INSTALL_DIR && ${sudo_hint}docker compose ps -a"
    info '修复后可执行 '"${sudo_hint}"'tixxin update '"$VERSION"' 继续（会先完整备份；首次迁移即失败时可追加 --skip-backup）。'
  } >&2
}

setup_status() {
  local cacert=()
  [ "$LOCAL_MODE" = 0 ] || cacert=(--cacert "$INSTALL_DIR/local-ca.crt")
  curl ${cacert[@]+"${cacert[@]}"} -sS --proto '=https' --max-time 15 -w '\n%{http_code}' "$SITE_URL/api/v1/setup/status" 2> /dev/null || true
}

print_summary() {
  local token response status body
  token=$(awk -F= '$1 == "SETUP_TOKEN" { value = substr($0, index($0, "=") + 1) } END { print value }' "$INSTALL_DIR/.env")
  response=$(setup_status)
  status=$(printf '%s' "$response" | tail -n 1)
  body=$(printf '%s' "$response" | sed '$d')
  step '安装完成'
  info "站点地址：$SITE_URL"
  info "版本：$VERSION"
  info "安装目录：$INSTALL_DIR"
  if [ "$status" = 200 ] && printf '%s' "$body" | grep -q '"needsSetup":true'; then
    info ''
    info '打开下面的链接设置博主账号（链接含一次性初始化令牌，请勿分享）：'
    info "  $SITE_URL/setup?token=$token"
  elif [ "$status" = 200 ]; then
    info '站点已有管理员，无需初始化；后台登录：'"$SITE_URL/admin/login"
  else
    warn "暂未读取到初始化状态（HTTP ${status:-无响应}）；稍后用 $(admin_prefix)$LINK_HINT status 确认站点就绪后再打开初始化链接"
    info "  $SITE_URL/setup?token=$token"
  fi
  if [ "$LOCAL_MODE" = 1 ]; then
    info ''
    info "本机试用使用 Caddy 内部证书，浏览器首次访问会提示证书不受信任，确认继续即可；"
    info "也可把根证书 $INSTALL_DIR/local-ca.crt 加入本机信任后再访问。"
  fi
  info ''
  info "请备份 $INSTALL_DIR/.env：其中的数据库密码与签名密钥丢失后无法恢复站点。"
  info "日常管理：$(admin_prefix)$LINK_HINT status | backup | update | logs | help"
}

main() {
  parse_args "$@"
  detect_platform
  ensure_root "$@"
  require_tools
  require_docker
  step '收集站点配置'
  collect_settings
  resolve_version
  # 先识别已有安装，再查端口：已有站点占用端口时应提示 tixxin update，而不是端口冲突。
  check_existing
  check_port "$HTTP_PORT"
  check_port "$HTTPS_PORT"
  info "将安装 TixXinBlog ${VERSION}（${ARCH}）到 ${INSTALL_DIR}（站点 ${SITE_URL}，语言 ${LOCALE}）"
  if [ "$ASSUME_YES" = 0 ]; then ask_yes_no '确认开始安装？' || fail '已取消'; fi
  trap on_exit EXIT
  step '下载并校验部署包'
  download_package
  step '写入安装目录与密钥'
  install_files
  LOG_FILE="$INSTALL_DIR/logs/install-$(date -u +%Y%m%dT%H%M%SZ).log"
  (umask 077 && : > "$LOG_FILE")
  info "已写入 $INSTALL_DIR/.env（权限 600），日志：$LOG_FILE"
  link_command
  step '拉取镜像、迁移数据库并启动服务'
  local first_start=("$INSTALL_DIR/deploy/tixxin" __first-start)
  [ "$NO_PULL" = 0 ] || first_start+=(--no-pull)
  TIXXIN_DIR=$INSTALL_DIR "${first_start[@]}" 2>&1 | tee -a "$LOG_FILE"
  print_summary 2>&1 | tee -a "$LOG_FILE"
}

main "$@"
exit $?
