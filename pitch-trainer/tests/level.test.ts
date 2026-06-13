import { describe, expect, it } from 'vitest'
import { PITCH } from '../src/config'
import { gateFromSensitivity, sensitivityFromGate } from '../src/audio/level'

describe('感度 ↔ RMS ゲートのマッピング', () => {
  it('両端が MAX(鈍感)/ MIN(敏感)に対応する', () => {
    expect(gateFromSensitivity(0)).toBeCloseTo(PITCH.RMS_GATE_MAX, 6)
    expect(gateFromSensitivity(1)).toBeCloseTo(PITCH.RMS_GATE_MIN, 6)
  })

  it('敏感(値が大きい)ほどゲートは小さくなる(単調減少)', () => {
    let prev = Infinity
    for (let s = 0; s <= 1.0001; s += 0.1) {
      const g = gateFromSensitivity(s)
      expect(g).toBeLessThan(prev)
      prev = g
    }
  })

  it('範囲外の入力はクランプされる', () => {
    expect(gateFromSensitivity(-1)).toBeCloseTo(PITCH.RMS_GATE_MAX, 6)
    expect(gateFromSensitivity(2)).toBeCloseTo(PITCH.RMS_GATE_MIN, 6)
  })

  it('sensitivityFromGate は gateFromSensitivity の逆(往復で一致)', () => {
    for (const s of [0, 0.25, 0.5, 0.73, 1]) {
      expect(sensitivityFromGate(gateFromSensitivity(s))).toBeCloseTo(s, 6)
    }
  })

  it('既定ゲート(RMS_GATE)は妥当なスライダー位置(0..1内)に写る', () => {
    const s = sensitivityFromGate(PITCH.RMS_GATE)
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })
})
