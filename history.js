import { supabase } from './supabase.js';
import { copyHtmlForHwp, addIndentationToHtml, downloadMarkdown } from './export.js';

const container = document.getElementById('historyContainer');
let historyData = [];
let currentHtml = '';
let currentItem = null;

async function fetchHistory() {
  container.innerHTML = '<div class="empty">데이터를 불러오는 중...</div>';
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      container.innerHTML = '<div class="empty">로그인이 필요합니다.</div>';
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    historyData = data || [];
    render();
  } catch (e) {
    console.error('History fetch error:', e);
    // 폴백: 로컬 스토리지
    historyData = JSON.parse(localStorage.getItem('docHistory') || '[]');
    render();
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = '⚠️ DB 연결 실패. 로컬 내역을 표시합니다.';
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 2500);
    }
  }
}

function render() {
  if (historyData.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">📭</div><p>아직 작성한 문서가 없습니다.<br><a href="create.html?type=GONGMUN">문서 작성하러 가기 →</a></p></div>';
    return;
  }
  
  container.innerHTML = '<div class="history-list">' + historyData.map((item, i) => {
    const d = new Date(item.created_at || item.date);
    const dateStr = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `<div class="history-card" data-idx="${i}">
      <div class="h-type">${item.type_name || item.typeName}</div>
      <div class="h-body">
        <div class="h-preview">${item.preview || '(제목 없음)'}</div>
        <div class="h-date">${dateStr}</div>
      </div>
      <div class="h-actions">
        <button class="h-btn view-btn" data-idx="${i}">👁️ 보기</button>
        <button class="h-btn del del-btn" data-idx="${i}">🗑️</button>
      </div>
    </div>`;
  }).join('') + '</div>';

  // 이벤트 바인딩
  container.querySelectorAll('.history-card').forEach(card => {
    card.addEventListener('click', () => openModal(parseInt(card.dataset.idx)));
  });
  container.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(parseInt(btn.dataset.idx));
    });
  });
  container.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItem(parseInt(btn.dataset.idx));
    });
  });
}

function openModal(idx) {
  currentItem = historyData[idx];
  currentHtml = addIndentationToHtml(currentItem.html);
  document.getElementById('modalTitle').textContent = (currentItem.type_name || currentItem.typeName) + ' - ' + (currentItem.preview || '');
  document.getElementById('modalBody').innerHTML = currentHtml;
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

async function deleteItem(idx) {
  if (confirm('이 문서를 삭제하시겠습니까?')) {
    const item = historyData[idx];
    
    if (item.id && typeof item.id === 'string' && item.id.length > 20) { // UUID check
      try {
        const { error } = await supabase.from('documents').delete().eq('id', item.id);
        if (error) throw error;
      } catch (e) {
        console.error('삭제 실패:', e);
      }
    }

    historyData.splice(idx, 1);
    // 로컬 동기화
    localStorage.setItem('docHistory', JSON.stringify(historyData.filter(h => h.date))); // Only keep local-style ones if any
    render();
  }
}

document.getElementById('modalClose')?.addEventListener('click', closeModal);
document.getElementById('modalCloseBtn')?.addEventListener('click', closeModal);
document.getElementById('modal')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

document.getElementById('modalCopy')?.addEventListener('click', () => {
  if (currentHtml) copyHtmlForHwp(currentHtml);
});

document.getElementById('modalMd')?.addEventListener('click', () => {
  if (currentHtml && currentItem) {
    downloadMarkdown(currentHtml, currentItem.type, currentItem.preview);
  }
});

fetchHistory();
