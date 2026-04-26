const guides = {
  setup: {
    tag: '기초 설정',
    title: '처음 사용자를 위한 학교 정보 설정 방법',
    description: 'AI가 학교 상황에 맞는 정확한 문서를 작성할 수 있도록 기초 정보를 설정하는 과정입니다.',
    content: `
      <h2>1. 설정 메뉴 접속하기</h2>
      <p>메인 페이지 상단 유틸리티 바의 <strong>⚙️ 학교 정보 설정</strong> 링크 또는 우측 상단의 <strong>학교 설정</strong> 버튼을 클릭하여 설정 페이지로 이동합니다.</p>
      
      <img src="/guide_setup.png" alt="학교 정보 설정 화면" class="guide-img">

      <h2>2. 필수 정보 입력</h2>
      <p>다음 항목들은 모든 문서 작성의 기초가 되므로 반드시 입력해 주세요.</p>
      <ul>
        <li><strong>학교명</strong>: 공문서 발신 명의 및 문서 제목에 사용됩니다.</li>
        <li><strong>소속/부서</strong>: 내부 결재 라인 및 연락처 정보에 포함됩니다.</li>
        <li><strong>직위/이름</strong>: 기안자 정보로 활용됩니다.</li>
      </ul>

      <div class="tip-box">
        <strong>💡 왜 설정이 중요한가요?</strong>
        AI는 이 정보를 바탕으로 "XX초등학교 제2026-123호"와 같은 문서 번호 체계나, "담임교사 홍길동"과 같은 서명란을 자동으로 구성합니다.
      </div>

      <h2>3. 정보 저장 및 확인</h2>
      <p>하단의 <strong>저장하기</strong> 버튼을 누르면 브라우저의 로컬 저장소(localStorage)에 안전하게 보관됩니다. 한 번 설정해두면 PC를 바꾸지 않는 한 계속 유지됩니다.</p>
    `
  },
  edufine: {
    tag: '문서 작성',
    title: '에듀파인 복잡도(간단/중간/상세) 선택 기준',
    description: '작성하려는 문서의 목적과 성격에 따라 가장 적합한 양식을 선택하는 방법입니다.',
    content: `
      <h2>1. 복잡도 단계별 특징</h2>
      <p>문서 작성 화면에서 세 가지 단계 중 하나를 선택할 수 있습니다.</p>
      
      <img src="/guide_edufine.png" alt="에듀파인 복잡도 선택" class="guide-img">

      <ul>
        <li><strong>간단 (Simple)</strong>: 1~2페이지 분량의 가벼운 공문. 단순 공람, 결과 보고, 단순 안내 등에 적합합니다.</li>
        <li><strong>중간 (Standard)</strong>: 가장 일반적으로 사용되는 사업 계획서 양식입니다. 추진 배경, 목적, 방침, 세부 계획이 포함됩니다.</li>
        <li><strong>상세 (Detailed)</strong>: 예산 내역, 복잡한 시간표, 다수의 항목이 포함된 전문적인 계획서입니다. 대외 기관 발송용으로 추천합니다.</li>
      </ul>

      <div class="tip-box">
        <strong>📌 선택 팁</strong>
        처음에는 '중간' 단계로 작성해 보시고, 내용이 너무 많거나 적다고 느껴지면 단계를 조절하여 다시 생성해 보세요.
      </div>
    `
  },
  hwp: {
    tag: '활용 팁',
    title: 'HWP 붙여넣기 시 서식 유지 방법',
    description: '웹에서 작성된 AI 결과물을 한컴오피스 한글(HWP) 문서로 완벽하게 옮기는 비결입니다.',
    content: `
      <h2>1. 복사 버튼 활용</h2>
      <p>문서 생성 완료 후 우측 상단의 <strong>📋 HWP 복사</strong> 버튼을 클릭합니다. 단순 텍스트가 아닌, 서식 정보가 포함된 HTML 데이터가 클립보드에 복사됩니다.</p>
      
      <img src="/guide_hwp.png" alt="HWP 복사 버튼 위치" class="guide-img">

      <h2>2. 한글(HWP)에 붙여넣기</h2>
      <p>한글 프로그램을 실행하고 <strong>Ctrl + V</strong>를 누릅니다.</p>
      <p>이때 붙여넣기 옵션 창이 뜬다면 <strong>'텍스트 형식으로 붙여넣기'가 아닌 일반 붙여넣기</strong>를 선택해야 표와 글자 모양이 유지됩니다.</p>

      <div class="tip-box">
        <strong>✨ 들여쓰기가 완벽한 이유</strong>
        학교문서AI는 일반 공백 대신 한글 프로그램에서 인식하는 <strong>전각 공백(Full-width space)</strong>을 자동으로 계산하여 삽입합니다. 따라서 별도의 문단 모양 설정 없이도 행정 편람 기준의 들여쓰기가 유지됩니다.
      </div>
    `
  },
  report: {
    tag: '심화 기능',
    title: '파일 첨부로 보고서 자동 생성하기',
    description: '기존에 작성된 계획서를 분석하여 결과 보고서를 단 몇 초 만에 완성하는 기능입니다.',
    content: `
      <h2>1. 계획서 파일 준비</h2>
      <p>이미 작성해 둔 운영 계획서 파일(HWP 내용을 복사한 텍스트 또는 PDF/이미지 등)을 준비합니다.</p>
      
      <h2>2. 보고서 메뉴 진입</h2>
      <p>문서 유형 선택에서 <strong>📈 보고서</strong>를 선택한 후, '파일 업로드' 영역에 계획서 내용을 입력하거나 파일을 드래그합니다.</p>

      <img src="/guide_report.png" alt="보고서 파일 업로드 영역" class="guide-img">

      <div class="tip-box">
        <strong>🔍 AI의 분석 원리</strong>
        AI는 계획서에 명시된 '목적'과 '추진 내용'을 바탕으로, 이미 사업이 완료된 시점의 '결과 보고' 어조로 문장을 자동 변환합니다.
      </div>
    `
  }
};

function renderGuide() {
  const urlParams = new URLSearchParams(window.location.search);
  const guideId = urlParams.get('id') || 'setup';
  const guide = guides[guideId];
  const contentArea = document.getElementById('guideContent');

  if (!guide) {
    contentArea.innerHTML = '<h1>가이드를 찾을 수 없습니다.</h1><p>왼쪽 메뉴에서 다른 가이드를 선택해 주세요.</p>';
    return;
  }

  // 메뉴 활성화 상태 변경
  document.querySelectorAll('.guide-nav a').forEach(link => {
    link.classList.remove('active');
  });
  const activeLink = document.getElementById(`nav-${guideId}`);
  if (activeLink) activeLink.classList.add('active');

  // 콘텐츠 렌더링
  contentArea.innerHTML = `
    <div class="guide-header">
      <span class="guide-tag">${guide.tag}</span>
      <h1>${guide.title}</h1>
      <p>${guide.description}</p>
    </div>
    <div class="guide-body">
      ${guide.content}
    </div>
  `;

  window.scrollTo(0, 0);
}

window.addEventListener('load', renderGuide);
window.addEventListener('popstate', renderGuide);
