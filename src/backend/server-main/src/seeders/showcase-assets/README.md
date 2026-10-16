# 真实感样本（showcase-v1）图片素材

这些照片延续旧版首页、朋友圈 Mock 页面曾引用的 Unsplash 图片，保存为本地种子素材，避免日常补种和页面验收依赖外站。它们是必要的业务样本素材，不是截图或测试报告。按 [Unsplash License](https://unsplash.com/license) 使用；来源如下。

| 文件              | 原始来源                                                                     | 实际像素    | 用途            |
| ----------------- | ---------------------------------------------------------------------------- | ----------- | --------------- |
| code-screen.webp  | [代码屏幕](https://images.unsplash.com/photo-1555099962-4199c345e5dd)        | 1000 × 667  | 文章封面        |
| server-room.webp  | [机房](https://images.unsplash.com/photo-1618401471353-b98afee0b2eb)         | 1000 × 653  | 文章封面        |
| laptop-desk.webp  | [桌上的笔记本](https://images.unsplash.com/photo-1516116216624-53e697fedbea) | 1000 × 625  | 文章封面        |
| code-editor.webp  | [编辑器](https://images.unsplash.com/photo-1461749280684-dccba630e2f6)       | 1000 × 668  | 文章封面        |
| macbook-code.webp | [写代码](https://images.unsplash.com/photo-1498050108023-c5249f4df085)       | 1000 × 666  | 文章封面        |
| terminal.webp     | [终端](https://images.unsplash.com/photo-1504639725590-34d0984388bd)         | 1000 × 750  | 文章封面        |
| workspace.webp    | [工作台](https://images.unsplash.com/photo-1484417894907-623942c8ee29)       | 1000 × 563  | 文章封面        |
| laptop-code.webp  | [笔记本代码](https://images.unsplash.com/photo-1517694712202-14dd9538aa97)   | 1000 × 667  | 文章封面        |
| typing.webp       | [敲键盘](https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d)       | 1000 × 665  | 文章封面        |
| devices.webp      | [设备](https://images.unsplash.com/photo-1531297484001-80022131f5a1)         | 1000 × 708  | 文章封面        |
| code-dark.webp    | [深色代码](https://images.unsplash.com/photo-1542831371-29b0f74f9713)        | 1000 × 667  | 文章封面        |
| team-desk.webp    | [协作桌面](https://images.unsplash.com/photo-1519389950473-47ba0277781c)     | 1000 × 667  | 文章封面        |
| sakura.webp       | [樱花](https://images.unsplash.com/photo-1459411552884-841db9b3cc2a)         | 1000 × 1225 | 动态配图        |
| blossom.webp      | [花枝](https://images.unsplash.com/photo-1518495973542-4542c06a5843)         | 800 × 1200  | 动态配图        |
| garden.webp       | [园林](https://images.unsplash.com/photo-1504567961542-e24d9439a724)         | 1000 × 750  | 动态配图        |
| sunset-sea.webp   | [海边夕阳](https://images.unsplash.com/photo-1501854140801-50d01698950b)     | 1000 × 595  | 动态配图        |
| waves.webp        | [海浪](https://images.unsplash.com/photo-1469474968028-56623f02e42e)         | 1000 × 664  | 动态配图        |
| sushi.webp        | [刺身](https://images.unsplash.com/photo-1579871494447-9811cf80d66c)         | 1000 × 667  | 动态配图        |
| eel-rice.webp     | [鳗鱼饭](https://images.unsplash.com/photo-1553621042-f6e147245754)          | 1000 × 800  | 动态配图        |
| reading.webp      | [读书](https://images.unsplash.com/photo-1544947950-fa07a98d237f)            | 1000 × 1500 | 动态配图        |
| cloud-sea.webp    | [云海](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b)         | 1000 × 667  | 动态配图 / 图库 |
| summit.webp       | [山顶](https://images.unsplash.com/photo-1454496522488-7a8e488e8606)         | 1000 × 662  | 动态配图 / 图库 |
| bookshelf.webp    | [书架](https://images.unsplash.com/photo-1507842217343-583bb7270b66)         | 1000 × 586  | 动态配图        |
| latte.webp        | [拿铁](https://images.unsplash.com/photo-1495474472287-4d71bcdd2085)         | 1000 × 667  | 动态配图        |
| city-night.webp   | [城市夜景](https://images.unsplash.com/photo-1519501025264-65ba15a82390)     | 1000 × 1251 | 动态配图 / 图库 |
| cbd-night.webp    | [楼群夜景](https://images.unsplash.com/photo-1477959858617-67f85cf4f1df)     | 1000 × 615  | 动态配图        |
| bay-run.webp      | [晨跑](https://images.unsplash.com/photo-1476480862126-209bfaa8edc8)         | 1000 × 667  | 动态配图        |
| bay-sunrise.webp  | [海湾日出](https://images.unsplash.com/photo-1502904550040-7534597429ae)     | 1000 × 527  | 动态配图 / 图库 |
| bay-track.webp    | [跑道](https://images.unsplash.com/photo-1461897104016-0b3b00cc81ee)         | 1000 × 667  | 动态配图        |

原图用 `auto=format&fit=max&w=1000&q=80` 下载，再经 Sharp 自动旋转并转换为 WebP（`blossom` 另缩至 800 宽以控制体积）。素材不保留 EXIF。种子仍通过实际媒体上传服务读取宽高与格式，不使用表格代替解码校验。

`showcase-v1` 里文章封面、动态配图与图库作品的标题、地点、器材都是样本设定，描述可见画面与样本情节，不声称是这些素材的真实拍摄地点、时间或作者经历。`night.webp`、`pizza.webp`、`mist.webp`、`ridge.webp` 等已在 `gallery-assets/` 的素材由本数据集直接复用，不重复入仓。

源素材保留于本目录；运行时图片写入明确配置的 `MEDIA_DIRECTORY`，通过媒体 API 读取。定向清理只移除确认可清理的数据库索引，保留磁盘文件及备份。
