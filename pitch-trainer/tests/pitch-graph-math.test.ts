import { describe, expect, it } from 'vitest'
import {
  desiredRange,
  followRange,
  midiOfY,
  yOfMidi,
  type GraphRange,
} from '../src/components/pitch-graph-math'
import { rmsOf } from '../src/audio/level'

const range: GraphRange = { low: 48, high: 72 }

describe('yOfMidi / midiOfY', () => {
  it('レンジ下端は高さいっぱい、上端は 0', () => {
    expect(yOfMidi(48, range, 600)).toBe(600)
    expect(yOfMidi(72, range, 600)).toBe(0)
    expect(yOfMidi(60, range, 600)).toBe(300)
  })

  it('midiOfY は逆変換', () => {
    for (const m of [48, 53.5, 60, 71.2]) {
      expect(midiOfY(yOfMidi(m, range, 600), range, 600)).toBeCloseTo(m, 8)
    }
  })
})

describe('desiredRange', () => {
  it('値域に余白を付ける', () => {
    const r = desiredRange([50, 70], range, 14, 3)
    expect(r).toEqual({ low: 47, high: 73 })
  })

  it('スパンが小さいときは中心を保って minSpan まで広げる', () => {
    const r = desiredRange([60], range, 14, 3)
    expect(r.high - r.low).toBe(14)
    expect((r.high + r.low) / 2).toBe(60)
  })

  it('値がなければ現在レンジを維持', () => {
    expect(desiredRange([], range, 14, 3)).toEqual(range)
  })
})

describe('followRange', () => {
  it('lerp で目標へ近づく', () => {
    const r = followRange({ low: 40, high: 60 }, { low: 50, high: 70 }, 0.1)
    expect(r.low).toBeCloseTo(41)
    expect(r.high).toBeCloseTo(61)
  })

  it('繰り返すと収束する', () => {
    let r: GraphRange = { low: 40, high: 60 }
    for (let i = 0; i < 200; i++) r = followRange(r, { low: 50, high: 70 }, 0.1)
    expect(r.low).toBeCloseTo(50, 4)
    expect(r.high).toBeCloseTo(70, 4)
  })
})

describe('rmsOf', () => {
  it('無音は 0、振幅 a のサイン波は約 a/√2', () => {
    expect(rmsOf(new Float32Array(1024))).toBe(0)
    const buf = new Float32Array(4096)
    for (let i = 0; i < buf.length; i++) buf[i] = 0.3 * Math.sin((2 * Math.PI * 8 * i) / buf.length)
    expect(rmsOf(buf)).toBeCloseTo(0.3 / Math.SQRT2, 3)
  })
})
