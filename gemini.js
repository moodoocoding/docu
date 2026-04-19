// gemini.js — Gemini API 호출 + 시스템 인스트럭션

export const SYSTEM_INSTRUCTION = `
당신은 대한민국 학교 행정 전문가이자 공문서 작성의 달인입니다.
사용자의 요청에 따라 '에듀파인(기안문)', '계획서', '보고서', '가정통신문', '학부모 안내 문자', '지출품의서', '협의회 회의록', '홍보/보도자료'를 작성해야 합니다.

**중요: 출력 형식은 반드시 복사해서 한글(HWP)에 붙여넣었을 때 양식이 유지되도록 깔끔한 HTML 코드로 작성해야 합니다.**
Markdown을 사용하지 말고, <html>, <head> 태그 없이 <body> 내부의 내용만 <div>로 감싸서 출력하세요.
**가장 핵심 규칙**: 엔터(\n) 기호만 쓰면 HTML에서 렌더링될 때 한 줄로 뭉개집니다! 따라서 모든 줄바꿈에는 반드시 <br> 태그를 명시적으로 넣고, 단락이 바뀔 때는 <p style="margin-bottom: 1rem;"> 태그를 적용하세요.

[핵심 작성 및 서식 규칙]
1. 서식:
   - 기본 글자 크기: 13pt (font-size: 13pt;)
   - 줄 간격: 160% (line-height: 1.6;)
   - 글꼴: 돋움체 (font-family: 'Dotum', sans-serif;)
   - 글자 색상: 모든 본문 및 표 내부의 글자 색은 반드시 검정색(#000000)으로 작성하세요.
   - 표(Table): border="1" style="border-collapse: collapse; width: 100%; color: #000000; border: 1px solid black;" 속성 적용.

2. 항목 기호 및 들여쓰기 규칙 (행정업무운영 편람 준수):
   - 1단계: 1., 2., 3., ... (들여쓰기 없음)
   - 2단계: &nbsp;&nbsp;가., &nbsp;&nbsp;나., ... (2타 공백)
   - 3단계: &nbsp;&nbsp;&nbsp;&nbsp;1), &nbsp;&nbsp;&nbsp;&nbsp;2), ... (4타 공백)
   - 4단계: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;가), &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;나), ... (6타 공백)
   - 5단계: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(1), &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(2), ... (8타 공백)
   - 6단계: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(가), &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(나), ... (10타 공백)
   - 7단계: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;①, &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;②, ... (12타 공백)

3. 문체:
   - 공문/계획서/보고서/품의서: 명사형 어미(~ㅁ, ~음, ~함) 개조식.
   - 가정통신문: 격식 합쇼체(~합니다, ~해주십시오). 계절 인사 포함.
   - 메세지(문자): 정중한 해요체/합쇼체. 핵심만 간결하게.

4. 붙임 문서 표기:
   - 1개: 붙임  문서명 1부.  끝. (번호 없음)
   - 2개 이상: 1. 문서명 1부. (번호 나열)

5. 예산표: 계획서/보고서는 표로, 품의서 산출내역은 텍스트로만.
`;

export const LOADING_MESSAGES = [
  "요청하신 내용으로 초안 작성 중...",
  "공문서 표준 번호 체계 및 서식 적용 중...",
  "본문 들여쓰기 및 가독성 최적화 중...",
  "HWP 문서 호환성 검토 및 변환 중...",
  "최종 문서 생성 중. 잠시만 기다려주세요..."
];

export const LOADING_MESSAGES_MESSAGE = [
  "요청하신 내용으로 문자 초안 작성 중...",
  "학부모 대상 어조 및 표현 다듬는 중...",
  "글자 수 및 분량 확인 중...",
  "최종 문자 메시지 생성 중. 잠시만 기다려주세요..."
];

const NUMBERING_RULE = `
[항목 기호 준수사항 및 들여쓰기]
대항목(1., 2.) 하위는 반드시 '가., 나.' -> '1), 2)' -> '가), 나)' 순서 준수.
각 하위 항목으로 넘어갈 때마다 <br>로 줄을 바꾸고 반드시 &nbsp; 기호를 이용해 들여쓰기를 적용하세요.
`;

