import { useEffect, useRef, useState } from 'react'
import { PIANO, SCALE, SINGLE, SYNTH } from './config'
import { rmsOf } from './audio/level'
import { describeMicError, openMic, type MicErrorInfo, type MicInput } from './audio/mic'
import { noteFull } from './audio/notes'
import { detectPitch } from './audio/pitch-detector'
import { PitchTracker } from './audio/smoothing'
import { audioContext, setMasterVolume } from './audio/output'
import { playFail, playSuccess, playTone, playTriad, type Timbre } from './audio/synth'
import {
  hasSampledPianoCache,
  loadSampledPiano,
  type SampledPianoProgress,
} from './audio/sampled-piano'
import { SingleMode } from './modes/single'
import { ScaleMode, type PatternKey } from './modes/scale'
import { JudgeBar, type JudgeBarHandle } from './components/JudgeBar'
import { MicHelp } from './components/MicHelp'
import { Piano } from './components/Piano'
import { PitchGraph, type PitchGraphHandle } from './components/PitchGraph'
import { ScalePane, type Chip } from './components/ScalePane'
import { SinglePane, type PresetKey } from './components/SinglePane'
import { Button, Card } from './components/ui'

type Mode = 'tuner' | 'keyboard' | 'single' | 'scale'

const TABS: ReadonlyArray<readonly [Mode, string]> = [
  ['tuner', 'チューナー'],
  ['keyboard', '鍵盤'],
  ['single', '単音発声'],
  ['scale', '音階練習'],
]

