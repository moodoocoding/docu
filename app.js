import { supabase } from './supabase.js';
import { getDocInstruction, callGemini, LOADING_MESSAGES, LOADING_MESSAGES_MESSAGE } from './gemini.js';
import { copyHtmlForHwp, downloadMarkdown, printDocument } from './export.js';

// app.js — 메인 UI 로직: 폼 전환, 이벤트, AI 호출 연결

(function() {
  // URL 파라미터로 문서 유형 결정
  const params = new URLSearchParams(location.search);
  const docType = params.get('type') || 'GONGMUN';

  const DOC_META = {
    GONGMUN: { name: '에듀파인', desc: '내부결재/외부발송 공문서를 AI가 자동 작성합니다', placeholder: '내부결재 예시:\n[목적] 5학년 1학기 현장체험학습 실시 계획\n[일시/장소] 5월 12일 / 국립중앙과학관\n\n외부발송 예시:\n[목적] 2026년 디지털 선도학교 교원 역량 강화 연수 강사 초빙\n[일시/장소] 4월 20일 / 본교 회의실' },
    PLAN: { name: '계획서', desc: '운영 계획서를 구조화된 양식으로 자동 작성합니다', placeholder: '[계획명] 유용한 학교 앱 제작 교사학습공동체 연간 운영 계획\n[운영기간] 4월 ~ 12월\n[주요활동] 생성형 AI 활용 학급 관리 앱 제작, 에듀테크 도구 실습\n[기대효과] 교사 디지털 역량 강화 및 업무 경감' },
    REPORT: { name: '보고서', desc: '결과 보고서를 계획서 기반으로 자동 작성합니다', placeholder: '[보고서명] 5학년 질문기반학습(QBE) 및 학생 주도 디지털 콘텐츠 제작 1학기 결과\n[형식] 개조식 요약\n[구성내용] 설계 - 적용 - 사례 종합 - 나눔 (4단계 구조로 체계화)' },
    NEWSLETTER: { name: '가정통신문', desc: '학부모 대상 공식 안내문을 자동 작성합니다', placeholder: '[주제] 다채움 선도학교 운영 안내\n[목적] 학생 자기주도적 성장 지원 및 디지털 포트폴리오 구축' },
    MESSAGE: { name: '학부모 문자', desc: 'SMS/LMS 알림 문자를 자동 작성합니다', placeholder: '[수신] 5학년 1반 학부모\n[주요내용] 내일(목) 오전 10시 학부모 총회 및 공개수업 (교실)' },
    PUMUI: { name: '지출품의서', desc: '내부 기안용 지출품의서를 자동 작성합니다', placeholder: '[예산과목] 디지털 선도학교 운영비\n[구매품목] 태블릿 거치대 25개, 고속 충전 케이블\n[금액] 총 50만 원 이내\n[목적] 디지털 교과서 및 에듀테크 활용 수업 환경 구축' },
    MEETING_MINUTES: { name: '협의회 회의록', desc: '회의록을 표 형식으로 자동 작성합니다', placeholder: '[회의명] 5학년 학년협의회\n[안건 1] 1학기 지필평가 일정 조정 (결정사항: 6월 3주차로 연기)\n[안건 2] 다채움 플랫폼 활용 방안 (결정사항: 학급별 주 1회 이상 필수 활용)\n[요청사항] 회의록 기본 양식에 맞춰 깔끔하게 정리' },
    PROMOTION: { name: '보도자료', desc: '보도자료 + SNS 홍보글을 동시 생성합니다', placeholder: '[주제] AI 시대, 교실의 변화와 교사의 찐 역할\n[대상] 예비 교사\n[핵심내용] 에듀테크 도구 활용법, 교사의 디지털 퍼실리테이터 역할\n[요청사항] 시선을 끄는 캐치프레이즈 형태의 제목 포함' }
  };

  const meta = DOC_META[docType] || DOC_META.GONGMUN;

  // 토스트 유틸리티 (export.js에서 가져온 것 외에 내부용)
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  // 헤더 초기화
  document.getElementById('typeBadge').textContent = meta.name;
  document.getElementById('formTitle').textContent = meta.name + ' 작성';
  document.getElementById('formDesc').textContent = meta.desc;
  
  const promptTextArea = document.getElementById('promptText');
  if (promptTextArea) {
    if (docType === 'MESSAGE') {
      const mn = document.querySelector('input[name="msgNature"]:checked')?.value;
      if (mn === 'REPLY') {
        promptTextArea.placeholder = "학부모님이 보내신 내용을 붙여주세요, 추가적으로 넣고 싶은 내용을 작성해 주세요.";
      } else if (mn === 'TEACHER_REPLY') {
        promptTextArea.placeholder = "[학부모님 메시지] 내일 상담 가능한가요?\n[추가 요청] 오전 10시는 수업 중이라 오후 3시 이후로 가능하다는 내용을 담임교사로서 친절하게 전달해줘.";
      } else {
        promptTextArea.placeholder = meta.placeholder || '';
      }
    } else if (meta.placeholder) {
      promptTextArea.placeholder = meta.placeholder;
    }
  }

  // nav 활성화
  document.querySelectorAll('nav a').forEach(a => {
    if (a.href.includes('type=' + docType)) a.classList.add('active');
  });

  // 문서 유형별 필드 표시/숨기기
  const gongmunFields = document.querySelectorAll('.gongmun-field');
  const pageField = document.querySelector('.page-field');
  const pumuiField = document.querySelector('.pumui-field');
  const messageFields = document.querySelectorAll('.message-field');

  if (gongmunFields) gongmunFields.forEach(f => f.style.display = docType === 'GONGMUN' ? '' : 'none');
  if (pageField) pageField.style.display = ['PLAN','REPORT','PROMOTION'].includes(docType) ? '' : 'none';
  if (pumuiField) pumuiField.style.display = docType === 'PUMUI' ? '' : 'none';
  if (messageFields) messageFields.forEach(f => f.style.display = docType === 'MESSAGE' ? '' : 'none');

  // 미리보기 초기 상태 설정
  const a4Preview = document.getElementById('a4Preview');
  const phonePreview = document.getElementById('phonePreview');
  const previewTitle = document.getElementById('previewTitle');

  if (docType === 'MESSAGE') {
    if (a4Preview) a4Preview.style.display = 'none';
    if (phonePreview) phonePreview.style.display = 'flex';
    if (previewTitle) previewTitle.textContent = '📱 문자 미리보기';
  } else {
    if (a4Preview) a4Preview.style.display = 'block';
    if (phonePreview) phonePreview.style.display = 'none';
    if (previewTitle) previewTitle.textContent = '📄 문서 미리보기';
  }

  // 복잡도 버튼
  document.querySelectorAll('.complexity-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.complexity-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 문자 발송 구분 변경 시 placeholder 대응
  document.querySelectorAll('input[name="msgNature"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (docType === 'MESSAGE' && radio.checked) {
        if (radio.value === 'REPLY') {
          promptTextArea.placeholder = "학부모님이 보내신 내용을 붙여주세요, 추가적으로 넣고 싶은 내용을 작성해 주세요.";
        } else if (radio.value === 'TEACHER_REPLY') {
          promptTextArea.placeholder = "[학부모님 메시지] 내일 상담 가능한가요?\n[추가 요청] 오전 10시는 수업 중이라 오후 3시 이후로 가능하다는 내용을 담임교사로서 친절하게 전달해줘.";
        } else {
          promptTextArea.placeholder = meta.placeholder;
        }
      }
    });
  });

  // 페이지 카운트 슬라이더
  const pageSlider = document.getElementById('pageCount');
  const pageVal = document.getElementById('pageVal');
  if (pageSlider) {
    pageSlider.addEventListener('input', () => {
      pageVal.textContent = pageSlider.value + '장';
    });
  }

  // 파일 첨부
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');
  let attachedFiles = []; // { file, base64, mimeType, name }

  if (fileInput) {
    fileInput.addEventListener('change', handleFiles);
    const fileDrop = document.getElementById('fileDrop');
    if (fileDrop) {
      fileDrop.addEventListener('drop', e => {
        e.preventDefault();
        fileInput.files = e.dataTransfer.files;
        handleFiles();
      });
      fileDrop.addEventListener('dragover', e => e.preventDefault());
    }
  }

  function handleFiles() {
    const newFiles = Array.from(fileInput.files);
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        attachedFiles.push({ file, base64: reader.result, mimeType: file.type, name: file.name });
        renderFileList();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderFileList() {
    fileList.innerHTML = attachedFiles.map((f, i) =>
      `<div class="file-item"><span>📎 ${f.name}</span><button class="remove-file-btn" data-idx="${i}">✕</button></div>`
    ).join('');
    
    // 삭제 버튼 이벤트 바인딩
    fileList.querySelectorAll('.remove-file-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        attachedFiles.splice(idx, 1);
        renderFileList();
      });
    });
  }

  // 설정에서 API 키 가져오기 (일단 localStorage 우선, 추후 Supabase 연동)


  // 생성된 HTML 저장
  let generatedHtml = '';

  // AI 문서 생성
  const generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    const btnText = generateBtn.querySelector('.btn-text');
    const btnLoading = generateBtn.querySelector('.btn-loading');
    const loadingMsg = document.getElementById('loadingMsg');

    generateBtn.addEventListener('click', async () => {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      if (!apiKey) {
        showToast('⚠️ 서버 설정에 Gemini API 키가 누락되었습니다. (.env 확인 필요)');
        return;
      }

      const prompt = document.getElementById('promptText').value.trim();
      if (!prompt) {
        showToast('⚠️ 작성 요청 내용을 입력해주세요.');
        return;
      }

      // 옵션 수집
      const settings = JSON.parse(localStorage.getItem('schoolDocSettings') || '{}');
      const opts = {
        schoolYear: document.getElementById('schoolYear').value,
        gongmunType: document.querySelector('input[name="gongmunType"]:checked')?.value,
        complexity: document.querySelector('.complexity-btn.active')?.dataset.val || 'MEDIUM',
        pageCount: parseInt(document.getElementById('pageCount')?.value || '2'),
        pumuiType: document.getElementById('pumuiType')?.value,
        msgType: document.querySelector('input[name="msgType"]:checked')?.value,
        msgNature: document.querySelector('input[name="msgNature"]:checked')?.value,
        files: attachedFiles,
        settings: settings
      };

      const instruction = getDocInstruction(docType, opts);

      // UI: 로딩 시작
      generateBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoading.style.display = 'flex';

      let msgIdx = 0;
      const activeMessages = docType === 'MESSAGE' ? LOADING_MESSAGES_MESSAGE : LOADING_MESSAGES;
      loadingMsg.textContent = activeMessages[0];
      const msgTimer = setInterval(() => {
        msgIdx = (msgIdx + 1) % activeMessages.length;
        loadingMsg.textContent = activeMessages[msgIdx];
      }, 2000);

      try {
        const result = await callGemini(apiKey, prompt, instruction, attachedFiles);

        // HTML 정리: ```html ... ``` 래핑 제거
        generatedHtml = result
          .replace(/^```html?\s*/i, '')
          .replace(/```\s*$/, '')
          .trim();

        // 미리보기 렌더링
        if (docType === 'MESSAGE') {
          const cleanText = generatedHtml.replace(/<[^>]*>/g, '').trim();
          const byteLen = new TextEncoder().encode(cleanText).length;
          const charLen = cleanText.length;
          
          document.getElementById('a4Preview').style.display = 'none';
          document.getElementById('phonePreview').style.display = 'flex';
          document.getElementById('phoneContent').innerHTML = `
            <div class="msg-bubble msg-sent">
              <div class="msg-text-content">${generatedHtml}</div>
              <div class="msg-footer">
                <div class="char-counter">${charLen}자 / ${byteLen}byte</div>
                <button class="msg-copy-btn" id="btnCopyMsg" title="메시지 복사">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <span>복사</span>
                </button>
              </div>
            </div>
          `;

          // 메시지 전용 복사 버튼 이벤트
          document.getElementById('btnCopyMsg')?.addEventListener('click', () => {
            const textToCopy = document.querySelector('.msg-text-content').innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
              showToast('✅ 메시지가 복사되었습니다!');
            });
          });

          document.getElementById('previewTitle').textContent = '📱 문자 미리보기';
        } else {
          document.getElementById('a4Preview').style.display = 'block';
          document.getElementById('phonePreview').style.display = 'none';
          document.getElementById('previewContent').innerHTML = generatedHtml;
          document.getElementById('previewTitle').textContent = '📄 문서 미리보기';
        }

        // 액션 버튼 활성화
        document.getElementById('btnCopyHwp').disabled = false;
        document.getElementById('btnDownloadMd').disabled = false;
        document.getElementById('btnPrint').disabled = false;

        // 히스토리 저장 (Supabase)
        await saveToSupabase(docType, meta.name, prompt, generatedHtml);

        showToast('✅ 문서가 생성되었습니다!');
      } catch (err) {
        showToast('❌ ' + err.message);
        console.error(err);
      } finally {
        clearInterval(msgTimer);
        generateBtn.disabled = false;
        btnText.style.display = '';
        btnLoading.style.display = 'none';
      }
    });
  }

  // 액션 버튼 이벤트
  document.getElementById('btnCopyHwp')?.addEventListener('click', () => {
    if (generatedHtml) copyHtmlForHwp(generatedHtml);
  });

  document.getElementById('btnDownloadMd')?.addEventListener('click', () => {
    if (generatedHtml) {
      const title = document.getElementById('promptText').value.slice(0, 20);
      downloadMarkdown(generatedHtml, docType, title);
    }
  });

  document.getElementById('btnPrint')?.addEventListener('click', printDocument);

  // Supabase에 저장
  async function saveToSupabase(type, typeName, prompt, html) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { error } = await supabase
        .from('documents')
        .insert([{
          type,
          type_name: typeName,
          prompt,
          html,
          preview: prompt.slice(0, 60),
          user_id: user.id
        }]);

      if (error) throw error;
      
      // 로컬 스토리지에도 백업 (선택 사항)
      const history = JSON.parse(localStorage.getItem('docHistory') || '[]');
      history.unshift({
        id: Date.now(),
        type, typeName, prompt,
        html,
        date: new Date().toISOString(),
        preview: prompt.slice(0, 60)
      });
      if (history.length > 50) history.length = 50;
      localStorage.setItem('docHistory', JSON.stringify(history));
      
    } catch (e) {
      console.error('Supabase 저장 실패:', e);
      showToast('⚠️ DB 저장에 실패했습니다. (로컬에만 저장됨)');
    }
  }

})();
