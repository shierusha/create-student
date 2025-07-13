

// ==========================
// (1) 切換 admin/player（開發測試用）
// ==========================
let userRole = 'admin'; // ← 你要測 admin 下拉就改成 'admin'，正式會用登入資料

// ==========================
// (2) Supabase 初始化
// ==========================
const client = window.supabase.createClient(
  'https://wfhwhvodgikpducrhgda.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaHdodm9kZ2lrcGR1Y3JoZ2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMTAwNjEsImV4cCI6MjA2MzU4NjA2MX0.P6P-x4SxjiR4VdWH6VFgY_ktgMac_OzuI4Bl7HWskz8'
);

// ==========================
// (3) 當你有登入時可以用這段來同步 userRole
// ==========================
/*
let currentPlayerId = null;
async function checkPlayer() {
  let { data: { user } } = await client.auth.getUser();
  if (!user) {
    location.href='https://shierusha.github.io/login/login.html';
    return;
  }
  currentPlayerId = user.id;
  // 判斷權限（用於 admin 下拉選單顯示）
  userRole = user.role === 'admin' ? 'admin' : 'player';
}
window.addEventListener('DOMContentLoaded', checkPlayer);
*/
let currentPlayerId = null; // 這行可保留

// ==========================
// (4) 所有表單資料
// ==========================
let formData = {
  name: '',       // 角色本名
  nickname: '',   // 角色稱呼
  alignment: '',  // 陣營
  gender: '',     // 性別
  age: '',        // 年齡
  height: '',     // 身高
  weight: '',     // 體重
  race: '',       // 種族
  personality: '', // 個性
  likes: '',       // 喜歡
  hate: '',        // 討厭
  background: '',  // 背景故事 
  notes: [{content:'', is_public:true}],
  element: '',         // 屬性
  weakness_id: '',     // 屬性弱點
  preferred_role: '',  // 定位
  starting_position: '',// 站位
  occupation_type: [],  // 職業（陣列）
  // ====== 技能欄位！留給第八頁用 ======
  skills: [ {}, {} ]    // 技能一、技能二 － 預設空物件，給skills.js動態綁定
};
let currentStep = 1;

