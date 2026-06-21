/** 音名ユーティリティ(MIDI ↔ 周波数 ↔ 音名)。純関数のみ */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** MIDI ノート番号 → 音名 (C〜B + #) */
export const noteName = (midi: number) => NOTE_NAMES[midi % 12]

/** MIDI ノート番号 → オクターブ番号 (C4 = 60 → 4) */
export const noteOct = (midi: number) => Math.floor(midi / 12) - 1

/** MIDI ノート番号 → "C4" 形式 */
export const noteFull = (midi: number) => `${noteName(midi)}${noteOct(midi)}`

/** MIDI ノート番号 → 周波数 Hz (A4 = 69 = 440Hz) */
export const freqOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/** 周波数 Hz → MIDI ノート値(小数。69 = A4 = 440Hz) */
export const midiOf = (freq: number) => 69 + 12 * Math.log2(freq / 440)

/** 黒鍵かどうか */
export const isBlackKey = (midi: number) => noteName(midi).includes('#')

/** メジャースケールのピッチクラス集合(キーのルート=0 からの半音オフセット) */
const MAJOR_SCALE = new Set([0, 2, 4, 5, 7, 9, 11])

/** MIDI ノートがキー(メジャースケール)のダイアトニック音かどうか。keyRoot は 0=C,1=C#,...,11=B */
export const isInKey = (midi: number, keyRoot: number) =>
  MAJOR_SCALE.has(((midi % 12) - keyRoot + 12) % 12)

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** スケール度数のローマ数字を返す。スケール外なら null */
export function degreeLabel(midi: number, keyRoot: number): string | null {
  const rel = ((midi % 12) - keyRoot + 12) % 12
  const idx = MAJOR_INTERVALS.indexOf(rel)
  return idx >= 0 ? ROMAN[idx] : null
}
