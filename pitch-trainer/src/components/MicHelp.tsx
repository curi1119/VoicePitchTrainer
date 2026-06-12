import type { MicErrorInfo } from '../audio/mic'
import { Button } from './ui'

type Platform = 'ios' | 'android' | 'desktop'

function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS は Mac を名乗るためタッチ点数でも判定する
  if (/iPhone|iPad|iPod/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/**
 * マイク許可の再設定手順(機種別)。
 * Web ページから OS の設定画面を直接開くことはセキュリティ制約上できないため、
 * 手順の案内と再試行ボタンを提供する。
 */
const GUIDES: Record<Platform, { label: string; steps: string[] }> = {
  ios: {
    label: 'iPhone / iPad (Safari) での許可手順',
    steps: [
      'アドレスバー左の「ぁあ」をタップ →「Webサイトの設定」→ マイク →「許可」',
      '出てこない場合: ホームの「設定」アプリ → アプリ一覧から Safari → マイク を許可',
      '設定を変えたらこのページを再読み込みして、もう一度マイクを開始してください',
    ],
  },
  android: {
    label: 'Android (Chrome) での許可手順',
    steps: [
      'アドレスバーの鍵アイコン(サイト情報)をタップ →「権限」→ マイク →「許可」',
      '出てこない場合: Chrome のメニュー → 設定 → サイトの設定 → マイク → 「ブロック中」からこのサイトを解除',
      '設定を変えたらこのページを再読み込みして、もう一度マイクを開始してください',
    ],
  },
  desktop: {
    label: 'PC ブラウザでの許可手順',
    steps: [
      'アドレスバーの鍵(またはマイク)アイコンをクリックして、マイクを「許可」に変更',
      '設定を変えたらこのページを再読み込みして、もう一度マイクを開始してください',
    ],
  },
}

interface MicHelpProps {
  error: MicErrorInfo
  onRetry(): void
  onClose(): void
}

/** マイクが使えないときの日本語ガイド(モーダル) */
export function MicHelp({ error, onRetry, onClose }: MicHelpProps) {
  const guide = GUIDES[detectPlatform()]
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="border-line bg-panel w-full max-w-md rounded-xl border p-4">
        <h2 className="text-red text-base font-semibold">🎤 {error.title}</h2>
        <p className="text-ink-dim mt-2 text-[13px] leading-relaxed">{error.detail}</p>
        {error.kind === 'denied' && (
          <div className="border-line bg-panel2 mt-3 rounded-lg border p-3">
            <div className="text-ink text-xs font-semibold">{guide.label}</div>
            <ol className="text-ink-dim mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
              {guide.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
            <p className="text-ink-dim mt-2 text-[11px]">
              ※ セキュリティ上の制約により、Web ページから OS の設定画面を直接開くことはできません
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onClose}>閉じる</Button>
          <Button primary onClick={onRetry}>
            🎤 再試行
          </Button>
        </div>
      </div>
    </div>
  )
}
