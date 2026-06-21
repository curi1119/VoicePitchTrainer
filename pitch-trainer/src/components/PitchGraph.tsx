import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { GRAPH, METER, PIANO, PITCH } from '../config'
import { freqOf, isBlackKey, isInKey, noteName, noteOct } from '../audio/notes'
import { desiredRange, followRange, midiOfY, yOfMidi, type GraphRange } from './pitch-graph-math'

/** 1フレームぶんの入力(メインループから毎フレーム渡す) */
export interface GraphFrame {
  /** performance.now() ms */
  now: number
  /** 平滑化後の MIDI 値(無音なら null) */
  midi: number | null
  /** ヒステリシス後の表示音名 MIDI(無音なら null) */
  note: number | null
  /** メーター基準とのずれ(セント。無音なら null) */
  cents: number | null
  /** ターゲット帯の中心 MIDI(なければ null) */
  target: number | null
  /** ターゲット帯の幅(±セント) */
  toleranceCents: number
  /** 入力レベル RMS */
  rms: number
}

export interface PitchGraphHandle {
  /** 毎フレーム呼ぶ。履歴の更新と再描画を行う */
  pushFrame(f: GraphFrame): void
}

interface Point {
  t: number
  midi: number | null
  target: number | null
  tol: number
}

const COLORS = {
  rowBlack: 'rgba(0,0,0,0.16)',
  gridLine: 'rgba(84,102,122,0.22)',
  gridLineC: 'rgba(84,102,122,0.65)',
  label: '#8fa1b0',
  labelDim: '#54667a',
  band: 'rgba(86,217,160,0.14)',
  bandCenter: 'rgba(86,217,160,0.55)',
  traceFree: '#6bb8ff',
  traceOffKey: '#ff6b6b',
  traceIn: '#56d9a0',
  traceOut: '#ffb347',
  keyWhite: '#f2f0ea',
  keyBlack: '#222a33',
  keySep: '#2c3742',
  keyLabel: '#6a737d',
  sung: '#6bb8ff',
  target: '#ffb347',
  levelBg: '#243140',
  levelLow: '#54667a',
  levelOk: '#56d9a0',
  pressed: 'rgba(255,179,71,0.55)',
} as const

/** ミニ鍵盤タップ後に押下表示を残す時間 ms */
const PRESS_MS = 180

