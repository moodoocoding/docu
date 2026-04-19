// export.js — HWP 복사(Clipboard API) + MD 다운로드 + 인쇄

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// HTML을 클립보드에 text/html 형태로 복사 (HWP 붙여넣기용)
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
