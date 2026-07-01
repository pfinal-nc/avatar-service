/**
 * Node.js 纯函数测试 (无需浏览器)
 * 测试: createRng, bytesToInt, 无 DOM 依赖的纯逻辑
 */
'use strict'

// —— 直接拷贝纯函数（避开 browser-only 的 crypto.subtle / document） ——

// createRng
const createRng = (seed) => {
  let s = seed | 0
  return () => {
    s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// bytesToInt
const bytesToInt = (bytes) =>
  (bytes[0] * 16777216 + bytes[1] * 65536 + bytes[2] * 256 + bytes[3]) >>> 0

// ─── 测试 ──────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(desc, fn) {
  try {
    const ok = fn()
    if (ok) { passed++; return }
    failed++
    console.error(`  ❌ ${desc}`)
  } catch (e) {
    failed++
    console.error(`  ❌ ${desc} — 异常: ${e.message}`)
  }
}

console.log('\n── createRng 确定性 ──')

assert('seed=42 第一次调用', () => {
  const r = createRng(42); return r() === 0.6011037519201636
})

assert('seed=42 序列一致', () => {
  const r1 = createRng(42)
  const r2 = createRng(42)
  for (let i = 0; i < 10; i++) {
    if (r1() !== r2()) return false
  }
  return true
})

assert('seed=0', () => {
  const r = createRng(0)
  const vals = Array.from({ length: 5 }, () => r())
  return vals.every(v => v >= 0 && v < 1)
})

assert('不同 seed 产生不同序列', () => {
  const r1 = createRng(1)
  const r2 = createRng(2)
  // 前 10 个值至少有一个不同 (几乎必然)
  for (let i = 0; i < 10; i++) {
    if (r1() !== r2()) return true
  }
  return false
})

assert('seed=9999999 不崩溃', () => {
  const r = createRng(9999999)
  return typeof r() === 'number'
})

assert('seed 为负值', () => {
  const r = createRng(-42)
  for (let i = 0; i < 100; i++) {
    const v = r()
    if (v < 0 || v >= 1) return false
  }
  return true
})

assert('返回值的范围', () => {
  const r = createRng(12345)
  for (let i = 0; i < 1000; i++) {
    const v = r()
    if (v < 0 || v >= 1) return false
  }
  return true
})

console.log('\n── bytesToInt ──')

assert('标准 4 字节序', () => {
  return bytesToInt(new Uint8Array([0x12, 0x34, 0x56, 0x78])) === 0x12345678
})

assert('全 0', () => {
  return bytesToInt(new Uint8Array([0, 0, 0, 0])) === 0
})

assert('全 255', () => {
  return bytesToInt(new Uint8Array([255, 255, 255, 255])) === 4294967295
})

assert('单字节值', () => {
  return bytesToInt(new Uint8Array([0, 0, 0, 255])) === 255
})

assert('高位字节', () => {
  return bytesToInt(new Uint8Array([255, 0, 0, 0])) === 4278190080
})

assert('中间值', () => {
  return bytesToInt(new Uint8Array([0, 128, 0, 0])) === 8388608
})

console.log('\n── 边界 ──')

assert('只有 1 字节时索引安全', () => {
  // bytes[1] 会是 undefined，但 *65536 → NaN，>>> 0 → 0
  // 实际上正常使用不会传短数组，但确保不抛异常
  try {
    const r = bytesToInt(new Uint8Array([1]))
    return typeof r === 'number'
  } catch (_) { return false }
})

assert('createRng + bytesToInt 集成', () => {
  // 模拟 Pixel 的种子生成逻辑
  const hash = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80])
  const seed = bytesToInt(hash)
  const rng = createRng(seed)
  const vals = Array.from({ length: 8 }, () => rng())
  // 同样的 hash 应产生同样的序列
  const seed2 = bytesToInt(new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]))
  const rng2 = createRng(seed2)
  return vals.every((v, i) => v === rng2())
})

// ─── 结果 ──────────────────────────────────────────────────

console.log(`\n${'─'.repeat(30)}`)
if (failed === 0) {
  console.log(`✅ 全部 ${passed} 项测试通过`)
} else {
  console.log(`❌ ${failed} 失败 / ${passed + failed} 项`)
  process.exit(1)
}
