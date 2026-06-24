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

export type ScaleType = 'major' | 'natural-minor' | 'harmonic-minor' | 'melodic-minor'

export const SCALE_TYPES: ReadonlyArray<readonly [ScaleType, string]> = [
  ['major', 'Major'],
  ['natural-minor', 'Minor (Natural)'],
  ['harmonic-minor', 'Minor (Harmonic)'],
  ['melodic-minor', 'Minor (Melodic)'],
] as const

const SCALE_INTERVALS: Record<ScaleType, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  'natural-minor': [0, 2, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
}

const SCALE_SETS = Object.fromEntries(
  Object.entries(SCALE_INTERVALS).map(([k, v]) => [k, new Set(v)]),
) as unknown as Record<ScaleType, ReadonlySet<number>>

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

/** MIDI ノートがキーのダイアトニック音かどうか。keyRoot は 0=C,1=C#,...,11=B */
export const isInKey = (midi: number, keyRoot: number, scale: ScaleType = 'major') =>
  SCALE_SETS[scale].has(((midi % 12) - keyRoot + 12) % 12)

/**
 * メジャースケール上で steps 度数ぶん移動した MIDI を返す。
 * steps>0 で上行、steps<0 で下行。midi がスケール音でなければ null。
 */
export function diatonicStep(midi: number, keyRoot: number, steps: number): number | null {
  const intervals = SCALE_INTERVALS.major
  const rel = ((midi % 12) - keyRoot + 12) % 12
  const idx = intervals.indexOf(rel)
  if (idx < 0) return null
  const targetIdx = idx + steps
  const octaveShift = Math.floor(targetIdx / 7)
  const degInOctave = ((targetIdx % 7) + 7) % 7
  return midi - rel + intervals[degInOctave] + octaveShift * 12
}

/** スケール度数のローマ数字を返す。スケール外なら null */
export function degreeLabel(
  midi: number,
  keyRoot: number,
  scale: ScaleType = 'major',
): string | null {
  const rel = ((midi % 12) - keyRoot + 12) % 12
  const intervals = SCALE_INTERVALS[scale]
  const idx = intervals.indexOf(rel)
  return idx >= 0 ? ROMAN[idx] : null
}
