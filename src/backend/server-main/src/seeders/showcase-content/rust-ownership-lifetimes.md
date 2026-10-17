七月底我给自己定了一个目标：用 Rust 把博客的图片压缩脚本重写一遍。原本那个脚本是 Node 写的，跑一次要三十多秒，我想看看换成 Rust 能快多少。结果第一周我连一张图都没压出来，全部时间花在和编译器吵架上，报错信息里反复出现的就是那几个词：moved、borrowed、lifetime。

写了七八年 JavaScript 之后，我以为学一门新语言无非是换个语法。Rust 给我的教训是，它换的不是语法，是你对“一个值在内存里属于谁”这件事的整个想法。这篇文章是我在六周之后回头整理的笔记，用 JS 的思维去类比，希望能帮同样背景的人少撞几次墙。

## 从 JS 的视角看，所有权到底在管什么

在 JS 里我们从来不想“这个对象归谁”。你 `const a = { x: 1 }`，再 `const b = a`，两个变量指向同一个对象，谁都能改，等没人引用了垃圾回收器会收走。这个模型很舒服，代价是你不知道对象什么时候释放，也不知道改了 `b` 会不会影响到某个你没想到的地方。

Rust 没有垃圾回收器，它用一套规则在编译期决定每个值什么时候释放：

1. 每个值有且只有一个所有者。
2. 所有者离开作用域时，值被释放。
3. 把值赋给另一个变量或传给函数，所有权就**移动**过去了，原来的变量不能再用。

第三条是最反直觉的。下面这段代码在 JS 里完全正常，在 Rust 里编译不过：

```rust
fn main() {
    let name = String::from("TixXin");
    let greeting = make_greeting(name);
    println!("{}", greeting);
    println!("{}", name); // 错误：value borrowed here after move
}

fn make_greeting(n: String) -> String {
    format!("Hello, {}", n)
}
```

`name` 传给 `make_greeting` 之后，所有权移进了函数，函数结束时 `n` 被释放，外面的 `name` 已经是个空壳了。我最初的反应是“那我怎么用一个值两次”，后来才明白这就是借用要解决的问题。

## 借用：不拿走，只看一眼

借用就是在不转移所有权的前提下用一个值，语法上就是加一个 `&`。用 JS 类比的话，有点像“传引用但承诺不改”：

```rust
fn main() {
    let name = String::from("TixXin");
    let greeting = make_greeting(&name);
    println!("{}", greeting);
    println!("{}", name); // 正常，name 还在
}

fn make_greeting(n: &str) -> String {
    format!("Hello, {}", n)
}
```

借用分两种，不可变借用 `&T` 和可变借用 `&mut T`。规则是：同一时刻，要么有任意多个不可变借用，要么只有一个可变借用，两者不能共存。这条规则我第一次读的时候觉得很严苛，直到想起自己在 JS 里踩过的坑：

```ts
const list = [1, 2, 3, 4]
for (const item of list) {
  if (item % 2 === 0) {
    list.splice(list.indexOf(item), 1) // 一边遍历一边删，结果跳过了元素
  }
}
console.log(list) // [1, 3, 4]，不是预期的 [1, 3]
```

这个 bug 的本质就是“有人在读的时候有人在写”。Rust 的借用规则在编译期就把这种代码拦下来了，你根本写不出一边遍历 `Vec` 一边往里 `push` 的代码。理解到这一层之后，我对借用检查器的态度从“它在刁难我”变成了“它在替我做 code review”。

## 生命周期：借用能活多久

借用引出了下一个问题：一个引用指向的值如果先被释放了怎么办？JS 里不存在这个问题，因为垃圾回收器保证只要有引用值就不会被回收。Rust 用生命周期来保证引用一定不会活得比它指向的值更久。

大多数时候生命周期是编译器自动推断的，你不需要写。但当一个函数接收多个引用并返回其中一个时，编译器不知道返回值跟哪个参数绑定，就需要你标注：

