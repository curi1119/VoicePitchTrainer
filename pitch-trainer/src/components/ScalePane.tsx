import { SCALE } from '../config'
import { noteFull } from '../audio/notes'
import type { ChipState, PatternKey } from '../modes/scale'
import { Button, Card } from './ui'

export interface Chip {
  label: string
  state: ChipState | ''
}

/** 開始音プルダウンの選択肢 (MIDI 36〜72) */
const BASE_OPTIONS = Array.from(
  { length: SCALE.BASE_MAX - SCALE.BASE_MIN + 1 },
  (_, i) => SCALE.BASE_MIN + i,
)

const CHIP_CLS: Record<ChipState | '', string> = {
  '': 'border-line bg-panel2 text-ink-dim',
  now: 'border-amber bg-panel2 text-amber',
  pass: 'border-green bg-green/15 text-green',
  fail: 'border-red bg-red/10 text-red',
}

interface ScalePaneProps {
  patternKey: PatternKey
  base: number
  bpm: number
  guideOn: boolean
  running: boolean
  info: string
  chips: Chip[]
  onPatternChange(key: PatternKey): void
  onBaseChange(midi: number): void
  onBpmChange(bpm: number): void
  onGuideChange(on: boolean): void
  onStart(): void
  onStop(): void
}

export function ScalePane(p: ScalePaneProps) {
  return (
    <Card title="音階練習">
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <label className="text-ink-dim text-[13px]" htmlFor="pattern">
          パターン
        </label>
        <select
          id="pattern"
          className="ctl"
          value={p.patternKey}
          onChange={(e) => p.onPatternChange(e.target.value as PatternKey)}
        >
          {(Object.keys(SCALE.PATTERNS) as PatternKey[]).map((key) => (
            <option key={key} value={key}>
              {SCALE.PATTERN_LABELS[key]}
            </option>
          ))}
        </select>
        <label className="text-ink-dim text-[13px]" htmlFor="scaleBase">
          開始音
        </label>
        <select
          id="scaleBase"
          className="ctl"
          value={p.base}
          onChange={(e) => p.onBaseChange(Number(e.target.value))}
        >
          {BASE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {noteFull(m)}
            </option>
          ))}
        </select>
        <label className="text-ink-dim text-[13px]" htmlFor="bpm">
          テンポ
        </label>
        <input
          id="bpm"
          type="range"
          className="ctl"
          min={SCALE.BPM_MIN}
          max={SCALE.BPM_MAX}
          step={SCALE.BPM_STEP}
          value={p.bpm}
          onChange={(e) => p.onBpmChange(Number(e.target.value))}
        />
        <span className="text-amber min-w-[70px] font-mono text-[13px]">{p.bpm} BPM</span>
      </div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <label className="text-ink-dim text-[13px]">
          <input
            type="checkbox"
            checked={p.guideOn}
            onChange={(e) => p.onGuideChange(e.target.checked)}
          />{' '}
          ガイド音を鳴らす
        </label>
        <Button primary onClick={p.onStart} disabled={p.running}>
          ▶ スタート
        </Button>
        <Button onClick={p.onStop} disabled={!p.running}>
          ■ 停止
        </Button>
        <span className="font-mono text-sm">{p.info}</span>
      </div>
      {p.chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-[5px]">
          {p.chips.map((c, i) => (
            <span
              key={i}
              className={`rounded-md border px-2 py-1 font-mono text-xs ${CHIP_CLS[c.state]}`}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
      <p className="text-ink-dim mt-2 text-xs">
        1周ごとに半音ずつ上がっていきます。※ガイド音ON時はマイクがアプリの音を拾うため
        <strong>ヘッドホン推奨</strong>です。
      </p>
    </Card>
  )
}
