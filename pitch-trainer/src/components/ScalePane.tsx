import { SCALE } from '../config'
import { noteFull } from '../audio/notes'
import type { ChipState, PatternKey } from '../modes/scale'
import { Button, Card, InfoTip } from './ui'

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
    <Card className="p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="パターン"
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
        <select
          aria-label="開始音"
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
        <span className="flex items-center gap-1">
          <input
            aria-label="テンポ"
            type="range"
            className="accent-amber w-24 touch-none"
            min={SCALE.BPM_MIN}
            max={SCALE.BPM_MAX}
            step={SCALE.BPM_STEP}
            value={p.bpm}
            onChange={(e) => p.onBpmChange(Number(e.target.value))}
          />
          <span className="text-amber font-mono text-[13px]">{p.bpm}</span>
        </span>
        <label className="text-ink-dim text-[13px]">
          <input
            type="checkbox"
            checked={p.guideOn}
            onChange={(e) => p.onGuideChange(e.target.checked)}
          />{' '}
          ガイド音
        </label>
        <Button primary onClick={p.onStart} disabled={p.running}>
          ▶ スタート
        </Button>
        <Button onClick={p.onStop} disabled={!p.running}>
          ■ 停止
        </Button>
        <span className="ml-auto">
          <InfoTip>
            開始前に基音の和音、続いてガイド音が鳴るので、合わせて発声してください。1周ごとに半音ずつ上がっていきます。※ガイド音ON時はマイクがアプリの音を拾うため
            <strong>ヘッドホン推奨</strong>です。
          </InfoTip>
        </span>
      </div>
      <div className="text-ink-dim mt-1.5 min-h-[18px] font-mono text-xs">{p.info}</div>
      {p.chips.length > 0 && (
        <div className="mt-1 flex gap-1 overflow-x-auto pb-0.5">
          {p.chips.map((c, i) => (
            <span
              key={i}
              className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-xs ${CHIP_CLS[c.state]}`}
            >
              {c.label}
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}
