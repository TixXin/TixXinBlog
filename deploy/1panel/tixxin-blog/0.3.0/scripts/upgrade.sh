#!/bin/bash
# TixXinBlog 1Panel 升级准备：1Panel 停止并移除旧容器、写入新版本文件之后，启动新容器之前执行。
# 沿用已有密钥与子网；新容器启动时 migration 服务会执行正式数据库迁移，请确认已勾选升级前备份。
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=prepare.sh
. "$(dirname "${BASH_SOURCE[0]}")/prepare.sh"

[ -f data/secrets/app.env ] && [ -f data/secrets/postgres.env ] ||
  fail '缺少 data/secrets/ 中的密钥文件，升级已中止；请从 1Panel 应用备份恢复后重试'

check_site_host
prepare_directories
prepare_secrets
prepare_subnet
info '新版本启动时将自动执行数据库迁移；迁移失败时 API 不会启动，可在 1Panel 中用升级前备份回滚'
