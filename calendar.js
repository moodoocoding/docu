// calendar.js — 학사일정 핵심 로직

const SUBJECTS = [
    "국어", "사회", "도덕", "수학", "과학", "실과", "체육", "음악", "미술", "영어", "자율", "동아리", "진로", "학교자율시간"
];

// 과목별 기본 목표 시수 (저장된 값이 없으면 기본값 사용)
const DEFAULT_TARGET_HOURS = {
    "국어": 172, "사회": 102, "도덕": 34, "수학": 136, "과학": 102, "실과": 68, "체육": 102, "음악": 68, "미술": 68, "영어": 102, 
    "자율": 85, "동아리": 15, "진로": 4, "학교자율시간": 32
};

let TARGET_HOURS = JSON.parse(localStorage.getItem('academic_target_hours')) || DEFAULT_TARGET_HOURS;

let currentSchedule = JSON.parse(localStorage.getItem('academic_schedule') || '{}');
let activePeriodIndex = 0; // 0: 3.2~4.25, 1: 4.27~6.20 ...

const PERIOD_RANGES = [
    { start: '2026-03-02', end: '2026-04-25', label: '3.2~4.25' },
    { start: '2026-04-27', end: '2026-06-20', label: '4.27~6.20' },
    { start: '2026-06-22', end: '2026-08-15', label: '6.22~8.15' },
    { start: '2026-08-17', end: '2026-10-10', label: '8.17~10.10' },
    { start: '2026-10-12', end: '2026-12-05', label: '10.12~12.5' },
    { start: '2026-12-07', end: '2027-01-30', label: '12.7~1.30' },
    { start: '2027-02-01', end: '2027-02-27', label: '2.1~2.27' }
];

// 초기화
document.addEventListener('DOMContentLoaded', () => {
    renderStatsTable();
    renderTabs();
    renderTimetable();
    initModal();
});

// --- 통계표 렌더링 ---
function renderStatsTable() {
    const thead = document.getElementById('statsHeader');
    const body = document.getElementById('statsBody');
    
    // 이중 헤더 생성
    thead.innerHTML = `
        <tr>
            <th rowspan="2">구분</th>
            <th colspan="10">교과</th>
            <th colspan="4">창의적 체험활동</th>
            <th rowspan="2">학교자율<br>시간</th>
            <th rowspan="2" class="total-col">합 계</th>
        </tr>
        <tr>
            <th>국어</th><th>사회</th><th>도덕</th><th>수학</th><th>과학</th><th>실과</th><th>체육</th><th>음악</th><th>미술</th><th>영어</th>
            <th style="background:#f0f9ff">창체(계)</th><th>자율</th><th>동아리</th><th>진로</th>
        </tr>
    `;
    
    const currentStats = calculateStats();
    
    const rowConfigs = [
        { label: '1학기 시수', key: 'sem1', data: currentStats.sem1 },
        { label: '2학기 시수', key: 'sem2', data: currentStats.sem2 },
        { label: '연간 합계', key: 'yearly', data: currentStats.yearly },
        { label: '(교육과정 기준)', key: 'target', data: TARGET_HOURS },
        { label: '연간 증감', key: 'diff', data: currentStats.diff }
    ];

    body.innerHTML = rowConfigs.map(row => {
        let total = 0;
        
        // 교과 (10개)
        const gyoqua = ["국어", "사회", "도덕", "수학", "과학", "실과", "체육", "음악", "미술", "영어"].map(s => {
            const val = row.data[s] || 0;
            total += val;
            return `<td>${val}</td>`;
        }).join('');

        // 창체 (계 + 하위 3개)
        const changcheSub = ["자율", "동아리", "진로"];
        const changcheSum = changcheSub.reduce((acc, s) => acc + (row.data[s] || 0), 0);
        total += changcheSum;
        const changcheCells = `<td style="background:#f0f9ff; font-weight:700;">${changcheSum}</td>` + 
            changcheSub.map(s => `<td>${row.data[s] || 0}</td>`).join('');

        // 학교자율시간
        const schoolAuto = row.data["학교자율시간"] || 0;
        total += schoolAuto;
        const schoolAutoCell = `<td>${schoolAuto}</td>`;

        const isDiff = row.key === 'diff';
        return `<tr class="${isDiff ? 'diff-row' : ''}">
            <td style="font-weight:700;">${row.label}</td>
            ${gyoqua}${changcheCells}${schoolAutoCell}
            <td class="total-col">${total}</td>
        </tr>`;
    }).join('');
}

