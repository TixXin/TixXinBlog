春节假期在家没什么事，把一个搁置很久的想法捡了起来：用 WebGPU 重写我两年前写的那个粒子动画 demo。那个 demo 用的是 WebGL 2，十万个粒子在 MacBook 上跑到 40 帧左右就开始掉，当时我以为是自己写得不好，后来发现是 WebGL 那套模型本身就不适合这种大量数据并行更新的场景。

WebGPU 从 2023 年 5 月在 Chrome 113 正式可用到现在快两年了，Edge 跟着 Chrome 走，Safari 目前还在 Technology Preview 里，Firefox 还在 Nightly。所以它还不能用在面向大众的产品上，但拿来做内部工具、数据可视化或者纯粹的玩具已经完全够了。这篇记录我第一次认真用它的体验，重点放在它和 WebGL 的思路差异上，不是完整教程。

## 从拿到设备开始

WebGL 的入口是 `canvas.getContext('webgl2')`，一行就拿到一个带状态机的上下文。WebGPU 多了几步：先问浏览器要一个适配器（对应一块物理 GPU），再从适配器要一个设备（逻辑设备），然后才配置画布。整个过程是异步的：

```ts
async function initWebGPU(canvas: HTMLCanvasElement) {
  if (!navigator.gpu) {
    throw new Error('当前浏览器不支持 WebGPU')
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) throw new Error('没有可用的 GPU 适配器')
  const device = await adapter.requestDevice()

  const context = canvas.getContext('webgpu')!
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({ device, format, alphaMode: 'premultiplied' })

  return { device, context, format }
}
```

TypeScript 类型要装 `@webgpu/types`，在 `tsconfig.json` 的 `types` 里加上就有完整的提示。`getPreferredCanvasFormat()` 这一步值得注意，它返回当前平台最合适的纹理格式（macOS 上一般是 `bgra8unorm`），不要硬编码。

设备拿到之后，所有东西都挂在 `device` 上创建：缓冲区、着色器模块、管线、绑定组。没有全局状态，没有 `gl.bindBuffer` 之后不知道当前绑的是哪个的问题。这是我用下来感受最强烈的一点：WebGL 像在操作一台有几十个开关的老式机器，你得记住每个开关现在是什么位置；WebGPU 像在填一张表，填完交上去。

## 画一个三角形

着色器语言换成了 WGSL，语法像 Rust 和 Metal 的混合体，第一眼有点陌生，看半小时就顺了。顶点着色器和片元着色器可以写在同一个模块里：

```wgsl
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vs_main(@builtin(vertex_index) index: u32) -> VertexOut {
  var positions = array<vec2f, 3>(
    vec2f(0.0, 0.6),
    vec2f(-0.6, -0.6),
    vec2f(0.6, -0.6),
  );
  var colors = array<vec4f, 3>(
    vec4f(1.0, 0.3, 0.3, 1.0),
    vec4f(0.3, 1.0, 0.3, 1.0),
    vec4f(0.3, 0.3, 1.0, 1.0),
  );
  var out: VertexOut;
  out.position = vec4f(positions[index], 0.0, 1.0);
  out.color = colors[index];
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  return in.color;
}
```

然后在 JS 这边建管线、录制命令、提交：

```ts
const module = device.createShaderModule({ code: shaderSource })
const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module, entryPoint: 'vs_main' },
  fragment: { module, entryPoint: 'fs_main', targets: [{ format }] },
  primitive: { topology: 'triangle-list' },
})

function frame() {
  const encoder = device.createCommandEncoder()
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  })
  pass.setPipeline(pipeline)
  pass.draw(3)
  pass.end()
  device.queue.submit([encoder.finish()])
  requestAnimationFrame(frame)
}
```

“编码器”和“队列”这两个概念是 WebGL 没有的。你不是直接发指令给 GPU，而是先把一帧要做的事录成一个命令缓冲，然后一次性提交。这让浏览器可以把验证和调度放到提交的那一刻做，也是它性能好的来源之一。

## 真正的亮点：计算着色器

回到那个粒子 demo。在 WebGL 2 里要在 GPU 上更新粒子位置，只能借 Transform Feedback 或者把数据编码进纹理再用片元着色器算，都是在“用画图的 API 做计算”。WebGPU 直接给了计算着色器：

```wgsl
struct Particle {
  pos: vec2f,
  vel: vec2f,
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> dt: f32;

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&particles)) { return; }
  var p = particles[i];
  p.vel.y -= 0.98 * dt;
  p.pos += p.vel * dt;
  if (p.pos.y < -1.0) { p.pos.y = -1.0; p.vel.y = -p.vel.y * 0.8; }
  particles[i] = p;
}
```

