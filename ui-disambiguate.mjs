#!/usr/bin/env node
/**
 * ui-disambiguate.mjs
 * ビジュアルUI曖昧解消ツール
 *
 * 使い方:
 *   node scripts/ui-disambiguate.mjs "上の画像のところ"
 *
 * 出力:
 *   - 候補用語リスト
 *   - preview_eval に貼るオーバーレイJS
 *   - オーバーレイ削除JS
 */

// ============================================================
// 用語集 + CSSセレクター マッピング
// ============================================================
const GLOSSARY = [
  {
    name: 'ヒーローセクション',
    aliases: ['ヒーロー', 'hero', 'キービジュアル', 'メインビジュアル', 'トップ画像', '上の大きい画像', '大きい画像', 'メイン画像', 'トップビジュアル'],
    selectors: ['.hero', '.hero-section', '[class*="hero"]', 'header + section', 'main > section:first-child', '.top-section'],
    description: 'ページ上部の全幅画像＋見出し＋CTAのエリア',
    color: 'rgba(255, 80, 80, 0.25)',
    border: 'rgba(255, 80, 80, 0.9)',
  },
  {
    name: 'ヘッダー',
    aliases: ['header', 'ヘッダ', 'ナビ', 'ナビゲーション', '上のバー', '上部', 'ヘッダーエリア', 'グローバルナビ'],
    selectors: ['header', '[class*="header"]', '.navbar', '.nav', 'nav', '.site-header'],
    description: 'ページ最上部のナビゲーションエリア',
    color: 'rgba(80, 80, 255, 0.25)',
    border: 'rgba(80, 80, 255, 0.9)',
  },
  {
    name: 'フッター',
    aliases: ['footer', 'フッタ', '下のバー', 'ページ下部', '一番下'],
    selectors: ['footer', '[class*="footer"]', '.site-footer'],
    description: 'ページ最下部のフッターエリア',
    color: 'rgba(80, 180, 80, 0.25)',
    border: 'rgba(80, 180, 80, 0.9)',
  },
  {
    name: 'カルーセル / スライダー',
    aliases: ['カルーセル', 'スライダー', 'スライド', '切り替わる画像', '自動で動く', 'バナー複数'],
    selectors: ['[class*="carousel"]', '[class*="slider"]', '[class*="swiper"]', '[class*="slide"]'],
    description: '複数の画像やコンテンツが切り替わるエリア',
    color: 'rgba(255, 160, 0, 0.25)',
    border: 'rgba(255, 160, 0, 0.9)',
  },
  {
    name: 'カード',
    aliases: ['カード', 'card', 'タイル', '箱', 'グリッドのやつ', '一覧のアイテム'],
    selectors: ['.card', '[class*="card"]', '.item', '[class*="item"]', 'article'],
    description: '情報をまとめた四角いブロック',
    color: 'rgba(160, 80, 255, 0.25)',
    border: 'rgba(160, 80, 255, 0.9)',
  },
  {
    name: 'モーダル',
    aliases: ['モーダル', 'modal', 'ポップアップ', 'popup', 'ダイアログ', '出てくるやつ', '前面に出るやつ'],
    selectors: ['.modal', '[class*="modal"]', '[class*="dialog"]', '[role="dialog"]'],
    description: 'クリックで前面に表示されるポップアップ',
    color: 'rgba(255, 80, 200, 0.25)',
    border: 'rgba(255, 80, 200, 0.9)',
  },
  {
    name: 'サイドバー',
    aliases: ['サイドバー', 'sidebar', '横のやつ', '右側', '左側', 'サイド'],
    selectors: ['aside', '.sidebar', '[class*="sidebar"]', '.side'],
    description: 'メインコンテンツの横に表示されるエリア',
    color: 'rgba(0, 200, 200, 0.25)',
    border: 'rgba(0, 200, 200, 0.9)',
  },
  {
    name: 'ナビゲーションバー',
    aliases: ['ナビバー', 'navbar', 'メニューバー', 'グローバルメニュー', 'メニュー', 'リンクのところ'],
    selectors: ['nav', '.navbar', '[class*="navbar"]', '[class*="nav-bar"]', '.global-nav'],
    description: 'サイト全体のリンクが並ぶナビゲーション',
    color: 'rgba(255, 120, 0, 0.25)',
    border: 'rgba(255, 120, 0, 0.9)',
  },
  {
    name: 'ハンバーガーメニュー',
    aliases: ['ハンバーガー', '三本線', 'スマホメニュー', '≡', 'メニューボタン'],
    selectors: ['.hamburger', '[class*="hamburger"]', '[class*="menu-btn"]', '[class*="toggle"]', '.nav-toggle'],
    description: 'スマホ時に表示される三本線のメニューボタン',
    color: 'rgba(200, 100, 0, 0.25)',
    border: 'rgba(200, 100, 0, 0.9)',
  },
  {
    name: 'パンくずリスト',
    aliases: ['パンくず', 'breadcrumb', 'パンくずリスト', '現在地', '階層表示'],
    selectors: ['.breadcrumb', '[class*="breadcrumb"]', '[aria-label="breadcrumb"]', 'nav[aria-label]'],
    description: 'ページの階層構造を示すナビゲーション',
    color: 'rgba(100, 200, 100, 0.25)',
    border: 'rgba(100, 200, 100, 0.9)',
  },
  {
    name: 'CTAボタン',
    aliases: ['CTA', 'cta', '行動喚起', 'メインボタン', '大きいボタン', '申し込みボタン', '購入ボタン'],
    selectors: ['.cta', '[class*="cta"]', '.btn-primary', '[class*="btn-primary"]', '.button-main'],
    description: 'ユーザーに行動を促すメインのボタン',
    color: 'rgba(255, 50, 50, 0.25)',
    border: 'rgba(255, 50, 50, 0.9)',
  },
  {
    name: 'セクション',
    aliases: ['セクション', 'section', 'エリア', 'ブロック', '区切り', 'かたまり'],
    selectors: ['section', '[class*="section"]', '.block', '[class*="block"]'],
    description: 'ページを区切るコンテンツのまとまり',
    color: 'rgba(150, 150, 150, 0.25)',
    border: 'rgba(150, 150, 150, 0.9)',
  },
  {
    name: 'フォーム',
    aliases: ['フォーム', 'form', '入力欄', '申し込みフォーム', '問い合わせ', 'お問い合わせ'],
    selectors: ['form', '[class*="form"]', '.contact', '[class*="contact"]'],
    description: '入力項目が並ぶフォームエリア',
    color: 'rgba(80, 200, 255, 0.25)',
    border: 'rgba(80, 200, 255, 0.9)',
  },
  {
    name: 'アコーディオン',
    aliases: ['アコーディオン', 'accordion', '開閉', '展開', 'FAQ', 'よくある質問', '折りたたみ'],
    selectors: ['.accordion', '[class*="accordion"]', '.faq', '[class*="faq"]', 'details'],
    description: 'クリックで開閉するコンテンツ',
    color: 'rgba(200, 255, 80, 0.25)',
    border: 'rgba(200, 255, 80, 0.9)',
  },
];

