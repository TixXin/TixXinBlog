# TixXin Blog 宣传海报

成图：[tixxin-blog-poster.png](tixxin-blog-poster.png)，1024 × 1536 px，竖版。

海报展示技术文章、生活随笔、灵感闪念和朋友圈。深灰、蓝色与圆角卡片沿用博客视觉；四张卡片采用两行排布。

## 制作方式与截图来源

先使用内置 imagegen 调整版式，再在 Photoshop 中直接合成原始网页截图。截图仅裁取主内容区域并等比缩放，没有使用生成图中的重绘界面作为最终卡片内容。

截图来自 2026-09-09 访问的在线页面：

- 技术文章：`https://tix.xin/` 的文章列表。
- 生活随笔：同一首页点击「随笔日记」分类后的文章列表。
- 灵感闪念：`https://tix.xin/flash`。
- 朋友圈：`https://tix.xin/moments`。

原始截图尺寸为 1280 × 720 px，取主内容区域 `x=336, y=16, width=588, height=592`，等比缩放后居中放入卡片。
此处展示访问时可见的界面，不表示对页面所有功能完成业务验收。

原始截图、版式中间稿、合成脚本与可编辑 PSD 保存在本机 `.artifacts/blog-poster/`，不纳入 Git。
这张成图属于宣传素材，保存在 `docs/img/`。

## 最终版式提示词

生成方式：内置 imagegen。输入依次为原始三卡海报，以及技术文章、生活随笔、闪念、朋友圈的截图。

以下为传给图像工具的完整提示词；其中截图裁切和像素保真要求在最终 Photoshop 合成阶段落实，实际采用上文所列的等比缩放区域。

```text
Use case: compositing
Task: Revise Image 1, the existing TixXin Blog promotional poster, according to the user's exact request: add a FOURTH card called "朋友圈", and replace EVERY card illustration with the ACTUAL webpage screenshots supplied in Images 2, 3, 4 and 5.
Input roles:
Image 1 = EDIT TARGET. Keep its brand identity, charcoal slate and periwinkle palette, Chinese headline, dot-grid ambience and bottom tix.xin address.
Image 2 = ACTUAL WEBSITE SCREENSHOT to place inside the "技术文章" card.
Image 3 = ACTUAL WEBSITE SCREENSHOT to place inside the "生活随笔" card.
Image 4 = ACTUAL WEBSITE SCREENSHOT to place inside the "灵感闪念" card.
Image 5 = ACTUAL WEBSITE SCREENSHOT to place inside the NEW "朋友圈" card.
Critical requirement: Treat images 2–5 as photographic inserts to be copied and composited. Do not redraw, reimagine, summarize or regenerate their interfaces. Preserve real text, images, avatars, icons, spacing, tags, dark theme and all visible screenshot details. No abstract placeholder lines, no invented article titles, no mountain or sunset illustration replacing the page.
Crop rule: Every screenshot is 1280x720. Each real main content panel is located at x=336, y=16, width=588, height=592. Crop EXACTLY that central main panel from each supplied screenshot and use the crop as the inset image. Exclude the left profile/sidebar, right sidebar and bottom site navigation. Do not remove the site content or replace it with descriptions. Keep each screenshot aspect ratio.
Layout: Create a highly polished portrait poster, ideally 2048x3072, with a roomy TWO BY TWO arrangement of FOUR full equally important front-facing rounded cards. Top left 技术文章, top right 生活随笔, bottom left 灵感闪念, bottom right 朋友圈. The cards must not overlap or obscure each other. Each gets a clean heading band ABOVE the real screenshot, with the exact card label in bold white Chinese. Screenshots should occupy most of each card and retain their original dark UI look. The frames are slightly raised slate with fine periwinkle edging and soft contact shadows. Almost no perspective: keep front-facing screenshots undistorted and readable. Use only subtle dimensionality in the frame edges. Arrange the four nearly square source crops in a balanced grid filling about 60% of the poster. Do not include the original scenic illustrations.
Typography and invariants:
Top brand: "TixXin Blog"
Headline first line: "记录生活点滴"
Headline second line: "分享技术与日常"
Small subtitle: "技术文章、生活随笔、灵感闪念与朋友圈"
Outside each screenshot the ONLY four card labels are: "技术文章", "生活随笔", "灵感闪念", "朋友圈"
Bottom theme row: "技术文章 · 生活随笔 · 灵感闪念 · 朋友圈"
Footer address "tix.xin" and "欢迎来逛逛" with a thin line arrow.
Keep the bold top headline similar to Image 1, but slightly reduce its height if needed to leave generous space for the actual screenshots. Remove Image 1's small handwritten decorative side phrases. Maintain about 5% safe margins and a clean aligned grid. No new copy, no QR code, no watermark, no fake metrics, no device mockup, no scenic filler. User explicitly requested actual page screenshots: authenticity and source fidelity are more important than decorative effects. Finished flat poster image.
```

## 核对结果

四个栏目标签、主标题、站点名称与域名核对通过；卡片边缘无旧生成文字露出。最终截图以独立像素图层合成，PSD 保留四张截图和对应底板，便于后续替换。
