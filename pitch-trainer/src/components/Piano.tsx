import { useEffect, useRef } from 'react'
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

export function Piano({ sung, target, onPlay }: PianoProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const keyEls = useRef(new Map<number, HTMLDivElement>())

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

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1.5">
      <div className="relative h-[120px] select-none" style={{ width: TOTAL_W }}>
        {KEYS.map((k) => {
          const isSung = sung === k.midi
          const cls = k.black
            ? `absolute top-0 z-[2] h-[74px] w-[15px] cursor-pointer rounded-b-[3px] border border-black ${
                isSung ? 'bg-blue' : 'bg-[#222a33] hover:bg-[#3a4654]'
              }`
            : `absolute top-0 h-[120px] w-[25px] cursor-pointer rounded-b border border-[#2c3742] ${
                isSung ? 'bg-blue' : 'bg-[#f2f0ea] hover:bg-white'
              }`
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
                ...(target === k.midi
                  ? { outline: '3px solid var(--color-amber)', outlineOffset: '-3px' }
                  : {}),
              }}
              onPointerDown={() => onPlay(k.midi)}
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
