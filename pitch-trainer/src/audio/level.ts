import { PITCH } from '../config'

/** 入力レベル(RMS)の計算。マイク動作インジケータ用の純関数 */
export function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

/**
 * 「感度」スライダー位置(0=鈍感 … 1=敏感)→ 実効 RMS ゲート。
 * 値域が広い(MAX/MIN ≒ 17倍)ため対数補間で滑らかに割り当てる。
 * s=0 → RMS_GATE_MAX(鈍感)/ s=1 → RMS_GATE_MIN(敏感)。
 */
export function gateFromSensitivity(s: number): number {
  const clamped = Math.min(1, Math.max(0, s))
  return PITCH.RMS_GATE_MAX * (PITCH.RMS_GATE_MIN / PITCH.RMS_GATE_MAX) ** clamped
}

/** RMS ゲート → スライダー位置(0..1)。gateFromSensitivity の逆。初期値の算出に使う */
export function sensitivityFromGate(gate: number): number {
  const s = Math.log(gate / PITCH.RMS_GATE_MAX) / Math.log(PITCH.RMS_GATE_MIN / PITCH.RMS_GATE_MAX)
  return Math.min(1, Math.max(0, s))
}
