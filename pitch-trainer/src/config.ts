/**
 * バランス調整値の集約。
 * 値の決定経緯は docs/architecture.md の調整値表・調整履歴を参照。
 * ここを変更したら docs/architecture.md の調整値表も同じコミットで更新すること。
 */

/** ピッチ検出 (YIN) */
export const PITCH = {
  /** CMNDF がこの値を最初に下回るラグを基音の周期として採用 */
  YIN_THRESHOLD: 0.15,
  /** 検出レンジ下限 Hz (A1) */
  F_MIN: 55,
  /** 検出レンジ上限 Hz */
  F_MAX: 1200,
  /**
   * RMS がこれ未満のフレームは無音/息ノイズとして棄却。
   * 0.015 → 0.006 → 0.003(2026-06-13): 小さい声を拾えるよう段階的に感度を向上。
   * 周期性の品質ゲートは YIN_THRESHOLD が担うため、判定精度への影響は小さい
   */
  RMS_GATE: 0.003,
  /** 閾値未達時の救済: CMNDF 全域最小がこれ未満なら採用 */
  FALLBACK_CMNDF: 0.3,
} as const

/** マイク入力 */
export const MIC = {
  /** 約85ms窓 @48kHz。低音(男性の声)の分解能確保のため 2048 から拡大した経緯あり */
  FFT_SIZE: 4096,
  /** 高次倍音のエネルギーを抑えるローパス。人声の基音レンジ ~1kHz は通す */
  LPF_HZ: 1200,
} as const

/** 平滑化(人声のジッター/ビブラート対策) */
export const SMOOTHING = {
  /** メディアンフィルタ窓(フレーム数、約150ms) */
  MEDIAN_WINDOW: 9,
  /** EMA 係数(時定数 ≒ 90ms) */
  EMA_ALPHA: 0.18,
  /** これ(半音)を超えるジャンプは、直近フレームが安定している場合のみ即追従 */
  JUMP_SEMITONES: 0.7,
  /** ジャンプ追従の安定判定に見るフレーム数 */
  JUMP_STABLE_FRAMES: 3,
  /** 音名表示のヒステリシス(半音)。境界チラつき防止 */
  HYSTERESIS_SEMITONES: 0.65,
  /** 発声開始ゲート: 連続このフレーム数の検出で発声扱い(約65ms) */
  VOICED_FRAMES: 4,
  /** 終了ゲート: このフレーム数までの途切れは直前値を保持(約130ms) */
  SILENT_FRAMES: 8,
} as const

/** 数値表示 */
export const METER = {
  /** 数値テキストの更新間隔 ms(10Hz。チラつき防止) */
  TEXT_UPDATE_MS: 100,
} as const

/** 単音発声トレーニング */
export const SINGLE = {
  /** 出題音の長さ(秒) */
  QUIZ_TONE_DUR: 3.0,
  /** 出題音の再生終了からこの時間後に判定開始(マイクがアプリ音を拾う誤判定の防止) */
  JUDGE_DELAY_MS: 200,
  /** 正解とみなすセント幅(±) */
  OK_CENTS: 50,
  /** 正解確定: ±OK_CENTS 以内をこの時間キープ */
  OK_HOLD_MS: 1500,
  /** 不正解確定: 外れた音程のまま安定したらこの時間で確定 */
  NG_HOLD_MS: 1200,
  /** 出題範囲プルダウンの選択肢レンジ (MIDI) */
  RANGE_MIN: 36,
  RANGE_MAX: 84,
  /** カスタム範囲の初期値 (C3〜C5) */
  DEFAULT_LOW: 48,
  DEFAULT_HIGH: 72,
  /**
   * 出題範囲プリセット。
   * 一般的な(訓練していない人を含む)無理のない声域として約2オクターブ:
   *   男性: G2(98Hz)〜G4(392Hz) / 女性: G3(196Hz)〜G5(784Hz)
   */
  PRESETS: {
    male: [43, 67],
    female: [55, 79],
  } as Record<'male' | 'female', readonly [number, number]>,
} as const