export function getDocInstruction(type, opts) {
  const y = opts.schoolYear || '2026';
  const gt = opts.gongmunType || 'INTERNAL';
  const gc = opts.complexity || 'MEDIUM';
  const pt = opts.pumuiType || 'GOODS';
  const mt = opts.msgType || 'LMS';
  const pc = opts.pageCount || 2;
  const files = opts.files || [];

  let specific = '';
  let volume = '';

  // 붙임 텍스트
  let attach = '';
  if (files.length === 1) {
    attach = `붙임  ${files[0].name} 1부.  끝.`;
  } else if (files.length > 1) {
    const lines = files.map((f, i) => `${i + 1}. ${f.name} 1부.`);
    lines[lines.length - 1] += '  끝.';
    attach = '붙임  ' + lines.join('<br>      ');
  }

  switch (type) {
    case 'GONGMUN':
      volume = '[분량 지침] A4 1페이지 이내. 핵심만 간결하게, 세부사항은 붙임으로.';
      const isInt = gt === 'INTERNAL';
      let cxInst = '';
      if (gc === 'SIMPLE') {
        cxInst = '구성: 1.관련, 2.시행문구, 붙임만. 세부항목(가,나,다) 생성 금지.';
      } else if (gc === 'MEDIUM') {
        cxInst = '구성: 1.관련, 2.시행문구, 3~4개 항목(가/나/다), 붙임. 각 항목 1줄 이내 요약.';
      } else {
        cxInst = '구성: 1.관련, 2.시행문구, 개요, 행정사항(표 가능), 붙임. 1페이지 내 정리.';
      }
      specific = `작업: [에듀파인 기안문 작성]\n${cxInst}\n수신: ${isInt ? '(내부결재)' : '수신자 참조'}\n글자색 검정 엄수. ${NUMBERING_RULE}\n${attach ? '붙임: ' + attach : ''}\n**중요**: K-에듀파인 기안기에 바로 붙여넣을 본문만 필요합니다. 문서 상단의 '학교명(예: OO초등학교)'이나 하단의 '기관장명(예: OO초등학교장)', 그리고 하단 결재선/푸터(담당자, 시행번호 등)는 **절대로 생성하지 마세요**. 오직 '수신'부터 '끝.'까지만 출력하세요.`;
      break;

    case 'PLAN':
      volume = `[분량] A4 약 ${pc}장 분량이 되도록 내용을 매우 구체적이고 풍성하게 작성하세요.`;
      specific = `작업: [계획서 작성]\n구조: 1.추진배경 2.목적 3.운영방침 4.세부추진계획 5.소요예산(안)(표) 6.기대효과\n제목 아래 창의적 부제. 대항목 하위는 가.,나. 2단계부터 시작. ${NUMBERING_RULE}\n내용이 시각적으로 ${pc}페이지가 되도록 충분히 길게 작성하고, 페이지를 넘길 부분에는 반드시 <hr class="page-break"> 태그를 삽입하여 페이지를 분리하세요.\n**주의**: 문서 끝에 학교명, 작성자 정보(직위/성명), 또는 데이터 출처 등을 절대로 적지 마세요. 기대효과와 '끝.'으로 마무리하세요.`;
      break;

    case 'REPORT':
      volume = `[분량] A4 약 ${pc}장.`;
      specific = `작업: [결과 보고서 작성]\n구조: 1.추진배경 2.목적 3.운영방침 4.세부추진계획(운영결과) 5.소요예산(계획액|집행액|잔액 비교표) 6.기대효과(성과)\n${NUMBERING_RULE}\n**주의**: 문서 끝에 학교명, 작성자, 출처 등을 적지 마세요.`;
      break;

    case 'NEWSLETTER':
      volume = '[분량] A4 1장 내외. 격식 편지글.';
      specific = '작업: [가정통신문 작성]\n어조: 합쇼체. 구조: 제목(중앙) → 계절인사 → 본문 → 맺음말 → 날짜 → 학교장 직인란(직인 생략).';
      break;

    case 'MESSAGE':
      const mn = opts.msgNature || 'INITIAL';
      let natureDesc = '';
      let teacherMode = '';
      let introRule = '';
      
      if (mn === 'INITIAL') {
        natureDesc = '학교에서 학부모 전체 또는 특정 그룹에게 발송하는 공식 안내 문자';
        teacherMode = '정중하고 명확한 학교 공식 어조';
        introRule = '시작할 때 반드시 "[학교명]입니다." 또는 "[학교명]에서 안내드립니다."와 같이 소속을 명확히 밝히세요.';
      } else if (mn === 'REPLY') {
        natureDesc = '학부모의 개별 문의나 민원에 대한 학교 차원의 공식 회신 문자';
        teacherMode = '정중하고 객관적이며 친절한 안내 어조';
        introRule = '시작할 때 반드시 "[학교명]입니다." 또는 "[학교명]에서 문의하신 사항에 대해 답변드립니다."와 같이 소속을 밝히세요.';
      } else if (mn === 'TEACHER_REPLY') {
        natureDesc = '학부모의 개별 연락에 대한 학급 담임 교사의 개인 회신 문자';
        teacherMode = '담임교사로서 학생을 아끼는 따뜻하고 친근하며 정중한 어조';
        introRule = '절대로 시작할 때 "[학교명]입니다."와 같은 딱딱한 공식 소속을 먼저 밝히지 마세요. 대신 "안녕하세요, OO 어머니/아버님. 담임교사 OOO입니다."와 같이 자연스럽고 따뜻한 인사를 먼저 건네세요.';
      }

      let messageFormat = '';
      if (mt === 'SMS') {
        volume = '[분량] 공백 포함 40자(90byte) 이하 엄수. 절대 초과 금지.';
        messageFormat = `작업: [단문 SMS 작성]\n특징: 인사말 최소화, 핵심 용건만 한 줄로. 예: (내용) 감사합니다.`;
      } else if (mt === 'MMS') {
        volume = '[분량] 공백 포함 200자 내외.';
        messageFormat = `작업: [중문 MMS 작성]\n특징: 간단한 인사와 본문 포함.`;
      } else {
        volume = '[분량] 공백 포함 1000자 이내.';
        messageFormat = `작업: [장문 LMS 작성]\n특징: 충분한 상세 설명과 안내처 포함.`;
      }

      specific = `${messageFormat}\n발송 목적 및 화자: ${natureDesc}\n요구되는 어조: ${teacherMode}\n자기소개 규칙: ${introRule}\n**중요 금지 사항**: 문서 하단에 날짜, 학교장 성명(직인 생략), 또는 상세한 학교 주소/전화번호 목록(푸터)을 절대로 적지 마세요. 이는 가정통신문이 아니라 '휴대폰 문자 메시지'입니다. 오직 학부모님께 보낼 '메시지 본문'만 출력하세요.`;
      break;

    case 'PUMUI':
      volume = '[분량] 1페이지 이내.';
      const pumuiLabels = { GOODS: '물품 구입', ALLOWANCE: '수당 지급', BIZ_PROMOTION: '업무추진비(협의회)' };
      specific = `작업: [지출품의서 - ${pumuiLabels[pt]}]\n구성: 1.관련 → 2.시행문구 → 가.내역/대상 나.용도/일시 다.소요예산 라.산출내역(텍스트만, 표 금지)\n붙임: 지출(지급)품의서 1부. 끝.\n${NUMBERING_RULE}`;
      break;

    case 'MEETING_MINUTES':
      volume = '[분량] 1~2페이지.';
      specific = '작업: [협의회 회의록 작성]\n형식: HTML <table> 기반. 구성: 제목(h2 중앙) → 학교명(우측) → 표(일시/장소/출석위원/안건/발언자별내용/서명란). 발언자별 대화 자연스럽게 재구성.';
      break;

    case 'PROMOTION':
      volume = `[분량] 보도자료 A4 ${pc}장 + 하단 SNS 홍보글(짧게).`;
      specific = '작업: [홍보/보도자료 작성]\n표준 보도자료(5W1H) + 관계자 인터뷰 인용구. 문체: ~했다, ~밝혔다. 하단에 [SNS 홍보용 요약] 추가(이모지, #해시태그 3~5개).';
      break;
  }

  const s = opts.settings || {};
  let schoolInfo = '';
  if (s.schoolName) {
    schoolInfo = `\n\n[학교 및 작성자 정보 (본문에 괄호나 빈칸 대신 적극 활용하세요)]
- 학교명: ${s.schoolName || ''}
- 소속 교육청: ${s.eduOffice || ''}
- 학교 주소: ${s.schoolAddr || ''}
- 대표 전화번호: ${s.schoolPhone || ''}
- 담당자(작성자) 성명: ${s.staffName || ''}
- 담당자 직위: ${s.staffTitle || ''}
- 담당자 직통번호: ${s.staffPhone || ''}
- 홈페이지: ${s.schoolWeb || ''}`;
  }

  const common = `[기본 설정] 학년도: ${y}학년도${schoolInfo}`;
  return `${specific}\n${volume}\n${common}`;
}

export async function callGemini(apiKey, promptContext, docInstruction, fileDataList) {
  const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
  let lastError = '';

  const parts = [];

  // 파일 첨부
  for (const fd of fileDataList) {
    parts.push({
      inlineData: {
        data: fd.base64.split(',')[1],
        mimeType: fd.mimeType
      }
    });
  }

  parts.push({
    text: `${docInstruction}\n\n[입력 정보 및 요청사항]:\n${promptContext}`
  });

  for (const model of models) {
    try {
      console.log(`Trying model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0.3 }
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        lastError = errJson.error?.message || `API Error ${res.status}`;
        console.warn(`Model ${model} failed:`, lastError);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      if (text) return text;
    } catch (e) {
      if (e.name === 'AbortError') {
        lastError = '요청 시간이 초과되었습니다(60초). 잠시 후 다시 시도해 주세요.';
      } else {
        lastError = e.message;
      }
      console.warn(`Model ${model} error:`, e);
    }
  }

  throw new Error(lastError || 'AI 문서 생성 중 오류가 발생했습니다. API 키를 확인해주세요.');
}
