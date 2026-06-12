/** ピッチグラフの座標・レンジ計算(純関数。テスト対象) */

/** 縦軸の表示レンジ (MIDI 値、low < high) */
export interface GraphRange {
  low: number
  high: number
}

/** MIDI 値 → Y 座標 px(上が高音。レンジ外もそのまま外挿する) */
export function yOfMidi(midi: number, range: GraphRange, height: number): number {
  return height * (1 - (midi - range.low) / (range.high - range.low))
}

/** Y 座標 px → MIDI 値(yOfMidi の逆変換) */
export function midiOfY(y: number, range: GraphRange, height: number): number {
  return range.low + (1 - y / height) * (range.high - range.low)
}

/**
 * 表示したい値(声の軌跡・ターゲット帯の端)から目標レンジを求める。
 * - 値域に pad 半音の余白を付ける
 * - スパンが minSpan 未満なら中心を保って広げる
 * - 値がなければ現在レンジを維持
 */
export function desiredRange(
  midis: readonly number[],
  current: GraphRange,
  minSpan: number,
  pad: number,
): GraphRange {
  if (midis.length === 0) return current
  let low = Math.min(...midis) - pad
  let high = Math.max(...midis) + pad
  if (high - low < minSpan) {
    const center = (high + low) / 2
    low = center - minSpan / 2
    high = center + minSpan / 2
  }
  return { low, high }
}

/** 現在レンジを目標レンジへ lerp で近づける(急なジャンプを避ける) */
export function followRange(current: GraphRange, target: GraphRange, lerp: number): GraphRange {
  return {
    low: current.low + (target.low - current.low) * lerp,
    high: current.high + (target.high - current.high) * lerp,
  }
}
