import { LEAP } from '../config'
import { diatonicStep, noteFull } from '../audio/notes'

export type ChipState = 'now' | 'pass' | 'fail'
export type IntervalKey = '3rd' | '5th' | 'random'
export type DirectionKey = 'up' | 'down' | 'random'

export interface LeapDeps {
  getBpm(): number
  getKey(): number
  getInterval(): IntervalKey
  getDirection(): DirectionKey
  getLow(): number
  getHigh(): number
  playTone(midi: number, durSec: number): void
  onChips(labels: string[]): void
  onChipState(idx: number, state: ChipState): void
  onInfo(text: string): void
  onTarget(midi: number | null): void
  onRunningChange(running: boolean): void
}

const SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

function diatonicNotesInRange(keyRoot: number, lo: number, hi: number): number[] {
  const notes: number[] = []
  for (let m = lo; m <= hi; m++) {
    const rel = ((m % 12) - keyRoot + 12) % 12
    if (SCALE_INTERVALS.includes(rel)) notes.push(m)
  }
  return notes
}

export interface LeapPattern {
  notes: [number, number, number]
  intervalLabel: string
  directionLabel: string
}

export function generatePattern(
  keyRoot: number,
  interval: IntervalKey,
  direction: DirectionKey,
  lo: number,
  hi: number,
  rand: () => number = Math.random,
): LeapPattern | null {
  const iv = interval === 'random' ? (rand() < 0.5 ? '3rd' : '5th') : interval
  const dir = direction === 'random' ? (rand() < 0.5 ? 'up' : 'down') : direction
  const steps = (iv === '3rd' ? 2 : 4) * (dir === 'up' ? 1 : -1)

  const candidates = diatonicNotesInRange(keyRoot, lo, hi).filter((m) => {
    const leap = diatonicStep(m, keyRoot, steps)
    return leap != null && leap >= lo && leap <= hi
  })
  if (candidates.length === 0) return null

  const base = candidates[Math.floor(rand() * candidates.length)]
  const leap = diatonicStep(base, keyRoot, steps)!
  return {
    notes: [base, leap, base],
    intervalLabel: iv === '3rd' ? '3度' : '5度',
    directionLabel: dir === 'up' ? '上行' : '下行',
  }
}

export class LeapMode {
  running = false
  idx = -1
  hits = 0
  voiced = 0
  results: boolean[] = []
  pattern: LeapPattern | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private deps: LeapDeps

  constructor(deps: LeapDeps) {
    this.deps = deps
  }

  play() {
    this.pattern = generatePattern(
      this.deps.getKey(),
      this.deps.getInterval(),
      this.deps.getDirection(),
      this.deps.getLow(),
      this.deps.getHigh(),
    )
    if (!this.pattern) {
      this.deps.onInfo('この設定では出題できる音がありません。音域を広げてください。')
      return
    }
    this.startSequence()
  }

  replay() {
    if (!this.pattern) return
    this.startSequence()
  }

  stop() {
    this.running = false
    clearTimeout(this.timer)
    this.deps.onTarget(null)
    this.deps.onRunningChange(false)
  }

  judge(midiFloat: number | null) {
    if (!this.running || this.idx < 0 || !this.pattern) return
    if (this.idx >= this.pattern.notes.length) return
    if (midiFloat != null) {
      this.voiced++
      const cents = (midiFloat - this.pattern.notes[this.idx]) * 100
      if (Math.abs(cents) <= LEAP.TOLERANCE_CENTS) this.hits++
    }
  }

  private startSequence() {
    if (!this.pattern) return
    this.running = true
    this.idx = -1
    this.results = []
    this.deps.onRunningChange(true)
    const p = this.pattern
    this.deps.onChips(p.notes.map((m) => noteFull(m)))
    this.deps.onInfo(`${p.intervalLabel}${p.directionLabel}: ${p.notes.map(noteFull).join(' → ')}`)
    this.nextNote()
  }

  private nextNote() {
    if (!this.running || !this.pattern) return
    const beat = 60000 / this.deps.getBpm()

    if (this.idx >= 0) {
      const pass = this.hits >= Math.max(LEAP.MIN_HITS, this.voiced * LEAP.HIT_RATIO)
      this.results.push(pass)
      this.deps.onChipState(this.idx, pass ? 'pass' : 'fail')
    }
    this.idx++

    if (this.idx >= this.pattern.notes.length) {
      const okCount = this.results.filter(Boolean).length
      this.deps.onInfo(
        `${this.pattern.intervalLabel}${this.pattern.directionLabel}: ${this.pattern.notes.map(noteFull).join(' → ')}  結果: ${okCount}/${this.pattern.notes.length}`,
      )
      this.running = false
      this.deps.onTarget(null)
      this.deps.onRunningChange(false)
      return
    }

    const midi = this.pattern.notes[this.idx]
    this.hits = 0
    this.voiced = 0
    this.deps.onChipState(this.idx, 'now')
    this.deps.onTarget(midi)
    this.deps.playTone(midi, Math.max(LEAP.GUIDE_MIN_SEC, (beat / 1000) * LEAP.GUIDE_BEAT_RATIO))
    this.timer = setTimeout(() => this.nextNote(), beat)
  }
}
