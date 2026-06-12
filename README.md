# VoicePitchTrainer

発声の音程(ピッチ)を鍛えるトレーニングアプリ。アプリが再生した音と同じ高さの声をマイクに向かって出し、合っているかをリアルタイム判定します。

- PC・スマホのブラウザで動作する Web アプリ(将来 Capacitor でモバイルアプリ化予定)
- UI も音も基本はコードで生成(ライセンス的に問題のないアセットの利用は可。ピアノ音源は導入予定)
- ピッチ検出は YIN 法の自前実装(外部音声ライブラリ不使用)

## デモ(GitHub Pages)

| URL | 内容 |
|---|---|
| <https://curi1119.github.io/VoicePitchTrainer/> | React 版本体(移植準備中) |
| <https://curi1119.github.io/VoicePitchTrainer/prototype/> | 動作確認済みプロトタイプ |

main へ push すると GitHub Actions が自動デプロイします。マイク入力(getUserMedia)は HTTPS 必須のため、スマホ実機の動作確認も Pages の URL を開くだけでできます。

## 機能(プロトタイプ実装済み)

- **チューナー(自由練習)**: 声の音程をアナログメーター・88鍵ピアノ・波形でリアルタイム表示
- **単音発声トレーニング**: 出題音を聞いて同じ高さの声を発声。±50セント以内を約1.5秒キープで正解。不正解後も正しい音が出せるまで練習継続できる
- **音階練習**: ドレミファソ…のガイドに合わせて発声し、音ごとに○×判定。1周ごとに半音ずつ上がる

## リポジトリ構成

| パス | 内容 |
|---|---|
| `prototype/` | 単一 HTML のプロトタイプ。**現時点の仕様と調整値の「正」** |
| `pitch-trainer/` | React + TypeScript + Vite の本体(プロトタイプを忠実に移植) |
| `docs/` | 開発ドキュメント |
| `HANDOVER.md` | 企画フェーズからの引継書。仕様・調整値の決定経緯 |

## ドキュメント

- [開発環境構築ガイド](docs/development_guide.md)
- [アーキテクチャ](docs/architecture.md)
- [開発ワークフロー](docs/development_workflow.md)