export default function App() {
  // ---- 離散イベント系の state(再レンダリング対象)----
  const [micOn, setMicOn] = useState(false)
  /** マイク取得失敗の内容(日本語ガイドのモーダル表示用) */
  const [micError, setMicError] = useState<MicErrorInfo | null>(null)
  const [timbre, setTimbre] = useState<Timbre>('sampled')
  /** マスター音量 0..1(localStorage に保存) */
  const [volume, setVolume] = useState<number>(() => {
    const raw = localStorage.getItem('master-volume')
    const saved = raw == null ? NaN : Number(raw)
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : SYNTH.MASTER_VOLUME_DEFAULT
  })
  const [sampledReady, setSampledReady] = useState(false)
  const [mode, setMode] = useState<Mode>('tuner')
  /** 検出音(88鍵の青ハイライト)。音名ヒステリシス通過後なので更新頻度は低い */
  const [sung, setSung] = useState<number | null>(null)
  /** 目標音(88鍵のオレンジ枠) */
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
  const graphRef = useRef<PitchGraphHandle>(null)
  const judgeRef = useRef<JudgeBarHandle>(null)
  const micRef = useRef<MicInput | null>(null)
  const trackerRef = useRef(new PitchTracker())
  const singleRef = useRef(new SingleMode())
  const modeRef = useRef<Mode>('tuner')
  const targetRef = useRef<number | null>(null)

  // マスター音量を反映(初回 + つまみ操作時)
  useEffect(() => {
    setMasterVolume(volume)
  }, [volume])

  // ScaleMode が常に最新の設定値を読めるようにする(プロトタイプが毎回 DOM を読む挙動の踏襲)
  const latest = useRef({ timbre, patternKey, bpm, guideOn })
  useEffect(() => {
    latest.current = { timbre, patternKey, bpm, guideOn }
  })

  // 起動直後にサンプルピアノのロードを開始する。AudioContext はサスペンド状態でも
  // サンプルのデコードは可能で、実際の再生開始(resume)は各操作ハンドラ内の audioContext() が行う。
  // ロード画面を出すのは未キャッシュ(=初回訪問)のときだけ。キャッシュ済みでもデコードに
  // 1〜2秒かかるため、毎回ロード画面を出すと「キャッシュが効いていない」体験になってしまう
  const [loadProgress, setLoadProgress] = useState<SampledPianoProgress>({ loaded: 0, total: 0 })
  const [overlay, setOverlay] = useState(false)
  const [overlaySkippable, setOverlaySkippable] = useState(false)
  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const clear = () => timers.forEach(clearTimeout)
    void (async () => {
      const cached = await hasSampledPianoCache()
      if (!cached && !cancelled) {
        // 描画直後の一瞬の点滅を避けるため 250ms 遅れて表示する
        timers.push(setTimeout(() => setOverlay(true), 250))
        timers.push(setTimeout(() => setOverlaySkippable(true), 5000))
      }
      loadSampledPiano(audioContext(), (p) => setLoadProgress({ ...p }))
        .then(() => setSampledReady(true))
        .catch((e) => console.warn('サンプルピアノのロードに失敗(合成ピアノで継続):', e))
        .finally(() => {
          clear()
          setOverlay(false)
        })
    })()
    return () => {
      cancelled = true
      clear()
    }
  }, [])

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
      let rms = 0
      const mic = micRef.current
      if (mic) {
        const buf = mic.read()
        raw = detectPitch(buf, mic.sampleRate)
        rms = rmsOf(buf)
      }
      const frame = trackerRef.current.update(raw)

      // グラフのターゲット帯(モードに応じて中心と幅を決める)
      let gTarget: number | null = null
      let gTol: number = SINGLE.OK_CENTS
      const ss = singleRef.current.state
      if (modeRef.current === 'single' && ss.target != null && !ss.solved) {
        gTarget = ss.target
      } else if (
        modeRef.current === 'scale' &&
        scaleRef.current?.running &&
        targetRef.current != null
      ) {
        gTarget = targetRef.current
        gTol = SCALE.TOLERANCE_CENTS
      }

      // セント表示: ターゲットがあればターゲット比、なければ表示中の音名比
      let cents: number | null = null
      if (frame.midi != null && frame.note != null) {
        cents = (frame.midi - (gTarget ?? frame.note)) * 100
        setSung(frame.note >= PIANO.MIDI_MIN && frame.note <= PIANO.MIDI_MAX ? frame.note : null)
      } else if (frame.cleared) {
        setSung(null)
      }

      graphRef.current?.pushFrame({
        now,
        midi: frame.midi,
        note: frame.note,
        cents,
        target: gTarget,
        toleranceCents: gTol,
        rms,
      })

      // 単音発声の判定(非表示中も時刻だけは進める)
      const res = singleRef.current.frame(frame.midi, now, modeRef.current === 'single')
      if (res) {
        judgeRef.current?.setMsg(res.msg.text, res.msg.cls)
        if (res.holdRatio != null) judgeRef.current?.setHold(res.holdRatio)
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
      setMicError(null)
    } catch (e) {
      setMicError(describeMicError(e))
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
      judgeRef.current?.setMsg('', '')
      setQuizDisabled(false)
      judgeRef.current?.setHold(0)
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
    judgeRef.current?.setHold(0)
    judgeRef.current?.setMsg('この音を発声してください…', '')
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
    judgeRef.current?.setMsg(`答えは ${noteFull(t)} でした`, 'ng')
    setPassDisabled(true)
    setQuizDisabled(false)
    judgeRef.current?.setHold(0)
  }

  function handleScaleStart() {
    if (!micOn) {
      alert('先にマイクを開始してください')
      return
    }
    scaleRef.current?.start(scaleBase)
  }

  return (
    <div className="mx-auto flex h-dvh max-w-[1080px] flex-col gap-2 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:gap-3 md:p-4">
      {overlay && !sampledReady && (
        <div className="bg-bg fixed inset-0 z-50 flex flex-col items-center justify-center gap-4">
          <div className="text-lg font-semibold tracking-[0.08em]">
            PITCH TRAINER
            <span className="text-ink-dim ml-2 text-xs font-normal">発声音程トレーナー</span>
          </div>
          <div className="text-ink-dim text-sm">ピアノ音源を読み込んでいます…</div>
          <div className="bg-panel2 h-2 w-64 overflow-hidden rounded">
            <i
              className="bg-amber block h-full transition-[width] duration-150 ease-linear"
              style={{
                width:
                  loadProgress.total > 0
                    ? `${(loadProgress.loaded / loadProgress.total) * 100}%`
                    : '0%',
              }}
            ></i>
          </div>
          <div className="text-ink-dim h-4 font-mono text-xs">
            {loadProgress.total > 0 ? `${loadProgress.loaded} / ${loadProgress.total}` : ''}
          </div>
          {overlaySkippable && (
            <Button small onClick={() => setOverlay(false)}>
              待たずに始める(ピアノ音源は準備でき次第有効になります)
            </Button>
          )}
        </div>
      )}
      {micError && (
        <MicHelp
          error={micError}
          onRetry={() => {
            setMicError(null)
            void handleMic()
          }}
          onClose={() => setMicError(null)}
        />
      )}
      <header className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h1 className="text-sm font-semibold tracking-[0.08em] whitespace-nowrap sm:text-base">
          PITCH TRAINER
          <span className="text-ink-dim ml-2 hidden text-xs font-normal sm:inline">
            発声音程トレーナー
          </span>
        </h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="flex items-center gap-1">
            <span aria-hidden className="text-xs">
              🔊
            </span>
            <input
              aria-label="音量"
              type="range"
              className="ctl w-12 sm:w-24"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolume(v)
                localStorage.setItem('master-volume', String(v))
              }}
            />
          </span>
          <select
            aria-label="音色"
            className="ctl"
            value={timbre}
            onChange={(e) => setTimbre(e.target.value as Timbre)}
          >
            <option value="sampled">{sampledReady ? 'ピアノ' : 'ピアノ(読込中)'}</option>
            <option value="piano">ピアノ(合成)</option>
            <option value="beep">ビープ音</option>
          </select>
          <Button primary onClick={handleMic} disabled={micOn}>
            {micOn ? (
              '🎤 動作中'
            ) : (
              <>
                🎤 <span className="hidden sm:inline">マイク</span>開始
              </>
            )}
          </Button>
        </div>
      </header>

      <div className="border-line bg-panel flex gap-1 rounded-lg border p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-sm ${
              mode === key ? 'bg-panel2 text-amber font-semibold' : 'text-ink-dim'
            }`}
            onClick={() => switchMode(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode !== 'keyboard' && (
        <div className="border-line bg-panel flex min-h-0 flex-1 flex-col rounded-xl border p-2">
          <PitchGraph
            ref={graphRef}
            className="min-h-[180px] w-full flex-1"
            onPlayNote={(m) => playTone(m, timbre)}
          />
          <JudgeBar ref={judgeRef} />
        </div>
      )}

      {/* 鍵盤モード: 88鍵のみを画面いっぱいに表示(スマホは縦置き=低音が下) */}
      {mode === 'keyboard' && (
        <div className="border-line bg-panel flex min-h-0 flex-1 flex-col rounded-xl border p-2">
          <div className="min-h-0 flex-1 md:hidden">
            <Piano
              vertical
              thickness={40}
              sung={sung}
              target={target}
              onPlay={(m) => playTone(m, timbre)}
            />
          </div>
          {/* 鍵が間延びしないよう長さに上限を設け、縦方向は中央に置く */}
          <div className="hidden min-h-0 flex-1 md:flex md:items-center">
            <div className="h-full max-h-[260px] w-full">
              <Piano
                thickness={32}
                length="fill"
                sung={sung}
                target={target}
                onPlay={(m) => playTone(m, timbre)}
              />
            </div>
          </div>
        </div>
      )}

      {mode === 'tuner' && (
        <Card className="p-2.5">
          <p className="text-ink-dim text-xs">
            マイクを開始して声を出すと、検出した音程がグラフに軌跡として表示されます。グラフ左の鍵盤をタップすると参照音が鳴ります。
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

      {/* 88鍵: スマホは折りたたみ、md 以上は常時表示(鍵盤モード中は非表示) */}
      <details className={mode === 'keyboard' ? 'hidden' : 'md:hidden'}>
        <summary className="border-line bg-panel text-ink-dim cursor-pointer rounded-lg border px-3 py-2 text-xs select-none">
          🎹 88鍵キーボードを表示
        </summary>
        <div className="border-line bg-panel mt-1 rounded-lg border p-2">
          <Piano sung={sung} target={target} onPlay={(m) => playTone(m, timbre)} />
        </div>
      </details>
      <div className={mode === 'keyboard' ? 'hidden' : 'hidden md:block'}>
        <Card title="Keyboard — A0 ~ C8 (88 keys)">
          <Piano sung={sung} target={target} onPlay={(m) => playTone(m, timbre)} />
        </Card>
      </div>
    </div>
  )
}
