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
  roundCount: number
  turnaround: boolean
  running: boolean
  info: string
  chips: Chip[]
  onPatternChange(key: PatternKey): void
  onBaseChange(midi: number): void
  onBpmChange(bpm: number): void
  onGuideChange(on: boolean): void
  onRoundCountChange(count: number): void
  onTurnaroundChange(on: boolean): void
  onStart(): void
  onStop(): void
}

export function ScalePane(p: ScalePaneProps) {
  return (
    <Card className="p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* スマホ1行目: スタート・停止・スタート音・ガイド音 / PC: 先頭 */}
        <Button primary onClick={p.onStart} disabled={p.running}>
          ▶ スタート
        </Button>
        <Button onClick={p.onStop} disabled={!p.running}>
          ■ 停止
        </Button>
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
        <label className="text-ink-dim text-[13px] md:hidden">
          <input
            type="checkbox"
            checked={p.guideOn}
            onChange={(e) => p.onGuideChange(e.target.checked)}
          />{' '}
          ガイド音
        </label>
        {/* スマホ2行目: テンポ・ラウンド数・折り返し */}
        <div className="flex w-full items-center gap-2 md:contents">
          <label className="text-ink-dim flex items-center gap-1 text-[13px]">
            テンポ
            <select
              aria-label="テンポ"
              className="ctl"
              value={p.bpm}
              onChange={(e) => p.onBpmChange(Number(e.target.value))}
            >
              {Array.from(
                { length: (SCALE.BPM_MAX - SCALE.BPM_MIN) / SCALE.BPM_STEP + 1 },
                (_, i) => SCALE.BPM_MIN + i * SCALE.BPM_STEP,
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-dim flex items-center gap-1 text-[13px]">
            ラウンド
            <select
              aria-label="ラウンド数"
              className="ctl"
              value={p.roundCount}
              onChange={(e) => p.onRoundCountChange(Number(e.target.value))}
            >
              {Array.from({ length: 11 }, (_, i) => i + 5).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-dim text-[13px]">
            <input
              type="checkbox"
              checked={p.turnaround}
              onChange={(e) => p.onTurnaroundChange(e.target.checked)}
            />{' '}
            折り返し
          </label>
        </div>
        {/* PC: 折り返しの後にガイド音 */}
        <label className="text-ink-dim max-md:hidden text-[13px]">
          <input
            type="checkbox"
            checked={p.guideOn}
            onChange={(e) => p.onGuideChange(e.target.checked)}
          />{' '}
          ガイド音
        </label>
        {/* スマホ3行目: パターン・？ / PC: ガイド音の後にパターン→？ */}
        <div className="flex w-full items-center gap-2 md:contents">
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
          <span className="ml-auto">
            <InfoTip>
              開始前に基音の和音、続いてガイド音が鳴るので、合わせて発声してください。1周ごとに半音ずつ上がり、
              <strong>ラウンド数</strong>ぶん上げたら終了します。<strong>折り返し</strong>
              にチェックを入れると、上げきった後は半音ずつ下げて開始音まで戻り、また上がる…を停止するまで繰り返します。
              ※ガイド音ON時はマイクがアプリの音を拾うため<strong>ヘッドホン推奨</strong>です。
            </InfoTip>
          </span>
        </div>
      </div>
      {p.info && (
        <div className="text-ink-dim mt-1.5 min-h-[18px] font-mono text-xs">{p.info}</div>
      )}
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
