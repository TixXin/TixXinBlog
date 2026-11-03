/**
 * @file jest-global-setup.cjs
 * @description Jest 主进程初始化：分享卡片渲染用到的原生 fontconfig 读取进程的真实环境变量，
 *   测试沙盒里的 process.env 只是副本，需在派生测试进程前预先指向随仓库交付的字体配置。
 */
const { join } = require('node:path')

module.exports = () => {
  process.env.FONTCONFIG_FILE ??= join(__dirname, '../assets/fonts/fonts.conf')
}
