// messenger.js — 소통메신저 탭 전체 로직
// gemini.js의 함수들은 글로벌 스코프에서 직접 접근합니다.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// ==================== 유틸리티 ====================
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function startLoadingCycle(msgEl, messages) {
  let idx = 0;
  msgEl.textContent = messages[0];
  return setInterval(() => {
    idx = (idx + 1) % messages.length;
    msgEl.textContent = messages[idx];
  }, 2200);
}

// ==================== 탭 전환 ====================
const tabBtns = document.querySelectorAll('.m-tab-btn');
const formAnalyze = document.getElementById('form-analyze');
const formWrite = document.getElementById('form-write');
const headerAnalyze = document.getElementById('analyzeHeader');
const headerWrite = document.getElementById('writeHeader');
const previewAnalyze = document.getElementById('analyzePreviewContainer');
const previewWrite = document.getElementById('writePreviewContainer');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (target === 'analyze') {
      formAnalyze.style.display = 'flex';
      formWrite.style.display = 'none';
      headerAnalyze.style.display = 'flex';
      headerWrite.style.display = 'none';
      previewAnalyze.style.display = 'block';
      previewWrite.style.display = 'none';
    } else {
      formAnalyze.style.display = 'none';
      formWrite.style.display = 'flex';
      headerAnalyze.style.display = 'none';
      headerWrite.style.display = 'flex';
      previewAnalyze.style.display = 'none';
      previewWrite.style.display = 'block';
    }
  });
});

// ==================== 분석 탭 ====================
const dropZone = document.getElementById('dropZone');
const dropZoneInner = document.getElementById('dropZoneInner');
const screenshotInput = document.getElementById('screenshotInput');
const screenshotPreview = document.getElementById('screenshotPreview');
const uploadActions = document.getElementById('uploadActions');
const analyzeBtn = document.getElementById('analyzeBtn');
const changeImageBtn = document.getElementById('changeImageBtn');
const analyzingMsg = document.getElementById('analyzingMsg');

let currentImageBase64 = null;
let currentImageMime = null;
let currentImageDataUrl = null;

dropZone.addEventListener('click', () => {
  if (!currentImageBase64) screenshotInput.click();
});

screenshotInput.addEventListener('change', () => {
  const file = screenshotInput.files[0];
  if (file) loadImageFile(file);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadImageFile(file);
  else showToast('⚠️ 이미지 파일만 업로드 가능합니다.');
});

// 클립보드 붙여넣기 (Ctrl+V)
window.addEventListener('paste', (e) => {
  // 현재 '분석' 탭이 활성화되어 있는지 확인
  if (formAnalyze.style.display === 'none') return;
  
  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile();
      loadImageFile(file);
      showToast('📸 클립보드 이미지가 붙여넣기 되었습니다.');
      break;
    }
  }
});

changeImageBtn.addEventListener('click', () => {
  screenshotInput.value = '';
  screenshotInput.click();
});

function loadImageFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImageDataUrl = e.target.result;
    currentImageMime = file.type;
    currentImageBase64 = e.target.result;

    screenshotPreview.src = currentImageDataUrl;
    screenshotPreview.style.display = 'block';
    dropZoneInner.style.display = 'none';
    uploadActions.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

// ===== 분석 실행 =====
analyzeBtn.addEventListener('click', async () => {
  if (!currentImageBase64) {
    showToast('⚠️ 이미지를 먼저 업로드해주세요.');
    return;
  }

  const btnTextEl = analyzeBtn.querySelector('.btn-text');
  const btnLoadingEl = analyzeBtn.querySelector('.btn-loading');
  analyzeBtn.disabled = true;
  btnTextEl.style.display = 'none';
  btnLoadingEl.style.display = 'flex';

  const timer = startLoadingCycle(analyzingMsg, LOADING_MESSAGES_MESSENGER_ANALYZE);

  try {
    const instruction = getDocInstruction('MESSENGER_ANALYZE', {});
    const fileDataList = [{
      base64: currentImageBase64,
      mimeType: currentImageMime,
      name: 'screenshot.png'
    }];

    const rawResult = await callGemini(
      API_KEY,
      '첨부된 스크린샷을 분석해주세요.',
      instruction,
      fileDataList,
      MESSENGER_ANALYZE_SYSTEM_INSTRUCTION
    );

    const jsonStr = rawResult
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      throw new Error('분석 결과를 해석할 수 없습니다. 다시 시도해주세요.');
    }

    displayAnalysisResult(data);
    showToast('✅ 분석이 완료되었습니다!');
  } catch (err) {
    showToast('❌ ' + err.message);
    console.error(err);
  } finally {
    clearInterval(timer);
    analyzeBtn.disabled = false;
    btnTextEl.style.display = '';
    btnLoadingEl.style.display = 'none';
  }
});

