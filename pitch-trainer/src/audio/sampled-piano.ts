import { CacheStorage, SplendidGrandPiano } from 'smplr'
import { SYNTH } from '../config'

/**
 * サンプルピアノ音源 (smplr + SplendidGrandPiano)。
 * Steinway のサンプル(パブリックドメイン、AKAI 放出)を smpldsnds の CDN から取得する。
 *
 * - Cache API が使える環境(HTTPS / localhost)では `CacheStorage` で永続キャッシュし、
 *   **2回目以降はネットワークなし**でロードできる(オフラインでも鳴る)
 * - 将来 Capacitor 等でサンプルを同梱する場合は baseUrl オプションで切り替えられる
 */

export interface SampledPianoProgress {
  loaded: number
  total: number
}

let piano: SplendidGrandPiano | null = null
let ready = false
let loading: Promise<void> | null = null

/**
 * サンプルのロードを開始する(初回のみ。2回目以降の呼び出しは同じ Promise を返す)。
 * AudioContext はサスペンド状態でもデコードできるため、ページ起動直後に呼んでよい。
 * onProgress は最初の呼び出しのものだけが有効。
 */
export function loadSampledPiano(
  ctx: AudioContext,
  onProgress?: (p: SampledPianoProgress) => void,
): Promise<void> {
  loading ??= (async () => {
    piano = new SplendidGrandPiano(ctx, {
      volume: SYNTH.SAMPLED_VOLUME,
      ...('caches' in window ? { storage: new CacheStorage('pitch-trainer-piano') } : {}),
      ...(onProgress ? { onLoadProgress: onProgress } : {}),
    })
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
