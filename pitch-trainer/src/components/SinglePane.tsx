import { SINGLE } from '../config'
import { noteFull } from '../audio/notes'
import { Button, Card, InfoTip } from './ui'

export type PresetKey = 'male' | 'female' | 'custom'

/** 出題範囲プルダウンの選択肢 (MIDI 36〜84) */
const RANGE_OPTIONS = Array.from(
  { length: SINGLE.RANGE_MAX - SINGLE.RANGE_MIN + 1 },
  (_, i) => SINGLE.RANGE_MIN + i,
)

interface SinglePaneProps {
  preset: PresetKey
  low: number
  high: number
  quizDisabled: boolean
  replayDisabled: boolean
  hideTuner: boolean
  autoQuiz: boolean
  onPresetChange(preset: PresetKey): void
  onLowChange(midi: number): void
  onHighChange(midi: number): void
  onQuiz(): void
  onReplay(): void
  onHideTunerChange(on: boolean): void
  onAutoQuizChange(on: boolean): void
}

export function SinglePane(p: SinglePaneProps) {
  const custom = p.preset === 'custom'
  return (
    <Card className="p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="出題範囲"
          className="ctl"
          value={p.preset}
          onChange={(e) => p.onPresetChange(e.target.value as PresetKey)}
        >
          <option value="male">男性向け (G2〜G4)</option>
          <option value="female">女性向け (G3〜G5)</option>
          <option value="custom">カスタム</option>
        </select>
        <span className="flex items-center gap-1">
          <select
            className="ctl"
            aria-label="下限"
            value={p.low}
            disabled={!custom}
            onChange={(e) => p.onLowChange(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {noteFull(m)}
              </option>
            ))}
          </select>
          <span className="text-ink-dim">〜</span>
          <select
            className="ctl"
            aria-label="上限"
            value={p.high}
            disabled={!custom}
            onChange={(e) => p.onHighChange(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {noteFull(m)}
              </option>
            ))}
          </select>
        </span>
        <span className="ml-auto">
          <InfoTip>
            出題音を聞いて、同じ高さの声を出してください。±50セント以内を
            <strong>約1.5秒キープで正解</strong>、外れた音程のまま安定すると<strong>不正解</strong>
            が確定します。不正解後もそのまま発声を続けて、正しい音が出せるまで練習できます。
            <br />
            <strong>チューナーを隠す</strong>:
            判定が出るまでメーターを隠し、耳だけで合わせる練習ができます。
            <br />
            <strong>自動出題</strong>: 判定確定の約2秒後に次の問題を自動で出します。
          </InfoTip>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button primary onClick={p.onQuiz} disabled={p.quizDisabled}>
          ▶ 出題
        </Button>
        <Button
          onClick={p.onReplay}
          disabled={p.replayDisabled}
          aria-label="もう一度"
          title="もう一度(出題音を再生)"
        >
          🔁
        </Button>
        <label className="text-ink-dim text-[13px]">
          <input
            type="checkbox"
            checked={p.hideTuner}
            onChange={(e) => p.onHideTunerChange(e.target.checked)}
          />{' '}
          チューナーを隠す
        </label>
        <label className="text-ink-dim text-[13px]">
          <input
            type="checkbox"
            checked={p.autoQuiz}
            onChange={(e) => p.onAutoQuizChange(e.target.checked)}
          />{' '}
          自動出題
        </label>
      </div>
    </Card>
  )
}
