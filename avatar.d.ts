export interface AvatarOptions {
  style?: 'identicon' | 'pixel'
  size?: number
  format?: 'png' | 'svg'
  foreground?: string | number[]
  background?: string | number[]
  margin?: number
  saturation?: number
  brightness?: number
  maxSize?: number
  ttl?: number
  keyFn?: (args: any[]) => string
}

declare function avatar(seed: string, options?: AvatarOptions): Promise<string>

declare namespace avatar {
  function createRng(seed: number): () => number
  function hashToBytes(seed: string): Promise<Uint8Array>
  function bytesToInt(bytes: Uint8Array): number
  function parseColor(value: string | number[] | undefined, fallback?: number[]): number[]
  function colorToCss(value: string | number[] | undefined): string
  function hslToRgb(h: number, s: number, l: number): number[]
  function drawIdenticon(hash: Uint8Array, size: number, options?: AvatarOptions): any
  function drawPixel(hash: Uint8Array, size: number, options?: AvatarOptions): any
  function canvasToDataUrl(canvas: any): string
  function svgToDataUrl(svg: string): string
  function generate(seed: string, options?: AvatarOptions): Promise<string>
  function withCache(fn: (...args: any[]) => any, options?: AvatarOptions): (...args: any[]) => Promise<any>
}

export = avatar
