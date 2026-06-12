import { describe, expect, it } from 'vitest'
import { freqOf, isBlackKey, midiOf, noteFull, noteName, noteOct } from '../src/audio/notes'

describe('notes', () => {
  it('A4 (MIDI 69) は 440Hz', () => {
    expect(freqOf(69)).toBeCloseTo(440, 10)
    expect(freqOf(57)).toBeCloseTo(220, 10)
    expect(freqOf(81)).toBeCloseTo(880, 10)
  })

  it('midiOf は freqOf の逆変換', () => {
    for (let m = 21; m <= 108; m++) {
      expect(midiOf(freqOf(m))).toBeCloseTo(m, 8)
    }
  })

  it('音名・オクターブ表記', () => {
    expect(noteFull(60)).toBe('C4')
    expect(noteFull(69)).toBe('A4')
    expect(noteFull(21)).toBe('A0')
    expect(noteFull(108)).toBe('C8')
    expect(noteName(61)).toBe('C#')
    expect(noteOct(59)).toBe(3)
  })

  it('黒鍵判定', () => {
    expect(isBlackKey(61)).toBe(true) // C#4
    expect(isBlackKey(60)).toBe(false) // C4
    expect(isBlackKey(70)).toBe(true) // A#4
  })
})
