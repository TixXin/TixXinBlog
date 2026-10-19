#!/bin/bash
# TixXinBlog 1Panel 安装初始化：1Panel 写好 .env 之后、启动容器之前执行。
# 生成密钥、准备数据目录与内部网络子网，并在安装日志中给出初始化链接。
set -euo pipefail

# shellcheck source-path=SCRIPTDIR source=prepare.sh
. "$(dirname "${BASH_SOURCE[0]}")/prepare.sh"

check_site_host
prepare_directories
prepare_secrets
prepare_subnet
print_setup_hint