function calculateStats() {
    const sem1 = {};
    const sem2 = {};
    const yearly = {};
    const SEMESTER_2_START = '2026-08-05';
    
    SUBJECTS.forEach(s => {
        sem1[s] = 0;
        sem2[s] = 0;
        yearly[s] = 0;
    });
    
    Object.entries(currentSchedule).forEach(([key, sub]) => {
        if (yearly[sub] !== undefined) {
            const dateStr = key.substring(0, 10); // YYYY-MM-DD
            if (dateStr < SEMESTER_2_START) {
                sem1[sub]++;
            } else {
                sem2[sub]++;
            }
            yearly[sub]++;
        }
    });
    
    const diff = {};
    SUBJECTS.forEach(s => {
        diff[s] = yearly[s] - (TARGET_HOURS[s] || 0);
    });
    
    return { sem1, sem2, yearly, diff };
}

// --- 탭 렌더링 ---
function renderTabs() {
    const container = document.getElementById('periodTabs');
    container.innerHTML = PERIOD_RANGES.map((range, idx) => `
        <button class="tab-btn ${idx === activePeriodIndex ? 'active' : ''}" onclick="changePeriod(${idx})">
            ${range.label}
        </button>
    `).join('');
}

function changePeriod(idx) {
    activePeriodIndex = idx;
    renderTabs();
    renderTimetable();
}
window.changePeriod = changePeriod;

