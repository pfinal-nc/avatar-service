/*!
 * avatar.js — 轻量级随机头像生成库
 * 基于 seed 的确定性 Identicon / Pixel 风格头像
 * 纯 FP 风格, 无 class, 无 this, 无 new
 *
 * Usage:
 *   const url = await avatar('pfinalclub', { style: 'pixel', size: 128 })
 *   document.getElementById('avatar').src = url
 *
 * 内置缓存 (LRU, max 100, TTL 10min), 相同 seed 第二次调用即时返回
 * 依赖: 浏览器 Web Crypto API + Canvas 2D (无需安装)
 */
;(function (root) {
  'use strict'

  // ─── Seeded PRNG (mulberry32) ──────────────────────────────
  // 纯函数工厂: 给定相同 seed, 返回相同的确定性随机数序列
  const createRng = (seed) => {
    let s = seed | 0
    return () => {
      s = (s + 0x6D2B79F5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // ─── Hashing ────────────────────────────────────────────────
  // 字符串 → SHA-256 → Uint8Array (优先 Web Crypto，缺失时回退到纯 JS)
  const fallbackHashToBytes = (seed) => {
    const bytes = new Uint8Array(32)
    const input = typeof seed === 'string' ? seed : String(seed)
    const data = new TextEncoder().encode(input)
    let state = 0x811c9dc5 >>> 0

    for (let i = 0; i < data.length; i++) {
      state ^= data[i]
      state = Math.imul(state, 0x01000193) >>> 0
    }

    for (let i = 0; i < bytes.length; i++) {
      state = (state + 0x9e3779b9 + i * 0x85ebca6b) >>> 0
      bytes[i] = (state >>> ((i % 4) * 8)) & 0xff
    }

    return bytes
  }

  const hashToBytes = (seed) => {
    const subtle = typeof crypto !== 'undefined' && crypto.subtle
    if (!subtle) {
      return Promise.resolve(fallbackHashToBytes(seed))
    }

    return subtle
      .digest('SHA-256', new TextEncoder().encode(seed))
      .then((buf) => new Uint8Array(buf))
  }

  // Uint8Array 前 4 字节 → uint32 (PRNG 种子)
  const bytesToInt = (bytes) =>
    (bytes[0] * 16777216 + bytes[1] * 65536 + bytes[2] * 256 + bytes[3]) >>> 0

  // ─── Color helpers ────────────────────────────────────────
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  const parseColor = (value, fallback = [255, 255, 255, 255]) => {
    if (Array.isArray(value)) {
      const [r, g, b, a = 255] = value
      return [Number(r), Number(g), Number(b), Number(a)]
    }

    if (typeof value === 'string') {
      const input = value.trim()
      if (!input) return fallback

      if (input.startsWith('#')) {
        const hex = input.slice(1)
        if (hex.length === 3) {
          const expanded = hex.split('').map((c) => c + c).join('')
          return [
            parseInt(expanded.slice(0, 2), 16),
            parseInt(expanded.slice(2, 4), 16),
            parseInt(expanded.slice(4, 6), 16),
            255
          ]
        }

        if (hex.length === 6) {
          return [
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16),
            255
          ]
        }
      }

      const rgbaMatch = input.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([0-9.]+))?\s*\)$/i)
      if (rgbaMatch) {
        const [, r, g, b, a = '1'] = rgbaMatch
        return [Number(r), Number(g), Number(b), Math.round(Number(a) * 255)]
      }
    }

    return fallback
  }

  const colorToCss = (color) => {
    const [r, g, b, a = 255] = parseColor(color, [255, 255, 255, 255])
    const alpha = clamp(a / 255, 0, 1)
    return alpha >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`
  }

  const hslToRgb = (h, s, l) => {
    const hue = h * 6
    const m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s
    const m1 = l * 2 - m2
    const hueToRgb = (hueValue) => {
      if (hueValue < 0) hueValue += 1
      if (hueValue > 1) hueValue -= 1
      if (hueValue * 6 < 1) return m1 + (m2 - m1) * hueValue * 6
      if (hueValue * 2 < 1) return m2
      if (hueValue * 3 < 2) return m1 + (m2 - m1) * (2 / 3 - hueValue) * 6
      return m1
    }

    return [
      Math.round(hueToRgb(hue + 1 / 3) * 255),
      Math.round(hueToRgb(hue) * 255),
      Math.round(hueToRgb(hue - 1 / 3) * 255)
    ]
  }

  const getForegroundColor = (hash, options = {}) => {
    if (options.foreground !== undefined) {
      return parseColor(options.foreground, [0, 0, 0, 255])
    }

    const bytes = hash instanceof Uint8Array ? hash : new Uint8Array(hash)
    const hueSeed = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2]
    const hue = (hueSeed >>> 0) / 0xffffff
    const saturation = options.saturation ?? 0.72
    const brightness = options.brightness ?? 0.62
    return [...hslToRgb(hue, saturation, brightness), 255]
  }

  const getBackgroundColor = (options = {}) => {
    if (options.background !== undefined) {
      return parseColor(options.background, [255, 255, 255, 255])
    }
    return [255, 255, 255, 255]
  }

  // ─── Draw Identicon ─────────────────────────────────────────
  // 7×7 对称镜像网格, 仿 GitHub 风格
  // 颜色由 hash 前 3 字节决定, 填充由 hash 字节奇偶性决定
  const drawIdenticon = (hash, size, options = {}) => {
    const grid = 7
    const marginRatio = options.margin ?? 0.08
    const baseMargin = Math.max(0, Math.floor(size * marginRatio))
    const cellSize = Math.max(1, Math.floor((size - 2 * baseMargin) / grid))
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const background = getBackgroundColor(options)
    const foreground = getForegroundColor(hash, options)

    ctx.fillStyle = colorToCss(background)
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = colorToCss(foreground)

    for (let x = 0; x < ((grid / 2) | 0) + 1; x++) {
      for (let y = 0; y < grid; y++) {
        if (hash[x * grid + y] % 2 !== 0) continue

        const lx = baseMargin + x * cellSize
        const ly = baseMargin + y * cellSize
        ctx.fillRect(lx, ly, cellSize, cellSize)

        const rx = baseMargin + (grid - 1 - x) * cellSize
        if (rx !== lx) {
          ctx.fillRect(rx, ly, cellSize, cellSize)
        }
      }
    }

    return canvas
  }

  // ─── Draw Pixel ─────────────────────────────────────────────
  // 8×8 随机像素块, 60% 填充概率, 每格随机亮色
  const drawPixel = (hash, size, options = {}) => {
    const grid = 8
    const cellSize = Math.max(1, Math.floor(size / grid))
    const rng = createRng(bytesToInt(hash))
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const background = getBackgroundColor(options)
    const foreground = getForegroundColor(hash, options)

    ctx.fillStyle = colorToCss(background)
    ctx.fillRect(0, 0, size, size)

    for (let x = 0; x < grid; x++) {
      for (let y = 0; y < grid; y++) {
        if (rng() >= 0.6) continue

        const r = clamp(Math.round(foreground[0] + (rng() - 0.5) * 120), 0, 255)
        const g = clamp(Math.round(foreground[1] + (rng() - 0.5) * 120), 0, 255)
        const b = clamp(Math.round(foreground[2] + (rng() - 0.5) * 120), 0, 255)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }

    return canvas
  }

  const buildIdenticonSvg = (hash, size, options = {}) => {
    const grid = 7
    const marginRatio = options.margin ?? 0.08
    const baseMargin = Math.max(0, Math.floor(size * marginRatio))
    const cellSize = Math.max(1, Math.floor((size - 2 * baseMargin) / grid))
    const background = colorToCss(getBackgroundColor(options))
    const foreground = colorToCss(getForegroundColor(hash, options))

    const rects = []
    for (let x = 0; x < ((grid / 2) | 0) + 1; x++) {
      for (let y = 0; y < grid; y++) {
        if (hash[x * grid + y] % 2 !== 0) continue

        const lx = baseMargin + x * cellSize
        const ly = baseMargin + y * cellSize
        rects.push(`<rect x="${lx}" y="${ly}" width="${cellSize}" height="${cellSize}" fill="${foreground}" />`)

        const rx = baseMargin + (grid - 1 - x) * cellSize
        if (rx !== lx) {
          rects.push(`<rect x="${rx}" y="${ly}" width="${cellSize}" height="${cellSize}" fill="${foreground}" />`)
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${background}" />${rects.join('')}</svg>`
  }

  const buildPixelSvg = (hash, size, options = {}) => {
    const grid = 8
    const cellSize = Math.max(1, Math.floor(size / grid))
    const rng = createRng(bytesToInt(hash))
    const background = colorToCss(getBackgroundColor(options))
    const foreground = getForegroundColor(hash, options)
    const rects = []

    for (let x = 0; x < grid; x++) {
      for (let y = 0; y < grid; y++) {
        if (rng() >= 0.6) continue

        const r = clamp(Math.round(foreground[0] + (rng() - 0.5) * 120), 0, 255)
        const g = clamp(Math.round(foreground[1] + (rng() - 0.5) * 120), 0, 255)
        const b = clamp(Math.round(foreground[2] + (rng() - 0.5) * 120), 0, 255)
        rects.push(`<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="rgb(${r},${g},${b})" />`)
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${background}" />${rects.join('')}</svg>`
  }

  // ─── Canvas → PNG Data URL ──────────────────────────────────
  const canvasToDataUrl = (canvas) => canvas.toDataURL('image/png')
  const svgToDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

  // ─── Generate (组合层) ──────────────────────────────────────
  // 串联 hash → draw → toDataUrl
  const generate = (seed, options = {}) => {
    if (!seed) return Promise.reject(new Error('avatar: seed is required'))

    return hashToBytes(seed).then((hash) => {
      const size = options.size || 512
      const style = options.style || 'identicon'
      const format = (options.format || 'png').toLowerCase()

      if (format === 'svg') {
        const svg = style === 'pixel' ? buildPixelSvg(hash, size, options) : buildIdenticonSvg(hash, size, options)
        return svgToDataUrl(svg)
      }

      const canvas =
        style === 'pixel'
          ? drawPixel(hash, size, options)
          : drawIdenticon(hash, size, options)
      return canvasToDataUrl(canvas)
    })
  }

  // ─── Cache Decorator ────────────────────────────────────────
  // 通用记忆化装饰器: LRU 淘汰 + TTL 过期
  const withCache = (fn, options = {}) => {
    const maxSize = options.maxSize || 100
    const ttl = options.ttl || 10 * 60 * 1000
    const keyFn =
      options.keyFn ||
      ((args) => {
        const [seed, opts] = args
        return `${seed}:${(opts && opts.style) || 'identicon'}:${(opts && opts.size) || 512}`
      })
    const cache = new Map()

    const cached = (...args) => {
      const key = keyFn(args)
      const entry = cache.get(key)

      if (entry && Date.now() - entry.time < ttl) {
        return Promise.resolve(entry.data)
      }

      cache.delete(key)

      return fn(...args).then((result) => {
        if (cache.size >= maxSize) {
          cache.delete(cache.keys().next().value)
        }
        cache.set(key, { data: result, time: Date.now() })
        return result
      })
    }

    return cached
  }

  // ─── Public API ─────────────────────────────────────────────
  // generate + withCache 组合, 缓存默认开启
  const avatar = withCache(generate, {
    keyFn: (args) => {
      const seed = args[0]
      const opts = args[1] || {}
      return `${seed}:${opts.style || 'identicon'}:${opts.size || 512}`
    }
  })

  // ─── 底层函数也暴露, 方便组合使用 ────────────────────────────
  avatar.createRng = createRng
  avatar.hashToBytes = hashToBytes
  avatar.bytesToInt = bytesToInt
  avatar.parseColor = parseColor
  avatar.colorToCss = colorToCss
  avatar.hslToRgb = hslToRgb
  avatar.drawIdenticon = drawIdenticon
  avatar.drawPixel = drawPixel
  avatar.canvasToDataUrl = canvasToDataUrl
  avatar.svgToDataUrl = svgToDataUrl
  avatar.generate = generate
  avatar.withCache = withCache

  // ─── UMD ────────────────────────────────────────────────────
  if (typeof define === 'function' && define.amd) {
    define([], () => avatar)
  } else if (typeof module === 'object' && module.exports) {
    module.exports = avatar
  } else {
    root.avatar = avatar
  }
})(typeof window !== 'undefined' ? window : globalThis)
