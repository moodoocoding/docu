// export.js — HWP 복사(Clipboard API) + MD 다운로드 + 인쇄

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// AI 생성 HTML에 들여쓰기를 자동 적용하는 후처리 함수
// <br> 직후의 기존 공백/&nbsp;를 제거하고, 번호 패턴에 따라 전각 공백(U+3000)을 삽입한다.
export function addIndentationToHtml(html) {
  if (!html) return html;

  const FW = '\u3000'; // 전각 공백
  // &nbsp; 또는 일반 공백을 매칭하는 패턴 (번호 앞의 기존 들여쓰기 제거용)
  const SP = '(?:&nbsp;|\\s|\\u00a0|\\u3000)*';

  // 순서 중요: 더 긴(구체적인) 패턴부터 처리해야 충돌 방지
  let result = html
    // (가) (나) (다) → 전각 공백 5개
    .replace(new RegExp('(<br\\s*\\/?>)' + SP + '(\\([가-하]\\))', 'gi'), '$1' + FW.repeat(5) + '$2')
    // (1) (2) (3) → 전각 공백 4개
    .replace(new RegExp('(<br\\s*\\/?>)' + SP + '(\\(\\d+\\))', 'gi'), '$1' + FW.repeat(4) + '$2')
    // ① ② ③ → 전각 공백 6개
    .replace(new RegExp('(<br\\s*\\/?>)' + SP + '([①②③④⑤⑥⑦⑧⑨⑩])', 'g'), '$1' + FW.repeat(6) + '$2')
    // 가) 나) 다) → 전각 공백 3개
    .replace(new RegExp('(<br\\s*\\/?>)' + SP + '([가-하]\\))', 'gi'), '$1' + FW.repeat(3) + '$2')
    // 1) 2) 3) → 전각 공백 2개
    .replace(new RegExp('(<br\\s*\\/?>)' + SP + '(\\d+\\))', 'gi'), '$1' + FW.repeat(2) + '$2')
    // 가. 나. 다. → 전각 공백 1개
    .replace(new RegExp('(<br\\s*\\/?>)' + SP + '([가-하]\\.)', 'gi'), '$1' + FW + '$2');

  return result;
}

// HTML을 클립보드에 text/html 형태로 복사 (HWP 붙여넣기: 표/굵기/서식 유지)
export async function copyHtmlForHwp(html) {
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const item = new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([htmlToPlainText(html)], { type: 'text/plain' }) });
    await navigator.clipboard.write([item]);
    showToast('✅ 클립보드에 복사되었습니다. 한글에서 붙여넣기(Ctrl+V) 하세요.');
  } catch (e) {
    // 폴백: textarea 복사
    const ta = document.createElement('textarea');
    ta.value = htmlToPlainText(html);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('📋 텍스트로 복사되었습니다.');
  }
}

// HTML → 플레인 텍스트 변환 (간단 버전)
function htmlToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerText || div.textContent || '';
}

// HTML → Markdown 변환
function htmlToMarkdown(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  let md = '';

  function walk(node, depth) {
    if (node.nodeType === Node.TEXT_NODE) {
      md += node.textContent;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName.toLowerCase();

    if (tag === 'br') { md += '\n'; return; }
    if (tag === 'strong' || tag === 'b') { md += '**'; walkChildren(node, depth); md += '**'; return; }
    if (tag === 'em' || tag === 'i') { md += '*'; walkChildren(node, depth); md += '*'; return; }
    if (tag === 'h1') { md += '\n# '; walkChildren(node, depth); md += '\n\n'; return; }
    if (tag === 'h2') { md += '\n## '; walkChildren(node, depth); md += '\n\n'; return; }
    if (tag === 'h3') { md += '\n### '; walkChildren(node, depth); md += '\n\n'; return; }
    if (tag === 'p') { walkChildren(node, depth); md += '\n\n'; return; }
    if (tag === 'div') { walkChildren(node, depth); md += '\n'; return; }

    if (tag === 'table') {
      md += '\n';
      const rows = node.querySelectorAll('tr');
      rows.forEach((row, ri) => {
        const cells = row.querySelectorAll('td, th');
        md += '| ';
        cells.forEach(c => { md += c.textContent.trim() + ' | '; });
        md += '\n';
        if (ri === 0) {
          md += '| ';
          cells.forEach(() => { md += '--- | '; });
          md += '\n';
        }
      });
      md += '\n';
      return;
    }

    walkChildren(node, depth);
  }

  function walkChildren(node, depth) {
    node.childNodes.forEach(ch => walk(ch, depth + 1));
  }

  walk(div, 0);

  // &nbsp; 정리
  md = md.replace(/\u00a0/g, ' ');
  // 연속 빈줄 정리
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

// MD 파일 다운로드
export function downloadMarkdown(html, docType, title) {
  const md = htmlToMarkdown(html);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const safeName = (title || '문서').replace(/[^가-힣a-zA-Z0-9]/g, '_').slice(0, 30);
  const filename = `${docType}_${safeName}_${date}.md`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`📥 ${filename} 다운로드 완료`);
}

// 인쇄
export function printDocument() {
  window.print();
}
