import { MIC } from '../config'

/** getUserMedia 失敗の分類と日本語説明 */
export interface MicErrorInfo {
  kind: 'denied' | 'notfound' | 'busy' | 'insecure' | 'other'
  title: string
  detail: string
}

/** getUserMedia の失敗理由(英語の DOMException)を日本語の説明に変換する */
export function describeMicError(e: unknown): MicErrorInfo {
  const name = e instanceof Error ? e.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        kind: 'denied',
        title: 'マイクの使用が許可されていません',
        detail:
          'ブラウザまたは OS の設定で、このサイトのマイクが拒否されています。許可の手順を確認して、設定後に再試行してください。',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        kind: 'notfound',
        title: 'マイクが見つかりません',
        detail: 'マイクが接続されているか確認してください。',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        kind: 'busy',
        title: 'マイクを開けませんでした',
        detail:
          '他のアプリやタブがマイクを使用している可能性があります。それらを閉じてから再試行してください。',
      }
    case 'SecurityError':
      return {
        kind: 'insecure',
        title: 'この接続ではマイクを使えません',
        detail: 'マイクは HTTPS(または localhost)のページでのみ使用できます。',
      }
    default:
      return {
        kind: 'other',
        title: 'マイクを開始できませんでした',
        detail: `不明なエラーです(${name || String(e)})。ページを再読み込みしてから再試行してください。`,
      }
  }
}

/** マイク入力。read() で最新の時間領域波形を取得する */
export interface MicInput {
  readonly sampleRate: number
  /** 最新フレームを内部バッファに読み込んで返す */
  read(): Float32Array
}

/**
 * マイクを開いて [入力] → [ローパス] → [AnalyserNode] のチェーンを作る。
 * エコーキャンセル等のブラウザ側加工はピッチ検出に有害なのですべて無効化する。
 */
export async function openMic(ctx: AudioContext): Promise<MicInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  })
  const src = ctx.createMediaStreamSource(stream)
  const lpf = ctx.createBiquadFilter()
  lpf.type = 'lowpass'
  lpf.frequency.value = MIC.LPF_HZ
  const analyser = ctx.createAnalyser()
  analyser.fftSize = MIC.FFT_SIZE
  src.connect(lpf)
  lpf.connect(analyser)

  const buf = new Float32Array(analyser.fftSize)
  return {
    sampleRate: ctx.sampleRate,
    read() {
      analyser.getFloatTimeDomainData(buf)
      return buf
    },
  }
}