/** 音階練習 */
export const SCALE = {
  PATTERNS: {
    p1: [0, 2, 4, 5, 7, 5, 4, 2, 0],
    p2: [0, 2, 4, 5, 7, 9, 11, 12, 11, 9, 7, 5, 4, 2, 0],
  } as Record<'p1' | 'p2', readonly number[]>,
  PATTERN_LABELS: {
    p1: 'ドレミファソ ファミレド',
    p2: 'ドレミファソラシド シラソファミレド',
  } as Record<'p1' | 'p2', string>,
  /** 1音ごとの判定セント幅(±) */
  TOLERANCE_CENTS: 60,
  /** 合格条件: hits >= max(MIN_HITS, voiced * HIT_RATIO) */
  MIN_HITS: 6,
  HIT_RATIO: 0.35,
  /** ガイド音はほぼ1拍ぶん鳴らす(短いとピチカート化する不具合があった) */
  GUIDE_MIN_SEC: 0.5,
  GUIDE_BEAT_RATIO: 0.95,
  /** ラウンド開始前に鳴らす基音のメジャートライアド(根音+長3度+完全5度) */
  TRIAD_INTERVALS: [0, 4, 7],
  TRIAD_BEATS: 2,
  /** 開始までの待ち(拍): ガイドON はトライアド2拍+半拍空け / OFF は半拍 */
  LEAD_IN_BEATS_GUIDE: 2.5,
  LEAD_IN_BEATS_NO_GUIDE: 0.5,
  /** ラウンド間の待ち(拍) */
  ROUND_GAP_BEATS: 2,
  /** 開始音プルダウンのレンジ (MIDI) と初期値 (C3) */
  BASE_MIN: 36,
  BASE_MAX: 72,
  DEFAULT_BASE: 48,
  BPM_MIN: 40,
  BPM_MAX: 160,
  BPM_DEFAULT: 80,
  BPM_STEP: 5,
  /** 最高音がこれを超えるラウンドには進まない */
  MAX_TOP_MIDI: 96,
  /** これを超えるラウンドには進まない */
  MAX_ROUNDS: 24,
} as const

/** ピッチグラフ(時間×音高) */
export const GRAPH = {
  /** 横軸の表示窓(秒)。右端が現在 */
  WINDOW_SEC: 6,
  /** 表示レンジ追従の lerp 係数(毎フレーム) */
  RANGE_LERP: 0.08,
  /** 縦軸の最小表示スパン(半音) */
  MIN_SPAN: 14,
  /** データ(声・ターゲット帯)に対する上下の余白(半音) */
  PAD: 3,
  /** 初期表示レンジ (MIDI)。カスタム出題範囲 C3〜C5 を含む */
  INIT_LOW: 46,
  INIT_HIGH: 74,
  /** 左端ミニ鍵盤の幅 px(タップターゲット) */
  KEYBOARD_W: 44,
} as const

/** ピアノ鍵盤 (A0〜C8, 88鍵) */
export const PIANO = {
  MIDI_MIN: 21,
  MIDI_MAX: 108,
  /** 白鍵の幅 px */
  WHITE_W: 25,
  /** 黒鍵の幅 px */
  BLACK_W: 15,
} as const

/** 音の合成 */
export const SYNTH = {
  /** 簡易ピアノ: 倍音加算合成のパラメータ */
  PIANO_PARTIALS: [1, 2, 3, 4, 5, 6],
  PIANO_GAINS: [1, 0.45, 0.22, 0.11, 0.06, 0.03],
  /** わずかな不協和性: f * p * (1 + INHARMONICITY * p^2) */
  PIANO_INHARMONICITY: 0.0004,
  PIANO_MASTER_GAIN: 0.22,
  BEEP_GAIN: 0.25,
  /** 参照音(鍵盤クリック等)のデフォルト長 秒 */
  DEFAULT_DUR: 0.9,
  /** マスター音量の初期値 0..1(ヘッダーのつまみ。localStorage に保存される) */
  MASTER_VOLUME_DEFAULT: 1,
  /** サンプルピアノ (smplr SplendidGrandPiano) の音量 0-127 */
  SAMPLED_VOLUME: 127,
  /** サンプルピアノのベロシティ 0-127(音の強さ=音色の明るさにも影響) */
  SAMPLED_VELOCITY: 108,
  /**
   * サンプルピアノの追加ブースト(GainNode 倍率)。
   * スマホのスピーカーで音量不足だったため増幅し、コンプレッサーで音割れを防ぐ(2026-06-13)
   */
  SAMPLED_BOOST: 1.6,
} as const
