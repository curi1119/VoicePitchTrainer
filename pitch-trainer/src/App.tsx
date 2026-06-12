import { useEffect, useRef, useState } from 'react'
import { METER, PIANO, SCALE, SINGLE } from './config'
import { openMic, type MicInput } from './audio/mic'
import { noteFull } from './audio/notes'
import { detectPitch } from './audio/pitch-detector'
import { PitchTracker } from './audio/smoothing'
import {
  audioContext,
  playFail,
  playSuccess,
  playTone,
  playTriad,
  type Timbre,
} from './audio/synth'
import { SingleMode } from './modes/single'
import { ScaleMode, type PatternKey } from './modes/scale'
import { Meter, type MeterHandle } from './components/Meter'
import { Piano } from './components/Piano'
import { ScalePane, type Chip } from './components/ScalePane'
import { SinglePane, type PresetKey } from './components/SinglePane'
import { WaveDisplay, type WaveHandle } from './components/WaveDisplay'
import { Button, Card } from './components/ui'

type Mode = 'tuner' | 'single' | 'scale'

const TABS: ReadonlyArray<readonly [Mode, string]> = [
  ['tuner', 'チューナー'],
  ['single', '単音発声'],
  ['scale', '音階練習'],
]

export default function App() {
  // ---- 離散イベント系の state(再レンダリング対象)----
  const [micOn, setMicOn] = useState(false)
  const [timbre, setTimbre] = useState<Timbre>('piano')
  const [mode, setMode] = useState<Mode>('tuner')
  /** 検出音(鍵盤の青ハイライト)。音名ヒステリシス通過後なので更新頻度は低い */
  const [sung, setSung] = useState<number | null>(null)
  /** 目標音(鍵盤のオレンジ枠) */
  const [target, setTarget] = useState<number | null>(null)
  // 単音発声トレーニング
  const [preset, setPreset] = useState<PresetKey>('custom')
  const [low, setLow] = useState<number>(SINGLE.DEFAULT_LOW)
  const [high, setHigh] = useState<number>(SINGLE.DEFAULT_HIGH)
  const [score, setScore] = useState({ ok: 0, all: 0 })
  const [quizDisabled, setQuizDisabled] = useState(false)
  const [replayDisabled, setReplayDisabled] = useState(true)
  const [passDisabled, setPassDisabled] = useState(true)
  // 音階練習
  const [patternKey, setPatternKey] = useState<PatternKey>('p1')
  const [scaleBase, setScaleBase] = useState<number>(SCALE.DEFAULT_BASE)
  const [bpm, setBpm] = useState<number>(SCALE.BPM_DEFAULT)
  const [guideOn, setGuideOn] = useState(true)
  const [scaleRunning, setScaleRunning] = useState(false)
  const [scaleInfo, setScaleInfo] = useState('')
  const [chips, setChips] = useState<Chip[]>([])

  // ---- 60Hz 系・メインループから参照するもの(ref。再レンダリングさせない)----
  const meterRef = useRef<MeterHandle>(null)
  const waveRef = useRef<WaveHandle>(null)
  const micRef = useRef<MicInput | null>(null)
  const trackerRef = useRef(new PitchTracker())
  const singleRef = useRef(new SingleMode())
  const modeRef = useRef<Mode>('tuner')
  const targetRef = useRef<number | null>(null)
  const lastTextRef = useRef(0)

  // ScaleMode が常に最新の設定値を読めるようにする(プロトタイプが毎回 DOM を読む挙動の踏襲)
  const latest = useRef({ timbre, patternKey, bpm, guideOn })
  useEffect(() => {
    latest.current = { timbre, patternKey, bpm, guideOn }
  })

  // インスタンスはマウント時に1度だけ生成する(コールバックはすべてイベント/タイマー文脈で呼ばれる)
  const scaleRef = useRef<ScaleMode | null>(null)
  useEffect(() => {
    scaleRef.current ??= new ScaleMode({
      getBpm: () => latest.current.bpm,
      getPatternKey: () => latest.current.patternKey,
      getGuideOn: () => latest.current.guideOn,
      playTone: (m, d) => playTone(m, latest.current.timbre, d),
      playTriad: (m, d) => playTriad(m, latest.current.timbre, d),
      onChips: (labels) => setChips(labels.map((label) => ({ label, state: '' }))),
      onChipState: (idx, state) =>
        setChips((cs) => cs.map((c, i) => (i === idx ? { ...c, state } : c))),
      onInfo: setScaleInfo,
      onTarget: (m) => {
        targetRef.current = m
        setTarget(m)
      },
      onRunningChange: setScaleRunning,
    })
  }, [])

  // ---- メインループ(約60fps)----
  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)

      let raw = -1
      const mic = micRef.current
      if (mic) {
        const buf = mic.read()
        waveRef.current?.draw(buf)
        raw = detectPitch(buf, mic.sampleRate)
      }
      const frame = trackerRef.current.update(raw)

      if (frame.midi != null && frame.note != null) {
        const nearest = frame.note
        // メーター基準: ターゲットがあればターゲット比、なければ表示中の音名比
        let refMidi = nearest
        const ss = singleRef.current.state
        if (modeRef.current === 'single' && ss.target != null && !ss.solved) refMidi = ss.target
        if (modeRef.current === 'scale' && scaleRef.current?.running && targetRef.current != null)
          refMidi = targetRef.current
        const cents = (frame.midi - refMidi) * 100
        meterRef.current?.setNeedle(cents, true)
        setSung(nearest >= PIANO.MIDI_MIN && nearest <= PIANO.MIDI_MAX ? nearest : null)
        if (now - lastTextRef.current > METER.TEXT_UPDATE_MS) {
          lastTextRef.current = now
          meterRef.current?.setReadout(nearest, frame.midi, cents)
        }
      } else if (frame.cleared) {
        meterRef.current?.clearReadout()
        meterRef.current?.setNeedle(0, false)
        setSung(null)
      }

      // 単音発声の判定(非表示中も時刻だけは進める)
      const res = singleRef.current.frame(frame.midi, now, modeRef.current === 'single')
      if (res) {
        meterRef.current?.setMsg(res.msg.text, res.msg.cls)
        if (res.holdRatio != null) meterRef.current?.setHold(res.holdRatio)
        if (res.sound === 'success') playSuccess()
        if (res.sound === 'fail') playFail()
        if (res.finished) {
          const st = singleRef.current.state
          setScore({ ok: st.ok, all: st.all })
          if (res.finished !== 'retry-ok') {
            // 判定確定 → 次の出題を許可し、答えの鍵盤を表示
            setQuizDisabled(false)
            setPassDisabled(true)
            targetRef.current = st.target
            setTarget(st.target)
          }
        }
      }

      // 音階練習の判定
      if (modeRef.current === 'scale') scaleRef.current?.judge(frame.midi)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- ハンドラ ----
  async function handleMic() {
    if (micOn) return
    try {
      micRef.current = await openMic(audioContext())
      setMicOn(true)
    } catch (e) {
      alert('マイクを取得できませんでした: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function switchMode(m: Mode) {
    setMode(m)
    modeRef.current = m
    if (m !== 'scale') scaleRef.current?.stop()
    if (m !== 'single') {
      singleRef.current.abandon()
      targetRef.current = null
      setTarget(null)
      meterRef.current?.setMsg('', '')
      setQuizDisabled(false)
      meterRef.current?.setHold(0)
    }
  }

  function handlePreset(p: PresetKey) {
    setPreset(p)
    if (p !== 'custom') {
      const [lo, hi] = SINGLE.PRESETS[p]
      setLow(lo)
      setHigh(hi)
    }
  }

  // プリセット選択中は範囲プルダウンが disabled なので通常起きないが保険
  function handleLow(v: number) {
    setLow(v)
    if (preset !== 'custom') setPreset('custom')
  }
  function handleHigh(v: number) {
    setHigh(v)
    if (preset !== 'custom') setPreset('custom')
  }

  function handleQuiz() {
    if (!micOn) {
      alert('先にマイクを開始してください')
      return
    }
    if (low > high) {
      alert('出題範囲が不正です')
      return
    }
    const t = singleRef.current.startQuiz(low, high, performance.now())
    const st = singleRef.current.state
    setScore({ ok: st.ok, all: st.all })
    setQuizDisabled(true) // 判定が確定するまで次の出題は不可
    setReplayDisabled(false)
    setPassDisabled(false)
    targetRef.current = null
    setTarget(null) // 答えは隠す
    meterRef.current?.setHold(0)
    meterRef.current?.setMsg('この音を発声してください…', '')
    playTone(t, timbre, SINGLE.QUIZ_TONE_DUR)
  }

  function handleReplay() {
    const st = singleRef.current.state
    if (st.target == null) return
    playTone(st.target, timbre, SINGLE.QUIZ_TONE_DUR)
    singleRef.current.replay(performance.now())
  }

  function handlePass() {
    const st = singleRef.current.state
    const t = st.target
    if (t == null || !singleRef.current.pass()) return
    targetRef.current = t
    setTarget(t)
    meterRef.current?.setMsg(`答えは ${noteFull(t)} でした`, 'ng')
    setPassDisabled(true)
    setQuizDisabled(false)
    meterRef.current?.setHold(0)
  }

  function handleScaleStart() {
    if (!micOn) {
      alert('先にマイクを開始してください')
      return
    }
    scaleRef.current?.start(scaleBase)
  }

  return (
    <div className="mx-auto max-w-[1080px] p-4">
      <header className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <h1 className="text-lg font-semibold tracking-[0.08em]">
          PITCH TRAINER
          <span className="text-ink-dim ml-2 text-xs font-normal">発声音程トレーナー</span>
        </h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="text-ink-dim text-[13px]" htmlFor="timbre">
            音色
          </label>
          <select
            id="timbre"
            className="ctl"
            value={timbre}
            onChange={(e) => setTimbre(e.target.value as Timbre)}
          >
            <option value="piano">ピアノ(合成)</option>
            <option value="beep">ビープ音</option>
          </select>
          <Button primary onClick={handleMic} disabled={micOn}>
            {micOn ? '🎤 マイク動作中' : '🎤 マイクを開始'}
          </Button>
        </div>
      </header>

      <Card title="Pitch Meter">
        <Meter ref={meterRef} />
        <WaveDisplay ref={waveRef} />
      </Card>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`border-line bg-panel cursor-pointer rounded-t-lg border px-4 py-2 text-sm ${
              mode === key ? 'border-t-amber text-ink border-t-2' : 'text-ink-dim'
            }`}
            onClick={() => switchMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'tuner' && (
        <Card title="チューナー(自由練習)">
          <p className="text-ink-dim mt-2 text-xs">
            マイクを開始して声を出すと、検出した音程がメーターと鍵盤に表示されます。鍵盤をクリックすると参照音が鳴ります。
          </p>
        </Card>
      )}
      {mode === 'single' && (
        <SinglePane
          preset={preset}
          low={low}
          high={high}
          score={score}
          quizDisabled={quizDisabled}
          replayDisabled={replayDisabled}
          passDisabled={passDisabled}
          onPresetChange={handlePreset}
          onLowChange={handleLow}
          onHighChange={handleHigh}
          onQuiz={handleQuiz}
          onReplay={handleReplay}
          onPass={handlePass}
        />
      )}
      {mode === 'scale' && (
        <ScalePane
          patternKey={patternKey}
          base={scaleBase}
          bpm={bpm}
          guideOn={guideOn}
          running={scaleRunning}
          info={scaleInfo}
          chips={chips}
          onPatternChange={setPatternKey}
          onBaseChange={setScaleBase}
          onBpmChange={setBpm}
          onGuideChange={setGuideOn}
          onStart={handleScaleStart}
          onStop={() => scaleRef.current?.stop()}
        />
      )}

      <Card title="Keyboard — A0 ~ C8 (88 keys)">
        <Piano sung={sung} target={target} onPlay={(m) => playTone(m, timbre)} />
      </Card>

      <footer className="text-ink-dim mt-1.5 text-center text-[11px]">
        Web Audio API / YIN ピッチ検出 / UI・音はコード生成(画像・音声アセット不使用)
      </footer>
    </div>
  )
}
