import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { diatonicStep } from '../src/audio/notes'
import {
  LeapMode,
  generatePattern,
  type ChipState,
  type DirectionKey,
  type IntervalKey,
  type LeapDeps,
} from '../src/modes/leap'

// ---- diatonicStep ユーティリティ ----

describe('diatonicStep', () => {
  it('C major: C4 から 3度上 = E4', () => {
    expect(diatonicStep(60, 0, 2)).toBe(64)
  })

  it('C major: C4 から 5度上 = G4', () => {
    expect(diatonicStep(60, 0, 4)).toBe(67)
  })

  it('C major: C4 から 3度下 = A3', () => {
    expect(diatonicStep(60, 0, -2)).toBe(57)
  })

  it('C major: C4 から 5度下 = F3', () => {
    expect(diatonicStep(60, 0, -4)).toBe(53)
  })

  it('C major: E4 から 3度上 = G4 (短3度)', () => {
    expect(diatonicStep(64, 0, 2)).toBe(67)
  })

  it('C major: B3 から 3度上 = D4 (オクターブをまたぐ)', () => {
    expect(diatonicStep(59, 0, 2)).toBe(62)
  })

  it('G major: G3 から 3度上 = B3', () => {
    expect(diatonicStep(55, 7, 2)).toBe(59)
  })

  it('スケール外の音は null を返す', () => {
    expect(diatonicStep(61, 0, 2)).toBeNull() // C#4 は C major にない
  })
})

// ---- generatePattern ----

describe('generatePattern', () => {
  it('3度上行パターンを生成する', () => {
    const p = generatePattern(0, '3rd', 'up', 48, 72, () => 0)
    expect(p).not.toBeNull()
    expect(p!.notes).toHaveLength(3)
    expect(p!.notes[0]).toBe(p!.notes[2]) // 基音→跳躍→基音
    expect(p!.notes[1]).toBeGreaterThan(p!.notes[0]) // 上行
    expect(p!.intervalLabel).toBe('3度')
    expect(p!.directionLabel).toBe('上行')
  })

  it('5度下行パターンを生成する', () => {
    const p = generatePattern(0, '5th', 'down', 48, 72, () => 0)
    expect(p).not.toBeNull()
    expect(p!.notes[1]).toBeLessThan(p!.notes[0]) // 下行
    expect(p!.intervalLabel).toBe('5度')
    expect(p!.directionLabel).toBe('下行')
  })

  it('跳躍先が音域外にならない', () => {
    // C3(48)〜E3(52) の狭い範囲で5度上行は不可能(G3=55 が範囲外)
    const p = generatePattern(0, '5th', 'up', 48, 52)
    expect(p).toBeNull()
  })

  it('ランダム設定は3度/5度と上行/下行をどちらも生成できる', () => {
    const intervals = new Set<string>()
    const directions = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const p = generatePattern(0, 'random', 'random', 36, 84)
      if (p) {
        intervals.add(p.intervalLabel)
        directions.add(p.directionLabel)
      }
    }
    expect(intervals.has('3度')).toBe(true)
    expect(intervals.has('5度')).toBe(true)
    expect(directions.has('上行')).toBe(true)
    expect(directions.has('下行')).toBe(true)
  })

  it('G major キーで正しいダイアトニック音を使う', () => {
    // G major: G A B C D E F#
    const p = generatePattern(7, '3rd', 'up', 55, 79, () => 0)
    expect(p).not.toBeNull()
    // 最小の候補 G3(55) → 3度上 = B3(59)
    expect(p!.notes[0]).toBe(55)
    expect(p!.notes[1]).toBe(59)
  })
})

// ---- LeapMode ----

interface Recorded {
  chips: string[][]
  chipStates: Array<[number, ChipState]>
  infos: string[]
  targets: Array<number | null>
  tones: Array<[number, number]>
  running: boolean[]
}

