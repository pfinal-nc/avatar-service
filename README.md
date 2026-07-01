# avatar-service

一个轻量级、可直接用于浏览器和 Node.js 的头像生成库。

它可以基于 seed 生成确定性的头像，并支持两种风格：

- Identicon：经典的方块风格头像
- Pixel：更偏像素风格的随机头像

此外，当前版本还支持：

- 通过 `seed` 生成稳定结果
- 生成 PNG / SVG 格式的 Data URL
- 自定义前景色、背景色、边距、饱和度、亮度
- 内置缓存，重复生成更快
- 兼容浏览器环境和 CommonJS

---

## 特性

### 1. 确定性生成
相同的 `seed` 会生成相同的结果，适合做头像、用户标识、徽章等场景。

### 2. 多种风格
- `identicon`：适合经典头像展示
- `pixel`：适合像素风格或更有创意的视觉效果

### 3. 可配置视觉参数
你可以自定义：

- `foreground`：前景色
- `background`：背景色
- `margin`：边距比例
- `saturation`：饱和度
- `brightness`：亮度
- `format`：`png` 或 `svg`

### 4. 内置缓存
同样的参数会被缓存，第二次调用通常会更快。

---

## 安装

### 浏览器
直接引入脚本即可：

```html
<script src="./avatar.js"></script>
```

### Node.js
```bash
npm install
```

然后使用：

```js
const avatar = require('./avatar.js')
```

> 由于实现依赖 `crypto.subtle` 和 Canvas，浏览器环境建议通过 `http://`、`https://` 或 `localhost` 打开页面。

---

## 基本用法

### 浏览器示例

```html
<img id="avatar" alt="avatar" />
<script src="./avatar.js"></script>
<script>
  ;(async () => {
    const url = await avatar('pfinalclub', {
      style: 'identicon',
      size: 128
    })
    document.getElementById('avatar').src = url
  })()
</script>
```

### Node.js 示例

```js
const avatar = require('./avatar.js')

;(async () => {
  const url = await avatar('pfinalclub', {
    style: 'identicon',
    size: 256
  })
  console.log(url)
})()
```

---

## 高级用法

### 生成 SVG

```js
const url = await avatar('demo', {
  style: 'identicon',
  size: 128,
  format: 'svg',
  foreground: '#4f46e5',
  background: '#f8fafc',
  margin: 0.1
})
```

### Pixel 风格

```js
const url = await avatar('demo', {
  style: 'pixel',
  size: 128
})
```

---

## API

```js
avatar(seed, options)
```

### 参数

- `seed`：字符串，头像生成的种子
- `options`：可选配置对象

### 可选配置

```js
{
  style: 'identicon' | 'pixel',
  size: 128,
  format: 'png' | 'svg',
  foreground: '#4f46e5',
  background: '#ffffff',
  margin: 0.08,
  saturation: 0.7,
  brightness: 0.5
}
```

---

## 测试

项目中提供了两个测试入口：

- `test.html`：浏览器测试页面
- `test.pure.js`：纯函数测试脚本

### 浏览器测试

建议使用本地静态服务器运行，例如：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/test.html
```

### Node 测试

```bash
node test.pure.js
```

---

## 项目文件说明

- `avatar.js`：主实现文件
- `avatar.min.js`：压缩版本
- `test.html`：浏览器测试页
- `test.pure.js`：纯函数测试脚本
- `README.md`：项目说明

---

## 说明

这个项目适合做以下场景：

- 用户头像生成
- 评论区头像
- 论坛/博客头像标识
- 小型头像服务或前端组件演示
- 学习和实验性的生成式图像逻辑

如果你愿意，我也可以继续帮你把这个库再升级成：

- 支持更多风格（圆形、圆角、网格等）
- 提供 npm 包化版本
- 增加 TypeScript 类型定义
- 做成一个更完整的前端头像组件库
