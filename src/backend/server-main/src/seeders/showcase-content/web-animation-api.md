博客的图库页面有一个看图模式，点一张缩略图，它会放大到屏幕中央，旁边出现上一张下一张的按钮。这个动画最早是用 CSS transition 写的，一直没什么问题，直到上个月我想加一个功能：用户按住方向键的时候图片快速切换，松开后慢慢减速停下来。用 CSS 写了两天，各种 class 切换加 `transitionend` 监听，代码越写越乱，最后还是有状态对不上的 bug。

然后我想起了 Web Animations API。这东西 2016 年左右就有了，但我一直没怎么用过，总觉得 CSS 动画够用。这次认真用了一遍之后，发现它解决的正是 CSS 动画最难搞的那部分：**运行中的动画怎么控制**。

## CSS 动画到底缺什么

CSS 的 transition 和 animation 本质上是声明式的：你描述起点、终点和时长，浏览器负责播放。这在“点一下就跑完”的场景下很好，但一旦你想在中间插手，就会发现几乎没有抓手：

- 想暂停？`animation-play-state: paused` 可以，但 transition 没有对应的东西。
- 想倒放？只能再写一个反向的 keyframes，或者改 `animation-direction` 然后重新触发。
- 想知道现在播到哪了？没办法，只能自己用时间戳算。
- 想在动画播到一半时改变终点？CSS 会从当前计算值重新开始一段新 transition，但你拿不到任何控制权。
- 想在动画结束时拿到一个 Promise？得自己包一层 `transitionend`，而且这个事件在动画被打断时不会触发，经常漏。

我那个“按住加速、松开减速”的需求，恰好每一条都踩中了。

## WAAPI 的基本用法

Web Animations API 的入口是 `Element.animate()`，参数和 CSS keyframes 几乎一一对应，返回一个 `Animation` 对象：

```ts
const el = document.querySelector<HTMLElement>('.lightbox-image')!

const animation = el.animate(
  [
    { transform: 'scale(0.6)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 },
  ],
  {
    duration: 320,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    fill: 'forwards',
  },
)

await animation.finished
console.log('动画结束')
```

这一段和 CSS 写法差别不大，但从 `animation` 这个对象开始，事情就不一样了。它有这些你在 CSS 里拿不到的东西：

```ts
animation.pause()
animation.play()
animation.reverse() // 从当前位置倒着播
animation.playbackRate = 2 // 两倍速
animation.currentTime = 160 // 直接跳到 160ms 处
animation.cancel() // 取消并清掉效果
animation.finished // Promise，结束时 resolve，取消时 reject
```

`reverse()` 是我最喜欢的一个。看图模式的关闭动画，以前要单独写一套 keyframes，现在只需要对打开动画调一次 `reverse()`，而且如果用户在打开到一半时点了关闭，它会从一半的位置倒回去，不会跳。

## 回到那个需求：按住加速，松开减速

有了 `playbackRate` 之后，“按住方向键快速切换”这个需求变得非常直接。我把图片切换做成一个无限循环的位移动画，按键时调高播放速率，松开后用一个小的缓动把速率降回零：