// 결과 표시
let currentAnalysisData = null;

function displayAnalysisResult(data) {
  currentAnalysisData = data;

  document.getElementById('analyzeEmpty').style.display = 'none';
  document.getElementById('resultCard').style.display = 'block';

  document.getElementById('copyResultBtn').disabled = false;
  document.getElementById('saveAnalysisBtn').disabled = false;

  const info = data.message_info || {};
  const cls = data.classification || {};
  const req = data.required_actions || [];
  const sch = data.schedule || {};
  const prep = data.preparation || {};
  const risk = data.risk_check || {};
  const guide = data.final_guide || {};

  const catColors = {
    '안내/공지': ['#ede9fe', '#7c3aed'],
    '행사': ['#dcfce7', '#16a34a'],
    '연수': ['#dbeafe', '#1d4ed8'],
    '민원': ['#fef3c7', '#b45309'],
    '회의': ['#e0f2fe', '#0369a1'],
    '제출': ['#ffedd5', '#c2410c'],
    '조사': ['#e0e7ff', '#4338ca'],
    '복무': ['#fce7f3', '#be185d'],
    '학생지도': ['#ecfdf5', '#047857'],
    '학부모': ['#fff1f2', '#e11d48'],
    '기타': ['#f3f4f6', '#6b7280'],
  };
  const cat = cls.category || data.category || '기타';
  const [bg, fg] = catColors[cat] || catColors['기타'];
  const badge = document.getElementById('resultCategory');
  badge.textContent = cat;
  badge.style.background = bg;
  badge.style.color = fg;

  const prioBadge = document.getElementById('resultPriority');
  if (cls.priority) {
    prioBadge.style.display = 'inline-block';
    prioBadge.textContent = cls.priority;
    if (cls.priority.includes('긴급') || cls.priority.includes('높음')) {
      prioBadge.style.background = '#fee2e2'; prioBadge.style.color = '#b91c1c';
    } else if (cls.priority.includes('보통')) {
      prioBadge.style.background = '#fef3c7'; prioBadge.style.color = '#b45309';
    } else {
      prioBadge.style.background = '#f3f4f6'; prioBadge.style.color = '#4b5563';
    }
  } else {
    prioBadge.style.display = 'none';
  }

  const platBadge = document.getElementById('resultPlatform');
  if (info.platform && info.platform !== '미확인') {
    platBadge.style.display = 'inline-block';
    platBadge.textContent = info.platform;
  } else {
    platBadge.style.display = 'none';
  }

  document.getElementById('resultDate').textContent = info.date || data.date || '날짜 미확인';
  const timeEl = document.getElementById('resultTime');
  timeEl.textContent = info.time || data.time || '';
  timeEl.style.display = (info.time || data.time) ? 'inline' : 'none';

  document.getElementById('resultSender').textContent = info.sender || data.sender || '미확인';
  document.getElementById('resultSubject').textContent = info.subject || data.subject || '(제목 없음)';

  let summaryText = '';
  const sumData = data.summary || [];
  if (Array.isArray(sumData)) {
    summaryText = sumData.map(s => `• ${s}`).join('\n');
  } else if (typeof sumData === 'string') {
    summaryText = sumData.replace(/• /g, '\n• ').trim();
  }
  document.getElementById('resultSummary').textContent = summaryText;

  const reqSection = document.getElementById('requiredActionsSection');
  const reqContainer = document.getElementById('resultRequiredActions');
  if (req && req.length > 0) {
    reqContainer.innerHTML = req.map((actionText, i) => `
      <div style="background: #fff; border: 1px solid #fed7aa; border-left: 4px solid #f97316; padding: 12px 16px; border-radius: 6px;">
        <div style="font-weight: 700; color: #9a3412; font-size: 14px;">${i+1}. ${typeof actionText === 'string' ? actionText : (actionText.action || actionText)}</div>
      </div>
    `).join('');
    reqSection.style.display = 'block';
  } else {
    reqSection.style.display = 'none';
  }

  const schSection = document.getElementById('scheduleSection');
  const addCalendarTopBtn = document.getElementById('addCalendarTopBtn');
  
  // 일정 정보가 있을 때만 상세 영역 표시
  if (sch && sch.has_schedule) {
    document.getElementById('schTitle').textContent = sch.title || '일정 정보';
    document.getElementById('schDateTime').textContent = `${sch.date || ''} ${sch.start_time || ''} ${sch.end_time ? '~ ' + sch.end_time : ''}`.trim() || '미상';
    document.getElementById('schLocation').textContent = sch.location || '미상';
    schSection.style.display = 'block';
  } else {
    schSection.style.display = 'none';
  }

  // 상단 일정 등록 버튼은 항상 표시 (분석 결과가 있을 때)
  addCalendarTopBtn.style.display = 'inline-block';

  addCalendarTopBtn.onclick = () => {
    // 일정 제목 결정 (추출된 일정 제목 -> 메시지 제목 -> 기본값)
    const eventTitle = sch.title || info.subject || data.subject || '새 일정';
    let title = encodeURIComponent(eventTitle);
    
    // 상세 내용 구성
    let detailsText = `📌 ${eventTitle}\n\n`;
    detailsText += `📝 핵심 요약\n${summaryText}`;
    
    if (req && req.length > 0) {
      detailsText += '\n\n✅ 필수 조치사항\n';
      req.forEach((actionText, i) => {
        detailsText += `${i+1}. ${typeof actionText === 'string' ? actionText : (actionText.action || actionText)}\n`;
      });
    }
    let details = encodeURIComponent(detailsText);
    let location = encodeURIComponent(sch.location || '');
    
    let datesParam = '';
    // 날짜 정보 결정 (추출된 일정 날짜 -> 조치사항 마감일 -> 메시지 수신 날짜 -> 오늘)
    let parsedDate = null;
    
    // 1. AI가 이미 추출한 구체적인 일정 날짜(sch.date)가 있는지 확인
    if (sch && sch.date) {
      const isoMatch = sch.date.match(/(\d{4})-(\d{2})-(\d{2})/);
      const koMatchFull = sch.date.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
      const koMatchShort = sch.date.match(/(\d{1,2})월\s*(\d{1,2})일/);
      
      if (isoMatch) parsedDate = new Date(isoMatch[1], parseInt(isoMatch[2])-1, isoMatch[3]);
      else if (koMatchFull) parsedDate = new Date(koMatchFull[1], parseInt(koMatchFull[2])-1, koMatchFull[3]);
      else if (koMatchShort) parsedDate = new Date(new Date().getFullYear(), parseInt(koMatchShort[1])-1, koMatchShort[2]);
    }

    // 2. 조치사항에서 마감/제출 기한 키워드와 함께 있는 날짜 추출 시도
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      if (req && req.length > 0) {
        for (const action of req) {
          const text = typeof action === 'string' ? action : (action.action || action);
          if (text.includes('제출') || text.includes('기한') || text.includes('마감') || text.includes('까지')) {
            const match = text.match(/(\d{1,2})월\s*(\d{1,2})일|(\d{1,2})\/(\d{1,2})|(\d{1,2})\.(\d{1,2})/);
            if (match) {
              const m = match[1] || match[3] || match[5];
              const d = match[2] || match[4] || match[6];
              parsedDate = new Date(new Date().getFullYear(), parseInt(m) - 1, parseInt(d));
              break;
            }
          }
        }
      }
    }

    // 3. 그래도 없으면 메시지 수신 날짜(info.date) 사용
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      let targetDateStr = info.date || data.date;
      if (targetDateStr) {
        const isoMatch = targetDateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
        const koMatchFull = targetDateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
        const koMatchShort = targetDateStr.match(/(\d{1,2})월\s*(\d{1,2})일/);
        
        if (isoMatch) parsedDate = new Date(isoMatch[1], parseInt(isoMatch[2])-1, isoMatch[3]);
        else if (koMatchFull) parsedDate = new Date(koMatchFull[1], parseInt(koMatchFull[2])-1, koMatchFull[3]);
        else if (koMatchShort) parsedDate = new Date(new Date().getFullYear(), parseInt(koMatchShort[1])-1, koMatchShort[2]);
      }
    }

    // 4. 최후의 수단으로 오늘 날짜
    if (!parsedDate || isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }

    const ey = parsedDate.getFullYear();
    const em = String(parsedDate.getMonth()+1).padStart(2, '0');
    const ed = String(parsedDate.getDate()).padStart(2, '0');
    const dateStr = `${ey}${em}${ed}`;
    
    let startStr = dateStr;
    let endStr = dateStr;

    if (sch && sch.start_time) {
      let stH = 0, stM = 0;
      let stMatch = sch.start_time.match(/(\d{1,2}):(\d{2})/);
      if (stMatch) {
        stH = parseInt(stMatch[1]);
        stM = parseInt(stMatch[2]);
      } else {
        const hMatch = sch.start_time.match(/(\d{1,2})시/);
        if (hMatch) stH = parseInt(hMatch[1]);
        const mMatch = sch.start_time.match(/(\d{1,2})분/);
        if (mMatch) stM = parseInt(mMatch[1]);
        if (sch.start_time.includes('오후') && stH < 12) stH += 12;
      }
      
      const stStrFormatted = String(stH).padStart(2, '0') + String(stM).padStart(2, '0') + '00';
      startStr += `T${stStrFormatted}`;
      
      if (sch.end_time) {
        let etH = stH + 1, etM = stM;
        let etMatch = sch.end_time.match(/(\d{1,2}):(\d{2})/);
        if (etMatch) {
          etH = parseInt(etMatch[1]);
          etM = parseInt(etMatch[2]);
        } else {
          const hMatch = sch.end_time.match(/(\d{1,2})시/);
          if (hMatch) etH = parseInt(hMatch[1]);
          const mMatch = sch.end_time.match(/(\d{1,2})분/);
          if (mMatch) etM = parseInt(mMatch[1]);
          if (sch.end_time.includes('오후') && etH < 12) etH += 12;
        }
        const etStrFormatted = String(etH).padStart(2, '0') + String(etM).padStart(2, '0') + '00';
        endStr += `T${etStrFormatted}`;
      } else {
        let tempDate = new Date(parsedDate);
        tempDate.setHours(stH + 1, stM);
        const tey = tempDate.getFullYear();
        const tem = String(tempDate.getMonth()+1).padStart(2, '0');
        const ted = String(tempDate.getDate()).padStart(2, '0');
        const teh = String(tempDate.getHours()).padStart(2, '0');
        const temm = String(tempDate.getMinutes()).padStart(2, '0');
        endStr = `${tey}${tem}${ted}T${teh}${temm}00`;
      }
      datesParam = `${startStr}/${endStr}`;
    } else {
      let tempDate = new Date(parsedDate);
      tempDate.setDate(tempDate.getDate() + 1);
      const tey = tempDate.getFullYear();
      const tem = String(tempDate.getMonth()+1).padStart(2, '0');
      const ted = String(tempDate.getDate()).padStart(2, '0');
      endStr = `${tey}${tem}${ted}`;
      datesParam = `${startStr}/${endStr}`;
    }
    
    let url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    if (datesParam) url += `&dates=${datesParam}`;
    
    window.open(url, '_blank');
  };

  const fullTextSection = document.getElementById('fullTextSection');
  const fullTextEl = document.getElementById('resultFullText');
  if (data.full_text && String(data.full_text).trim() !== '') {
    fullTextEl.textContent = data.full_text;
    fullTextSection.style.display = 'block';
  } else {
    fullTextSection.style.display = 'none';
  }
}

