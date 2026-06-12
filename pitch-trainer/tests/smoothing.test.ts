import { describe, expect, it } from 'vitest'
import { freqOf } from '../src/audio/notes'
import { PitchTracker } from '../src/audio/smoothing'

/** midi 値の声を n フレーム入力する(最後のフレーム結果を返す) */
function feed(tracker: PitchTracker, midi: number, n: number) {
  let last = tracker.update(freqOf(midi))
  for (let i = 1; i < n; i++) last = tracker.update(freqOf(midi))
  return last
}

describe('PitchTracker', () => {
  it('発声開始ゲート: 連続4フレーム検出して初めて発声扱い', () => {
    const t = new PitchTracker()
    expect(t.update(freqOf(60)).midi).toBeNull()
    expect(t.update(freqOf(60)).midi).toBeNull()
    expect(t.update(freqOf(60)).midi).toBeNull()
    expect(t.update(freqOf(60)).midi).not.toBeNull() // 4フレーム目
  })

  it('終了ゲート: 8フレームまでの途切れは直前値を保持、9フレーム目でリセット', () => {
    const t = new PitchTracker()
    feed(t, 60, 10)
    for (let i = 0; i < 8; i++) {
      const f = t.update(-1)
      expect(f.midi, `${i + 1}フレーム目の無音で値が消えた`).not.toBeNull()
      expect(f.cleared).toBe(false)
    }
    const f9 = t.update(-1)
    expect(f9.midi).toBeNull()
    expect(f9.cleared).toBe(true)
  })

  it('音名ヒステリシス: ±0.65半音を超えるまで表示音名を切り替えない', () => {
    const t = new PitchTracker()
    expect(feed(t, 69, 50).note).toBe(69)
    // +0.6 半音ではまだ A4 のまま (EMA が収束するまで十分回す)
    expect(feed(t, 69.6, 300).note).toBe(69)
    // +0.7 半音で切替 (69.7 を丸めて 70)
    expect(feed(t, 69.7, 300).note).toBe(70)
  })

  it('瞬間的な外れ値はメディアンで吸収する', () => {
    const t = new PitchTracker()
    const before = feed(t, 60, 30).midi!
    t.update(freqOf(76)) // オクターブ超の瞬間ノイズ1フレーム
    const after = feed(t, 60, 3).midi!
    expect(Math.abs(after - before)).toBeLessThan(0.1)
  })

  it('意図的な音程移動(安定した大ジャンプ)には即追従する', () => {
    const t = new PitchTracker()
    feed(t, 60, 30)
    // 65 へ移動: メディアン(窓9)が 65 側に倒れた時点で直近3フレームは安定 → 即スナップ
    const res = feed(t, 65, 6)
    expect(res.midi!).toBeCloseTo(65, 5)
  })

  it('reset で全状態が消える', () => {
    const t = new PitchTracker()
    feed(t, 60, 10)
    t.reset()
    expect(t.update(freqOf(60)).midi).toBeNull() // ゲートからやり直し
  })
})
