declare module 'gifuct-js' {
  export interface GifFrame {
    dims: { left: number; top: number; width: number; height: number }
    patch: Uint8ClampedArray
    delay: number
    disposalType: number
  }
  export interface ParsedGif {
    lsd: { width: number; height: number }
  }
  export function parseGIF(data: ArrayBuffer): ParsedGif
  export function decompressFrames(gif: ParsedGif, buildPatch: boolean): GifFrame[]
}
