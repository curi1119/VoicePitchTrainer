import { useEffect, useRef, useState } from 'react'
import { PIANO } from '../config'
import { degreeLabel, isBlackKey, isInKey, noteName, noteOct, type ScaleType } from '../audio/notes'

interface KeyDef {
  midi: number
  black: boolean
  /** 白鍵単位のオフセット(白鍵 = 整数、黒鍵 = 境界をまたぐ小数) */
  pos: number
  /** C の白鍵のみオクターブラベルを付ける */
  label?: string
}

const BLACK_RATIO = PIANO.BLACK_W / PIANO.WHITE_W

const KEYS: KeyDef[] = (() => {
  const keys: KeyDef[] = []
  let whiteCount = 0
  for (let m = PIANO.MIDI_MIN; m <= PIANO.MIDI_MAX; m++) {
    if (!isBlackKey(m)) {
      keys.push({
        midi: m,
        black: false,
        pos: whiteCount,
        label: noteName(m) === 'C' ? `C${noteOct(m)}` : undefined,
      })
      whiteCount++
    } else {
      keys.push({ midi: m, black: true, pos: whiteCount - BLACK_RATIO / 2 })
    }
  }
  return keys
})()
const WHITE_COUNT = KEYS.filter((k) => !k.black).length
/** C4 の白鍵オフセット(初期スクロールの中心) */
const C4_POS = KEYS.find((k) => k.midi === 60)!.pos

/** タップ後に押下表示を残す時間 ms(素早いタップでも「押した感」が見えるように) */
const PRESS_MS = 180

interface PianoProps {
  /** 検出中の音(青ハイライト) */
  sung: number | null
  /** 目標音(オレンジ枠) */
  target: number | null
  onPlay(midi: number): void
  /** キーを離したとき(ビープのサステイン停止用) */
  onPlayStop?(): void
  /** 縦置き(スマホの鍵盤モード用)。低音が下・鍵は横いっぱいに伸びる */
  vertical?: boolean
  /** 白鍵の太さ px(横置き=鍵の幅 / 縦置き=鍵の高さ) */
  thickness?: number
  /** 鍵の長さ。横置きのみ有効('fill' は親の高さいっぱい) */
  length?: number | 'fill'
  /** キー(0=C,...,11=B)。設定時は基音を青、スケール外を赤で塗る */
  keyRoot?: number | null
  /** スケールタイプ */
  scaleType?: ScaleType
  /** 度数表記(I〜VII)を白鍵に表示する */
  showDegree?: boolean
}

export function Piano({
  sung,
  target,
  onPlay,
  onPlayStop,
  vertical = false,
  thickness = PIANO.WHITE_W,
  length = 120,
  keyRoot = null,
  scaleType = 'major',
  showDegree = false,
}: PianoProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const keyEls = useRef(new Map<number, HTMLDivElement>())
  const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set())
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  const blackThick = thickness * BLACK_RATIO
  const totalPx = WHITE_COUNT * thickness

  // 初期表示は中央(C4付近)へスクロール
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const c4 = C4_POS * thickness
    if (vertical) el.scrollTop = Math.max(0, totalPx - c4 - el.clientHeight / 2)
    else el.scrollLeft = Math.max(0, c4 - el.clientWidth / 2)
  }, [vertical, thickness, totalPx])

  // 目標音が変わったら見える位置へスクロール
  useEffect(() => {
    if (target == null) return
    keyEls.current.get(target)?.scrollIntoView({
      inline: vertical ? 'nearest' : 'center',
      block: vertical ? 'center' : 'nearest',
      behavior: 'smooth',
    })
  }, [target, vertical])

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
    <div
      ref={scrollRef}
      className={vertical ? 'h-full overflow-y-auto' : 'h-full overflow-x-auto pb-1.5'}
    >
      <div
        className="relative select-none"
        style={
          vertical
            ? { height: totalPx, width: '100%' }
            : { width: totalPx, height: length === 'fill' ? '100%' : length, minHeight: 80 }
        }
      >
        {KEYS.map((k) => {
          const isSung = sung === k.midi
          const isPressed = pressed.has(k.midi)
          const isRoot = keyRoot != null && k.midi % 12 === keyRoot
          const isOffKey = keyRoot != null && !isInKey(k.midi, keyRoot, scaleType)
          const bg = k.black
            ? isPressed
              ? 'bg-[#46566c]'
              : isSung
                ? 'bg-blue'
                : isRoot
                  ? 'bg-[#5ba8d0]'
                  : isOffKey
                    ? 'bg-[#e8a0a0]'
                    : 'bg-[#222a33] hover:bg-[#3a4654]'
            : isPressed
              ? 'bg-[#cfc9b8]'
              : isSung
                ? 'bg-blue'
                : isRoot
                  ? 'bg-[#a8d8f0]'
                  : isOffKey
                    ? 'bg-[#e8a0a0]'
                    : 'bg-[#f2f0ea] hover:bg-white'
          const thick = k.black ? blackThick : thickness
          const posPx = k.pos * thickness
          const cls = k.black
            ? `absolute z-[2] cursor-pointer border border-black transition-[background-color,transform] duration-100 ${
                vertical ? 'rounded-r-[3px]' : 'rounded-b-[3px]'
              } ${bg}`
            : `absolute cursor-pointer border border-[#2c3742] transition-[background-color,transform] duration-100 ${
                vertical ? 'rounded-r' : 'rounded-b'
              } ${bg}`
          const geom = vertical
            ? {
                top: totalPx - posPx - thick,
                left: 0,
                height: thick,
                width: k.black ? '62%' : '100%',
              }
            : {
                left: posPx,
                top: 0,
                width: thick,
                height: k.black ? '62%' : '100%',
              }
          return (
            <div
              key={k.midi}
              ref={(el) => {
                if (el) keyEls.current.set(k.midi, el)
                else keyEls.current.delete(k.midi)
              }}
              className={cls}
              style={{
                ...geom,
                WebkitTapHighlightColor: 'transparent',
                ...(isPressed
                  ? {
                      transform: vertical ? 'scaleX(0.98)' : 'translateY(2px) scaleY(0.98)',
                      transformOrigin: 'left center',
                    }
                  : {}),
                ...(target === k.midi
                  ? { outline: '3px solid var(--color-amber)', outlineOffset: '-3px' }
                  : {}),
              }}
              onPointerDown={() => press(k.midi)}
              onPointerUp={() => onPlayStop?.()}
              onPointerLeave={() => onPlayStop?.()}
            >
              {k.label != null && (
                <span
                  className={
                    vertical
                      ? 'pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 -rotate-90 font-mono text-[10px] text-[#6a737d]'
                      : 'pointer-events-none absolute bottom-[3px] w-full text-center font-mono text-[8px] text-[#6a737d]'
                  }
                >
                  {k.label}
                </span>
              )}
              {showDegree &&
                keyRoot != null &&
                (() => {
                  const deg = degreeLabel(k.midi, keyRoot, scaleType)
                  return deg ? (
                    <span
                      className={
                        vertical
                          ? `pointer-events-none absolute top-1/2 -translate-y-1/2 -rotate-90 font-mono text-[9px] font-bold ${k.black ? 'right-[3px] text-white/80' : 'left-[62%] text-[#4a7a9b]'}`
                          : `pointer-events-none absolute w-full text-center font-mono text-[9px] font-bold ${k.black ? 'bottom-[3px] text-white/80' : 'top-[62%] text-[#4a7a9b]'}`
                      }
                    >
                      {deg}
                    </span>
                  ) : null
                })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
