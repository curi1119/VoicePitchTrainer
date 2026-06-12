# 開発環境構築ガイド

> ※ `pitch-trainer/`(React 版)は移植開始前です。それまでの動作確認は `prototype/pitch-trainer-prototype.html` をブラウザで直接開くだけでできます(依存ゼロ)。

## 前提

- WSL2(Ubuntu 等)上で開発し、Git で管理
- Node.js 22.12 以上(推奨: 24 LTS。CI は 24 を使用)。npm 同梱
  - 動作確認済み: Node v25.6.0 / npm 11.8.0
- GitHub CLI(`gh`)があると Actions の確認やリポジトリ操作が楽
- 動作検証ブラウザ: PC は Windows 側の Firefox / Chrome、スマホは実機(GitHub Pages 経由)

## セットアップ

```bash
git clone git@github.com:curi1119/VoicePitchTrainer.git
cd VoicePitchTrainer/pitch-trainer
npm ci
```

## 開発サーバ

```bash
npm run dev
```

- WSL2 でも `http://localhost:5173` を Windows 側ブラウザでそのまま開ける(localhost 転送)
- マイク許可ダイアログが出たら許可する。`localhost` は HTTP でも getUserMedia が使える(secure context 扱い)

## スマホ実機での確認

getUserMedia(マイク)は **HTTPS 必須**のため、`http://192.168.x.x:5173` ではスマホのマイクが動きません。方法は2つ:

1. **GitHub Pages で確認(推奨)**: main へ push → 自動デプロイ(1〜2分)→ スマホで <https://curi1119.github.io/VoicePitchTrainer/> を開く
2. **LAN + HTTPS**: `npm run dev:https`(`@vitejs/plugin-basic-ssl` の自己署名証明書)で起動し、スマホから `https://<開発機のIP>:5173` へ。証明書警告は「続行」する。WSL2 の場合は Windows 側へのポートプロキシ設定(`netsh interface portproxy`)が必要になることがある

## テスト・lint・ビルド

```bash
npm test          # Vitest(YIN 回帰テストなど)
npm run lint      # ESLint
npm run format    # Prettier --write
npm run build     # 型チェック + vite build → dist/
npm run preview   # ビルド結果をローカル配信
```

## トラブルシュート

- **マイクが取れない**: ブラウザのサイト権限と、OS 側のマイク権限(Windows 設定 → プライバシー)を確認
- **音が出ない**: AudioContext はユーザー操作起点でしか開始できない(特に iOS Safari)。ボタン押下から鳴らす実装構造を崩さないこと
- **Pages に反映されない**: デプロイは `pitch-trainer/`・`prototype/`・workflow 自体の変更時のみ走る。GitHub の Actions タブから手動実行(Run workflow)も可能
