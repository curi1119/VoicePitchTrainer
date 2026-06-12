import { MIC } from '../config'

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