function makeDeps(
  over: {
    bpm?: number
    key?: number
    interval?: IntervalKey
    direction?: DirectionKey
    low?: number
    high?: number
  } = {},
) {
  const rec: Recorded = {
    chips: [],
    chipStates: [],
    infos: [],
    targets: [],
    tones: [],
    running: [],
  }
  const deps: LeapDeps = {
    getBpm: () => over.bpm ?? 60,
    getKey: () => over.key ?? 0,
    getInterval: () => over.interval ?? '3rd',
    getDirection: () => over.direction ?? 'up',
    getLow: () => over.low ?? 48,
    getHigh: () => over.high ?? 72,
    playTone: (m, d) => rec.tones.push([m, d]),
    onChips: (l) => rec.chips.push(l),
    onChipState: (i, s) => rec.chipStates.push([i, s]),
    onInfo: (t) => rec.infos.push(t),
    onTarget: (m) => rec.targets.push(m),
    onRunningChange: (r) => rec.running.push(r),
  }
  return { deps, rec }
}

describe('LeapMode', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('play() で3音を1拍ずつ鳴らす', () => {
    const { deps, rec } = makeDeps({ bpm: 60, interval: '3rd', direction: 'up' })
    const m = new LeapMode(deps)
    m.play()

    expect(rec.running[0]).toBe(true)
    expect(rec.chips[0]).toHaveLength(3)
    expect(rec.chipStates[0]).toEqual([0, 'now'])
    expect(rec.tones).toHaveLength(1)

    vi.advanceTimersByTime(1000) // 2音目
    expect(rec.chipStates).toContainEqual([1, 'now'])
    expect(rec.tones).toHaveLength(2)

    vi.advanceTimersByTime(1000) // 3音目
    expect(rec.chipStates).toContainEqual([2, 'now'])
    expect(rec.tones).toHaveLength(3)

    vi.advanceTimersByTime(1000) // 終了
    expect(m.running).toBe(false)
  })

  it('各音の判定: ヒット数が十分なら pass', () => {
    const { deps, rec } = makeDeps({ bpm: 60, interval: '3rd', direction: 'up' })
    const m = new LeapMode(deps)
    m.play()

    const note0 = m.pattern!.notes[0]
    for (let i = 0; i < 20; i++) m.judge(note0 + 0.5) // +50c
    vi.advanceTimersByTime(1000)
    expect(rec.chipStates).toContainEqual([0, 'pass'])

    const note1 = m.pattern!.notes[1]
    for (let i = 0; i < 20; i++) m.judge(note1 + 10) // 大きく外れ
    vi.advanceTimersByTime(1000)
    expect(rec.chipStates).toContainEqual([1, 'fail'])
  })

  it('replay() は同じパターンを再生する', () => {
    const { deps, rec } = makeDeps({ interval: '3rd', direction: 'up' })
    const m = new LeapMode(deps)
    m.play()
    vi.advanceTimersByTime(3000) // 終了まで
    const firstChips = rec.chips[0]

    m.replay()
    expect(rec.chips[1]).toEqual(firstChips)
    expect(m.running).toBe(true)
  })

  it('play() を再度呼ぶと新しいパターンを生成する', () => {
    const { deps } = makeDeps({ interval: 'random', direction: 'random' })
    const m = new LeapMode(deps)
    m.play()
    vi.advanceTimersByTime(3000)
    m.play()
    expect(m.running).toBe(true)
    expect(m.pattern).not.toBeNull()
  })

  it('stop() でタイマーが止まる', () => {
    const { deps, rec } = makeDeps()
    const m = new LeapMode(deps)
    m.play()
    vi.advanceTimersByTime(500)
    m.stop()
    const toneCount = rec.tones.length
    vi.advanceTimersByTime(5000)
    expect(rec.tones.length).toBe(toneCount)
  })

  it('音域が狭すぎる場合はエラーメッセージを出す', () => {
    const { deps, rec } = makeDeps({ interval: '5th', direction: 'up', low: 48, high: 52 })
    const m = new LeapMode(deps)
    m.play()
    expect(m.running).toBe(false)
    expect(rec.infos[0]).toContain('音域を広げてください')
  })

  it('結果を info に表示する', () => {
    const { deps, rec } = makeDeps({ bpm: 60, interval: '3rd', direction: 'up' })
    const m = new LeapMode(deps)
    m.play()
    vi.advanceTimersByTime(3000) // 3音終了
    const last = rec.infos[rec.infos.length - 1]
    expect(last).toContain('結果:')
  })
})
