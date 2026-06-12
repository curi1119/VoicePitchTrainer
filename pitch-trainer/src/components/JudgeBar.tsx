import { useImperativeHandle, useRef, type Ref } from 'react'

/** 判定メッセージとホールド進捗バー。60Hz 系のため ref 経由で直接更新する */
export interface JudgeBarHandle {
  setMsg(text: string, cls: 'ok' | 'ng' | ''): void
  /** ホールド進捗 0..1 */
  setHold(ratio: number): void
}

// 長いメッセージ(不正解時)でも2行ぶんを常に確保し、レイアウトが上下に揺れないようにする
const MSG_BASE = 'min-h-[36px] text-center text-[13px] leading-[18px]'

export function JudgeBar({ ref }: { ref?: Ref<JudgeBarHandle> }) {
  const msgRef = useRef<HTMLDivElement>(null)
  const holdRef = useRef<HTMLElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      setMsg(text, cls) {
        const el = msgRef.current
        if (!el) return
        el.textContent = text
        el.className =
          MSG_BASE + (cls === 'ok' ? ' font-bold text-green' : cls === 'ng' ? ' text-red' : '')
      },
      setHold(ratio) {
        if (holdRef.current) holdRef.current.style.width = `${Math.min(100, ratio * 100)}%`
      },
    }),
    [],
  )

  return (
    <div className="mt-1">
      <div ref={msgRef} className={MSG_BASE}></div>
      <div className="bg-panel2 mx-auto mt-1 h-2 max-w-[320px] overflow-hidden rounded">
        <i
          ref={holdRef}
          className="bg-green block h-full w-0 transition-[width] duration-[80ms] ease-linear"
        ></i>
      </div>
    </div>
  )
}
