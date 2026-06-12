import { SCALE } from '../config'
import { noteFull } from '../audio/notes'

export type PatternKey = keyof typeof SCALE.PATTERNS

export type ChipState = 'now' | 'pass' | 'fail'

/**
 * 音階練習が外界(UI・音声)とやり取りするための依存。
 * getter は「その時点の設定値」を返すこと(プロトタイプが毎回 DOM を読む挙動の踏襲)。
 */
export interface ScaleDeps {
  getBpm(): number
  getPatternKey(): PatternKey
  getGuideOn(): boolean
  playTone(midi: number, durSec: number): void
  playTriad(rootMidi: number, durSec: number): void
  /** ラウンド開始時にチップ(音名ラベル列)を再構築する */
  onChips(labels: string[]): void
  onChipState(idx: number, state: ChipState): void
  onInfo(text: string): void
  onTarget(midi: number | null): void
  onRunningChange(running: boolean): void
}

/**
 * 音階練習モード: ラウンド進行(タイマー駆動)と音ごとの判定。
 * React には依存しない。テストでは vi.useFakeTimers で進行を制御できる。
 */
export class ScaleMode {
  running = false
  base: number = SCALE.DEFAULT_BASE
  round = 0
  /** 現在の音のインデックス(-1 はトライアド再生中) */
  idx = -1
  hits = 0
  voiced = 0
  results: boolean[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private deps: ScaleDeps

  constructor(deps: ScaleDeps) {
    this.deps = deps
  }

  start(base: number) {
    this.running = true
    this.base = base
    this.round = 1
    this.deps.onRunningChange(true)
    this.startRound()
  }

  stop() {
    this.running = false
    clearTimeout(this.timer)
    this.deps.onTarget(null)
    this.deps.onRunningChange(false)
  }

  /** 毎フレームの判定(音階練習モードが表示中のときのみ呼ぶ) */
  judge(midiFloat: number | null) {
    if (!this.running || this.idx < 0) return
    const pat = SCALE.PATTERNS[this.deps.getPatternKey()]
    if (this.idx >= pat.length) return
    if (midiFloat != null) {
      this.voiced++
      const cents = (midiFloat - (this.base + pat[this.idx])) * 100
      if (Math.abs(cents) <= SCALE.TOLERANCE_CENTS) this.hits++
    }
  }

  private startRound() {
    if (!this.running) return
    const pat = SCALE.PATTERNS[this.deps.getPatternKey()]
    this.deps.onChips(pat.map((iv) => noteFull(this.base + iv)))
    this.idx = -1
    this.results = []
    const beat = 60000 / this.deps.getBpm()

    // 開始前に基音のトライアドを一度鳴らして調を提示する(ボイトレのピアノ伴奏方式)
    const guide = this.deps.getGuideOn()
    this.deps.onInfo(
      `ラウンド ${this.round} — 基音 ${noteFull(this.base)}` + (guide ? ' ♪ コードを再生中…' : ''),
    )
    this.deps.onTarget(this.base)
    if (guide) this.deps.playTriad(this.base, (beat * SCALE.TRIAD_BEATS) / 1000)

    this.timer = setTimeout(
      () => {
        if (!this.running) return
        this.deps.onInfo(`ラウンド ${this.round} — 基音 ${noteFull(this.base)}`)
        this.next()
      },
      guide ? beat * SCALE.LEAD_IN_BEATS_GUIDE : beat * SCALE.LEAD_IN_BEATS_NO_GUIDE,
    )
  }

  private next() {
    if (!this.running) return
    const pat = SCALE.PATTERNS[this.deps.getPatternKey()]
    const beat = 60000 / this.deps.getBpm()

    // 直前ノートの判定確定
    if (this.idx >= 0) {
      const pass = this.hits >= Math.max(SCALE.MIN_HITS, this.voiced * SCALE.HIT_RATIO)
      this.results.push(pass)
      this.deps.onChipState(this.idx, pass ? 'pass' : 'fail')
    }
    this.idx++

    if (this.idx >= pat.length) {
      // 1周終了 → 結果表示して半音上げ
      const okCount = this.results.filter(Boolean).length
      this.deps.onInfo(`ラウンド ${this.round} 結果: ${okCount}/${pat.length}  → 半音上げます`)
      this.round++
      this.base++
      if (this.base + Math.max(...pat) > SCALE.MAX_TOP_MIDI || this.round > SCALE.MAX_ROUNDS) {
        this.stop()
        return
      }
      this.timer = setTimeout(() => this.startRound(), beat * SCALE.ROUND_GAP_BEATS)
      return
    }

    const midi = this.base + pat[this.idx]
    this.hits = 0
    this.voiced = 0
    this.deps.onChipState(this.idx, 'now')
    this.deps.onTarget(midi)
    if (this.deps.getGuideOn()) {
      // ほぼ1拍ぶん鳴らす(短いと合成ピアノがピチカート化する)
      this.deps.playTone(
        midi,
        Math.max(SCALE.GUIDE_MIN_SEC, (beat / 1000) * SCALE.GUIDE_BEAT_RATIO),
      )
    }
    this.timer = setTimeout(() => this.next(), beat)
  }
}
