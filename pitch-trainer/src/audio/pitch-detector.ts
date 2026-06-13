import { PITCH } from '../config'

/**
 * ピッチ検出: YIN法 (de Cheveigné & Kawahara, 2002)
 *
 * 差分関数を累積平均で正規化(CMNDF)し、閾値を最初に下回るラグを採用する。
 * 「最も強い周期」ではなく「最も短い妥当な周期=基音」を選ぶため、
 * 倍音にロックして実際よりオクターブ以上高く誤検出する問題に強い。
 * (自己相関法では男性の低い声で第5倍音にロックする障害があり YIN に差し替えた経緯がある)
 *
 * @returns 検出した基音周波数 Hz。検出できなければ -1
 */
export function detectPitch(
  buf: Float32Array,
  sampleRate: number,
  fMin: number = PITCH.F_MIN,
  fMax: number = PITCH.F_MAX,
  rmsGate: number = PITCH.RMS_GATE,
): number {
  const SIZE = buf.length
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < rmsGate) return -1 // 無音/息ノイズは棄却(感度設定で可変)

  const half = SIZE >> 1
  // 検出レンジは設定で絞れる(声域に合わせて上限を下げると、大声時に高次倍音=
  // 例えば C3 の第5倍音 E5 へロックする誤判定を構造的に防げる)
  const tauMin = Math.floor(sampleRate / fMax)
  const tauMax = Math.min(Math.floor(sampleRate / fMin), half - 1)

  // 差分関数 d(tau)
  const d = new Float32Array(tauMax + 1)
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0
    for (let i = 0; i < half; i++) {
      const diff = buf[i] - buf[i + tau]
      sum += diff * diff
    }
    d[tau] = sum
  }

  // 累積平均正規化 (CMNDF) — tauMin 未満も累積に含める必要があるため全域計算
  const cm = new Float32Array(tauMax + 1)
  cm[0] = 1
  let running = 0
  for (let tau = 1; tau <= tauMax; tau++) {
    if (tau < tauMin) {
      // 高域側の d も累積に必要なので軽量計算(2サンプル間引きで近似)
      let sum = 0
      for (let i = 0; i < half; i += 2) {
        const diff = buf[i] - buf[i + tau]
        sum += diff * diff
      }
      running += sum * 2
      cm[tau] = 1
    } else {
      running += d[tau]
      cm[tau] = (d[tau] * tau) / running
    }
  }

  // 閾値を最初に下回るラグ(=基音の周期)を探し、その局所最小まで進める
  let tau = -1
  for (let t = tauMin; t <= tauMax; t++) {
    if (cm[t] < PITCH.YIN_THRESHOLD) {
      while (t + 1 <= tauMax && cm[t + 1] < cm[t]) t++
      tau = t
      break
    }
  }
  // 見つからない場合: 全域の最小値がそこそこ低ければ採用(弱い声への救済)。
  // ただし低音量時はノイズ優勢の誤ラグ(オクターブ下等)を拾いやすいため救済しない
  if (tau === -1) {
    if (rms < PITCH.FALLBACK_MIN_RMS) return -1
    let best = tauMin
    for (let t = tauMin; t <= tauMax; t++) if (cm[t] < cm[best]) best = t
    if (cm[best] < PITCH.FALLBACK_CMNDF) tau = best
    else return -1
  }

  // 放物線補間でサブサンプル精度に
  const x1 = cm[tau - 1] ?? cm[tau]
  const x2 = cm[tau]
  const x3 = cm[tau + 1] ?? cm[tau]
  const a = (x1 + x3 - 2 * x2) / 2
  const b = (x3 - x1) / 2
  const betterTau = a ? tau - b / (2 * a) : tau

  const f = sampleRate / betterTau
  return f >= fMin && f <= fMax ? f : -1
}
