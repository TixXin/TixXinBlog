#!/usr/bin/env bash
# @file package-deploy.sh
# @description 生成一键安装的 Release 资产：tixxin-blog-<版本>.tar.gz 部署包、写入固定版本的 install.sh 与 SHA256SUMS。
#   Release 工作流与 CI 安装冒烟共用；只读取仓库内跟踪的部署文件，不包含任何密钥。
set -euo pipefail

usage() {
  cat << 'EOF'
用法：scripts/release/package-deploy.sh --version <版本> --repository <所有者/仓库> --output <目录> [--image-prefix <前缀>]

  --version       发布版本（不带 v），写入部署包与 install.sh 的默认版本
  --repository    GitHub 仓库，决定默认下载源与默认镜像前缀
  --image-prefix  镜像前缀，默认 ghcr.io/<小写的所有者/仓库>
  --output        输出目录（不存在时创建；已有同名资产会被替换）
EOF
}

version=''
repository=''
image_prefix=''
output=''
while [ $# -gt 0 ]; do
  case $1 in
    -h | --help)
      usage
      exit 0
      ;;
    --version | --repository | --image-prefix | --output)
      [ $# -ge 2 ] && [ -n "$2" ] || {
        echo "$1 需要参数值" >&2
        exit 1
      }
      case $1 in
        --version) version=${2#v} ;;
        --repository) repository=$2 ;;
        --image-prefix) image_prefix=$2 ;;
        --output) output=$2 ;;
      esac
      shift
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
  shift
done

[ -n "$version" ] && [ -n "$repository" ] && [ -n "$output" ] || {
  usage >&2
  exit 1
}
printf '%s' "$version" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$' || {
  echo "版本号 $version 不合法" >&2
  exit 1
}
printf '%s' "$repository" | grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' || {
  echo "仓库 $repository 不合法" >&2
  exit 1
}
[ -n "$image_prefix" ] || image_prefix="ghcr.io/$(printf '%s' "$repository" | tr '[:upper:]' '[:lower:]')"

root=$(cd "$(dirname "$0")/../.." && pwd -P)
mkdir -p "$output"
output=$(cd "$output" && pwd -P)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/deploy"
cp "$root/compose.production.yaml" "$stage/"
cp "$root"/deploy/Caddyfile* "$root/deploy/compose.local.yaml" "$root/deploy/production.env.example" \
  "$root/deploy/tixxin" "$stage/deploy/"
chmod 644 "$stage/compose.production.yaml" "$stage"/deploy/*
chmod 755 "$stage/deploy/tixxin"
cat > "$stage/deploy/package.env" << EOF
# 部署包元信息：由 package-deploy.sh 生成，install.sh 与 tixxin 据此确定版本与默认镜像前缀。
TIXXIN_PACKAGE_VERSION=$version
TIXXIN_IMAGE_PREFIX=$image_prefix
TIXXIN_REPOSITORY=$repository
EOF

asset="tixxin-blog-$version.tar.gz"
# 关闭 macOS 扩展属性；GNU tar 下额外固定排序与属主，便于复现。
if tar --version 2> /dev/null | grep -q 'GNU tar'; then
  (cd "$stage" && tar --sort=name --owner=0 --group=0 --numeric-owner -cf - compose.production.yaml deploy) |
    gzip -n > "$output/$asset"
else
  (cd "$stage" && COPYFILE_DISABLE=1 tar -cf - compose.production.yaml deploy) | gzip -n > "$output/$asset"
fi

sed -e "s|^DEFAULT_VERSION='__TIXXIN_RELEASE_VERSION__'\$|DEFAULT_VERSION='$version'|" \
  -e "s|^DEFAULT_REPOSITORY='__TIXXIN_REPOSITORY__'\$|DEFAULT_REPOSITORY='$repository'|" \
  "$root/deploy/install.sh" > "$output/install.sh"
grep -q "^DEFAULT_VERSION='$version'\$" "$output/install.sh" || {
  echo 'install.sh 默认版本写入失败' >&2
  exit 1
}
chmod 755 "$output/install.sh"

(
  cd "$output"
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$asset" install.sh > SHA256SUMS
  else
    shasum -a 256 "$asset" install.sh > SHA256SUMS
  fi
)
echo "部署包已生成：$output"
cat "$output/SHA256SUMS"
