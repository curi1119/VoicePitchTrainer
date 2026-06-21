import { SCALE, SYNTH } from '../config'
import { freqOf } from './notes'
import { audioContext, masterOut } from './output'
import {
  loadSampledPiano,
  loadSampledPianoDry,
  playSampledPiano,
  playSampledPianoDry,
} from './sampled-piano'

export type Timbre = 'sampled' | 'sampled-dry' | 'piano' | 'beep'

/** 参照音・出題音・ガイド音の再生 */
export function playTone(midi: number, timbre: Timbre, dur: number = SYNTH.DEFAULT_DUR) {
  const a = audioContext()
  if (timbre === 'sampled') {
    if (playSampledPiano(midi, dur)) return
    void loadSampledPiano(a)
    playSynthPiano(a, midi, dur)
    return
  }
  if (timbre === 'sampled-dry') {
    if (playSampledPianoDry(midi, dur)) return
    void loadSampledPianoDry(a)
    playSynthPiano(a, midi, dur)
    return
  }
  if (timbre === 'beep') {
    playBeep(a, midi, dur)
  } else {
    playSynthPiano(a, midi, dur)
  }
}

function playBeep(a: AudioContext, midi: number, dur: number) {
  const t = a.currentTime
  const f = freqOf(midi)
  const master = a.createGain()
  master.connect(masterOut())
  const o1 = a.createOscillator()
  o1.type = 'sine'
  o1.frequency.value = f
  const o2 = a.createOscillator()
  o2.type = 'square'
  o2.frequency.value = f
  const g1 = a.createGain()
  const g2 = a.createGain()
  g1.gain.value = 0.7
  g2.gain.value = 0.15
  o1.connect(g1)
  o2.connect(g2)
  g1.connect(master)
  g2.connect(master)
  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(SYNTH.BEEP_GAIN, t + 0.005)
  master.gain.setValueAtTime(SYNTH.BEEP_GAIN, t + dur - 0.05)
  master.gain.linearRampToValueAtTime(0.0001, t + dur)
  o1.start(t)
  o1.stop(t + dur)
  o2.start(t)
  o2.stop(t + dur)
}

let activeBeep: { master: GainNode; o1: OscillatorNode; o2: OscillatorNode } | null = null

function stopActiveBeep() {
  if (!activeBeep) return
  const { master, o1, o2 } = activeBeep
  const t = master.context.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(0.0001, t + 0.03)
  o1.stop(t + 0.04)
  o2.stop(t + 0.04)
  activeBeep = null
}

/** ビープをサステインで鳴らし始める(鍵盤の長押し用)。前の音は自動で消える */
export function startBeep(midi: number) {
  stopActiveBeep()
  const a = audioContext()
  const t = a.currentTime
  const f = freqOf(midi)
  const master = a.createGain()
  master.connect(masterOut())
  const o1 = a.createOscillator()
  o1.type = 'sine'
  o1.frequency.value = f
  const o2 = a.createOscillator()
  o2.type = 'square'
  o2.frequency.value = f
  const g1 = a.createGain()
  const g2 = a.createGain()
  g1.gain.value = 0.7
  g2.gain.value = 0.15
  o1.connect(g1)
  o2.connect(g2)
  g1.connect(master)
  g2.connect(master)
  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(SYNTH.BEEP_GAIN, t + 0.005)
  o1.start(t)
  o2.start(t)
  activeBeep = { master, o1, o2 }
}

/** サステイン中のビープを止める */
export function stopBeep() {
  stopActiveBeep()
}

/** 簡易ピアノ: 倍音加算 + 減衰エンベロープ(サンプル未ロード時のフォールバック兼比較用) */
function playSynthPiano(a: AudioContext, midi: number, dur: number) {
  const t = a.currentTime
  const f = freqOf(midi)
  const master = a.createGain()
  master.connect(masterOut())
  master.gain.setValueAtTime(SYNTH.PIANO_MASTER_GAIN, t)
  // 低音(C4=60 以下)では上位倍音を強調しスマホスピーカーでも聞こえるようにする
  const boost = midi < 60 ? Math.min(3, (60 - midi) / 12) : 0
  SYNTH.PIANO_PARTIALS.forEach((p, i) => {
    const hf = f * p * (1 + SYNTH.PIANO_INHARMONICITY * p * p)
    if (hf > 16000) return
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sine'
    o.frequency.value = hf
    const baseGain = SYNTH.PIANO_GAINS[i]
    const gain = i === 0 ? baseGain : baseGain * (1 + boost * (i / 2))
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1.6 - i * 0.15))
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur * 1.7)
  })
}

/** 基音のメジャートライアド(ド・ミ・ソ)を和音で鳴らす */
export function playTriad(rootMidi: number, timbre: Timbre, durSec: number) {
  SCALE.TRIAD_INTERVALS.forEach((iv) => playTone(rootMidi + iv, timbre, durSec))
}

/** 正解音(880 → 1318.5Hz の2音) */
export function playSuccess() {
  const a = audioContext()
  const t = a.currentTime
  ;[880, 1318.5].forEach((f, i) => {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'triangle'
    o.frequency.value = f
    g.gain.setValueAtTime(0.12, t + i * 0.1)
    g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.25)
    o.connect(g)
    g.connect(masterOut())
    o.start(t + i * 0.1)
    o.stop(t + i * 0.1 + 0.3)
  })
}

/** 不正解音(下降音) */
export function playFail() {
  const a = audioContext()
  const t = a.currentTime
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'triangle'
  o.frequency.setValueAtTime(330, t)
  o.frequency.linearRampToValueAtTime(220, t + 0.25)
  g.gain.setValueAtTime(0.1, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
  o.connect(g)
  g.connect(masterOut())
  o.start(t)
  o.stop(t + 0.4)
}
