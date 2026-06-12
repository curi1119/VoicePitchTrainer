import { describe, expect, it } from 'vitest'
import { freqOf, midiOf } from '../src/audio/notes'
import { detectPitch } from '../src/audio/pitch-detector'

const SR = 48000
const N = 4096

/** 再現性のある擬似乱数 (mulberry32) */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 人声を模した合成信号 (HANDOVER.md §4.2 の回帰テスト仕様):
 * 基音が弱く(振幅0.05)3〜6次倍音が強い + 軽いノイズ。
 * 自己相関法では倍音にロックして誤検出していた特性を再現する。
 */
function synthVoice(midi: number): Float32Array {
  const f = freqOf(midi)
  const amps = [0.05, 0.15, 0.3, 0.28, 0.25, 0.18]
  const rand = mulberry32(0xc0ffee ^ midi)
  const buf = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    let v = 0
    for (let h = 1; h <= amps.length; h++) {
      v += amps[h - 1] * Math.sin((2 * Math.PI * f * h * i) / SR + h * 0.7)
    }
    buf[i] = v + (rand() * 2 - 1) * 0.005
  }
  return buf
}

describe('detectPitch (YIN) 回帰テスト', () => {
  it('人声模擬信号で C2〜C5 を誤差 ±2 セント以内で検出する(倍音ロックしない)', () => {
    let maxErr = 0
    for (let midi = 36; midi <= 72; midi++) {
      const got = detectPitch(synthVoice(midi), SR)
      expect(got, `MIDI ${midi} で検出失敗`).toBeGreaterThan(0)
      const errCents = (midiOf(got) - midi) * 100
      maxErr = Math.max(maxErr, Math.abs(errCents))
      // 倍音(+1200セント以上)へのロックがないことを含めて確認
      expect(Math.abs(errCents), `MIDI ${midi}: ${errCents.toFixed(2)} cents`).toBeLessThanOrEqual(
        2,
      )
    }
    // 参考: プロトタイプでの実測は 0.1 セント以内 (HANDOVER.md §4.2)
    expect(maxErr).toBeLessThanOrEqual(2)
  })

  it('無音(ゼロ信号)は棄却する', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBe(-1)
  })

  it('RMS ゲート未満の微小信号は棄却する', () => {
    const buf = new Float32Array(N)
    for (let i = 0; i < N; i++) buf[i] = 0.01 * Math.sin((2 * Math.PI * 220 * i) / SR)
    expect(detectPitch(buf, SR)).toBe(-1)
  })

  it('純音(サイン波)も検出できる', () => {
    const buf = new Float32Array(N)
    for (let i = 0; i < N; i++) buf[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / SR)
    const got = detectPitch(buf, SR)
    expect(Math.abs((midiOf(got) - 69) * 100)).toBeLessThanOrEqual(2)
  })
})
