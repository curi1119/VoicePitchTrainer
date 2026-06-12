import { useImperativeHandle, useRef, type Ref } from 'react'
import { METER } from '../config'
import { freqOf, noteName, noteOct } from '../audio/notes'

/** 60Hz 系の更新は React の再レンダリングを通さず、この handle 経由で直接 DOM を触る */
export interface MeterHandle {
  /** 針を動かす(毎フレーム呼ぶと lerp でゆったり追従する) */
  setNeedle(cents: number, active: boolean): void
  /** 音名・周波数・セント表示の更新(10Hz に間引いて呼ぶ) */
  setReadout(note: number, midiFloat: number, cents: number): void
  clearReadout(): void
  setMsg(text: string, cls: 'ok' | 'ng' | ''): void
  /** ホールド進捗バー 0..1 */
  setHold(ratio: number): void
}

const CX = 150
const CY = 150
const pol = (r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180
  return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)]
}
const arc = (r: number, c1: number, c2: number) => {
  const [x1, y1] = pol(r, (c1 / 50) * 60)
  const [x2, y2] = pol(r, (c2 / 50) * 60)
  return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
}
/** 目盛り(±50セントを±60度に対応づける) */
const TICKS = (() => {
  const out: { c: number; major: boolean; x1: number; y1: number; x2: number; y2: number }[] = []
  for (let c = -50; c <= 50; c += 10) {
    const deg = (c / 50) * 60
    const major = c === 0 || Math.abs(c) === 50
    const [x1, y1] = pol(major ? 100 : 106, deg)
    const [x2, y2] = pol(118, deg)
    out.push({ c, major, x1, y1, x2, y2 })
  }
  return out
})()
const LABELS = [
  { text: '-50', pos: pol(138, -60) },
  { text: '0', pos: pol(138, 0) },
  { text: '+50', pos: pol(138, 60) },
]

const MSG_BASE = 'mt-2.5 min-h-[22px] text-[15px]'

export function Meter({ ref }: { ref?: Ref<MeterHandle> }) {
  const needleRef = useRef<SVGGElement>(null)
  const needleDeg = useRef(0)
  const noteRef = useRef<HTMLSpanElement>(null)
  const octRef = useRef<HTMLSpanElement>(null)
  const freqRef = useRef<HTMLSpanElement>(null)
  const centsRef = useRef<HTMLDivElement>(null)
  const msgRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      setNeedle(cents, active) {
        const target = Math.max(-60, Math.min(60, (cents / 50) * 60))
        needleDeg.current += (target - needleDeg.current) * METER.NEEDLE_LERP
        const n = needleRef.current
        if (!n) return
        n.setAttribute('transform', `rotate(${needleDeg.current.toFixed(2)} ${CX} ${CY})`)
        n.style.opacity = active ? '1' : '0.3'
      },
      setReadout(note, midiFloat, cents) {
        if (noteRef.current) noteRef.current.textContent = noteName(note)
        if (octRef.current) octRef.current.textContent = String(noteOct(note))
        // 周波数表示は平滑化後の MIDI 値から逆算
        if (freqRef.current) freqRef.current.textContent = freqOf(midiFloat).toFixed(1)
        if (centsRef.current)
          centsRef.current.textContent = `${cents >= 0 ? '+' : ''}${cents.toFixed(0)} cents`
      },
      clearReadout() {
        if (noteRef.current) noteRef.current.textContent = '—'
        if (octRef.current) octRef.current.textContent = ''
        if (freqRef.current) freqRef.current.textContent = '---.-'
        if (centsRef.current) centsRef.current.textContent = '± -- cents'
      },
      setMsg(text, cls) {
        const el = msgRef.current
        if (!el) return
        el.textContent = text
        el.className =
          MSG_BASE + (cls === 'ok' ? ' font-bold text-green' : cls === 'ng' ? ' text-red' : '')
      },
      setHold(ratio) {
        if (holdRef.current) holdRef.current.style.width = `${Math.min(100, ratio * 100)}%`
      },
    }),
    [],
  )

  return (
    <div className="flex flex-wrap items-center justify-center gap-[18px]">
      <div className="w-[320px] max-w-full shrink-0">
        <svg viewBox="0 0 300 170" width="100%">
          <g stroke="#54667a" strokeWidth={2}>
            {TICKS.map((t) => (
              <line
                key={t.c}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                {...(t.major ? { stroke: '#8fa1b0', strokeWidth: 3 } : {})}
              />
            ))}
          </g>
          {/* 正解ゾーン ±50c */}
          <path d={arc(124, -50, 50)} stroke="rgba(255,179,71,.25)" strokeWidth={10} fill="none" />
          {/* グリーンゾーン ±10c */}
          <path
            d={arc(124, -10, 10)}
            stroke="var(--color-green)"
            strokeWidth={10}
            fill="none"
            opacity={0.8}
          />
          {LABELS.map((l) => (
            <text
              key={l.text}
              x={l.pos[0]}
              y={l.pos[1]}
              fontSize={12}
              fill="#8fa1b0"
              textAnchor="middle"
              fontFamily="monospace"
            >
              {l.text}
            </text>
          ))}
          <g ref={needleRef}>
            <line
              x1={CX}
              y1={CY}
              x2={CX}
              y2={44}
              stroke="var(--color-amber)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <circle cx={CX} cy={CY} r={7} fill="var(--color-amber)" />
          </g>
          <text
            x={150}
            y={166}
            fontSize={10}
            fill="#54667a"
            textAnchor="middle"
            fontFamily="monospace"
          >
            cents
          </text>
        </svg>
      </div>
      <div className="min-w-[220px] flex-1 text-center">
        <div className="font-mono text-7xl leading-none font-bold">
          <span ref={noteRef}>—</span>
          <span ref={octRef} className="text-ink-dim text-[34px]"></span>
        </div>
        <div className="text-ink-dim mt-1.5 font-mono text-base">
          <span ref={freqRef}>---.-</span> Hz
        </div>
        <div ref={centsRef} className="mt-1 font-mono text-sm">
          ± -- cents
        </div>
        <div ref={msgRef} className={MSG_BASE}></div>
        <div className="bg-panel2 mx-auto mt-2 h-2 max-w-[320px] overflow-hidden rounded">
          <i
            ref={holdRef}
            className="bg-green block h-full w-0 transition-[width] duration-[80ms] ease-linear"
          ></i>
        </div>
      </div>
    </div>
  )
}