// 결과 복사
document.getElementById('copyResultBtn')?.addEventListener('click', () => {
  if (!currentAnalysisData) return;
  const d = currentAnalysisData;
  const info = d.message_info || {};
  const cls = d.classification || {};
  const guide = d.final_guide || {};
  
  let text = `[${cls.category || d.category || '기타'}] ${info.subject || d.subject || ''}\n`;
  if (guide.one_line_action) text += `💡 ${guide.one_line_action}\n`;
  text += `\n📅 ${info.date || d.date || ''} ${info.time || d.time || ''}\n`;
  text += `👤 발신자: ${info.sender || d.sender || ''}\n\n`;
  
  text += `📋 핵심 요약\n`;
  const sumData = d.summary || [];
  if (Array.isArray(sumData)) text += sumData.map(s => `• ${s}`).join('\n');
  else if (sumData) text += sumData;
  
  if (d.required_actions && d.required_actions.length) {
    text += `\n\n✅ 필수 조치사항\n`;
    text += d.required_actions.map((r, i) => `${i+1}. ${typeof r === 'string' ? r : (r.action || r)}`).join('\n');
  }
  
  navigator.clipboard.writeText(text.trim()).then(() => showToast('✅ 분석 내용이 복사되었습니다!'));
});

// ===== 분석 저장 =====
const HISTORY_KEY = 'messengerAnalysisHistory';

