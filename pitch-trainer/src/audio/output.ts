import { SYNTH } from '../config'

/**
 * AudioContext とマスター音量。
 * アプリの全出力(サンプルピアノ・合成音・効果音)は masterOut() を経由する。
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let volume: number = SYNTH.MASTER_VOLUME_DEFAULT

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

/** マスター出力(音量つまみの効く GainNode)。全出力はここに接続する */
export function masterOut(): GainNode {
  const a = audioContext()
  if (!master) {
    master = a.createGain()
    master.gain.value = volume
    master.connect(a.destination)
  }
  return master
}

/** マスター音量 0..1 */
export function setMasterVolume(v: number) {
  volume = Math.max(0, Math.min(1, v))
  if (master) master.gain.value = volume
}
