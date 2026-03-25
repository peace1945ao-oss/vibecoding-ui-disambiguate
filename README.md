# vibecoding-ui-disambiguate

**Vibe Codingで「上の画像のところ」と言ったら、AIが実際のサイト画面で聞き返してくれるツール**

![デモ](ui-disambiguate-demo.gif)

**Claude Code・Google Antigravity の両方に対応**

---

## これは何？

AIにWebサイトを作ってもらうとき、こんな指示をしていませんか？

- 「上の画像のところを変えて」
- 「右のボタンのやつ」
- 「ポップアップを出して」

用語がわからないと、AIが違う場所を修正してしまうことがあります。

このツールは、**曖昧な表現を入力すると候補用語を探し出し、実際のサイト画面に色枠で「ここですか？」と聞き返す**ためのスクリプトです。

---

## デモの流れ

```
ユーザー「上の画像のところ」
↓
候補を検索: ヒーローセクション / ヘッダー / ナビゲーションバー
↓
実際のサイト画面に色枠を表示
↓
「[A]ヒーローセクション [B]ヘッダー のどれですか？」
↓
ユーザーが選択 → 確定して実装へ
```

---

## 構成

```
vibecoding-ui-disambiguate/
├── ui-disambiguate.mjs   # コアスクリプト（共通）
├── CLAUDE.md.example     # Claude Code 用の組み込み方
├── AGENT.md.example      # Google Antigravity 用の組み込み方
├── ui-disambiguate-demo.gif
└── README.md
```

スクリプト本体は**どのツールでも共通**です。
AIへの指示ファイルだけ、使うツールに合わせてコピーします。

---

## セットアップ

### Claude Code の場合

1. `ui-disambiguate.mjs` をプロジェクトの `scripts/` に配置
2. `CLAUDE.md.example` の内容をプロジェクトの `CLAUDE.md` にコピー

### Google Antigravity の場合

1. `ui-disambiguate.mjs` をプロジェクトルートに配置
2. `AGENT.md.example` を `.agent/workflows/ui-disambiguate.md` としてコピー
3. Antigravity の JavaScript Execution Policy を "Always Proceed" に設定

---

## 使い方

### 1. 候補を検索してオーバーレイJSを生成

```bash
node ui-disambiguate.mjs "上の画像のところ"
```

出力例：

```
📋 候補用語:
  [A] ヒーローセクション — ページ上部の全幅画像＋見出し＋CTAのエリア
  [B] ナビゲーションバー — サイト全体のリンクが並ぶナビゲーション
  [C] ヘッダー — ページ最上部のナビゲーションエリア

📌 【STEP 1】 ページに注入するJS（オーバーレイ表示）:
...（JSコード）...
```

### 2. 注入方法（ツール別）

| ツール | 注入方法 |
|---|---|
| Claude Code | `preview_eval` に出力JSを貼る |
| Antigravity | Browser Sub-Agent に実行を指示 |

### 3. スクリーンショットを撮ってユーザーに確認

```
「[A]・[B]・[C]のどれですか？」
```

### 4. 選んでもらったら確定して作業を続ける

---

## 対応している用語（14種類）

| 曖昧な表現 | 検出する用語 |
|---|---|
| 上の大きい画像 | ヒーローセクション |
| 上のバー、ナビ | ヘッダー / ナビゲーションバー |
| 一番下 | フッター |
| 切り替わる画像 | カルーセル / スライダー |
| 箱、タイル | カード |
| ポップアップ | モーダル |
| 横のやつ | サイドバー |
| 三本線 | ハンバーガーメニュー |
| パンくず | パンくずリスト |
| 大きいボタン | CTAボタン |
| 開閉するやつ | アコーディオン |
| 入力欄 | フォーム |
| かたまり | セクション |

---

## 関連リンク

- [Vibe Coding 用語集](https://vibecoding-glossary.pages.dev/) — 用語の詳細はこちら

---

MIT License