// ==========================
// (5) 步驟切換 function
// ==========================
function showStep(step) {
  // 步驟條高亮
  document.querySelectorAll('.step').forEach((el, idx) => {
    if (idx === step - 1) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // 分頁切換
  document.querySelectorAll('.form-page').forEach(f => f.classList.remove('active')); 
  document.getElementById(`form-step-${step}`).classList.add('active');
  currentStep = step;

  // ====== 自動回填各頁資料 ======
  if (step === 1) {
    document.getElementById('name').value = formData.name || '';
    document.getElementById('nickname').value = formData.nickname || '';
  }
  if (step === 2) {
    document.getElementById('alignment').value = formData.alignment || '';
    document.getElementById('gender').value = formData.gender || '';
    document.getElementById('age').value = formData.age || '';
    document.getElementById('height').value = formData.height || '';
    document.getElementById('weight').value = formData.weight || '';
    document.getElementById('race').value = formData.race || '';
  }
  if (step === 3) {
    document.getElementById('personality').value = formData.personality || '';
    document.getElementById('likes').value = formData.likes || '';
    document.getElementById('hate').value = formData.hate || '';
  }
  if (step === 5) {
    initNotesForm();
  }
  if (step === 6) {
    renderStep6Dropdowns();
    document.getElementById('element').value = formData.element || '';
    document.getElementById('weakness_id').value = formData.weakness_id || '';
    document.getElementById('preferred_role').value = formData.preferred_role || '';
    document.getElementById('starting_position').value = formData.starting_position || '';
  }
  if (step === 7) {
    renderJobGrid();
    formData.occupation_type = formData.occupation_type || [];
    updateJobButtons();
  }
  // ====== 技能即時預覽（進第八頁時，如果你要自動更新預覽可以在這裡 call） ======
  if (step === 8) {
    if (typeof renderSkillPreview === "function") {
      renderSkillPreview(formData.skills);  // 你的 skills.js 預覽同步函數
    }
  }
  updateStudentCard();
}

// ==========================
// (13) 第七頁 職業選擇區塊
// ==========================

// 1. 初始化職業按鈕
function renderJobGrid() {
  const jobGrid = document.getElementById('job-grid');
  const jobList = [
    { key: 'attack', text: '攻擊手' },
    { key: 'tank', text: '坦' },
    { key: 'healer', text: '補師' },
    { key: 'buffer', text: '增益手' },
    { key: 'jammer', text: '妨礙手' }
  ];
  jobGrid.innerHTML = '';
  jobList.forEach(j => {
    const btn = document.createElement('div');
    btn.className = 'job-btn';
    btn.dataset.job = j.key;
    btn.innerText = j.text;
    jobGrid.appendChild(btn);
  });
  updateJobButtons();
}

// 2. 根據定位決定哪些職業能選、哪些要 disable
function updateJobButtons() {
  const preferred = formData.preferred_role;
  const jobs = formData.occupation_type || [];
  const jobBtns = document.querySelectorAll('.job-btn');
  const maxCount = (userRole === 'admin') ? 5 : 2;

  jobBtns.forEach(btn => {
    const job = btn.dataset.job;
    btn.classList.remove('disabled', 'selected');
    btn.onclick = null; // 清除上一次的事件

    // 管理員無限制
    if (userRole === 'admin') {
      btn.onclick = handleJobSelect;
      if (jobs.includes(job)) btn.classList.add('selected');
      return;
    }

    // 先全部設為可點
    let canSelect = true;

    // 根據 preferred_role 決定職業可選
    if (preferred === 'melee') { // 近戰
      if (job === 'healer') canSelect = false;
    }
    else if (preferred === 'ranger') { // 遠攻
      if (job === 'tank') canSelect = false;
    }
    else if (preferred === 'balance') { // 普通
      if (job === 'tank') canSelect = false;
    }

    // 數量限制（不是已選的不能再選超過 maxCount）
    if (!jobs.includes(job) && jobs.length >= maxCount) canSelect = false;

    // 按鈕狀態
    if (jobs.includes(job)) btn.classList.add('selected');
    if (!canSelect) btn.classList.add('disabled');
    if (canSelect || jobs.includes(job)) btn.onclick = handleJobSelect;
  });
}

function handleJobSelect(e) {
  const job = e.currentTarget.dataset.job;
  let jobs = formData.occupation_type || [];
  const maxCount = (userRole === 'admin') ? 5 : 2;

  // === 每次換職業，都會清空技能 ===
  if (!jobs.includes(job) && jobs.length < maxCount) {
    jobs.push(job);
    formData.skills = [ {}, {} ]; // ← ← ← 這行保證「換職業就清空技能」
  } else if (jobs.includes(job)) {
    jobs = jobs.filter(j => j !== job);
    formData.skills = [ {}, {} ]; // ← ← ← 這行保證「取消職業也清空技能」
  }
  formData.occupation_type = jobs;
  updateJobButtons();
  updateStudentCard();
}


// 4. 驗證
function validateStep7() {
  let warn = '';
  const jobs = formData.occupation_type || [];
  const maxCount = (userRole === 'admin') ? 5 : 2;

  if (jobs.length === 0) warn = '請至少選擇一個職業';
  if (jobs.length > maxCount) warn = `最多只能選 ${maxCount} 個職業`;
  if (formData.preferred_role === 'balance') {
    if (jobs.length === 2 && jobs.includes('healer') && jobs.includes('tank')) {
      warn = '不能同時選擇「補師」與「坦」';
    }
    if (jobs.length === 1 && (jobs[0] === 'healer' || jobs[0] === 'tank')) {
      warn = '普通攻擊手不能只選「補師」';
    }
  }
  document.getElementById('warn-7').innerText = warn;
  document.getElementById('warn-7').style.display = warn ? '' : 'none';
  return !warn;
}

// 5. 步驟切換
document.getElementById('btn-step-7').onclick = function () {
  if (validateStep7()) {
    showStep(8); // 進入下一頁
  }
};
document.getElementById('back-7').onclick = function () {
  showStep(6);
};


// ==========================
// (12) 即時同步：第1,2,3,4頁欄位
// ==========================
document.getElementById('name').addEventListener('input', function() {
  formData.name = this.value;
  updateStudentCard();
});
document.getElementById('nickname').addEventListener('input', function() {
  formData.nickname = this.value;
  updateStudentCard();
});
['alignment','gender','age','height','weight','race'].forEach(id=>{
  document.getElementById(id).addEventListener('input', function(){
    formData[id] = this.value;
    updateStudentCard();
  });
  document.getElementById(id).addEventListener('change', function(){
    formData[id] = this.value;
    updateStudentCard();
  });
});
['personality', 'likes', 'hate', 'background'].forEach(id => {
  const ta = document.getElementById(id);
  if (!ta) return;
  ta.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
    formData[id] = this.value;
    updateStudentCard();
  });

});


