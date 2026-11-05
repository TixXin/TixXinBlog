# 内容仓库

内容仓库把后台导出的内容包展开成一个普通目录：文章、闪念、朋友圈是带 frontmatter 的 Markdown，其余内容域是 YAML，受管图片是原文件。目录可以交给 Git 管理，每次重新导出后用 `git diff` 查看后台改了什么；也可以在编辑器里修改后重新打包，再从后台迁入。

当前以后台为事实源：仓库是内容包的文件化表达，不是第二个写作入口，不做双向同步。直接以仓库为准、由 CI 构建静态站的方案见[待办与已调研方向](backlog.md)。

## 命令

```sh
corepack pnpm content:repo export --pack <内容包.json> --out <仓库目录>
corepack pnpm content:repo pack --dir <仓库目录> --out <内容包.json> [--force]
corepack pnpm content:repo check --dir <仓库目录>
```

| 子命令   | 作用                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------- |
| `export` | 把内容包展开到目录。写出前先确认能无损转回；目标必须是空目录、不存在的目录或已有的内容仓库              |
| `pack`   | 把目录打回内容包。媒体逐个核对字节数与 SHA-256；结果超过 50 MiB 时拒绝。已有输出文件需加 `--force` 覆盖 |
| `check`  | 只校验目录能否打包，不写文件                                                                            |

命令只读写指定的本机文件，不访问后端或网络。内容包在后台 `/admin/maintenance` 下载，导出时勾选附带图片，仓库里才有图片文件。

## 目录结构

```text
tixxin-content.yaml   格式与版本、导出时间、媒体开关、评论审核、专栏、标签、友链规则、器材
site.yaml             站点资料
posts/<地址>.md        文章；没有自定义地址时为 post-<编号>.md
flashes/<日期>-<编号前 8 位>.md
moments/<日期>-<编号前 8 位>.md
guestbook.yaml  gallery.yaml  projects.yaml  links.yaml  prompts.yaml  subscriptions.yaml
media/index.yaml      媒体元数据（编号、名称、替代文本、说明、尺寸、SHA-256、字节数）
media/<媒体UUID>.webp  受管图片原图
```

Markdown 的正文就是文章的 `contentRaw` 或闪念、朋友圈的 `content`，frontmatter 依次是记录字段（`sourceId`、`createdAt` 等）、内容包 `values` 里的其余字段，以及非空的 `comments`。文件名只用于阅读，打包时以 frontmatter 为准；同名时追加编号区分。

工具只管理上面列出的条目。仓库里自己的 `README.md`、`.git`、CI 配置等文件不会被读取，也不会在重新导出时删除；以 `.` 开头的文件一律忽略。管理目录里出现无法识别的文件时拒绝打包，不静默丢弃。

## 与内容包的关系

- 转换只搬运字段，往返无损：正文、换行和字段值逐字保留，记录按编号（闪念、朋友圈按创建时间）排序。字段含义、版本差异和上限以[备份与恢复](backup-and-recovery.md)为准。
- 工具不做业务校验。打出的内容包仍须在后台上传预览，由内容包规则检查版本、结构、引用和图片真实格式后再迁入。
- 迁入语义不变：内容迁入为新编号的草稿，按 `skip` 或 `copy` 策略处理重复，目标站已删除的内容不复活。从仓库迁回同一站点时用 `skip`，未改动的内容按内容判断为相同项跳过。
- 媒体以 UUID 和 SHA-256 为身份。改动图片字节、删掉文件或放入未登记的文件都会被 `pack` 拒绝；新增图片请在后台上传后重新导出。
- 内容包不含登录凭据、互动去重、修订历史和访问统计，仓库同样没有。内容仓库不能替代完整备份。

## 验证

```sh
corepack pnpm test:dev
```

其中 `scripts/content-repo/content-repo.test.mjs` 覆盖往返无损、正文边界、同名文件、媒体篡改与缺失、未知字段，以及重新导出时只清理工具管理的条目。
