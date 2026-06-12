import { SINGLE } from '../config'
import { noteFull } from '../audio/notes'
import { Button, Card } from './ui'

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
  score: { ok: number; all: number }
  quizDisabled: boolean
  replayDisabled: boolean
  passDisabled: boolean
  onPresetChange(preset: PresetKey): void
  onLowChange(midi: number): void
  onHighChange(midi: number): void
  onQuiz(): void
  onReplay(): void
  onPass(): void
}

export function SinglePane(p: SinglePaneProps) {
  const custom = p.preset === 'custom'
  return (
    <Card title="単音発声トレーニング">
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <label className="text-ink-dim text-[13px]" htmlFor="rangePreset">
          出題範囲
        </label>
        <select
          id="rangePreset"
          className="ctl"
          value={p.preset}
          onChange={(e) => p.onPresetChange(e.target.value as PresetKey)}
        >
          <option value="male">男性向け (G2〜G4)</option>
          <option value="female">女性向け (G3〜G5)</option>
          <option value="custom">カスタム</option>
        </select>
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
        <Button primary onClick={p.onQuiz} disabled={p.quizDisabled}>
          ▶ 出題
        </Button>
        <Button onClick={p.onReplay} disabled={p.replayDisabled}>
          🔁 もう一度聞く
        </Button>
        <Button onClick={p.onPass} disabled={p.passDisabled}>
          答えを見てパス
        </Button>
        <span className="font-mono text-sm">
          正解 <span>{p.score.ok}</span> / <span>{p.score.all}</span>
        </span>
      </div>
      <p className="text-ink-dim mt-2 text-xs">
        出題音を聞いて、同じ高さの声を出してください。発声中は高い/低いをリアルタイム表示します。±50セント以内を
        <strong>約1.5秒キープで正解</strong>、外れた音程のまま安定すると<strong>不正解</strong>
        が確定します。不正解後もそのまま発声を続けて、正しい音が出せるまで練習できます(スコアは不正解のまま)。
      </p>
    </Card>
  )
}
