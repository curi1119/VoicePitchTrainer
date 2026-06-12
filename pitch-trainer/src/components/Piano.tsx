import { useEffect, useRef, useState } from 'react'
import { PIANO } from '../config'
import { isBlackKey, noteName, noteOct } from '../audio/notes'

interface KeyDef {
  midi: number
  black: boolean
  left: number
  /** C の白鍵のみオクターブラベルを付ける */
  label?: string
}

const KEYS: KeyDef[] = (() => {
  const keys: KeyDef[] = []
  let whiteCount = 0
  for (let m = PIANO.MIDI_MIN; m <= PIANO.MIDI_MAX; m++) {
    if (!isBlackKey(m)) {
      keys.push({
        midi: m,
        black: false,
        left: whiteCount * PIANO.WHITE_W,
        label: noteName(m) === 'C' ? `C${noteOct(m)}` : undefined,
      })
      whiteCount++
    } else {
      keys.push({ midi: m, black: true, left: whiteCount * PIANO.WHITE_W - PIANO.BLACK_W / 2 })
    }
  }
  return keys
})()
const TOTAL_W = KEYS.filter((k) => !k.black).length * PIANO.WHITE_W

interface PianoProps {
  /** 検出中の音(青ハイライト) */
  sung: number | null
  /** 目標音(オレンジ枠) */
  target: number | null
  onPlay(midi: number): void
}

/** タップ後に押下表示を残す時間 ms(素早いタップでも「押した感」が見えるように) */
const PRESS_MS = 180

export function Piano({ sung, target, onPlay }: PianoProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const keyEls = useRef(new Map<number, HTMLDivElement>())
  const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set())
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  // 初期表示は中央(C4付近)へスクロール
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = 23 * PIANO.WHITE_W - 200
  }, [])

  // 目標音が変わったら見える位置へスクロール
  useEffect(() => {
    if (target == null) return
    keyEls.current
      .get(target)
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [target])

  // アンマウント時に押下表示のタイマーを掃除
  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach(clearTimeout)
  }, [])

  function press(midi: number) {
    onPlay(midi)
    setPressed((s) => new Set(s).add(midi))
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      setPressed((s) => {
        const next = new Set(s)
        next.delete(midi)
        return next
      })
    }, PRESS_MS)
    timersRef.current.add(timer)
  }

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1.5">
      <div className="relative h-[120px] select-none" style={{ width: TOTAL_W }}>
        {KEYS.map((k) => {
          const isSung = sung === k.midi
          const isPressed = pressed.has(k.midi)
          const bg = k.black
            ? isPressed
              ? 'bg-[#46566c]'
              : isSung
                ? 'bg-blue'
                : 'bg-[#222a33] hover:bg-[#3a4654]'
            : isPressed
              ? 'bg-[#cfc9b8]'
              : isSung
                ? 'bg-blue'
                : 'bg-[#f2f0ea] hover:bg-white'
          const cls = k.black
            ? `absolute top-0 z-[2] h-[74px] w-[15px] cursor-pointer rounded-b-[3px] border border-black transition-[background-color,transform] duration-100 ${bg}`
            : `absolute top-0 h-[120px] w-[25px] cursor-pointer rounded-b border border-[#2c3742] transition-[background-color,transform] duration-100 ${bg}`
          return (
            <div
              key={k.midi}
              ref={(el) => {
                if (el) keyEls.current.set(k.midi, el)
                else keyEls.current.delete(k.midi)
              }}
              className={cls}
              style={{
                left: k.left,
                WebkitTapHighlightColor: 'transparent',
                ...(isPressed ? { transform: 'translateY(2px) scaleY(0.98)' } : {}),
                ...(target === k.midi
                  ? { outline: '3px solid var(--color-amber)', outlineOffset: '-3px' }
                  : {}),
              }}
              onPointerDown={() => press(k.midi)}
            >
              {k.label != null && (
                <span className="pointer-events-none absolute bottom-[3px] w-full text-center font-mono text-[8px] text-[#6a737d]">
                  {k.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
