import { SINGLE } from '../config'
import { noteFull } from '../audio/notes'

/** 判定メッセージ(メーター下に表示) */
export interface JudgeMsg {
  text: string
  cls: 'ok' | 'ng' | ''
}

/** 1フレームぶんの判定結果 */
export interface SingleFrameResult {
  msg: JudgeMsg
  /** ホールド進捗 0..1(出題音の再生待ち中は undefined = 変更なし) */
  holdRatio?: number
  /** このフレームで確定したイベント */
  finished?: 'ok' | 'ng' | 'retry-ok'
  sound?: 'success' | 'fail'
}

export interface SingleState {
  target: number | null
  /** この時刻(performance.now 基準)以降に判定開始 */
  judgeFrom: number
  holdMs: number
  wrongMs: number
  lastT: number
  ok: number
  all: number
  solved: boolean
  /** 不正解確定後の練習継続中か(スコアは変えない) */
  retry: boolean
}

/**
 * 単音発声トレーニングの判定ロジック(状態機械)。
 * UI・音声出力には依存しない。毎フレーム frame() を呼ぶこと。
 */
export class SingleMode {
  state: SingleState = {
    target: null,
    judgeFrom: 0,
    holdMs: 0,
    wrongMs: 0,
    lastT: 0,
    ok: 0,
    all: 0,
    solved: true,
    retry: false,
  }

  /** 出題。選ばれたターゲット MIDI を返す */
  startQuiz(lo: number, hi: number, now: number, rand: () => number = Math.random): number {
    const s = this.state
    s.target = lo + Math.floor(rand() * (hi - lo + 1))
    s.all++
    s.solved = false
    s.retry = false
    s.holdMs = 0
    s.wrongMs = 0
    s.judgeFrom = now + SINGLE.QUIZ_TONE_DUR * 1000 + SINGLE.JUDGE_DELAY_MS
    return s.target
  }

  /** もう一度聞く(再生し直し、判定を一時停止) */
  replay(now: number) {
    if (this.state.target == null) return
    this.state.judgeFrom = now + SINGLE.QUIZ_TONE_DUR * 1000 + SINGLE.JUDGE_DELAY_MS
  }

  /** 答えを見てパス。成立したら true */
  pass(): boolean {
    const s = this.state
    if (s.target == null || s.solved) return false
    s.solved = true
    s.retry = false
    return true
  }

  /** タブ切替などで問題を放棄する */
  abandon() {
    this.state.target = null
    this.state.retry = false
  }

  /**
   * 毎フレームの判定。
   * @param midiFloat 平滑化後の MIDI 値(無音なら null)
   * @param now performance.now()
   * @param isActive 単音発声モードが表示中か(非表示でも時刻だけは進める)
   */
  frame(midiFloat: number | null, now: number, isActive: boolean): SingleFrameResult | null {
    const s = this.state
    const dt = s.lastT ? now - s.lastT : 16
    s.lastT = now

    if (!isActive || s.target == null || s.solved) return null
    if (now < s.judgeFrom) {
      return { msg: { text: '♪ 出題音を再生中…よく聞いてください', cls: '' } }
    }

    const ansLabel = s.retry ? `正解の ${noteFull(s.target)} ` : 'この音'
    let msg: JudgeMsg

    if (midiFloat == null) {
      // 無音: タイマーを戻しつつ待機
      s.holdMs = Math.max(0, s.holdMs - dt)
      s.wrongMs = Math.max(0, s.wrongMs - dt * 2)
      msg = { text: `${ansLabel}を発声してください…`, cls: s.retry ? 'ng' : '' }
    } else {
      const cents = (midiFloat - s.target) * 100
      if (Math.abs(cents) <= SINGLE.OK_CENTS) {
        s.holdMs += dt
        s.wrongMs = 0
        msg = { text: '✔ その音をキープ…!', cls: 'ok' }
      } else {
        // キープ中に範囲を外れたら2倍速で減少(即ゼロにはしない)
        s.holdMs = Math.max(0, s.holdMs - dt * 2)
        s.wrongMs += dt
        msg = {
          text: cents > 0 ? '↓ 高すぎます。もう少し低く' : '↑ 低すぎます。もう少し高く',
          cls: 'ng',
        }
      }
    }

    const holdRatio = Math.min(1, s.holdMs / SINGLE.OK_HOLD_MS)

    // ―― 正解音をキープできた ――
    if (s.holdMs >= SINGLE.OK_HOLD_MS) {
      if (s.retry) {
        // 不正解確定後の練習: スコアは変えずに「出せたこと」を確認
        s.solved = true
        s.retry = false
        return {
          msg: {
            text: `✔ 正しい音 ${noteFull(s.target)} が出せました!(記録は不正解のまま)`,
            cls: 'ok',
          },
          holdRatio: 0,
          finished: 'retry-ok',
          sound: 'success',
        }
      }
      s.solved = true
      s.ok++
      return {
        msg: { text: `正解! ${noteFull(s.target)} 🎉`, cls: 'ok' },
        holdRatio: 0,
        finished: 'ok',
        sound: 'success',
      }
    }

    // ―― 不正解の確定: 外れた音程で安定してしまった場合(初回のみ) ――
    if (!s.retry && s.wrongMs >= SINGLE.NG_HOLD_MS) {
      // 不正解はスコア確定。ただし問題は閉じず、正しい音を出すまで練習を継続できる
      s.retry = true
      s.holdMs = 0
      s.wrongMs = 0
      const sung = midiFloat != null ? noteFull(Math.round(midiFloat)) : '?'
      const dir = midiFloat != null && midiFloat > s.target ? '高い' : '低い'
      return {
        msg: {
          text: `不正解… 正解は ${noteFull(s.target)}(あなたの声は ${sung} で${dir}でした)。続けて正しい音を出してみましょう`,
          cls: 'ng',
        },
        holdRatio: 0,
        finished: 'ng',
        sound: 'fail',
      }
    }

    return { msg, holdRatio }
  }
}
