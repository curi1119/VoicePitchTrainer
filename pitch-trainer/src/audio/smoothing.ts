import { SMOOTHING } from '../config'
import { midiOf } from './notes'

/** 1フレームぶんの追跡結果 */
export interface TrackerFrame {
  /** 平滑化後の MIDI 値(発声中でなければ null) */
  midi: number | null
  /** ヒステリシス適用後の表示用音名(整数 MIDI。発声中でなければ null) */
  note: number | null
  /** このフレームで無音リセット状態か(表示クリア用。無音が続く間 true を返し続ける) */
  cleared: boolean
}

/**
 * 平滑化(人声向けチューニング)
 *
 * 人間の声はジッター/ビブラートで常時±20〜40セント程度揺れるため、
 *   1) メディアンフィルタ(約150ms)で外れ値除去
 *   2) EMA(指数移動平均)で滑らかに追従
 *   3) オクターブ誤検出などの瞬間的な大ジャンプは棄却
 * の多段構成にする。意図的な音程変化(>0.7半音が連続)には素早く追従する。
 *
 * さらに発声開始/終了ゲートと音名表示のヒステリシスもここで扱う。
 */
export class PitchTracker {
  private recent: number[] = []
  private ema: number | null = null
  private shownNote: number | null = null
  private voicedFrames = 0
  private silentFrames = 0
  private octaveJumpFrames = 0

  /** 生の検出周波数(検出なしは -1)を1フレームぶん入力する */
  update(rawFreq: number): TrackerFrame {
    if (rawFreq > 0) {
      this.voicedFrames++
      this.silentFrames = 0
    } else {
      this.silentFrames++
      // 約130ms 無音で発声終了とみなす
      if (this.silentFrames > SMOOTHING.SILENT_FRAMES) this.voicedFrames = 0
    }

    // 連続検出して初めて「発声中」扱い → 子音や瞬間ノイズを無視
    const voiced = this.voicedFrames >= SMOOTHING.VOICED_FRAMES
    let midi: number | null = null
    if (voiced && rawFreq > 0) {
      midi = this.smooth(this.resolveOctave(midiOf(rawFreq)))
    } else if (voiced && this.ema != null) {
      midi = this.ema // 短い途切れ中は直前の値を保持
    }

    if (midi != null) {
      // 音名表示のヒステリシス: 表示中の音から一定以上離れて初めて切り替える
      if (
        this.shownNote == null ||
        Math.abs(midi - this.shownNote) > SMOOTHING.HYSTERESIS_SEMITONES
      ) {
        this.shownNote = Math.round(midi)
      }
      return { midi, note: this.shownNote, cleared: false }
    }

    // 無音が続く間は true を返し続ける(針をゼロ位置へアニメーションさせ続けるため)
    const cleared = this.silentFrames > SMOOTHING.SILENT_FRAMES
    if (cleared) this.clearSmoothing()
    return { midi: null, note: null, cleared }
  }

  /** 完全リセット(発声ゲート含む) */
  reset() {
    this.clearSmoothing()
    this.voicedFrames = 0
    this.silentFrames = 0
  }

  private clearSmoothing() {
    this.recent.length = 0
    this.ema = null
    this.shownNote = null
    this.octaveJumpFrames = 0
  }

  /**
   * オクターブ連続性: 確立ピッチ(ema)のちょうど整数オクターブに当たる検出は倍音/サブ倍音の
   * 誤りとみなし、確立オクターブへ折り返す。連続して続けば意図的なオクターブ移動として受理する。
   * 確立前(ema==null)や、最近接オクターブから OCTAVE_FOLD_TOLERANCE 超離れた検出
   * (=オクターブでない音程移動)はそのまま通し、通常のジャンプ処理に委ねる。
   * 単フレームでは正解と倍音ロックを分離できないため、時間方向の文脈で判別する(pYIN 的)。
   */
  private resolveOctave(rawMidi: number): number {
    if (this.ema == null) {
      this.octaveJumpFrames = 0
      return rawMidi
    }
    const k = Math.round((this.ema - rawMidi) / 12)
    if (k === 0) {
      this.octaveJumpFrames = 0
      return rawMidi
    }
    const folded = rawMidi + 12 * k
    if (Math.abs(folded - this.ema) > SMOOTHING.OCTAVE_FOLD_TOLERANCE) {
      this.octaveJumpFrames = 0
      return rawMidi // オクターブでない音程移動 → ジャンプ処理へ委ねる
    }
    this.octaveJumpFrames++
    if (this.octaveJumpFrames >= SMOOTHING.OCTAVE_CONFIRM_FRAMES) {
      this.clearSmoothing() // 連続 → 意図的移動として新オクターブで再確立
      return rawMidi
    }
    return folded // 短時間の倍音/サブ倍音誤り → 確立オクターブへ折り返す
  }

  private smooth(midiFloat: number): number {
    this.recent.push(midiFloat)
    if (this.recent.length > SMOOTHING.MEDIAN_WINDOW) this.recent.shift()
    const sorted = [...this.recent].sort((x, y) => x - y)
    const med = sorted[Math.floor(sorted.length / 2)]

    if (this.ema == null) {
      this.ema = med
      return this.ema
    }

    const diff = med - this.ema
    if (Math.abs(diff) > SMOOTHING.JUMP_SEMITONES) {
      // 大きな変化: 直近フレームが安定していれば「意図的な音程移動」として即追従
      const last = this.recent.slice(-SMOOTHING.JUMP_STABLE_FRAMES)
      const stable =
        last.length === SMOOTHING.JUMP_STABLE_FRAMES &&
        last.every((v) => Math.abs(v - med) < SMOOTHING.JUMP_SEMITONES)
      if (stable) this.ema = med
      // 不安定なら瞬間ノイズ(オクターブ誤検出等)とみなし現在値を維持
    } else {
      this.ema = this.ema + diff * SMOOTHING.EMA_ALPHA
    }
    return this.ema
  }
}