const LABELS = ['A', 'B', 'C', 'D', 'E'];

// ============================================================
// 曖昧表現から候補を検索
// ============================================================
function searchCandidates(input) {
  const normalized = input.toLowerCase().replace(/\s/g, '');
  const scored = GLOSSARY.map(term => {
    let score = 0;
    // エイリアスとの一致チェック
    for (const alias of term.aliases) {
      const normalizedAlias = alias.toLowerCase().replace(/\s/g, '');
      if (normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized)) {
        score += 10;
      }
      // 部分一致
      const inputChars = [...normalized];
      const matchCount = inputChars.filter(c => normalizedAlias.includes(c)).length;
      score += matchCount * 0.5;
    }
    // 用語名との一致チェック
    const termName = term.name.toLowerCase().replace(/\s/g, '');
    if (normalized.includes(termName) || termName.includes(normalized)) {
      score += 15;
    }
    return { ...term, score };
  });

  return scored
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

// ============================================================
// オーバーレイ注入JS生成
// ============================================================
function generateOverlayJS(candidates) {
  const candidatesJson = JSON.stringify(
    candidates.map(c => ({
      name: c.name,
      selectors: c.selectors,
      description: c.description,
      color: c.color,
      border: c.border,
    }))
  );

  return `
(function() {
  // 既存のオーバーレイを削除
  document.querySelectorAll('.__ui-disambiguate').forEach(el => el.remove());

  const candidates = ${candidatesJson};
  const labels = ${JSON.stringify(LABELS)};
  const results = [];

  candidates.forEach((candidate, i) => {
    let el = null;
    for (const sel of candidate.selectors) {
      try { el = document.querySelector(sel); } catch(e) {}
      if (el) break;
    }
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = '__ui-disambiguate';
    overlay.style.cssText = [
      'position: fixed',
      'top: ' + rect.top + 'px',
      'left: ' + rect.left + 'px',
      'width: ' + rect.width + 'px',
      'height: ' + rect.height + 'px',
      'background: ' + candidate.color,
      'border: 3px solid ' + candidate.border,
      'z-index: 999999',
      'pointer-events: none',
      'box-sizing: border-box',
    ].join(';');

    const badge = document.createElement('div');
    badge.textContent = '[' + labels[i] + '] ' + candidate.name;
    badge.style.cssText = [
      'background: white',
      'color: #111',
      'font-weight: bold',
      'font-size: 13px',
      'padding: 4px 10px',
      'border-radius: 6px',
      'display: inline-block',
      'margin: 6px',
      'font-family: system-ui, sans-serif',
      'box-shadow: 0 2px 8px rgba(0,0,0,0.25)',
    ].join(';');

    overlay.appendChild(badge);
    document.body.appendChild(overlay);
    results.push('[' + labels[i] + '] ' + candidate.name + ': ' + candidate.description);
  });

  return results.length > 0
    ? results.join('\\n')
    : '該当する要素がページ上に見つかりませんでした';
})();
`.trim();
}

// ============================================================
// オーバーレイ削除JS
// ============================================================
const CLEANUP_JS = `document.querySelectorAll('.__ui-disambiguate').forEach(el => el.remove()); 'オーバーレイを削除しました';`;

// ============================================================
// メイン処理
// ============================================================
const input = process.argv[2];

if (!input) {
  console.log('使い方: node scripts/ui-disambiguate.mjs "曖昧な表現"');
  console.log('例:     node scripts/ui-disambiguate.mjs "上の画像のところ"');
  process.exit(0);
}

const candidates = searchCandidates(input);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 入力:', input);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (candidates.length === 0) {
  console.log('❌ 候補が見つかりませんでした。もう少し具体的に教えてください。');
  process.exit(0);
}

console.log('📋 候補用語:');
candidates.forEach((c, i) => {
  console.log(`  [${LABELS[i]}] ${c.name} — ${c.description}`);
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 【STEP 1】 preview_eval に貼るJS（オーバーレイ表示）:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(generateOverlayJS(candidates));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 【STEP 2】 preview_screenshot でスクリーンショット撮影');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📌 【STEP 3】 オーバーレイ削除JS:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(CLEANUP_JS);
console.log();