document.getElementById('saveAnalysisBtn')?.addEventListener('click', () => {
  if (!currentAnalysisData) return;
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  const entry = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    imageDataUrl: currentImageDataUrl,
    ...currentAnalysisData,
  };
  history.unshift(entry);
  if (history.length > 30) history.length = 30;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
  showToast('💾 분석 내역이 저장되었습니다!');
});

// ===== 히스토리 렌더링 =====
function renderHistory() {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  
  const list = document.getElementById('historyList');

  if (!history.length) {
    list.innerHTML = '<div class="history-empty" style="text-align:center; color:#aaa; font-size:13px; padding:20px;">저장된 분석 내역이 없습니다</div>';
    return;
  }

  list.innerHTML = history.map(item => {
    const info = item.message_info || item;
    const cls = item.classification || item;
    const dateStr = info.date || '날짜 미확인';
    const thumb = item.imageDataUrl
      ? `<img class="history-thumb" src="${item.imageDataUrl}" alt="썸네일">`
      : `<div class="history-thumb-placeholder">📱</div>`;
    return `
      <div class="history-item" data-id="${item.id}">
        ${thumb}
        <div class="history-info">
          <div class="history-subject">${info.subject || '(제목 없음)'}</div>
          <div class="history-meta">${dateStr} · 발신: ${info.sender || '—'}</div>
          <span class="history-cat">${cls.category || '기타'}</span>
        </div>
        <button class="history-del-btn" data-id="${item.id}" title="삭제">✕</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-del-btn')) return;
      const id = parseInt(el.dataset.id);
      const item = history.find(h => h.id === id);
      if (!item) return;
      if (item.imageDataUrl) {
        screenshotPreview.src = item.imageDataUrl;
        screenshotPreview.style.display = 'block';
        dropZoneInner.style.display = 'none';
        uploadActions.style.display = 'flex';
        currentImageDataUrl = item.imageDataUrl;
        currentImageBase64 = item.imageDataUrl;
      }
      displayAnalysisResult(item);
    });
  });

  list.querySelectorAll('.history-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      const updated = history.filter(h => h.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      renderHistory();
      showToast('🗑️ 삭제되었습니다.');
    });
  });
}

document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
  if (!confirm('분석 내역을 모두 삭제할까요?')) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  showToast('🗑️ 전체 내역이 삭제되었습니다.');
});

renderHistory();

// ==================== 작성 탭 ====================
let selectedTarget = 'COLLEAGUE';

document.querySelectorAll('.target-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.target-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedTarget = btn.dataset.target;
  });
});

const writeGenerateBtn = document.getElementById('writeGenerateBtn');
const writePrompt = document.getElementById('writePrompt');
const writeLoadingMsg = document.getElementById('writeLoadingMsg');
const mockupBody = document.getElementById('mockupBody');

let generatedWriteText = '';

writeGenerateBtn.addEventListener('click', async () => {
  const prompt = writePrompt.value.trim();
  if (!prompt) {
    showToast('⚠️ 전달할 내용을 입력해주세요.');
    return;
  }

  const btnText = writeGenerateBtn.querySelector('.btn-text');
  const btnLoading = writeGenerateBtn.querySelector('.btn-loading');
  writeGenerateBtn.disabled = true;
  btnText.style.display = 'none';
  btnLoading.style.display = 'flex';

  const timer = startLoadingCycle(writeLoadingMsg, LOADING_MESSAGES_MESSENGER_WRITE);

  try {
    const settings = JSON.parse(localStorage.getItem('docAiSettings') || '{}');
    const instruction = getDocInstruction('MESSENGER_WRITE', { 
      messengerTarget: selectedTarget,
      settings: settings
    });
    
    const result = await callGemini(
      API_KEY,
      prompt,
      instruction,
      [],
      MESSENGER_SYSTEM_INSTRUCTION
    );

    generatedWriteText = result.trim();
    displayWriteResult(generatedWriteText);
    showToast('✅ 쪽지가 생성되었습니다!');
  } catch (err) {
    showToast('❌ ' + err.message);
    console.error(err);
  } finally {
    clearInterval(timer);
    writeGenerateBtn.disabled = false;
    btnText.style.display = '';
    btnLoading.style.display = 'none';
  }
});

function displayWriteResult(text) {
  document.getElementById('copyWriteBtn').disabled = false;
  document.getElementById('saveWriteBtn').disabled = false;

  const parts = text.split(/\n---+\n/);
  const mainText = parts[0] || text;
  const tipText = parts[1] ? parts.slice(1).join('\n---\n') : null;

  document.getElementById('writeEmpty').style.display = 'none';
  document.getElementById('writeResultCard').style.display = 'block';

  const targetLabels = { COLLEAGUE: '👩‍🏫 동료 교사', ADMIN: '🏫 관리자/장학사', PARENT: '👨‍👩‍👧 학부모' };
  document.getElementById('writeTargetBadge').textContent = targetLabels[selectedTarget];
  
  const today = new Date();
  document.getElementById('writeGeneratedDate').textContent = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

  document.getElementById('writeGeneratedText').innerHTML = escapeHtml(mainText);

  const tipSection = document.getElementById('writeTipSection');
  if (tipText) {
    document.getElementById('writeTipText').innerHTML = escapeHtml(tipText);
    tipSection.style.display = 'block';
  } else {
    tipSection.style.display = 'none';
  }

  const btnCopy = document.getElementById('btnCopyWriteResult');
  if (btnCopy) {
    btnCopy.onclick = () => {
      navigator.clipboard.writeText(mainText).then(() => {
        showToast('✅ 쪽지 내용이 복사되었습니다!');
      });
    };
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

document.getElementById('copyWriteBtn')?.addEventListener('click', () => {
  if (!generatedWriteText) return;
  navigator.clipboard.writeText(generatedWriteText).then(() => {
    showToast('✅ 쪽지 내용이 복사되었습니다!');
  });
});

const WRITE_HISTORY_KEY = 'messengerWriteHistory';
document.getElementById('saveWriteBtn')?.addEventListener('click', () => {
  if (!generatedWriteText) return;
  const history = JSON.parse(localStorage.getItem(WRITE_HISTORY_KEY) || '[]');
  const targetLabels = { COLLEAGUE: '동료 교사', ADMIN: '관리자/장학사', PARENT: '학부모' };
  history.unshift({
    id: Date.now(),
    savedAt: new Date().toISOString(),
    target: selectedTarget,
    targetLabel: targetLabels[selectedTarget],
    prompt: writePrompt.value.trim(),
    text: generatedWriteText,
  });
  if (history.length > 30) history.length = 30;
  localStorage.setItem(WRITE_HISTORY_KEY, JSON.stringify(history));
  showToast('💾 작성 내역이 저장되었습니다!');
});