```ts
import { onMounted, onUnmounted } from 'vue'

export function useSpinner(track: HTMLElement, itemWidth: number, count: number) {
  const anim = track.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${itemWidth * count}px)` }], {
    duration: count * 400,
    iterations: Infinity,
    easing: 'linear',
  })
  anim.pause()

  let decayTimer: number | undefined

  function speedUp() {
    window.clearInterval(decayTimer)
    anim.playbackRate = 3
    anim.play()
  }

  function release() {
    decayTimer = window.setInterval(() => {
      anim.playbackRate = Math.max(0, anim.playbackRate - 0.25)
      if (anim.playbackRate === 0) {
        window.clearInterval(decayTimer)
        anim.pause()
      }
    }, 50)
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowRight') return
    e.type === 'keydown' ? speedUp() : release()
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
  })
  onUnmounted(() => {
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('keyup', onKey)
    anim.cancel()
  })
}
```

这段代码我省略了“停在最近一张整图上”的对齐逻辑，那部分是读 `anim.currentTime` 算出当前偏移，再补一段短动画把它推到最近的格子上。关键是整个过程只有一个 `Animation` 对象，所有状态都在它身上，不再有一堆 class 和定时器互相打架。用 CSS 写的那两天代码，换成 WAAPI 之后不到八十行。

## 另一个用法：把动画进度交给别的东西控制

`currentTime` 可以写，这个特性打开了另一扇门：动画不一定要按时间播放，可以把它的进度绑定到任何一个数值上。博客顶部的阅读进度条就是这么做的。我先定义一条从 0 到 100% 宽度的动画，然后 `pause()` 住，之后在滚动事件里根据滚动比例去设置 `currentTime`，动画本身一帧都不会自己播，完全由滚动驱动。

这样做比直接改 `style.width` 的好处是，缓动、颜色渐变、甚至多段关键帧都可以写在动画定义里，滚动处理函数只负责算一个 0 到 1 的比例，职责分得很清楚。而且如果以后想换成浏览器原生的滚动驱动动画，只要把这个手动设置的部分去掉就行，关键帧定义可以原样保留。

同样的思路也可以用在手势上。拖动关闭看图模式的时候，手指移动的距离映射成关闭动画的进度，松手时根据当前进度决定是 `play()` 继续关闭还是 `reverse()` 弹回去。整个交互只有一个动画对象和两个事件处理函数，比我以前用 transform 加 transition 硬凑出来的版本干净太多了。

## 几个值得注意的细节

**`fill: 'forwards'` 不是免费的。**它会让动画结束后保持终态，但这个终态是动画层的，优先级高于你的样式表。如果之后你改了元素的 `style.transform`，会发现不生效，因为动画还在“填充”。我的做法是动画结束后调 `commitStyles()` 把终态写进内联样式，然后 `cancel()` 掉动画。

**`finished` 在取消时会 reject。**这意味着你 `await animation.finished` 的时候要 catch 一下，否则用户快速连点会在控制台里刷一堆 AbortError。

**复合动画可以叠加。**同一个元素可以同时跑多个 `animate()`，用 `composite: 'add'` 让它们叠加而不是覆盖。我用这个做了一个“放大的同时轻微晃动”的效果，两个动画各管各的，互不干扰。

**性能和 CSS 动画一样。**只要你动的是 `transform` 和 `opacity`，WAAPI 动画同样跑在合成线程上，主线程卡住也不会掉帧。我用图库里 40 张图的切换实测了一下，CSS 和 WAAPI 两种实现的帧率曲线基本重合。

**浏览器支持已经不是问题。**到今年，`Element.animate()`、`playbackRate`、`reverse()`、`commitStyles()` 这些在主流浏览器里都已经稳定可用，我没有加任何 polyfill。

## 什么时候还用 CSS

说了这么多，我并没有把博客里所有动画都改成 WAAPI。悬停时按钮变色、卡片进入时淡入、主题切换时的渐变，这些“触发一次、跑完就完”的动画，CSS 依然是最省事的写法，写在样式表里，不占 JS 体积，也不需要拿到元素引用。

我的分界线是：**动画需不需要在运行中被控制**。需要暂停、倒放、变速、跟手势联动、或者多个动画之间有时序依赖的，用 WAAPI；其它的留给 CSS。按这个标准，博客里目前只有看图模式和阅读进度指示器两处用了 WAAPI，剩下的几十处都还是 CSS。

写完那个按键加速的功能之后，我把图库的打开和关闭动画也顺手换成了 WAAPI，去掉了三个 class 和两个 `transitionend` 监听。代码少了，行为反而更可预测了。这大概就是用对工具的感觉。
