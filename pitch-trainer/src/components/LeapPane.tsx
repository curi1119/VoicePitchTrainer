import { LEAP } from '../config'
import { NOTE_NAMES, noteFull } from '../audio/notes'
import type { ChipState, DirectionKey, IntervalKey } from '../modes/leap'
import { Button, Card, InfoTip } from './ui'

export type PresetKey = 'male' | 'female' | 'custom'

export interface LeapChip {
  label: string
  state: ChipState | ''
}

const RANGE_OPTIONS = Array.from(
  { length: LEAP.RANGE_MAX - LEAP.RANGE_MIN + 1 },
  (_, i) => LEAP.RANGE_MIN + i,
)

const CHIP_CLS: Record<ChipState | '', string> = {
  '': 'border-line bg-panel2 text-ink-dim',
  now: 'border-amber bg-panel2 text-amber',
  pass: 'border-green bg-green/15 text-green',
  fail: 'border-red bg-red/10 text-red',
}

interface LeapPaneProps {
  keyRoot: number
  interval: IntervalKey
  direction: DirectionKey
  bpm: number
  preset: PresetKey
  low: number
  high: number
  running: boolean
  info: string
  chips: LeapChip[]
  onKeyChange(key: number): void
  onIntervalChange(interval: IntervalKey): void
  onDirectionChange(direction: DirectionKey): void
  onBpmChange(bpm: number): void
  onPresetChange(preset: PresetKey): void
  onLowChange(midi: number): void
  onHighChange(midi: number): void
  onPlay(): void
  onReplay(): void
}

export function LeapPane(p: LeapPaneProps) {
  const custom = p.preset === 'custom'
  return (
    <Card className="overflow-hidden p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* 行1: 再生・もう一度・？ */}
        <Button primary onClick={p.onPlay} disabled={p.running}>
          ▶ 再生
        </Button>
        <Button
          className="border-amber/50 bg-amber/15 enabled:hover:bg-amber/25"
          onClick={p.onReplay}
          disabled={p.running || p.chips.length === 0}
          title="同じパターンをもう一度再生"
        >
          🔁 もう一度
        </Button>
        <span className="md:order-last md:ml-auto">
          <InfoTip>
            選択したキーの<strong>メジャースケール</strong>
            上でダイアトニック3度/5度の跳躍練習を行います。ガイド音を聞いて同じ高さの声を出してください。
            <br />
            各音±60セント以内をキープすれば合格です。
            <br />
            <strong>再生</strong>: 新しいパターンをランダムに出題します。
            <br />
            <strong>もう一度</strong>: 同じパターンを再度再生します。
          </InfoTip>
        </span>
        {/* 行2: キー・跳躍幅・跳躍方向・テンポ */}
        <div className="flex w-full items-center gap-2 md:contents">
          <label className="text-ink-dim flex items-center gap-1 text-[13px]">
            キー
            <select
              className="ctl"
              aria-label="キー"
              value={p.keyRoot}
              onChange={(e) => p.onKeyChange(Number(e.target.value))}
            >
              {NOTE_NAMES.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-ink-dim flex items-center gap-1 text-[13px]">
            跳躍幅
            <select
              className="ctl"
              aria-label="跳躍幅"
              value={p.interval}
              onChange={(e) => p.onIntervalChange(e.target.value as IntervalKey)}
            >
              <option value="random">ランダム</option>
              <option value="3rd">3度</option>
              <option value="5th">5度</option>
            </select>
          </label>
          <label className="text-ink-dim flex items-center gap-1 text-[13px]">
            方向
            <select
              className="ctl"
              aria-label="跳躍方向"
              value={p.direction}
              onChange={(e) => p.onDirectionChange(e.target.value as DirectionKey)}
            >
              <option value="random">ランダム</option>
              <option value="up">上行</option>
              <option value="down">下行</option>
            </select>
          </label>
          <label className="text-ink-dim flex items-center gap-1 text-[13px]">
            テンポ
            <select
              className="ctl"
              aria-label="テンポ"
              value={p.bpm}
              onChange={(e) => p.onBpmChange(Number(e.target.value))}
            >
              {Array.from(
                { length: (LEAP.BPM_MAX - LEAP.BPM_MIN) / LEAP.BPM_STEP + 1 },
                (_, i) => LEAP.BPM_MIN + i * LEAP.BPM_STEP,
              ).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* 行3: 音域 */}
        <div className="flex w-full items-center gap-2 md:contents">
          <select
            aria-label="音域"
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
        </div>
      </div>
      {p.info && <div className="text-ink-dim mt-1.5 min-h-[18px] font-mono text-xs">{p.info}</div>}
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
