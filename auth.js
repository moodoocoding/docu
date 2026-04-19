import { supabase } from './supabase.js';

// auth.js — 로그인 상태 체크 및 페이지 보호

async function checkAuth() {
  console.log('--- 🛡️ Auth Check Starting ---');
  console.log('Pathname:', window.location.pathname);
  console.log('Full URL:', window.location.href);
  
  try {
    // 세션이 브라우저에 안착할 때까지 최대 5번(0.5초) 재시도
    let session = null;
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.auth.getSession();
      session = data.session;
      if (session) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('Session Status:', session ? '✅ Logged In (' + session.user.email + ')' : '❌ Logged Out');

    const isLoginPage = window.location.pathname.includes('login.html');
    const isLandingPage = window.location.pathname.endsWith('index.html') || 
                         window.location.pathname === '/' || 
                         window.location.pathname.endsWith('/');

    if (!session && !isLoginPage && !isLandingPage) {
      console.log('🚨 Not logged in. Redirecting to login.html...');
      window.location.replace('login.html');
      return;
    }

    if (session) {
      updateHeaderUI(session.user);
    }
  } catch (err) {
    console.error('❌ Auth Check Failed:', err);
  }
}

function updateHeaderUI(user) {
  // 모든 페이지의 헤더 버튼을 로그아웃으로 변경하거나 프로필 표시
  const headerBtns = document.querySelectorAll('.header-btn, .util-bar a[href="settings.html"]');
  headerBtns.forEach(btn => {
    // 설정 버튼은 유지하되, 별도의 로그아웃 버튼 추가 가능
  });

  // .header-actions 안에 로그아웃 추가
  const headerActions = document.querySelector('.header-actions');
  if (headerActions && !document.getElementById('logoutBtn')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logoutBtn';
    logoutBtn.className = 'header-btn';
    logoutBtn.style.background = 'none';
    logoutBtn.style.color = '#666';
    logoutBtn.style.border = '1.5px solid #e0e0e8';
    logoutBtn.textContent = '로그아웃';
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    };
    headerActions.appendChild(logoutBtn);
  }
}

// 초기 체크 실행
checkAuth();

// 상태 변경 감지
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    window.location.href = 'index.html';
  } else if (event === 'SIGNED_IN' && window.location.pathname.includes('login.html')) {
    window.location.href = 'index.html';
  }
});