// --- 시간표 렌더링 ---
function renderTimetable() {
    const container = document.getElementById('timetableGrid');
    container.innerHTML = '';
    
    const range = PERIOD_RANGES[activePeriodIndex];
    let currentDate = new Date(range.start);
    const endDate = new Date(range.end);
    
    // 학기 시작일(3월 2일)로부터 몇 주 지났는지 계산 (누적 주수)
    const semesterStart = new Date('2026-03-02');
    const diffTime = Math.max(0, currentDate - semesterStart);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let weekNum = Math.floor(diffDays / 7) + 1;
    let renderedWeeks = 0;
    
    // 8주씩 표시 (또는 범위 내 전체)
    while (currentDate <= endDate && renderedWeeks < 8) {
        const weekCard = document.createElement('div');
        weekCard.className = 'week-card';
        
        // 주의 시작(월)과 끝(토) 계산
        const weekStart = new Date(currentDate);
        const weekEnd = new Date(currentDate);
        weekEnd.setDate(weekEnd.getDate() + 5); // 토요일까지
        
        const dateLabel = `${weekStart.getMonth()+1}.${weekStart.getDate()}~${weekEnd.getMonth()+1}.${weekEnd.getDate()}`;
        
        weekCard.innerHTML = `
            <div class="week-header">${weekNum}주(${dateLabel})</div>
            <table class="week-table">
                <thead>
                    <tr>
                        <th style="width:24px;"></th>
                        <th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th class="day-sat">토</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from({length: 10}).map((_, p) => `
                        <tr>
                            <td class="period-num">${p+1}</td>
                            ${Array.from({length: 6}).map((_, d) => {
                                const targetDate = new Date(weekStart);
                                targetDate.setDate(targetDate.getDate() + d);
                                const dateStr = targetDate.toISOString().split('T')[0];
                                const key = `${dateStr}-${p+1}`;
                                const subject = currentSchedule[key] || '';
                                
                                // 특수 날짜 체크 (일요일 등은 여기 없지만, 이미지에 맞춰 토요일 등 처리)
                                let cellClass = 'subject-cell';
                                if (d === 5) cellClass += ' cell-sat-bg';
                                
                                return `<td class="${cellClass}" onclick="openSubjectModal('${key}')">${subject}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.appendChild(weekCard);
        
        // 다음 주로 이동
        currentDate.setDate(currentDate.getDate() + 7);
        weekNum++;
        renderedWeeks++;
    }
}

// --- 모달 로직 ---
let targetCellKey = null;

function initModal() {
    const palette = document.getElementById('subjectPalette');
    
    const gyoqua = ["국어", "사회", "도덕", "수학", "과학", "실과", "체육", "음악", "미술", "영어"];
    const changche = ["자율", "동아리", "진로"];
    const others = ["학교자율시간"];

    let html = '<div class="palette-group"><h4>교과</h4><div class="palette-grid">';
    html += gyoqua.map(s => `<button class="palette-btn" onclick="selectSubject('${s}')">${s}</button>`).join('');
    html += '</div></div>';

    html += '<div class="palette-group"><h4>창의적 체험활동</h4><div class="palette-grid">';
    html += changche.map(s => `<button class="palette-btn" onclick="selectSubject('${s}')">${s}</button>`).join('');
    html += '</div></div>';

    html += '<div class="palette-group"><h4>기타</h4><div class="palette-grid">';
    html += others.map(s => `<button class="palette-btn" onclick="selectSubject('${s}')">${s}</button>`).join('');
    html += `<button class="palette-btn" style="color:red" onclick="selectSubject('')">지우기</button>`;
    html += '</div></div>';

    palette.innerHTML = html;
    palette.className = 'palette-container';
    
    document.getElementById('closeModal').onclick = () => {
        document.getElementById('subjectModal').classList.remove('show');
    };
    
    document.getElementById('addCustomSubject').onclick = () => {
        const sub = document.getElementById('customSubject').value.trim();
        if (sub) selectSubject(sub);
    };
}

function openSubjectModal(key) {
    targetCellKey = key;
    document.getElementById('subjectModal').classList.add('show');
}
window.openSubjectModal = openSubjectModal;

function selectSubject(subject) {
    if (targetCellKey) {
        if (subject) {
            currentSchedule[targetCellKey] = subject;
        } else {
            delete currentSchedule[targetCellKey];
        }
        localStorage.setItem('academic_schedule', JSON.stringify(currentSchedule));
        renderStatsTable();
        renderTimetable();
    }
    document.getElementById('subjectModal').classList.remove('show');
    showToast(subject ? `${subject} 편성됨` : '삭제됨');
}
window.selectSubject = selectSubject;

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(100px)';
    }, 2000);
}

// --- 템플릿 모달 로직 ---
function initTemplateModal() {
    const table = document.getElementById('templateTable');
    table.innerHTML = `
        <thead>
            <tr><th>교시</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th></tr>
        </thead>
        <tbody>
            ${Array.from({length: 7}).map((_, p) => `
                <tr>
                    <td class="period-num">${p+1}</td>
                    ${Array.from({length: 5}).map((_, d) => `
                        <td class="template-cell" data-day="${d+1}" data-period="${p+1}" onclick="openTemplateSubjectSelect(this)" style="border:1px solid #ddd; height:40px; cursor:pointer;"></td>
                    `).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;

    document.getElementById('closeTemplate').onclick = () => {
        document.getElementById('templateModal').classList.remove('show');
    };

    document.getElementById('applyTemplate').onclick = applyTemplateToSchedule;
}

let activeTemplateCell = null;

function openTemplateSubjectSelect(cell) {
    activeTemplateCell = cell;
    targetCellKey = 'TEMPLATE'; // 플래그
    document.getElementById('subjectModal').classList.add('show');
}
window.openTemplateSubjectSelect = openTemplateSubjectSelect;

function applyTemplateToSchedule() {
    if (!confirm('설정된 시간표를 1년 전체 일정에 일괄 적용하시겠습니까?\n(기존에 입력된 데이터가 모두 덮어씌워집니다)')) return;

    const template = {};
    document.querySelectorAll('.template-cell').forEach(cell => {
        const sub = cell.innerText;
        if (sub) {
            template[`${cell.dataset.day}-${cell.dataset.period}`] = sub;
        }
    });

    // 모든 날짜 순회하며 적용 (2026.03.02 ~ 2027.02.28)
    const start = new Date('2026-03-02');
    const end = new Date('2027-02-28'); // 다음해 2월까지가 1개 학년도
    let curr = new Date(start);

    while (curr <= end) {
        const day = curr.getDay(); // 0:일, 1:월, 2:화, 3:수, 4:목, 5:금, 6:토
        if (day >= 1 && day <= 5) {
            for (let p = 1; p <= 7; p++) {
                const sub = template[`${day}-${p}`];
                if (sub) {
                    const dateStr = curr.toISOString().split('T')[0];
                    currentSchedule[`${dateStr}-${p}`] = sub;
                }
            }
        }
        curr.setDate(curr.getDate() + 1);
    }

    localStorage.setItem('academic_schedule', JSON.stringify(currentSchedule));
    renderStatsTable();
    renderTimetable();
    document.getElementById('templateModal').classList.remove('show');
    showToast('기본 시간표가 연간 일정에 일괄 적용되었습니다.');
}

// 기존 selectSubject 확장
const originalSelectSubject = window.selectSubject;
window.selectSubject = (subject) => {
    if (targetCellKey === 'TEMPLATE' && activeTemplateCell) {
        activeTemplateCell.innerText = subject;
        activeTemplateCell.style.background = '#f0f9ff';
        document.getElementById('subjectModal').classList.remove('show');
        return;
    }
    originalSelectSubject(subject);
};

// --- 시수 편제 모달 로직 ---
function initAllocationModal() {
    const container = document.getElementById('allocationList');
    
    // 모달 너비 조정 (테이블을 위해 넓게)
    document.querySelector('#allocationModal .modal').style.maxWidth = '1200px';

    const gyoqua = ["국어", "사회", "도덕", "수학", "과학", "실과", "체육", "음악", "미술", "영어"];
    const changche = ["자율", "동아리", "진로"];

    container.innerHTML = `
        <table class="stats-table" style="width:100%; border-collapse:collapse; font-size:12px; text-align:center;">
            <thead>
                <tr style="background:#f1f5f9;">
                    <th colspan="10" style="border:1px solid #ddd; padding:8px;">교과</th>
                    <th colspan="3" style="border:1px solid #ddd; padding:8px;">창의적 체험활동</th>
                    <th style="border:1px solid #ddd; padding:8px;">기타</th>
                </tr>
                <tr style="background:#fff;">
                    ${gyoqua.map(s => `<th style="border:1px solid #ddd; padding:6px;">${s}</th>`).join('')}
                    ${changche.map(s => `<th style="border:1px solid #ddd; padding:6px;">${s}</th>`).join('')}
                    <th style="border:1px solid #ddd; padding:6px;">학교자율시간</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    ${gyoqua.map(s => `
                        <td style="border:1px solid #ddd; padding:4px;">
                            <input type="number" class="allocation-input" data-subject="${s}" value="${TARGET_HOURS[s] || 0}" 
                                   style="width:100%; border:none; text-align:center; padding:4px; font-family:inherit;">
                        </td>
                    `).join('')}
                    ${changche.map(s => `
                        <td style="border:1px solid #ddd; padding:4px;">
                            <input type="number" class="allocation-input" data-subject="${s}" value="${TARGET_HOURS[s] || 0}" 
                                   style="width:100%; border:none; text-align:center; padding:4px; font-family:inherit;">
                        </td>
                    `).join('')}
                    <td style="border:1px solid #ddd; padding:4px;">
                        <input type="number" class="allocation-input" data-subject="학교자율시간" value="${TARGET_HOURS["학교자율시간"] || 0}" 
                               style="width:100%; border:none; text-align:center; padding:4px; font-family:inherit;">
                    </td>
                </tr>
            </tbody>
        </table>
    `;

    document.getElementById('closeAllocation').onclick = () => {
        document.getElementById('allocationModal').classList.remove('show');
    };

    document.getElementById('saveAllocation').onclick = () => {
        const newTargets = {};
        document.querySelectorAll('.allocation-input').forEach(input => {
            newTargets[input.dataset.subject] = parseInt(input.value) || 0;
        });
        TARGET_HOURS = newTargets;
        localStorage.setItem('academic_target_hours', JSON.stringify(TARGET_HOURS));
        renderStatsTable();
        document.getElementById('allocationModal').classList.remove('show');
        showToast('시수 편제 기준이 저장되었습니다.');
    };
}

// --- 파일 업로드 분석 로직 ---
const SUBJECT_ALIASES = {
    "창체": "자율",
    "창의적체험활동": "자율",
    "창의적 체험활동": "자율",
    "창체자율": "자율",
    "창체 자율": "자율",
    "자율활동": "자율",
    "동아리활동": "동아리",
    "진로활동": "진로",
    "학교 자율 시간": "학교자율시간",
    "학교자율": "학교자율시간",
    "학교자율 시간": "학교자율시간"
};

function normalizeSubjectName(value) {
    if (value === null || value === undefined) return '';
    const subject = String(value).trim();
    if (!subject) return '';
    return SUBJECT_ALIASES[subject] || subject;
}

function extractJsonObject(responseText) {
    if (responseText.includes('```')) {
        const fenced = responseText.match(/```(?:json)?([\s\S]*?)```/);
        if (fenced) return fenced[1].trim();
    }

    const start = responseText.indexOf('{');
    const end = responseText.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return responseText.slice(start, end + 1);
    }

    return responseText.trim();
}

function normalizeSchedule(rawSchedule) {
    const cleanedSchedule = {};
    const entries = Array.isArray(rawSchedule)
        ? rawSchedule.map(item => [`${item.date}-${item.period}`, item.subject])
        : Object.entries(rawSchedule || {});

    entries.forEach(([key, value]) => {
        const match = String(key).match(/^(\d{4}-\d{2}-\d{2})-(\d{1,2})$/);
        if (!match) return;

        const period = Number(match[2]);
        const subject = normalizeSubjectName(value);
        if (period < 1 || period > 10 || !subject) return;

        cleanedSchedule[`${match[1]}-${period}`] = subject;
    });

    return cleanedSchedule;
}

function normalizeAllocation(rawAllocation) {
    const cleanedAllocation = {};

    Object.entries(rawAllocation || {}).forEach(([subject, value]) => {
        const normalizedSubject = normalizeSubjectName(subject);
        const hours = Number.parseInt(value, 10);

        if (SUBJECTS.includes(normalizedSubject) && Number.isFinite(hours)) {
            cleanedAllocation[normalizedSubject] = hours;
        }
    });

    return cleanedAllocation;
}

async function analyzeFile(file) {
    if (!file) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key') || '';

    showToast('파일 분석 중... 잠시만 기다려주세요.');
    
    try {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        const docInst = window.getDocInstruction('CALENDAR_ANALYZE', { settings: {} });
        const responseText = await window.callGemini(apiKey, "첨부한 연간 시간표 PDF를 분석하세요. 상단/하단의 시수 편제표는 allocation에, 월별/주별 날짜 칸의 실제 시간표는 schedule에 채우세요. schedule 키는 반드시 YYYY-MM-DD-교시 형식으로 만들고, 교시는 1~10 범위만 사용하세요.", docInst, [{ base64, mimeType: file.type }]);
        console.log("AI Response Raw:", responseText);
        
        const jsonStr = extractJsonObject(responseText);
        const data = JSON.parse(jsonStr);
        console.log("Parsed Data:", data);

        if (data.schedule) {
            const cleanedSchedule = normalizeSchedule(data.schedule);
            currentSchedule = { ...currentSchedule, ...cleanedSchedule };
            localStorage.setItem('academic_schedule', JSON.stringify(currentSchedule));
        }
        if (data.allocation) {
            TARGET_HOURS = { ...TARGET_HOURS, ...normalizeAllocation(data.allocation) };
            localStorage.setItem('academic_target_hours', JSON.stringify(TARGET_HOURS));
        }

        renderStatsTable();
        renderTimetable();
        showToast('분석이 완료되어 시간표가 업데이트되었습니다.');
    } catch (e) {
        console.error(e);
        alert('분석 중 오류가 발생했습니다: ' + e.message);
    }
}

// 글로벌 등록 (onclick 등에서 사용하기 위함)
window.applyTemplateToSchedule = applyTemplateToSchedule;
window.analyzeFile = analyzeFile;

// 초기화 실행
initTemplateModal();
initAllocationModal();
