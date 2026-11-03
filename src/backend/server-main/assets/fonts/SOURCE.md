# 分享卡片字体

后端渲染分享卡片（`src/modules/og`）使用的中文字体，随生产镜像交付，渲染时不依赖系统字体。

| 文件                  | 来源                                                                                                                                      | SHA-256                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `NotoSansSC-Bold.otf` | [notofonts/noto-cjk](https://github.com/notofonts/noto-cjk) 标签 `Sans2.004`（提交 `523d033d`）的 `Sans/SubsetOTF/SC/NotoSansSC-Bold.otf` | `c6cb5a93abaa9edc8ee7463b7ebb7f42d618d40e6ed2f7a5371c97b0b64767c0` |
| `OFL.txt`             | 同一标签的仓库根目录 `LICENSE`                                                                                                            | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` |

字体按 SIL Open Font License 1.1 授权，许可全文见 `OFL.txt`。只带 Bold 一个字重，标题与辅助文字靠字号和透明度区分；未做子集裁剪，生僻字同样能显示。

`fonts.conf` 是 fontconfig 的最小配置：字体目录指向本目录，缓存写入 `/tmp/tixxin-fontconfig`。渲染模块在首次渲染前，若环境未设置 `FONTCONFIG_FILE`，就指向这份配置。
