# 開発ワークフロー

個人開発のため軽量に保つ。

## 基本サイクル

1. 変更する(仕様の正は `prototype/` と `HANDOVER.md`。React 版で挙動を変えない)
2. `bun run test` と `bun run lint` を通す
3. main へ commit & push(大きめの変更はブランチ + PR でもよい)
4. GitHub Actions が自動で GitHub Pages へデプロイ(1〜2分)
5. PC ブラウザ + 必要に応じてスマホ実機(Pages の URL)で確認

## コミット

- メッセージは日本語で「何を・なぜ」
- 調整値(`config.ts`)を変えたときは `docs/architecture.md` の調整値表と経緯を**同じコミットで**更新

## デプロイ

- トリガ: main への push のうち `pitch-trainer/`・`prototype/`・workflow 自体が変わったときのみ
- 手動実行: GitHub → Actions → "Deploy to GitHub Pages" → Run workflow(または `gh workflow run deploy.yml`)
- 状況確認: `gh run watch` か Actions タブ
- React 版が未着手の間は、準備中ページ + `/prototype/` のプロトタイプが公開される

## スマホ実機検証

- 通常は Pages 経由(push して URL を開くだけ)
- push せずに試したい場合は `npm run dev:https`(詳細は development_guide.md)

## 移植(React 化)の進め方 ※現フェーズ

1. `audio/` の純ロジック(notes → pitch-detector → smoothing → synth)を移植し、**先に Vitest を通す**(YIN 回帰テスト含む)
2. `mic.ts` + メインループ + チューナーモード(メーター・波形・88鍵)
3. 単音発声モード → 音階練習モード(`modes/` を純 TS の状態機械として移植)
4. 各段階でプロトタイプと並べて挙動・見た目を目視比較する
