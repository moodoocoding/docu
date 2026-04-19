import { supabase } from './supabase.js';

const NEIS_API_KEY = 'ab0666ba9cb243edba61cb06fe48d12a';
const NEIS_API_URL = 'https://open.neis.go.kr/hub/schoolInfo';

const FIELDS = ['schoolName','eduOffice','orgCode','schoolAddr','schoolPhone','schoolFax','schoolWeb','staffName','staffTitle','staffPhone'];
const AUTO_FIELDS = ['schoolName','eduOffice','orgCode','schoolAddr','schoolPhone','schoolFax','schoolWeb'];

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function getSchoolBadge(kind) {
  if (kind.includes('초')) return '<span class="badge badge-elem">초등학교</span>';
  if (kind.includes('중')) return '<span class="badge badge-mid">중학교</span>';
  if (kind.includes('고')) return '<span class="badge badge-high">고등학교</span>';
  return '<span class="badge badge-etc">' + kind + '</span>';
}

// ===== 학교 검색 =====
const searchInput = document.getElementById('schoolSearch');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');

async function searchSchool() {
  const query = searchInput.value.trim();
  if (!query) {
    showToast('⚠️ 학교명을 입력하세요');
    return;
  }

  searchBtn.disabled = true;
  searchBtn.innerHTML = '<span class="spinner"></span>검색 중...';
  searchResults.innerHTML = '';
  searchResults.classList.remove('show');

  try {
    const url = `${NEIS_API_URL}?KEY=${NEIS_API_KEY}&Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.RESULT) {
      searchResults.innerHTML = '<div class="search-no-result">😔 검색 결과가 없습니다. 학교명을 다시 확인해주세요.</div>';
      searchResults.classList.add('show');
      return;
    }

    if (data.schoolInfo && data.schoolInfo[1] && data.schoolInfo[1].row) {
      const schools = data.schoolInfo[1].row;
      if (schools.length === 0) {
        searchResults.innerHTML = '<div class="search-no-result">😔 검색 결과가 없습니다.</div>';
      } else {
        searchResults.innerHTML = schools.map((s, i) => `
          <div class="search-result-item" data-index="${i}">
            <div class="school-name">${s.SCHUL_NM} ${getSchoolBadge(s.SCHUL_KND_SC_NM)}</div>
            <div class="school-meta">
              <span>📍 ${s.ORG_RDNMA}</span>
              <span>📞 ${s.ORG_TELNO}</span>
              <span>🏛️ ${s.ATPT_OFCDC_SC_NM}</span>
            </div>
          </div>
        `).join('');

        searchResults.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            selectSchool(schools[idx]);
          });
        });
      }
      searchResults.classList.add('show');
    }
  } catch (err) {
    searchResults.innerHTML = '<div class="search-no-result">❌ API 호출 중 오류가 발생했습니다: ' + err.message + '</div>';
    searchResults.classList.add('show');
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = '🔍 검색';
  }
}

function selectSchool(school) {
  const addr = school.ORG_RDNMA + (school.ORG_RDNDA ? ' ' + school.ORG_RDNDA.replace(/^\/\s*/, '') : '');

  document.getElementById('schoolName').value = school.SCHUL_NM;
  document.getElementById('eduOffice').value = school.ATPT_OFCDC_SC_NM;
  document.getElementById('orgCode').value = school.SD_SCHUL_CODE;
  document.getElementById('schoolAddr').value = addr.trim();
  document.getElementById('schoolPhone').value = school.ORG_TELNO || '';
  document.getElementById('schoolFax').value = school.ORG_FAXNO || '';
  document.getElementById('schoolWeb').value = school.HMPG_ADRES || '';

  AUTO_FIELDS.forEach(f => {
    const el = document.getElementById(f);
    el.classList.add('auto-filled');
    setTimeout(() => el.classList.remove('auto-filled'), 3000);
  });

  searchResults.classList.remove('show');
  searchInput.value = school.SCHUL_NM;

  saveSettings();
  showToast('✅ ' + school.SCHUL_NM + ' 정보가 자동 입력 및 저장되었습니다!');
}

searchBtn?.addEventListener('click', searchSchool);
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    searchSchool();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) {
    searchResults.classList.remove('show');
  }
});

// ===== 저장 함수 =====
async function saveSettings() {
  const data = {};
  FIELDS.forEach(f => { 
    const el = document.getElementById(f);
    if (el) data[f] = el.value.trim(); 
  });
  
  // 로컬 저장
  localStorage.setItem('schoolDocSettings', JSON.stringify(data));
  
  // Supabase 저장
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 기존 데이터가 있는지 확인
    const { data: existing, error: fetchError } = await supabase
      .from('school_settings')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    
    if (fetchError) throw fetchError;
    
    const payload = {
      school_name: data.schoolName,
      edu_office: data.eduOffice,
      org_code: data.orgCode,
      school_addr: data.schoolAddr,
      school_phone: data.schoolPhone,
      school_fax: data.schoolFax,
      school_web: data.schoolWeb,
      staff_name: data.staffName,
      staff_title: data.staffTitle,
      staff_phone: data.staffPhone,
      user_id: user.id,
      updated_at: new Date().toISOString()
    };

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from('school_settings')
        .update(payload)
        .eq('id', existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('school_settings')
        .insert([payload]);
      if (error) throw error;
    }
  } catch (e) {
    console.error('Supabase 설정 저장 실패:', e);
  }
}

// 실시간 자동 저장
FIELDS.forEach(f => {
  const el = document.getElementById(f);
  if (el) {
    el.addEventListener('input', () => {
      const settings = JSON.parse(localStorage.getItem('schoolDocSettings') || '{}');
      settings[f] = el.value.trim();
      localStorage.setItem('schoolDocSettings', JSON.stringify(settings));
    });
  }
});

// ===== 불러오기 =====
async function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('schoolDocSettings') || '{}');
  FIELDS.forEach(f => {
    const el = document.getElementById(f);
    if (el && saved[f]) el.value = saved[f];
  });
  if (saved.schoolName) searchInput.value = saved.schoolName;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('school_settings')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      const mapping = {
        schoolName: data.school_name,
        eduOffice: data.edu_office,
        orgCode: data.org_code,
        schoolAddr: data.school_addr,
        schoolPhone: data.school_phone,
        schoolFax: data.school_fax,
        schoolWeb: data.school_web,
        staffName: data.staff_name,
        staffTitle: data.staff_title,
        staffPhone: data.staff_phone
      };
      
      FIELDS.forEach(f => {
        const el = document.getElementById(f);
        if (el && mapping[f]) el.value = mapping[f];
      });
      if (data.school_name) searchInput.value = data.school_name;
      
      // 로컬 업데이트
      const settings = {};
      FIELDS.forEach(f => settings[f] = mapping[f] || '');
      localStorage.setItem('schoolDocSettings', JSON.stringify(settings));
    }
  } catch (e) {
    console.error('Supabase 설정 불러오기 실패:', e);
  }
}

loadSettings();

// 수동 저장 버튼
document.getElementById('saveBtn')?.addEventListener('click', async () => {
  await saveSettings();
  showToast('✅ 모든 설정이 안전하게 저장되었습니다!');
});

// ===== 초기화 =====
document.getElementById('resetBtn')?.addEventListener('click', async () => {
  if (confirm('정말로 모든 설정과 작성 내역을 삭제하시겠습니까?')) {
    localStorage.removeItem('schoolDocSettings');
    localStorage.removeItem('docHistory');
    
    // DB 초기화
    try {
      await supabase.from('school_settings').delete().neq('id', 0);
      await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      console.error('DB 초기화 실패:', e);
    }

    FIELDS.forEach(f => { 
      const el = document.getElementById(f);
      if (el) el.value = ''; 
    });
    searchInput.value = '';
    showToast('🗑️ 모든 데이터가 초기화되었습니다');
  }
});
