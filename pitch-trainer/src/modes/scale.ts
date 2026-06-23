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
  /** 上昇するラウンド数。折り返しONのときは「往路の長さ」になる */
  getRoundCount(): number
  /** 折り返し(往復)。ONなら上限まで上げたら下げて開始音へ戻り、また上げる(無限ループ) */
  getTurnaround(): boolean
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
  /** 折り返しの基準となる開始音(往復の下端) */
  startBase: number = SCALE.DEFAULT_BASE
  /** 進行方向。+1 = 上昇、-1 = 下降(折り返し中のみ -1 になる) */
  dir: 1 | -1 = 1
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
    this.startBase = base
    this.dir = 1
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
      // 1周終了 → 結果表示して次の基音へ
      const okCount = this.results.filter(Boolean).length
      const turn = this.deps.getTurnaround()
      const count = this.deps.getRoundCount()
      // 往路の上端(ラウンド数ぶん上げた基音)。安全弁(MAX_TOP_MIDI)も超えないようにする
      const maxBaseByMidi = SCALE.MAX_TOP_MIDI - Math.max(...pat)
      const topBase = Math.min(this.startBase + count - 1, maxBaseByMidi)

      // 次の基音を決める
      let nextBase: number
      let stop = false
      if (turn) {
        // 端で方向を反転(無限ループ)。退化ケース(count<=1)は範囲にクランプして同音を繰り返す
        if (this.dir > 0 && this.base >= topBase) this.dir = -1
        else if (this.dir < 0 && this.base <= this.startBase) this.dir = 1
        nextBase = Math.min(topBase, Math.max(this.startBase, this.base + this.dir))
      } else {
        nextBase = this.base + 1
        // ラウンド数に達した or 安全弁を超えるなら停止
        if (this.round >= count || nextBase > maxBaseByMidi) stop = true
      }

      const arrow = stop
        ? '→ 終了'
        : nextBase > this.base
          ? '→ 半音上げます'
          : nextBase < this.base
            ? '→ 半音下げます'
            : '→ 繰り返します'
      this.deps.onInfo(`ラウンド ${this.round} 結果: ${okCount}/${pat.length}  ${arrow}`)

      if (stop) {
        this.stop()
        return
      }
      this.round++
      this.base = nextBase
      this.timer = setTimeout(() => this.startRound(), beat * SCALE.ROUND_GAP_BEATS)
      return
    }

    const midi = this.base + pat[this.idx]
    this.hits = 0
    this.voiced = 0
    this.deps.onChipState(this.idx, 'now')
    this.deps.onTarget(midi)
    this.deps.playTone(
      midi,
      Math.max(SCALE.GUIDE_MIN_SEC, (beat / 1000) * SCALE.GUIDE_BEAT_RATIO),
    )
    this.timer = setTimeout(() => this.next(), beat)
  }
}
