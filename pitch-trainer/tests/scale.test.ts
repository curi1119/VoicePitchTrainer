import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCALE } from '../src/config'
import { ScaleMode, type ChipState, type PatternKey, type ScaleDeps } from '../src/modes/scale'

interface Recorded {
  chips: string[][]
  chipStates: Array<[number, ChipState]>
  infos: string[]
  targets: Array<number | null>
  tones: Array<[number, number]>
  triads: Array<[number, number]>
  running: boolean[]
}

function makeDeps(
  over: {
    bpm?: number
    pattern?: PatternKey
    guide?: boolean
    roundCount?: number
    turnaround?: boolean
  } = {},
) {
  const rec: Recorded = {
    chips: [],
    chipStates: [],
    infos: [],
    targets: [],
    tones: [],
    triads: [],
    running: [],
  }
  const deps: ScaleDeps = {
    getBpm: () => over.bpm ?? 60, // 1拍 = 1000ms
    getPatternKey: () => over.pattern ?? 'p1',
    getGuideOn: () => over.guide ?? true,
    getRoundCount: () => over.roundCount ?? SCALE.ROUND_COUNT_MAX,
    getTurnaround: () => over.turnaround ?? false,
    playTone: (m, d) => rec.tones.push([m, d]),
    playTriad: (m, d) => rec.triads.push([m, d]),
    onChips: (l) => rec.chips.push(l),
    onChipState: (i, s) => rec.chipStates.push([i, s]),
    onInfo: (t) => rec.infos.push(t),
    onTarget: (m) => rec.targets.push(m),
    onRunningChange: (r) => rec.running.push(r),
  }
  return { deps, rec }
}

