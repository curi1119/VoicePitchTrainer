/** 入力レベル(RMS)の計算。マイク動作インジケータ用の純関数 */
export function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}
