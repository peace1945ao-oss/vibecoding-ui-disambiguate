#!/usr/bin/env node
/**
 * ui-disambiguate.mjs
 * ビジュアルUI曖昧解消ツール
 *
 * 【モード1】JS注入モード（Claude Code用）
 *   node ui-disambiguate.mjs "上の画像のところ"
 *   → preview_eval に貼るJSを出力
 *
 * 【モード2】HTMLオーバーレイモード（Antigravity用・JS実行不要）
 *   node ui-disambiguate.mjs "上の画像のところ" --html http://localhost:3099
 *   → CSSオーバーレイ済みのHTMLファイルを /tmp/ui-overlay.html に生成
 *   → Browser Sub-Agent は file:///tmp/ui-overlay.html を開くだけでよい
 */

import { writeFileSync } from 'fs';
import { createServer } from 'http';

// ============================================================
// 用語集 + CSSセレクター マッピング
// ============================================================
const GLOSSARY = [
  {
    name: 'ヒーローセクション',
    aliases: ['ヒーロー', 'hero', 'キービジュアル', 'メインビジュアル', 'トップ画像', '上の大きい画像', '大きい画像', 'メイン画像', 'トップビジュアル'],
    selectors: ['.hero', '.hero-section', '[class*="hero"]', 'header + section', 'main > section:first-child', 'main section:first-of-type', 'main div > section:first-child', '.top-section'],
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
// プロキシサーバー起動（Antigravity用・JS実行不要・推奨）
// ============================================================
function startOverlayProxy(targetUrl, cssRules, proxyPort = 3097) {
  const target = new URL(targetUrl);

  const server = createServer(async (req, res) => {
    const proxyUrl = `${target.origin}${req.url}`;
    try {
      const upstream = await fetch(proxyUrl, {
        headers: { host: target.host },
        redirect: 'follow',
      });
      const contentType = upstream.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        let html = await upstream.text();
        const styleBlock = `<style>\n${cssRules}\n</style>`;
        html = html.replace(/<\/body>/i, `\n${styleBlock}\n</body>`);
        res.writeHead(upstream.status, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
      } else {
        const buf = await upstream.arrayBuffer();
        res.writeHead(upstream.status, { 'content-type': contentType });
        res.end(Buffer.from(buf));
      }
    } catch (e) {
      res.writeHead(502);
      res.end('Proxy error: ' + e.message);
    }
  });

  server.listen(proxyPort, () => {
    console.log(`✅ オーバーレイプロキシ起動: http://localhost:${proxyPort}/`);
    console.log('');
    console.log('📌 Browser Sub-Agentへの指示:');
    console.log(`   http://localhost:${proxyPort}/ を開いてスクリーンショットを撮影してください`);
    console.log('');
    console.log('   ※ JS実行ポリシーの変更不要です');
    console.log('   ※ 確認後 Ctrl+C でプロキシを停止してください');
  });
}

// ============================================================
// HTMLオーバーレイ生成（Antigravity用・JS実行不要）
// ============================================================
async function generateOverlayHTML(input, url, candidates) {
  let html;
  try {
    const res = await fetch(url);
    html = await res.text();
  } catch (e) {
    console.error('❌ ページ取得失敗:', url, e.message);
    process.exit(1);
  }

  // 候補ごとにCSSルールを生成（アウトライン + ::before でバッジ表示）
  const cssRules = candidates.map((c, i) => {
    const sels = c.selectors.join(', ');
    return `
/* [${LABELS[i]}] ${c.name} */
${sels} {
  outline: 4px solid ${c.border} !important;
  outline-offset: -4px;
  position: relative !important;
}
${sels}::before {
  content: '[${LABELS[i]}] ${c.name}' !important;
  position: absolute !important;
  top: 6px !important;
  left: 6px !important;
  background: white !important;
  color: #111 !important;
  font-weight: bold !important;
  font-size: 14px !important;
  padding: 4px 12px !important;
  border-radius: 6px !important;
  z-index: 2147483647 !important;
  font-family: system-ui, sans-serif !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
  pointer-events: none !important;
}`;
  }).join('\n');

  const baseTag = `<base href="${url}">`;
  const styleBlock = `<style>\n${cssRules}\n</style>`;

  // 相対URLを絶対URLに書き換え（base hrefより確実）
  const origin = new URL(url).origin;
  const rewritten = html
    .replace(/(href|src|action)="(?!https?:\/\/|\/\/|data:|#)([^"]*)"/g, (_, attr, path) => {
      const abs = path.startsWith('/') ? `${origin}${path}` : `${url.replace(/\/[^/]*$/, '/')}${path}`;
      return `${attr}="${abs}"`;
    });

  // </body>前にstyleを注入
  const modified = rewritten
    .replace(/<\/body>/i, `\n${styleBlock}\n</body>`);

  const outPath = '/tmp/ui-overlay.html';
  writeFileSync(outPath, modified, 'utf-8');
  return outPath;
}

// ============================================================
// メイン処理
// ============================================================
const args = process.argv.slice(2);
const input = args[0];
const htmlFlag = args.indexOf('--html');
const htmlUrl = htmlFlag !== -1 ? args[htmlFlag + 1] : null;
const proxyFlag = args.indexOf('--proxy');
const proxyUrl = proxyFlag !== -1 ? args[proxyFlag + 1] : null;
const portIdx = args.indexOf('--port');
const proxyPort = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 3097;

if (!input) {
  console.log('【モード1】JS注入モード（Claude Code）:');
  console.log('  node ui-disambiguate.mjs "曖昧な表現"');
  console.log('');
  console.log('【モード2】プロキシモード（Antigravity推奨・JS実行不要）:');
  console.log('  node ui-disambiguate.mjs "曖昧な表現" --proxy http://localhost:3000');
  console.log('');
  console.log('【モード3】HTML生成モード（Antigravity・JS実行不要）:');
  console.log('  node ui-disambiguate.mjs "曖昧な表現" --html http://localhost:3000');
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

// ── モード2: プロキシ（推奨）──────────────────────────────
if (proxyUrl) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 プロキシモード（Antigravity推奨）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  const cssRules = candidates.map((c, i) => {
    const sels = c.selectors.join(', ');
    return `${sels} { outline: 4px solid ${c.border} !important; position: relative !important; }
${sels}::before { content: '[${LABELS[i]}] ${c.name}' !important; position: absolute !important; top: 6px !important; left: 6px !important; background: white !important; color: #111 !important; font-weight: bold !important; font-size: 14px !important; padding: 4px 12px !important; border-radius: 6px !important; z-index: 2147483647 !important; font-family: system-ui, sans-serif !important; box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important; pointer-events: none !important; }`;
  }).join('\n');
  startOverlayProxy(proxyUrl, cssRules, proxyPort);
} else

// ── モード3: HTMLオーバーレイ ──────────────────────────────
if (htmlUrl) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌐 HTMLオーバーレイモード（Antigravity用）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  generateOverlayHTML(input, htmlUrl, candidates).then(outPath => {
    console.log('✅ オーバーレイHTML生成完了:');
    console.log('   ' + outPath);
    console.log('');
    console.log('📌 Browser Sub-Agentへの指示:');
    console.log('   file://' + outPath + ' を開いてスクリーンショットを撮影してください');
    console.log('');
    console.log('📌 確認後、元のページに戻る:');
    console.log('   ' + htmlUrl + ' に戻ってください');
  });
} else {

// ── モード1: JS注入（Claude Code） ─────────────────────────
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
}