describe('ScaleMode', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('開始時にトライアドを 2 拍鳴らし、半拍空けて最初の音に進む', () => {
    const { deps, rec } = makeDeps()
    const m = new ScaleMode(deps)
    m.start(48)

    expect(rec.chips[0]).toEqual(['C3', 'D3', 'E3', 'F3', 'G3', 'F3', 'E3', 'D3', 'C3'])
    expect(rec.infos[0]).toBe('ラウンド 1 — 基音 C3 ♪ コードを再生中…')
    expect(rec.triads).toEqual([[48, 2]]) // 2拍 = 2秒 @60BPM
    expect(rec.targets[0]).toBe(48)

    vi.advanceTimersByTime(2500) // 2.5拍
    expect(rec.infos[1]).toBe('ラウンド 1 — 基音 C3')
    expect(rec.chipStates[0]).toEqual([0, 'now'])
    expect(rec.targets[1]).toBe(48)
    expect(rec.tones[0]).toEqual([48, 0.95]) // 1拍の95%
  })

  it('ガイド OFF はトライアドをスキップして半拍で開始する', () => {
    const { deps, rec } = makeDeps({ guide: false })
    const m = new ScaleMode(deps)
    m.start(48)
    expect(rec.triads).toHaveLength(0)
    vi.advanceTimersByTime(500)
    expect(rec.chipStates[0]).toEqual([0, 'now'])
    expect(rec.tones).toHaveLength(0) // ガイド音も鳴らさない
  })

  it('±60セント以内のフレームが max(6, voiced*0.35) 以上で合格', () => {
    const { deps, rec } = makeDeps()
    const m = new ScaleMode(deps)
    m.start(48)
    vi.advanceTimersByTime(2500) // 最初の音 (C3=48) 開始

    for (let i = 0; i < 20; i++) m.judge(48 + 0.5) // +50c × 20フレーム
    vi.advanceTimersByTime(1000) // 1拍経過 → 判定確定
    expect(rec.chipStates).toContainEqual([0, 'pass'])

    for (let i = 0; i < 20; i++) m.judge(55) // 2音目 D3(50) に対し5半音上 → 全フレーム外れ
    vi.advanceTimersByTime(1000)
    expect(rec.chipStates).toContainEqual([1, 'fail'])

    // 発声フレームが多いと必要ヒット数も増える: 40フレーム中13ヒットは 14 (=40*0.35) に届かず不合格
    for (let i = 0; i < 13; i++) m.judge(52)
    for (let i = 0; i < 27; i++) m.judge(40)
    vi.advanceTimersByTime(1000)
    expect(rec.chipStates).toContainEqual([2, 'fail'])
  })

  it('無音フレームは voiced に数えない', () => {
    const { deps, rec } = makeDeps()
    const m = new ScaleMode(deps)
    m.start(48)
    vi.advanceTimersByTime(2500)
    for (let i = 0; i < 6; i++) m.judge(48) // ちょうど6ヒット
    for (let i = 0; i < 50; i++) m.judge(null) // 無音はカウント外
    vi.advanceTimersByTime(1000)
    expect(rec.chipStates).toContainEqual([0, 'pass'])
  })

  it('1周終了で結果を表示し、半音上げて次ラウンドへ', () => {
    const { deps, rec } = makeDeps()
    const m = new ScaleMode(deps)
    m.start(48)
    vi.advanceTimersByTime(2500 + 9 * 1000) // トライアド + 9音
    expect(rec.infos).toContain('ラウンド 1 結果: 0/9  → 半音上げます')
    expect(m.round).toBe(2)
    expect(m.base).toBe(49)
    vi.advanceTimersByTime(2000) // ラウンド間 2拍
    expect(rec.chips[1]).toEqual(['C#3', 'D#3', 'F3', 'F#3', 'G#3', 'F#3', 'F3', 'D#3', 'C#3'])
  })

  it('最高音が MIDI 96 を超えるラウンドには進まず自動停止する', () => {
    const { deps, rec } = makeDeps()
    const m = new ScaleMode(deps)
    m.start(89) // 89+7=96 はギリギリ可。次の 90+7=97 で停止
    vi.advanceTimersByTime(2500 + 9 * 1000)
    expect(m.running).toBe(false)
    expect(rec.running).toEqual([true, false])
    expect(rec.targets[rec.targets.length - 1]).toBeNull()
  })

  it('設定したラウンド数だけ上げて自動停止する(折り返しOFF)', () => {
    const { deps, rec } = makeDeps({ roundCount: 3 })
    const m = new ScaleMode(deps)
    m.start(48)
    // 1ラウンド = 2500(リードイン) + 9*1000(9音) + 2000(ラウンド間) = 13500ms
    vi.advanceTimersByTime(3 * 13500)
    expect(m.running).toBe(false)
    expect(m.round).toBe(3)
    expect(m.base).toBe(50) // 48 → 49 → 50 の3ラウンド
    expect(rec.infos).toContain('ラウンド 3 結果: 0/9  → 終了')
  })

  it('折り返しONは上限まで上げたら下げて開始音へ戻り、停止せず往復する', () => {
    const { deps, rec } = makeDeps({ roundCount: 3, turnaround: true })
    const m = new ScaleMode(deps)
    m.start(48) // 往路の上端 = 48 + 3 - 1 = 50

    // 上り: 48 → 49 → 50(上端)→ 折り返し下り: 49 → 48(下端)→ また上り: 49 ...
    vi.advanceTimersByTime(6 * 13500)
    expect(m.running).toBe(true) // 無限ループなので止まらない
    expect(m.base).toBeGreaterThanOrEqual(48)
    expect(m.base).toBeLessThanOrEqual(50)
    // 下降(半音下げ)が一度は起きている
    expect(rec.infos.some((t) => t.includes('→ 半音下げます'))).toBe(true)

    m.stop()
    expect(m.running).toBe(false)
  })

  it('停止すると以後のタイマーは何もしない', () => {
    const { deps, rec } = makeDeps()
    const m = new ScaleMode(deps)
    m.start(48)
    vi.advanceTimersByTime(2500)
    m.stop()
    const states = rec.chipStates.length
    vi.advanceTimersByTime(10000)
    expect(rec.chipStates.length).toBe(states)
  })

  it('パターン p2 (1オクターブ往復) のチップ', () => {
    const { deps, rec } = makeDeps({ pattern: 'p2' })
    const m = new ScaleMode(deps)
    m.start(60)
    expect(rec.chips[0]).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'B4',
      'A4',
      'G4',
      'F4',
      'E4',
      'D4',
      'C4',
    ])
    expect(SCALE.PATTERNS.p2).toHaveLength(15)
  })
})
