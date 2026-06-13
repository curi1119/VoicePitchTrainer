import { describe, expect, it } from 'vitest'
import { PITCH } from '../src/config'
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
    // 振幅 = ゲート値のサイン波 → RMS はゲートの 1/√2 でゲート未満
    const buf = new Float32Array(N)
    for (let i = 0; i < N; i++) buf[i] = PITCH.RMS_GATE * Math.sin((2 * Math.PI * 220 * i) / SR)
    expect(detectPitch(buf, SR)).toBe(-1)
  })

  it('ゲートを少し超える小さな声でも検出できる(感度)', () => {
    const amp = PITCH.RMS_GATE * 3 // RMS ≒ ゲートの2.1倍
    const buf = new Float32Array(N)
    for (let i = 0; i < N; i++) buf[i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR)
    const got = detectPitch(buf, SR)
    expect(Math.abs((midiOf(got) - 57) * 100)).toBeLessThanOrEqual(2) // A3
  })

  it('ノイズ優勢の微小信号で誤った音程を返さない(減衰した発声末尾の回帰)', () => {
    // 長い発声の末尾で声が減衰しノイズと拮抗すると、救済ルールがオクターブ下などの
    // 誤ラグを拾って「ピッチずれ」を起こしていた(2026-06-13 修正)。
    // 検出するなら正しい音、さもなくば棄却(-1)が正。誤値だけは返してはならない
    for (let trial = 0; trial < 20; trial++) {
      const rand = mulberry32(0xdecae ^ trial)
      const buf = new Float32Array(N)
      for (let i = 0; i < N; i++) {
        let v = 0
        for (let h = 1; h <= 6; h++) {
          v +=
            [0.05, 0.15, 0.3, 0.28, 0.25, 0.18][h - 1] *
            Math.sin((2 * Math.PI * 220 * h * i) / SR + h * 0.7)
        }
        buf[i] = v * 0.0126 + (rand() * 2 - 1) * 0.004
      }
      const got = detectPitch(buf, SR)
      if (got > 0) {
        expect(Math.abs((midiOf(got) - 57) * 100), `trial ${trial}`).toBeLessThanOrEqual(50)
      }
    }
  })

  it('検出レンジ上限を下げると倍音ロックを構造的に防げる(音域=男声)', () => {
    // 大声時を模した「基音が弱く第5倍音が突出した」C3 信号。
    // 広レンジ(既定 55-1200)では第5倍音 ≒ E5 へロックしうるが、
    // 上限を 520Hz に絞ると E5 帯は探索対象外になり高音への化けが起きない。
    const f = freqOf(48) // C3 ≒ 130.8Hz
    const rand = mulberry32(0x5)
    const buf = new Float32Array(N)
    const amps = [0.05, 0.15, 0.12, 0.18, 1.0, 0.1, 0.05, 0.05, 0, 0.4]
    for (let i = 0; i < N; i++) {
      let v = 0
      for (let h = 1; h <= amps.length; h++) {
        if (f * h > 2000) break
        v += amps[h - 1] * Math.sin((2 * Math.PI * f * h * i) / SR + h * 0.7)
      }
      buf[i] = v + (rand() * 2 - 1) * 0.01
    }
    // 広レンジでは高音(>500Hz)へロックすることを記録(この信号の誤検出の再現)
    const wide = detectPitch(buf, SR)
    expect(wide).toBeGreaterThan(500)
    // 男性レンジ(上限605=E5未満)では上限を超える検出は起きない
    const [fMin, fMax] = PITCH.DETECT_RANGES.male
    const capped = detectPitch(buf, SR, fMin, fMax)
    expect(capped).toBeLessThanOrEqual(fMax)
  })

  it('各音域プリセットでレンジ内の発声を正しく検出する', () => {
    for (const [key, [fMin, fMax]] of Object.entries(PITCH.DETECT_RANGES)) {
      for (let midi = 24; midi <= 96; midi++) {
        const f = freqOf(midi)
        // レンジの内側(端の補間誤差を避け 6% マージン)だけを対象に精度を見る
        if (f < fMin * 1.06 || f > fMax * 0.94) continue
        const got = detectPitch(synthVoice(midi), SR, fMin, fMax)
        expect(got, `${key} MIDI ${midi} で検出失敗`).toBeGreaterThan(0)
        expect(Math.abs((midiOf(got) - midi) * 100), `${key} MIDI ${midi}`).toBeLessThanOrEqual(2)
      }
    }
  })

  it('純音(サイン波)も検出できる', () => {
    const buf = new Float32Array(N)
    for (let i = 0; i < N; i++) buf[i] = 0.3 * Math.sin((2 * Math.PI * 440 * i) / SR)
    const got = detectPitch(buf, SR)
    expect(Math.abs((midiOf(got) - 69) * 100)).toBeLessThanOrEqual(2)
  })
})
