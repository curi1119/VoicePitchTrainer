# 開発環境構築ガイド

> ※ `pitch-trainer/`(React 版)は移植開始前です。それまでの動作確認は `prototype/pitch-trainer-prototype.html` をブラウザで直接開くだけでできます(依存ゼロ)。

## 前提

- WSL2(Ubuntu 等)上で開発し、Git で管理
- **Node.js**(Vite・Vitest の実行系)と **Bun**(パッケージ管理・スクリプト実行)は asdf で導入し、リポジトリ直下の `.tool-versions` でバージョン固定(CI も同じファイルを参照):

  ```bash
  asdf plugin add nodejs
  asdf plugin add bun
  asdf install   # .tool-versions に固定されたバージョンを導入
  ```

  リポジトリ外では別の Node を使える(このマシンは `asdf set --home nodejs system` 設定済みで、リポジトリ外は OS / brew の node)
- 動作確認済み: Node v26.3.0 / Bun 1.3.14
- GitHub CLI(`gh`)があると Actions の確認やリポジトリ操作が楽
- 動作検証ブラウザ: PC は Windows 側の Firefox / Chrome、スマホは実機(GitHub Pages 経由)

## セットアップ

```bash
git clone git@github.com:curi1119/VoicePitchTrainer.git
cd VoicePitchTrainer/pitch-trainer
bun install
```

## 開発サーバ

```bash
bun run dev
```

- WSL2 でも `http://localhost:5173` を Windows 側ブラウザでそのまま開ける(localhost 転送)
- マイク許可ダイアログが出たら許可する。`localhost` は HTTP でも getUserMedia が使える(secure context 扱い)

## スマホ実機での確認

getUserMedia(マイク)は **HTTPS 必須**のため、`http://192.168.x.x:5173` ではスマホのマイクが動きません。方法は2つ:

1. **GitHub Pages で確認(推奨)**: main へ push → 自動デプロイ(1〜2分)→ スマホで <https://curi1119.github.io/VoicePitchTrainer/> を開く
2. **LAN + HTTPS**: `bun run dev:https`(`@vitejs/plugin-basic-ssl` の自己署名証明書)で起動し、スマホから `https://<開発機のIP>:5173` へ。証明書警告は「続行」する。WSL2 の場合は Windows 側へのポートプロキシ設定(`netsh interface portproxy`)が必要になることがある

## テスト・lint・ビルド

```bash
bun run test      # Vitest(YIN 回帰テストなど)
bun run lint      # ESLint
bun run format    # Prettier --write
bun run build     # 型チェック + vite build → dist/
bun run preview   # ビルド結果をローカル配信
```

> **注意**: テストは必ず `bun run test`。`bun test` と打つと Bun 内蔵のテストランナーが起動してしまい、Vitest が動かない。

## トラブルシュート

- **マイクが取れない**: ブラウザのサイト権限と、OS 側のマイク権限(Windows 設定 → プライバシー)を確認
- **音が出ない**: AudioContext はユーザー操作起点でしか開始できない(特に iOS Safari)。ボタン押下から鳴らす実装構造を崩さないこと
- **Pages に反映されない**: デプロイは `pitch-trainer/`・`prototype/`・workflow 自体の変更時のみ走る。GitHub の Actions タブから手動実行(Run workflow)も可能
