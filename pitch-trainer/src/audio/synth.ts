import { SCALE, SYNTH } from '../config'
import { freqOf } from './notes'
import { loadSampledPiano, playSampledPiano } from './sampled-piano'

export type Timbre = 'sampled' | 'piano' | 'beep'

let ctx: AudioContext | null = null

/**
 * AudioContext はユーザー操作起点で生成・resume する(iOS Safari 対策)。
 * 必ずクリック等のイベントハンドラから呼ばれる経路にすること。
 */
export function audioContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 参照音・出題音・ガイド音の再生 */
export function playTone(midi: number, timbre: Timbre, dur: number = SYNTH.DEFAULT_DUR) {
  const a = audioContext()
  if (timbre === 'sampled') {
    if (playSampledPiano(midi, dur)) return
    // サンプル未ロード: ロードを開始しつつ、この音は合成ピアノで代替する
    void loadSampledPiano(a)
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
  const master = a.createGain()
  master.connect(a.destination)
  const o = a.createOscillator()
  o.type = 'sine'
  o.frequency.value = freqOf(midi)
  o.connect(master)
  master.gain.setValueAtTime(0, t)
  master.gain.linearRampToValueAtTime(SYNTH.BEEP_GAIN, t + 0.01)
  master.gain.setValueAtTime(SYNTH.BEEP_GAIN, t + dur - 0.08)
  master.gain.linearRampToValueAtTime(0.0001, t + dur)
  o.start(t)
  o.stop(t + dur)
}

/** 簡易ピアノ: 倍音加算 + 減衰エンベロープ(サンプル未ロード時のフォールバック兼比較用) */
function playSynthPiano(a: AudioContext, midi: number, dur: number) {
  const t = a.currentTime
  const f = freqOf(midi)
  const master = a.createGain()
  master.connect(a.destination)
  master.gain.setValueAtTime(SYNTH.PIANO_MASTER_GAIN, t)
  SYNTH.PIANO_PARTIALS.forEach((p, i) => {
    const o = a.createOscillator()
    const g = a.createGain()
    o.type = 'sine'
    o.frequency.value = f * p * (1 + SYNTH.PIANO_INHARMONICITY * p * p) // わずかな不協和性
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(SYNTH.PIANO_GAINS[i], t + 0.004)
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
    g.connect(a.destination)
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
  g.connect(a.destination)
  o.start(t)
  o.stop(t + 0.4)
}
