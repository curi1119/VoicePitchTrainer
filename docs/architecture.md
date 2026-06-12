# アーキテクチャ

## 全体像

ブラウザ完結の SPA。サーバ・DB・外部 API なし。音声処理はすべてクライアントの Web Audio API で行う。

```
[マイク] → getUserMedia → ローパスフィルタ(1200Hz) → AnalyserNode (fftSize 4096)
                                       │  requestAnimationFrame で約60fpsポーリング
                                       ▼
                         YIN ピッチ検出 (audio/pitch-detector.ts)
                                       ▼
                         多段平滑化 (audio/smoothing.ts)
                         メディアン9 → EMA 0.18 → ジャンプ棄却 → 音名ヒステリシス
                                       ▼
                    ┌──────────────────┴──────────────────┐
              モード判定 (modes/)                     UI 表示 (components/)
              single / scale の状態機械               メーター・88鍵・波形
                                       ▲
[スピーカー] ← 音の合成 (audio/synth.ts) ← 出題音・ガイド音・トライアド・効果音
```

## 技術スタック

| 項目 | 採用 | 補足 |
|---|---|---|
| UI | React 19 + TypeScript (strict) | Vite `react-ts` テンプレートベース |
| ビルド | Vite | CI では `--base=/VoicePitchTrainer/` 付き |
| ランタイム | Bun(パッケージ管理・スクリプト実行)+ Node 24 LTS(Vite・Vitest の実行系)。asdf + ルート `.tool-versions` で両方固定 | テストは `bun run test`(`bun test` は別物) |
| CSS | Tailwind CSS v4(`@tailwindcss/vite`) | プロトタイプの配色(--bg, --panel, --amber 等)は `@theme` のデザイントークンとして移植 |
| Lint/Format | ESLint + Prettier + prettier-plugin-tailwindcss | テンプレート付属の ESLint 設定を継承 |
| テスト | Vitest(node 環境) | `audio/` と `modes/` が対象 |
| 状態管理 | ライブラリなし | 下記「React との接続」参照 |
| ピッチ検出 | YIN 法の自前実装 | 外部音声ライブラリ不使用(経緯: 自己相関法では男性低音で倍音誤検出 → YIN へ。HANDOVER.md §4.2) |
| デプロイ | GitHub Actions → GitHub Pages | `.github/workflows/deploy.yml` |

## リポジトリ構成

| パス | 内容 |
|---|---|
| `prototype/` | 単一 HTML のプロトタイプ。**現時点の仕様と調整値の「正」** |
| `pitch-trainer/` | React + TypeScript + Vite の本体(下記レイヤ構成) |
| `docs/` | 開発ドキュメント |
| `HANDOVER.md` | 企画フェーズからの引継書。仕様・調整値の決定経緯 |
| `.github/workflows/deploy.yml` | GitHub Pages 自動デプロイ |

## レイヤ構成(設計原則)

```
pitch-trainer/
├─ src/
│  ├─ audio/        # React 非依存の純粋ロジック層(テスト対象)
│  │  ├─ pitch-detector.ts   # YIN 実装(CMNDF + 放物線補間)
│  │  ├─ smoothing.ts        # メディアン + EMA + ジャンプ棄却 + ヒステリシス + 発声ゲート
│  │  ├─ synth.ts            # ビープ/簡易ピアノ合成、トライアド、成功/不正解音
│  │  ├─ mic.ts              # getUserMedia + ローパス + AnalyserNode
│  │  └─ notes.ts            # MIDI ↔ 周波数 ↔ 音名 の変換ユーティリティ
│  ├─ modes/        # 判定ロジック。純粋 TS(テスト対象)
│  │  ├─ single.ts           # 単音発声: キープ/不正解/リトライの状態機械
│  │  └─ scale.ts            # 音階練習: ラウンド進行と音ごとの判定
│  ├─ components/   # Meter / Piano / WaveDisplay / 各モードの UI
│  ├─ config.ts     # バランス調整値を集約(下表)
│  └─ App.tsx
├─ tests/           # Vitest
└─ vite.config.ts
```

原則:

1. **`audio/` と `modes/` は React・DOM に依存しない**(mic.ts の getUserMedia などブラウザ API は可、React の import は不可)
2. **調整値は config.ts に集約**し、コードにマジックナンバーを散らさない
3. プロトタイプ(`prototype/pitch-trainer-prototype.html`)の**挙動・調整値を変えずに**移植する

## React との接続(レンダリング方針)

毎フレーム(60Hz)更新される値を React state に入れると再レンダリングが洪水になるため、更新頻度でルートを分ける:

