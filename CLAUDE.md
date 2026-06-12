# CLAUDE.md

発声音程トレーナー。アプリが鳴らした音と同じ高さの声を出し、マイク入力を YIN 法でピッチ検出して正誤判定する Web アプリ。

## 仕様の「正」

- `prototype/pitch-trainer-prototype.html`(動作確認済み)と `HANDOVER.md` が仕様・調整値の正
- React 版(`pitch-trainer/`)への移植では**挙動・調整値を変えない**こと

## 必ず守ること

- 作業言語は日本語(ドキュメント・コミットメッセージ・UI 文言)
- アセット(画像・音源)は開発者自身では制作しない。**ライセンス的に問題ないものの導入は可**。ピアノはサンプル音源(smplr + SplendidGrandPiano、パブリックドメイン)を使用中。合成ピアノはフォールバック兼比較用に残す
- バランス調整値(判定時間・閾値など)は `pitch-trainer/src/config.ts` に集約し、独断で変更しない(調整の経緯は HANDOVER.md §5)。変更したら docs/architecture.md の調整値表も同じコミットで更新
- `src/audio/` と `src/modes/` は React 非依存の純粋 TypeScript に保つ(Vitest の対象)
- YIN 検出器の合成信号回帰テスト(HANDOVER.md §4.2)は常にパスさせる

## 技術スタック(2026-06 確定)

React 19 + TypeScript (strict) + Vite / Tailwind CSS v4 / ESLint + Prettier (+ prettier-plugin-tailwindcss) / Vitest / Bun(パッケージ管理・スクリプト実行)+ Node 26(Vite・Vitest の実行系。2026-10 に LTS 昇格予定)

Node と Bun は asdf で導入し、ルートの `.tool-versions` でバージョン固定。手元と CI(setup-node / setup-bun)が同じファイルを参照する。

## コマンド(pitch-trainer/ 内で実行)

- `bun install` — 依存の導入
- `bun run dev` — 開発サーバ
- `bun run dev:https` — HTTPS 開発サーバ(スマホ実機のマイク検証用。getUserMedia は HTTPS 必須)
- `bun run test` — Vitest(**`bun test` は不可**。Bun 内蔵ランナーが起動して Vitest が動かない)
- `bun run build` — 型チェック+ビルド
- `bun run lint` / `bun run format` — ESLint / Prettier

## デプロイ

main へ push → `.github/workflows/deploy.yml` が GitHub Pages へ自動デプロイ。

- 本体: <https://curi1119.github.io/VoicePitchTrainer/>(CI では `--base=/VoicePitchTrainer/` 付きビルド)
- プロトタイプ: <https://curi1119.github.io/VoicePitchTrainer/prototype/>

## ドキュメント

- `docs/development_guide.md` — 環境構築
- `docs/architecture.md` — 構成・データフロー・調整値の一覧
- `docs/development_workflow.md` — 作業の進め方

仕様・構成・調整値を変えたら該当 docs を必ず更新する。
README.md は**アプリの紹介のみ**とし、開発情報(構成・ドキュメントリンク等)は docs/ と本ファイルに書く。