export function PitchGraph({
  onPlayNote,
  keyRoot = null,
  ref,
  className = '',
}: {
  onPlayNote(midi: number): void
  /** 選択中のキー(0=C,...,11=B)。null ならキー判定なし */
  keyRoot?: number | null
  ref?: Ref<PitchGraphHandle>
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Point[]>([])
  const rangeRef = useRef<GraphRange>({ low: GRAPH.INIT_LOW, high: GRAPH.INIT_HIGH })
  const textRef = useRef({ at: 0, note: '—', oct: '', freq: '---.-', cents: '± --' })
  const pressedRef = useRef<{ midi: number; until: number } | null>(null)
  const keyRootRef = useRef(keyRoot)
  useEffect(() => {
    keyRootRef.current = keyRoot
  }, [keyRoot])

  useImperativeHandle(
    ref,
    () => ({
      pushFrame(f: GraphFrame) {
        const canvas = canvasRef.current
        if (!canvas) return
        const windowMs = GRAPH.WINDOW_SEC * 1000

        // ---- 履歴更新 ----
        const points = pointsRef.current
        points.push({ t: f.now, midi: f.midi, target: f.target, tol: f.toleranceCents })
        while (points.length > 0 && points[0].t < f.now - windowMs - 250) points.shift()

        // ---- レンジ追従(声とターゲット帯が収まるように)----
        const interest: number[] = []
        for (const p of points) {
          if (p.midi != null) interest.push(p.midi)
          if (p.target != null) interest.push(p.target - p.tol / 100, p.target + p.tol / 100)
        }
        rangeRef.current = followRange(
          rangeRef.current,
          desiredRange(interest, rangeRef.current, GRAPH.MIN_SPAN, GRAPH.PAD),
          GRAPH.RANGE_LERP,
        )
        const range = rangeRef.current

        // ---- 数値表示のキャッシュ更新(10Hz 間引き)----
        const text = textRef.current
        if (f.now - text.at > METER.TEXT_UPDATE_MS) {
          text.at = f.now
          if (f.midi != null && f.note != null && f.cents != null) {
            text.note = noteName(f.note)
            text.oct = String(noteOct(f.note))
            text.freq = freqOf(f.midi).toFixed(1)
            text.cents = `${f.cents >= 0 ? '+' : ''}${f.cents.toFixed(0)} cents`
          } else {
            text.note = '—'
            text.oct = ''
            text.freq = '---.-'
            text.cents = '± --'
          }
        }

        // ---- キャンバス準備(クライアントサイズ × dpr)----
        const dpr = window.devicePixelRatio || 1
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
        const c = canvas.getContext('2d')
        if (!c || w === 0 || h === 0) return
        c.scale(dpr, dpr)

        const kw = GRAPH.KEYBOARD_W
        const plotW = w - kw
        const xOf = (t: number) => kw + (1 - (f.now - t) / windowMs) * plotW

        // ---- 行(黒鍵の段を暗く)とグリッド線 ----
        const mLo = Math.floor(range.low)
        const mHi = Math.ceil(range.high)
        for (let m = mLo; m <= mHi; m++) {
          const top = yOfMidi(m + 0.5, range, h)
          const bottom = yOfMidi(m - 0.5, range, h)
          if (bottom < 0 || top > h) continue
          if (isBlackKey(m)) {
            c.fillStyle = COLORS.rowBlack
            c.fillRect(kw, top, plotW, bottom - top)
          }
          const y = yOfMidi(m, range, h)
          const isC = noteName(m) === 'C'
          c.strokeStyle = isC ? COLORS.gridLineC : COLORS.gridLine
          c.lineWidth = 1
          c.beginPath()
          c.moveTo(kw, y)
          c.lineTo(w, y)
          c.stroke()
          if (isC) {
            c.fillStyle = COLORS.label
            c.font = '10px ui-monospace, monospace'
            c.textAlign = 'left'
            c.textBaseline = 'bottom'
            c.fillText(`${noteName(m)}${noteOct(m)}  ${freqOf(m).toFixed(0)}Hz`, kw + 4, y - 2)
          }
        }

        // ---- ターゲット帯(時間方向。同じターゲットの区間をまとめて描画)----
        let runStart: Point | null = null
        const drawBand = (from: number, to: number, target: number, tol: number) => {
          const yTop = yOfMidi(target + tol / 100, range, h)
          const yBottom = yOfMidi(target - tol / 100, range, h)
          c.fillStyle = COLORS.band
          c.fillRect(from, yTop, to - from, yBottom - yTop)
          const yC = yOfMidi(target, range, h)
          c.strokeStyle = COLORS.bandCenter
          c.lineWidth = 1
          c.beginPath()
          c.moveTo(from, yC)
          c.lineTo(to, yC)
          c.stroke()
        }
        for (let i = 0; i <= points.length; i++) {
          const p = points[i]
          const changed = !p || !runStart || p.target !== runStart.target || p.tol !== runStart.tol
          if (changed) {
            if (runStart && runStart.target != null) {
              const endT = p ? p.t : f.now
              drawBand(Math.max(kw, xOf(runStart.t)), xOf(endT), runStart.target, runStart.tol)
            }
            runStart = p && p.target != null ? p : null
          }
        }

        // ---- 声の軌跡(無音で途切れ、帯内は緑)----
        c.lineWidth = 2
        c.lineJoin = 'round'
        let prev: Point | null = null
        for (const p of points) {
          if (p.midi != null && prev && prev.midi != null) {
            const inZone = p.target != null && Math.abs(p.midi - p.target) * 100 <= p.tol
            const kr = keyRootRef.current
            const freeColor =
              kr != null && !isInKey(Math.round(p.midi), kr) ? COLORS.traceOffKey : COLORS.traceFree
            c.strokeStyle = p.target == null ? freeColor : inZone ? COLORS.traceIn : COLORS.traceOut
            c.beginPath()
            c.moveTo(Math.max(kw, xOf(prev.t)), yOfMidi(prev.midi, range, h))
            c.lineTo(xOf(p.t), yOfMidi(p.midi, range, h))
            c.stroke()
          }
          prev = p
        }

        // ---- 左端ミニ鍵盤 ----
        c.fillStyle = COLORS.keyWhite
        c.fillRect(0, 0, kw, h)
        for (let m = mLo; m <= mHi; m++) {
          const top = yOfMidi(m + 0.5, range, h)
          const bottom = yOfMidi(m - 0.5, range, h)
          if (bottom < 0 || top > h) continue
          if (isBlackKey(m)) {
            c.fillStyle = COLORS.keyBlack
            c.fillRect(0, top, kw * 0.62, bottom - top)
          }
          if (f.note === m) {
            c.fillStyle = COLORS.sung
            c.fillRect(0, top, kw, bottom - top)
          }
          // タップ直後の押下フラッシュ
          const pressed = pressedRef.current
          if (pressed && pressed.midi === m && pressed.until > f.now) {
            c.fillStyle = COLORS.pressed
            c.fillRect(0, top, kw, bottom - top)
          }
          if (f.target != null && Math.round(f.target) === m) {
            c.strokeStyle = COLORS.target
            c.lineWidth = 2
            c.strokeRect(1, top + 1, kw - 2, bottom - top - 2)
          }
          c.strokeStyle = COLORS.keySep
          c.lineWidth = 1
          c.beginPath()
          c.moveTo(0, bottom)
          c.lineTo(kw, bottom)
          c.stroke()
          if (noteName(m) === 'C') {
            c.fillStyle = COLORS.keyLabel
            c.font = '9px ui-monospace, monospace'
            c.textAlign = 'right'
            c.textBaseline = 'middle'
            c.fillText(`C${noteOct(m)}`, kw - 3, (top + bottom) / 2)
          }
        }
        c.strokeStyle = COLORS.keySep
        c.beginPath()
        c.moveTo(kw + 0.5, 0)
        c.lineTo(kw + 0.5, h)
        c.stroke()

        // ---- 数値表示(右上)----
        c.textAlign = 'right'
        c.textBaseline = 'top'
        c.fillStyle = '#e9eef3'
        c.font = 'bold 26px ui-monospace, monospace'
        c.fillText(text.note + text.oct, w - 8, 6)
        c.fillStyle = COLORS.label
        c.font = '11px ui-monospace, monospace'
        c.fillText(`${text.freq} Hz`, w - 8, 36)
        c.fillText(text.cents, w - 8, 50)

        // ---- 入力レベル(左下)----
        const lv = Math.min(1, f.rms / 0.3)
        c.fillStyle = COLORS.levelBg
        c.fillRect(kw + 8, h - 12, 46, 5)
        c.fillStyle = f.rms < PITCH.RMS_GATE ? COLORS.levelLow : COLORS.levelOk
        c.fillRect(kw + 8, h - 12, 46 * lv, 5)
      },
    }),
    [],
  )

  return (
    <canvas
      ref={canvasRef}
      className={`bg-panel2 block w-full touch-manipulation rounded-lg ${className}`}
      onPointerDown={(e) => {
        const canvas = canvasRef.current
        if (!canvas) return
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        if (x > GRAPH.KEYBOARD_W) return
        const midi = Math.round(midiOfY(y, rangeRef.current, rect.height))
        if (midi >= PIANO.MIDI_MIN && midi <= PIANO.MIDI_MAX) {
          pressedRef.current = { midi, until: performance.now() + PRESS_MS }
          onPlayNote(midi)
        }
      }}
    />
  )
}