- **60Hz 系**(メーター針の角度・波形 Canvas・ホールド進捗バー): rAF ループから ref / Canvas を直接更新し、React の再レンダリングを通さない
- **離散イベント系**(表示音名の切替・判定確定・スコア・モード切替): React state。音名はヒステリシス(±65セント)通過後にしか変わらないので更新頻度は低い
- 数値テキスト(周波数・セント)はプロトタイプ同様 **10Hz に間引き**
- 動的な座標・角度(鍵盤の絶対配置、針の回転)は Tailwind ではなくインライン style で与える
- マイク+検出のメインループはアプリ全体で1本。カスタムフック(例: `useMicPitch`)が React 側の購読窓口

## config.ts に集約する主な調整値(プロトタイプの確定値)

| 定数 | 値 | 意味 |
|---|---|---|
| `YIN_THRESHOLD` | 0.15 | CMNDF(累積平均正規化差分)の採用閾値 |
| `F_MIN` / `F_MAX` | 55 / 1200 Hz | 検出レンジ(A1〜ソプラノ上限) |
| RMS ゲート | 0.015 | これ未満の音量は無音として棄却 |
| 救済閾値 | 0.30 | 閾値未達でも CMNDF 全域最小がこれ未満なら採用 |
| `fftSize` | 4096 | 約85ms窓 @48kHz(男性低音の分解能確保) |
| ローパス | 1200 Hz | マイク入力の高次倍音抑制 |
| メディアン窓 | 9 フレーム | 約150ms の外れ値除去 |
| EMA 係数 | 0.18 | 時定数 約90ms |
| ジャンプ棄却 | 0.7 半音 | 直近3フレーム安定なら意図的な移動として即追従 |
| 音名ヒステリシス | 0.65 半音 | 表示音名の切替閾値(境界チラつき防止) |
| 発声開始 / 終了ゲート | 4 / 8 フレーム | 約65ms / 約130ms |
| 針の lerp | 0.10 | アナログメーター風のゆったり追従 |
| テキスト更新 | 10 Hz | 数値のチラつき防止 |
| `QUIZ_TONE_DUR` | 3.0 秒 | 出題音の長さ(再生終了 +0.2 秒後に判定開始) |
| `OK_HOLD_MS` | 1500 | 正解: ±50セント以内をキープする時間 |
| `NG_HOLD_MS` | 1200 | 不正解: 外れた音程のまま安定する時間(キープ外れは2倍速で減少) |
| 音階判定 | ±60セント, `max(6, voiced×0.35)` | 1音ごとの合格条件 |
| 音階ガイド音長 | `max(0.5, 拍×0.95)` 秒 | 短いとピチカート化する不具合対策 |
| トライアド | 2拍再生 + 半拍空け | ラウンド開始前に調を提示 |
| 出題プリセット | 男性 G2〜G4 / 女性 G3〜G5 | MIDI 43-67 / 55-79(カスタム初期値 C3〜C5) |

調整の経緯(なぜこの値か)は HANDOVER.md §5。**値を変えたらこの表と経緯を更新する。**

## テスト戦略

- **YIN 回帰テスト(必須)**: 人声を模した合成信号(基音が弱く倍音が強い: 振幅 [0.05, 0.15, 0.30, 0.28, 0.25, 0.18]、位相 h×0.7、ノイズ ±0.005)で C2〜C5 を検出できること。プロトタイプでの実測誤差は 0.1 セント以内(HANDOVER.md §4.2)
- smoothing: ジャンプ棄却・ヒステリシス・発声ゲートの境界値テスト
- modes: 判定の状態遷移(キープ→正解 / 外れ安定→不正解 / リトライ→正しい音でスコア据え置き)を時系列入力でテスト
- コンポーネントの自動テストは当面なし(目視 + 実機確認)

## 既知の制限・将来課題

- **本物のピアノ音源の導入を予定(優先度高)**: 現状の合成ピアノは音質に不満あり(減衰が速く、3秒出題でも体感 2.5 秒程度で小さくなる)。移植完了後に差し替える。候補: smplr(npm のサウンドフォント再生ライブラリ)+ ライセンスの明確な音源(smplr 同梱の SplendidGrandPiano、Salamander Grand Piano = CC BY 3.0 など)。アセットはライセンス的に問題ないもののみ利用可
- 音階練習でガイド音 ON + スピーカー使用時は自分のマイクがアプリ音を拾いうる(ヘッドホン推奨で運用)
- AudioWorklet 化(検出処理のオーディオスレッド移行)は見送り中。現状メインスレッドで約 2.3ms/フレームと実用十分
- 未着手の将来項目: 音名表記の切替(ドレミ等)、設定/スコアの localStorage 永続化、練習/テストモード切替、Capacitor によるモバイルアプリ化
