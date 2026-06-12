import { describe, expect, it } from 'vitest'
import { describeMicError } from '../src/audio/mic'

const domEx = (name: string) => new DOMException('some english message', name)

describe('describeMicError', () => {
  it('許可拒否は denied として日本語タイトルになる', () => {
    const info = describeMicError(domEx('NotAllowedError'))
    expect(info.kind).toBe('denied')
    expect(info.title).toBe('マイクの使用が許可されていません')
  })

  it('デバイスなしは notfound', () => {
    expect(describeMicError(domEx('NotFoundError')).kind).toBe('notfound')
  })

  it('使用中は busy', () => {
    expect(describeMicError(domEx('NotReadableError')).kind).toBe('busy')
  })

  it('非セキュア接続は insecure', () => {
    expect(describeMicError(domEx('SecurityError')).kind).toBe('insecure')
  })

  it('未知のエラーは other としてエラー名を含める', () => {
    const info = describeMicError(new Error('boom'))
    expect(info.kind).toBe('other')
    expect(info.detail).toContain('Error')
  })

  it('Error 以外が飛んできても落ちない', () => {
    expect(describeMicError('weird').kind).toBe('other')
  })
})
