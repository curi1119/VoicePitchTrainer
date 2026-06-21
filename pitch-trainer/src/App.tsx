import { useEffect, useRef, useState } from 'react'
import { PIANO, PITCH, SCALE, SINGLE, SYNTH } from './config'
import { gateFromSensitivity, rmsOf, sensitivityFromGate } from './audio/level'
import { describeMicError, openMic, type MicErrorInfo, type MicInput } from './audio/mic'
import { detectPitch } from './audio/pitch-detector'
import { PitchTracker } from './audio/smoothing'
import { audioContext, setMasterVolume } from './audio/output'
import { playFail, playSuccess, playTone, playTriad, type Timbre } from './audio/synth'
import {
  hasSampledPianoCache,
  loadSampledPiano,
  loadSampledPianoDry,
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
import { Button, Card, InfoTip } from './components/ui'
import { SensitivityControl } from './components/SensitivityControl'
import { VolumeControl } from './components/VolumeControl'

type Mode = 'tuner' | 'keyboard' | 'single' | 'scale'
type DetectRangeKey = keyof typeof PITCH.DETECT_RANGES

// ---- localStorage 読み出しヘルパ(未保存・不正値はフォールバック)----
function loadNum(key: string, fallback: number, min = -Infinity, max = Infinity): number {
  const raw = localStorage.getItem(key)
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
function loadEnum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const raw = localStorage.getItem(key)
  return raw != null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback
}
function loadBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  return raw == null ? fallback : raw === 'true'
}

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
  /** 検出音域(localStorage に保存)。声域に合わせて検出レンジを絞り倍音ロックを抑える */
  const [detectRange, setDetectRange] = useState<DetectRangeKey>(() => {
    const raw = localStorage.getItem('detect-range')
    return raw != null && raw in PITCH.DETECT_RANGES
      ? (raw as DetectRangeKey)
      : PITCH.DETECT_RANGE_DEFAULT
  })
  /** マイク感度 0..1(localStorage に保存)。実効 RMS ゲートに対数マッピングする */
  const [sensitivity, setSensitivity] = useState<number>(() => {
    const raw = localStorage.getItem('detect-sensitivity')
    const saved = raw == null ? NaN : Number(raw)
    return Number.isFinite(saved)
      ? Math.min(1, Math.max(0, saved))
      : sensitivityFromGate(PITCH.RMS_GATE)
  })
  /** チューナーのキー選択(null=キーなし)。localStorage に保存 */
  const [tunerKey, setTunerKey] = useState<number | null>(() => {
    const raw = localStorage.getItem('tuner-key')
    if (raw == null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 && n <= 11 ? n : null
  })
  const [showDegree, setShowDegree] = useState(() => loadBool('show-degree', false))
  const [mode, setMode] = useState<Mode>('tuner')
  /** 鍵盤の全画面表示(スマホで鍵を大きく出すための CSS オーバーレイ) */
  const [keyboardFull, setKeyboardFull] = useState(false)
  /** 検出音(88鍵の青ハイライト)。音名ヒステリシス通過後なので更新頻度は低い */
  const [sung, setSung] = useState<number | null>(null)
  /** 目標音(88鍵のオレンジ枠) */
  const [target, setTarget] = useState<number | null>(null)
  // 単音発声トレーニング(設定は localStorage に保存)
  const [preset, setPreset] = useState<PresetKey>(() =>
    loadEnum('single-preset', ['male', 'female', 'custom'] as const, 'custom'),
  )
  const [low, setLow] = useState<number>(() =>
    loadNum('single-low', SINGLE.DEFAULT_LOW, SINGLE.RANGE_MIN, SINGLE.RANGE_MAX),
  )
  const [high, setHigh] = useState<number>(() =>
    loadNum('single-high', SINGLE.DEFAULT_HIGH, SINGLE.RANGE_MIN, SINGLE.RANGE_MAX),
  )
  const [quizDisabled, setQuizDisabled] = useState(false)
  const [replayDisabled, setReplayDisabled] = useState(true)
  /** チューナーを隠すオプション(localStorage 保存)。判定が出るまでメーターを隠す */
  const [hideTuner, setHideTuner] = useState(() => loadBool('single-hide-tuner', false))
  /** 自動出題オプション(localStorage 保存)。判定確定の一定時間後に次を自動出題 */
  const [autoQuiz, setAutoQuiz] = useState(() => loadBool('single-auto-quiz', false))
  /** いまメーターを覆っているか(チューナーを隠す ON + 出題中〜判定前) */
  const [tunerCovered, setTunerCovered] = useState(false)
  // 音階練習(設定は localStorage に保存)
  const [patternKey, setPatternKey] = useState<PatternKey>(() =>
    loadEnum('scale-pattern', Object.keys(SCALE.PATTERNS) as PatternKey[], 'p1'),
  )
  const [scaleBase, setScaleBase] = useState<number>(() =>
    loadNum('scale-base', SCALE.DEFAULT_BASE, SCALE.BASE_MIN, SCALE.BASE_MAX),
  )
  const [bpm, setBpm] = useState<number>(() =>
    loadNum('scale-bpm', SCALE.BPM_DEFAULT, SCALE.BPM_MIN, SCALE.BPM_MAX),
  )
  const [guideOn, setGuideOn] = useState(() => loadBool('scale-guide', true))
  const [roundCount, setRoundCount] = useState<number>(() =>
    loadNum(
      'scale-round-count',
      SCALE.ROUND_COUNT_DEFAULT,
      SCALE.ROUND_COUNT_MIN,
      SCALE.ROUND_COUNT_MAX,
    ),
  )
  const [turnaround, setTurnaround] = useState(() =>
    loadBool('scale-turnaround', SCALE.TURNAROUND_DEFAULT),
  )
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
  /** メインループ(60Hz)が毎フレーム読む検出レンジ [下限Hz, 上限Hz] */
  const detectRangeRef = useRef<readonly [number, number]>(PITCH.DETECT_RANGES[detectRange])
  /** メインループが毎フレーム読む実効 RMS ゲート(感度設定由来) */
  const gateRef = useRef<number>(gateFromSensitivity(sensitivity))
  // 自動出題: メインループ(stale closure)から最新の設定とハンドラを参照するための ref
  const autoQuizRef = useRef(autoQuiz)
  const handleQuizRef = useRef<() => void>(() => {})
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const quizLockRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    autoQuizRef.current = autoQuiz
  }, [autoQuiz])
  // 自動出題のタイマーから最新の handleQuiz(low/high/timbre を参照)を呼べるようにする
  useEffect(() => {
    handleQuizRef.current = handleQuiz
  })

  // マスター音量を反映(初回 + つまみ操作時)
  useEffect(() => {
    setMasterVolume(volume)
  }, [volume])

  // 鍵盤の全画面表示は Escape で閉じる
  useEffect(() => {
    if (!keyboardFull) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setKeyboardFull(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [keyboardFull])

  useEffect(() => {
    if (tunerKey == null) localStorage.removeItem('tuner-key')
    else localStorage.setItem('tuner-key', String(tunerKey))
  }, [tunerKey])

  useEffect(() => {
    localStorage.setItem('show-degree', String(showDegree))
  }, [showDegree])

  // 検出レンジをメインループ用 ref に反映(+ localStorage 保存)
  useEffect(() => {
    detectRangeRef.current = PITCH.DETECT_RANGES[detectRange]
    localStorage.setItem('detect-range', detectRange)
  }, [detectRange])

  // 感度 → 実効 RMS ゲートをメインループ用 ref に反映(+ localStorage 保存)
  useEffect(() => {
    gateRef.current = gateFromSensitivity(sensitivity)
    localStorage.setItem('detect-sensitivity', String(sensitivity))
  }, [sensitivity])

  // 単音発声の設定を localStorage に保存(プリセット選択時は low/high も同期されるため一括で保存)
  useEffect(() => {
    localStorage.setItem('single-preset', preset)
    localStorage.setItem('single-low', String(low))
    localStorage.setItem('single-high', String(high))
    localStorage.setItem('single-hide-tuner', String(hideTuner))
    localStorage.setItem('single-auto-quiz', String(autoQuiz))
  }, [preset, low, high, hideTuner, autoQuiz])

  // 音階練習の設定を localStorage に保存
  useEffect(() => {
    localStorage.setItem('scale-pattern', patternKey)
    localStorage.setItem('scale-base', String(scaleBase))
    localStorage.setItem('scale-bpm', String(bpm))
    localStorage.setItem('scale-guide', String(guideOn))
    localStorage.setItem('scale-round-count', String(roundCount))
    localStorage.setItem('scale-turnaround', String(turnaround))
  }, [patternKey, scaleBase, bpm, guideOn, roundCount, turnaround])

  // ScaleMode が常に最新の設定値を読めるようにする(プロトタイプが毎回 DOM を読む挙動の踏襲)
  const latest = useRef({ timbre, patternKey, bpm, guideOn, roundCount, turnaround })
  useEffect(() => {
    latest.current = { timbre, patternKey, bpm, guideOn, roundCount, turnaround }
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
        .then(() => {
          setSampledReady(true)
          return loadSampledPianoDry(audioContext())
        })
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
      getRoundCount: () => latest.current.roundCount,
      getTurnaround: () => latest.current.turnaround,
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
        rms = rmsOf(buf)
        // 検出レンジは「音域」設定に、足切りは「感度」設定に追従
        const [fMin, fMax] = detectRangeRef.current
        raw = detectPitch(buf, mic.sampleRate, fMin, fMax, gateRef.current)
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
        if (res.finished && res.finished !== 'retry-ok') {
          // 判定確定 → メーターを表示し、答えの鍵盤を表示
          const st = singleRef.current.state
          setTunerCovered(false)
          targetRef.current = st.target
          setTarget(st.target)
          // 自動出題: 確定の一定時間後に次を出題(ref 経由で最新の設定/ハンドラを読む)
          if (autoQuizRef.current) {
            clearTimeout(autoTimerRef.current)
            autoTimerRef.current = setTimeout(() => {
              if (modeRef.current === 'single') handleQuizRef.current()
            }, SINGLE.AUTO_QUIZ_DELAY_MS)
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
    if (m !== 'keyboard') setKeyboardFull(false)
    if (m !== 'scale') scaleRef.current?.stop()
    if (m !== 'single') {
      singleRef.current.abandon()
      clearTimeout(autoTimerRef.current)
      clearTimeout(quizLockRef.current)
      targetRef.current = null
      setTarget(null)
      setTunerCovered(false)
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
    clearTimeout(autoTimerRef.current) // 手動出題は保留中の自動出題をキャンセル
    const t = singleRef.current.startQuiz(low, high, performance.now())
    setQuizDisabled(true)
    clearTimeout(quizLockRef.current)
    quizLockRef.current = setTimeout(() => setQuizDisabled(false), 3000)
    setReplayDisabled(false)
    setTunerCovered(hideTuner) // チューナーを隠す ON なら出題中はメーターを覆う
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
    // 再生中は判定を止めるため、固まって見えるキープバーは 0 に戻して仕切り直しを明示
    judgeRef.current?.setHold(0)
    judgeRef.current?.setMsg('♪ 出題音を再生中…よく聞いてください', '')
  }

  // チューナーを隠すを OFF にしたら即メーターを表示する
  function handleHideTuner(on: boolean) {
    setHideTuner(on)
    if (!on) setTunerCovered(false)
  }
  // 自動出題を OFF にしたら保留中のタイマーを止める
  function handleAutoQuiz(on: boolean) {
    setAutoQuiz(on)
    if (!on) clearTimeout(autoTimerRef.current)
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
            PITCH LAB
            <span className="text-ink-dim ml-2 text-xs font-normal">ピッチラボ</span>
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
      {keyboardFull && (
        <div className="bg-bg fixed inset-0 z-50 flex flex-col gap-2 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <span className="text-ink-dim text-xs">🎹 鍵盤(全画面)</span>
            <Button small onClick={() => setKeyboardFull(false)}>
              ✕ 閉じる
            </Button>
          </div>
          {/* スマホは縦置き(低音が下)で鍵を大きく */}
          <div className="min-h-0 flex-1 md:hidden">
            <div className="mx-auto h-full max-w-[360px]">
              <Piano
                vertical
                thickness={48}
                sung={sung}
                target={target}
                onPlay={(m) => playTone(m, timbre)}
                keyRoot={tunerKey}
                showDegree={showDegree}
              />
            </div>
          </div>
          {/* md 以上は横置き。大画面で鍵が縦長になりすぎないよう高さに上限を設け中央に置く */}
          <div className="hidden min-h-0 flex-1 md:flex md:items-center md:justify-center">
            <div className="h-full max-h-[320px] w-full">
              <Piano
                thickness={40}
                length="fill"
                sung={sung}
                target={target}
                onPlay={(m) => playTone(m, timbre)}
                keyRoot={tunerKey}
                showDegree={showDegree}
              />
            </div>
          </div>
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
          PITCH LAB
          <span className="text-ink-dim ml-2 hidden text-xs font-normal sm:inline">ピッチラボ</span>
        </h1>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <VolumeControl
            volume={volume}
            onChange={(v) => {
              setVolume(v)
              localStorage.setItem('master-volume', String(v))
            }}
          />
          <SensitivityControl sensitivity={sensitivity} onChange={setSensitivity} />
          <span className="flex items-center gap-1">
            <select
              aria-label="音域(検出する声の高さ)"
              title="検出する声の高さの範囲。大声で低音が高い音に化ける場合は声に合った音域を選ぶと改善します"
              className="ctl"
              value={detectRange}
              onChange={(e) => setDetectRange(e.target.value as DetectRangeKey)}
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="wide">全域</option>
            </select>
            <InfoTip placement="bottom-center">
              左のセレクトは<strong>音域</strong>
              (検出する声の高さの範囲)です。大声で低音が高い音に化ける場合は、声に合った音域を選ぶと改善します。
              <br />
              男性: D2〜D5 / 女性: C3〜D6 / 全域: A1〜E6
            </InfoTip>
          </span>
          <select
            aria-label="音色"
            className="ctl"
            value={timbre}
            onChange={(e) => setTimbre(e.target.value as Timbre)}
          >
            <option value="sampled">{sampledReady ? 'ピアノ1' : 'ピアノ1(読込中)'}</option>
            <option value="sampled-dry">{sampledReady ? 'ピアノ2' : 'ピアノ2(読込中)'}</option>
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
          {/* チューナーを隠すオプションで覆うのはこの音高メーター部分のみ。下の JudgeBar(メッセージ・進捗バー)は隠さない */}
          <div className="relative flex min-h-0 w-full flex-1 flex-col">
            <PitchGraph
              ref={graphRef}
              className="min-h-[180px] w-full flex-1"
              keyRoot={mode === 'tuner' ? tunerKey : null}
              onPlayNote={(m) => playTone(m, timbre)}
            />
            {mode === 'single' && tunerCovered && (
              <div className="bg-panel2 absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg p-4 text-center">
                <div className="text-3xl">🎧</div>
                <div className="text-ink text-sm font-semibold">音高メーターは非表示です</div>
                <div className="text-ink-dim max-w-xs text-xs leading-relaxed">
                  下のメッセージを頼りに、耳で合わせて発声してください。判定が出るとメーターが表示されます。
                </div>
              </div>
            )}
          </div>
          {mode === 'single' && <JudgeBar ref={judgeRef} />}
        </div>
      )}

      {/* 鍵盤モード: 88鍵のみを画面いっぱいに表示(スマホは縦置き=低音が下) */}
      {mode === 'keyboard' && (
        <div className="border-line bg-panel flex min-h-0 flex-1 flex-col rounded-xl border p-2">
          <div className="mb-1 flex items-center gap-2">
            <label className="text-ink-dim flex items-center gap-1 text-xs">
              キー
              <select
                className="ctl"
                value={tunerKey ?? ''}
                onChange={(e) => setTunerKey(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">なし</option>
                {(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).map(
                  (n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ),
                )}
              </select>
            </label>
            {tunerKey != null && (
              <label className="text-ink-dim text-[13px]">
                <input
                  type="checkbox"
                  checked={showDegree}
                  onChange={(e) => setShowDegree(e.target.checked)}
                />{' '}
                度数
              </label>
            )}
            <span className="ml-auto">
              <Button small onClick={() => setKeyboardFull(true)}>
                ⛶ 全画面
              </Button>
            </span>
          </div>
          {/* 鍵が間延びしないよう長さに上限(実物のピアノ比)を設け、左右中央に置く */}
          <div className="min-h-0 flex-1 md:hidden">
            <div className="mx-auto h-full max-w-[260px]">
              <Piano
                vertical
                thickness={40}
                sung={sung}
                target={target}
                onPlay={(m) => playTone(m, timbre)}
                keyRoot={tunerKey}
                showDegree={showDegree}
              />
            </div>
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
                keyRoot={tunerKey}
                showDegree={showDegree}
              />
            </div>
          </div>
        </div>
      )}

      {mode === 'tuner' && (
        <Card className="p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-ink-dim flex items-center gap-1 text-xs">
              キー
              <select
                className="ctl"
                value={tunerKey ?? ''}
                onChange={(e) => setTunerKey(e.target.value === '' ? null : Number(e.target.value))}
              >
                <option value="">なし</option>
                {(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const).map(
                  (n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ),
                )}
              </select>
            </label>
            {tunerKey != null && (
              <label className="text-ink-dim text-[13px]">
                <input
                  type="checkbox"
                  checked={showDegree}
                  onChange={(e) => setShowDegree(e.target.checked)}
                />{' '}
                度数
              </label>
            )}
            <p className="text-ink-dim text-xs">
              マイクを開始して声を出すと、検出した音程がグラフに軌跡として表示されます。グラフ左の鍵盤をタップすると参照音が鳴ります。
            </p>
          </div>
        </Card>
      )}
      {mode === 'single' && (
        <SinglePane
          preset={preset}
          low={low}
          high={high}
          quizDisabled={quizDisabled}
          replayDisabled={replayDisabled}
          hideTuner={hideTuner}
          autoQuiz={autoQuiz}
          onPresetChange={handlePreset}
          onLowChange={handleLow}
          onHighChange={handleHigh}
          onQuiz={handleQuiz}
          onReplay={handleReplay}
          onHideTunerChange={handleHideTuner}
          onAutoQuizChange={handleAutoQuiz}
        />
      )}
      {mode === 'scale' && (
        <ScalePane
          patternKey={patternKey}
          base={scaleBase}
          bpm={bpm}
          guideOn={guideOn}
          roundCount={roundCount}
          turnaround={turnaround}
          running={scaleRunning}
          info={scaleInfo}
          chips={chips}
          onPatternChange={setPatternKey}
          onBaseChange={setScaleBase}
          onBpmChange={setBpm}
          onGuideChange={setGuideOn}
          onRoundCountChange={setRoundCount}
          onTurnaroundChange={setTurnaround}
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
          <Piano
            sung={sung}
            target={target}
            onPlay={(m) => playTone(m, timbre)}
            keyRoot={mode === 'tuner' ? tunerKey : null}
            showDegree={mode === 'tuner' && showDegree}
          />
        </div>
      </details>
      <div className={mode === 'keyboard' ? 'hidden' : 'hidden md:block'}>
        <Card title="Keyboard — A0 ~ C8 (88 keys)">
          <Piano
            sung={sung}
            target={target}
            onPlay={(m) => playTone(m, timbre)}
            keyRoot={mode === 'tuner' ? tunerKey : null}
            showDegree={mode === 'tuner' && showDegree}
          />
        </Card>
      </div>
    </div>
  )
}