```rust
fn longer<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() >= y.len() { x } else { y }
}

fn main() {
    let a = String::from("nuxt");
    let result;
    {
        let b = String::from("vue");
        result = longer(&a, &b);
        println!("{}", result); // 这里可以用
    }
    // println!("{}", result); // 错误：b 已经被释放，result 可能指向它
}
```

`'a` 这个标注不是在“设定”生命周期，而是在告诉编译器“返回值的存活时间不超过 x 和 y 中较短的那个”。我一开始总想着怎么写标注让代码编译过，后来发现思路反了：标注是在描述事实，如果事实本身不成立，比如上面那个被注释掉的 `println!`，怎么标都没用，该改的是代码结构。

还有一个常见的误区是把 `'a` 理解成“这个引用要活到 a 这么久”，然后试图通过改标注来延长它。实际上生命周期标注只能描述，不能延长任何东西，一个引用能活多久完全取决于它指向的值在哪个作用域里。我有一次卡了一整晚，最后的解法是把 `String` 的所有权直接移进结构体，根本不用引用，标注自然就消失了。很多时候“需要写生命周期标注”本身就是一个信号，说明这里或许不该用引用。

一个对我帮助很大的心智模型是把生命周期想成 TypeScript 的泛型参数。`fn longer<'a>` 和 `function longer<T>` 的结构是一样的，只不过 `T` 约束的是类型，`'a` 约束的是“活多久”。它们都是编译期的信息，运行时不存在。

## 回到那个压缩脚本

搞懂这三样之后，脚本写起来就顺了。核心部分大概是这样，用 `image` 这个 crate 读图、缩放、再编码成 WebP：

```rust
use image::{imageops::FilterType, ImageReader};
use std::path::Path;

fn compress(input: &Path, output: &Path, max_width: u32) -> Result<(), Box<dyn std::error::Error>> {
    let img = ImageReader::open(input)?.decode()?;
    let resized = if img.width() > max_width {
        let ratio = max_width as f32 / img.width() as f32;
        let height = (img.height() as f32 * ratio) as u32;
        img.resize(max_width, height, FilterType::Lanczos3)
    } else {
        img
    };
    resized.save(output)?;
    Ok(())
}
```

注意 `compress` 接收的是 `&Path`，借用而不是拿走所有权，所以调用方可以在一个循环里反复用同一个路径变量。`img` 在 `if` 分支里被移动进了 `resize`，另一个分支直接返回 `img` 本身，两个分支都把所有权交给了 `resized`，这是合法的，因为编译器知道只会走其中一条。

最后跑下来，同一批 212 张图，Node 版本平均 31 秒，Rust 版本 4.7 秒。差距主要不在语言本身，而是 Node 那个脚本是串行的，Rust 版本我用 `rayon` 做了并行，而且并行写起来很安心，因为借用规则保证了不会有两个线程同时改同一份数据。

## 给前端同行的几条建议

- **先别碰 `Rc`、`RefCell`、`Box<dyn Trait>`。** 这些是绕开所有权限制的工具，初学时很容易拿它们当拐杖，结果写出一堆运行时才报错的代码，把 Rust 最大的优势丢了。
- **报错先读完再改。** Rust 的编译错误是我见过最详细的，经常直接告诉你加个 `&` 或者 `.clone()` 就行。我前两周有一半的时间是没读完报错就乱改。
- **`.clone()` 不丢人。** 初学阶段，复制一份数据换来编译通过，比纠结半天怎么借用更划算。等熟了再回头优化。
- **用 `cargo clippy`。** 它会指出很多“能编译但不地道”的写法，比如不必要的克隆、可以用迭代器的循环。

六周之后我的感受是，Rust 并没有让我成为一个 Rust 程序员，但它确实改变了我写 JS 的方式。现在写一个函数的时候，我会下意识想“这个参数我是要改它，还是只是读它”，然后更倾向于不改。这个习惯本身，已经值回这六周了。