JS 这边创建一个 `GPUBuffer`，用途标成 `STORAGE | VERTEX`，同一块缓冲既给计算管线读写，又给渲染管线当顶点数据，中间不需要任何拷贝。每帧先 `dispatchWorkgroups(Math.ceil(count / 64))` 跑一遍模拟，再走渲染通道画出来。

结果是十万个粒子稳定 120 帧（显示器上限），我把数量加到一百万才开始掉到 70 帧左右。WebGL 2 版本在十万粒子时是 40 帧。这不是因为我的 WebGPU 代码写得多好，而是计算完全没有离开 GPU，CPU 每帧只负责提交两个命令。

## 绑定组：数据是怎么交给着色器的

上面的计算着色器里出现了 `@group(0) @binding(0)`，这是 WebGPU 里我花了最多时间才想通的概念。WebGL 里给着色器传数据是一个一个来的：`gl.uniform1f` 设一个浮点数，`gl.bindTexture` 绑一张纹理，调用顺序和当前状态绑在一起。WebGPU 把这些资源打包成“绑定组”，一次性绑定到管线上。

绑定组有两层：布局描述“第几个槽位放什么类型的资源、哪些着色器阶段能访问”，绑定组本身描述“这个槽位具体放哪块缓冲”。同一个布局可以对应很多个绑定组，比如一百个物体共用一套材质布局，各自有一个绑定组装自己的变换矩阵。渲染的时候 `setBindGroup(0, group)` 换一下就行，不需要重新设置几十个 uniform。

```ts
const bindGroup = device.createBindGroup({
  layout: computePipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer: particleBuffer } },
    { binding: 1, resource: { buffer: dtBuffer } },
  ],
})
```

写代码的时候这确实比 WebGL 啰嗦，但它换来的是所有数据依赖在创建时就被验证过，运行时不会再出现“忘了绑纹理结果画出一片黑”这类要查半天的问题。我重写粒子 demo 时遇到的错误全部是在控制台里直接告诉我哪个槽位类型不对，没有一次是靠猜的。

另外一个和 WebGL 完全不同的习惯是数据对齐。WGSL 里的结构体有严格的对齐规则，`vec3f` 占 16 字节而不是 12，一个包含 `vec3f` 和 `f32` 的结构体在 JS 里用 `Float32Array` 填充时要手动留出空位。我的粒子结构一开始用 `vec3f` 存位置，JS 这边按 12 字节一个粒子写进去，结果所有粒子位置全乱了，排查了快一个小时才意识到是对齐问题，后来干脆改成两个 `vec2f` 绕开。

## 和 WebGL 相比还有什么不一样

- **错误处理。** WebGL 出错是静默的，要自己 `gl.getError()`；WebGPU 会在控制台打出非常具体的验证信息，比如“绑定组布局和管线不匹配，期待 uniform 但给了 storage”，调试体验好了一个量级。
- **资源生命周期显式。** 缓冲和纹理用完要自己 `destroy()`，不然等 GC。写惯 JS 会忘。
- **没有立即模式。** 想改一个 uniform 必须 `device.queue.writeBuffer` 写进缓冲，不能像 `gl.uniform1f` 那样随手设。
- **着色器编译是异步的。** `createShaderModule` 返回后可以用 `getCompilationInfo()` 拿警告和错误，行号是准的。
- **多线程友好。** 设备可以在 Worker 里用，画布通过 `OffscreenCanvas` 转过去，主线程完全不参与渲染。

## 现在能用在哪

兼容性是最大的限制。写这篇的时候我特意查了一下自己博客最近一个月的访问统计，能跑 WebGPU 的浏览器大概占六成，剩下的要么是 Safari，要么是国内一些基于旧内核的浏览器。我的博客访客里 Safari 占了将近三成，所以这个粒子效果只能做渐进增强：检测到 `navigator.gpu` 才用 WebGPU，否则退回原来的 WebGL 版本，再不行就是静态背景。两套代码维护起来确实有点烦，但目前没别的办法。

抛开兼容性，我觉得 WebGPU 最大的价值不是“更快的 WebGL”，而是把 GPU 计算这件事正常化了。以前在浏览器里做并行计算是奇技淫巧，现在是写一个函数的事。接下来我打算试试用它做图片处理，把博客图库里的滤镜从 Canvas 2D 搬过去，有结果再写。
