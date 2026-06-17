import { describe, expect, it } from 'vitest'
import { SINGLE } from '../src/config'
import { SingleMode } from '../src/modes/single'

const DT = 100 // テスト用フレーム間隔 ms

/** t から dt 刻みで n フレーム判定を回す。確定イベントが出たらそこで返す */
function run(mode: SingleMode, midi: number | null, from: number, n: number, dt = DT) {
  let t = from
  for (let i = 0; i < n; i++) {
    t += dt
    const res = mode.frame(midi, t, true)
    if (res?.finished) return { res, t }
  }
  return { res: null, t }
}

/** 出題(target を固定するため rand を注入)して判定開始時刻まで進める */
function startQuiz(mode: SingleMode, target = 60) {
  mode.frame(null, 0, true) // lastT 初期化
  const got = mode.startQuiz(target, target, 0, () => 0)
  expect(got).toBe(target)
  const judgeFrom = SINGLE.QUIZ_TONE_DUR * 1000 + SINGLE.JUDGE_DELAY_MS
  mode.frame(null, judgeFrom, true) // 再生待ちを消化
  return judgeFrom
}

describe('SingleMode', () => {
  it('出題音の再生中は判定しない', () => {
    const m = new SingleMode()
    m.startQuiz(60, 60, 0, () => 0)
    const res = m.frame(60, 1000, true)
    expect(res!.msg.text).toContain('再生中')
    expect(res!.finished).toBeUndefined()
    expect(m.state.all).toBe(1)
  })

  it('±50セント以内を 1.5 秒キープで正解', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    const { res } = run(m, 60.3, t0, 60) // +30c は正解範囲内
    expect(res!.finished).toBe('ok')
    expect(res!.sound).toBe('success')
    expect(res!.msg.text).toBe('正解! C4 🎉')
    expect(m.state.ok).toBe(1)
    expect(m.state.solved).toBe(true)
  })

  it('外れた音程のまま 1.2 秒で不正解が確定し、リトライに入る', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    const { res, t } = run(m, 64, t0, 60) // 4半音上 (E4)
    expect(res!.finished).toBe('ng')
    expect(res!.sound).toBe('fail')
    expect(res!.msg.text).toBe(
      '不正解… 正解は C4(あなたの声は E4 で高いでした)。続けて正しい音を出してみましょう',
    )
    expect(m.state.ok).toBe(0)
    expect(m.state.retry).toBe(true)
    expect(m.state.solved).toBe(false)

    // リトライ中に正しい音をキープ → スコアは変わらず確認のみ
    const { res: res2 } = run(m, 60, t, 60)
    expect(res2!.finished).toBe('retry-ok')
    expect(res2!.msg.text).toBe('✔ 正しい音 C4 が出せました!(記録は不正解のまま)')
    expect(m.state.ok).toBe(0)
    expect(m.state.solved).toBe(true)
  })

  it('低すぎる声の不正解メッセージは「低い」', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    const { res } = run(m, 57, t0, 60) // A3
    expect(res!.msg.text).toContain('A3 で低いでした')
  })

  it('キープ中に外れると 2 倍速で減少する(即ゼロにはしない)', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    const { t } = run(m, 60, t0, 8) // 800ms キープ
    expect(m.state.holdMs).toBe(800)
    m.frame(64, t + DT, true) // 1フレーム外す
    expect(m.state.holdMs).toBe(800 - DT * 2)
    expect(m.state.wrongMs).toBe(DT)
  })

  it('無音時は hold が減少し wrong は 2 倍速で減少する', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    const { t } = run(m, 60, t0, 8)
    m.frame(64, t + DT, true)
    const res = m.frame(null, t + DT * 2, true)
    expect(res!.msg.text).toBe('この音を発声してください…')
    expect(m.state.holdMs).toBe(800 - DT * 3)
    expect(m.state.wrongMs).toBe(0)
  })

  it('リアルタイムの高低ヒントを出す', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    expect(m.frame(61, t0 + DT, true)!.msg.text).toBe('↓ 高すぎます。もう少し低く')
    expect(m.frame(59, t0 + DT * 2, true)!.msg.text).toBe('↑ 低すぎます。もう少し高く')
    expect(m.frame(60, t0 + DT * 3, true)!.msg.text).toBe('✔ その音をキープ…!')
  })

  it('パスは未解決時のみ成立する', () => {
    const m = new SingleMode()
    startQuiz(m, 60)
    expect(m.pass()).toBe(true)
    expect(m.pass()).toBe(false) // 既に solved
    expect(m.state.solved).toBe(true)
  })

  it('もう一度(replay)はキープ/外れ進捗をリセットし再生待ちに戻す', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    run(m, 60, t0, 8) // 800ms キープ(バーが進んだ状態)
    expect(m.state.holdMs).toBe(800)

    m.replay(t0 + 1000)
    expect(m.state.holdMs).toBe(0) // バーが固まったまま残らないようリセット
    expect(m.state.wrongMs).toBe(0)
    // 再生待ち中は判定しない(マイクがアプリ音を拾うため)
    expect(m.frame(60, t0 + 1100, true)!.msg.text).toContain('再生中')
  })

  it('非アクティブ(他タブ)では判定しないが時刻は進む', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    expect(m.frame(60, t0 + DT, false)).toBeNull()
    expect(m.state.holdMs).toBe(0)
    expect(m.state.lastT).toBe(t0 + DT)
  })

  it('abandon で問題を放棄できる', () => {
    const m = new SingleMode()
    const t0 = startQuiz(m, 60)
    m.abandon()
    expect(m.frame(60, t0 + DT, true)).toBeNull()
  })
})
