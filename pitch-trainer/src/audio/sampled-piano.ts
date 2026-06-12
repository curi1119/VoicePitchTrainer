import { SplendidGrandPiano } from 'smplr'
import { SYNTH } from '../config'

/**
 * サンプルピアノ音源 (smplr + SplendidGrandPiano)。
 * Steinway のサンプル(パブリックドメイン、AKAI 放出)を smpldsnds の CDN から遅延ロードする。
 * 将来オフライン/Capacitor 対応する場合は baseUrl オプションで同梱サンプルに切り替えられる。
 */

let piano: SplendidGrandPiano | null = null
let ready = false
let loading: Promise<void> | null = null

/**
 * サンプルのロードを開始する(初回のみ)。
 * AudioContext を使うため、必ずユーザー操作起点で呼ぶこと。
 */
export function loadSampledPiano(ctx: AudioContext): Promise<void> {
  loading ??= (async () => {
    piano = new SplendidGrandPiano(ctx, { volume: SYNTH.SAMPLED_VOLUME })
    await piano.load
    ready = true
  })()
  return loading
}

export const isSampledPianoReady = () => ready

/**
 * ロード済みならサンプルで鳴らして true を返す。
 * 未ロードなら false(呼び出し側で合成ピアノにフォールバックする)。
 */
export function playSampledPiano(midi: number, dur: number): boolean {
  if (!ready || piano == null) return false
  piano.start({ note: midi, duration: dur, velocity: SYNTH.SAMPLED_VELOCITY })
  return true
}
