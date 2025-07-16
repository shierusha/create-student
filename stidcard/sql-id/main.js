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

let currentPlayerId = null;

// ==========================
// (4) 所有表單資料
// ==========================
let formData = {
  name: '',
  nickname: '',
  alignment: '',
  gender: '',
  age: '',
  height: '',
  weight: '',
  race: '',
  personality: '',
  likes: '',
  hate: '',
  background: '',
  notes: [{content:'', is_public:true}],
  element: [],         // 直接陣列
  weakness_id: '',
  preferred_role: '',
  starting_position: '',
  occupation_type: [],
  skills: [ {}, {} ]
};

let currentStep = 1;

// ==========================
// (5) 步驟切換 function
// ==========================
function showStep(step) {
  document.querySelectorAll('.step').forEach((el, idx) => {
    if (idx === step - 1) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  document.querySelectorAll('.form-page').forEach(f => f.classList.remove('active')); 
  document.getElementById(`form-step-${step}`).classList.add('active');
  currentStep = step;

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
    updateElementUI(); // 單/多選切換
    syncElementValueToUI();
    document.getElementById('weakness_id').value = formData.weakness_id || '';
    document.getElementById('preferred_role').value = formData.preferred_role || '';
    document.getElementById('starting_position').value = formData.starting_position || '';
  }
  if (step === 7) {
    renderJobGrid();
    formData.occupation_type = formData.occupation_type || [];
    updateJobButtons();
  }
  if (step === 8) {
    if (typeof renderSkillsPage === "function") {
      renderSkillsPage(formData.skills);
    }
  }
  updateStudentCard();
}

// ==========================
// (6) 第6頁 下拉選單渲染+多選渲染
// ==========================
function renderStep6Dropdowns() {
  // === 屬性清單（不含「無」）
  let baseElementList = [
    { value: 'fire', text: '火' },
    { value: 'water', text: '水' },
    { value: 'ice', text: '冰' },
    { value: 'wind', text: '風' },
    { value: 'earth', text: '土' },
    { value: 'thunder', text: '雷' },
    { value: 'dark', text: '暗' },
    { value: 'light', text: '光' }
  ];

  // === 複製一份給單選用、多選用、弱點用
  let elementSelectList = [...baseElementList];
  let weakSelectList = [...baseElementList];

  // === 單選屬性 select 加入「無」or「請選擇」
  if (userRole === 'admin') {
    elementSelectList.unshift({ value: '', text: '無（沒有屬性）' });
  } else {
    elementSelectList.unshift({ value: '', text: '請選擇屬性' });
  }

  // === 單選下拉渲染
  const elSelect = document.getElementById('element');
  elSelect.innerHTML = '';
  elementSelectList.forEach(item => {
    let opt = document.createElement('option');
    opt.value = item.value;
    opt.text = item.text;
    elSelect.appendChild(opt);
  });

  // === 多選渲染（僅 admin）
  if (userRole === 'admin') {
    let html = '';
    baseElementList.forEach(item => {
      html += `<label style="margin-right:10px;width: 15px">
        <input type="checkbox" class="element-multi-checkbox" value="${item.value}">${item.text}
      </label>`;
    });
    document.getElementById('element-multi-select').innerHTML = html;
    document.getElementById('multi-element-toggle').style.display = '';
  } else {
    document.getElementById('multi-element-toggle').style.display = 'none';
    document.getElementById('element-multi-select').style.display = 'none';
    document.getElementById('element-single-select').style.display = '';
  }

  // === 屬性弱點選單（獨立一份，不會重複「無」）
  const weakSelect = document.getElementById('weakness_id');
  weakSelect.innerHTML = '<option value="">無（沒有屬性弱點）</option>';
  window.weaknessDict = {};
  weakSelectList.forEach(item => {
    let opt = document.createElement('option');
    opt.value = item.value;
    opt.text = item.text;
    weakSelect.appendChild(opt);
    window.weaknessDict[item.value] = { element: item.value };
  });

  // === 定位選單 ===
  const roleList = [
    { value: 'melee', text: '近戰攻擊手' },
    { value: 'ranger', text: '遠攻攻擊手' },
    { value: 'balance', text: '普通攻擊手' }
  ];
  const roleSelect = document.getElementById('preferred_role');
  roleSelect.innerHTML = '<option value="">請選擇定位</option>';
  roleList.forEach(item => {
    let opt = document.createElement('option');
    opt.value = item.value;
    opt.text = item.text;
    roleSelect.appendChild(opt);
  });

  // === 站位選單 ===
  const positionList = [
    { value: 'close', text: '近戰區' },
    { value: 'far', text: '遠攻區' }
  ];
  const posSelect = document.getElementById('starting_position');
  posSelect.innerHTML = '';
  let posOptions = [...positionList];
  if (userRole === 'admin') {
    posOptions.unshift({ value: '', text: '無（交由戰鬥補上）' });
  }
  posOptions.forEach(item => {
    let opt = document.createElement('option');
    opt.value = item.value;
    opt.text = item.text;
    posSelect.appendChild(opt);
  });
}


// ========== 多選切換 UI邏輯 ==========
function updateElementUI() {
  const enableMulti = document.getElementById('enable-multi-element');
  if (userRole !== 'admin') {
    document.getElementById('element-single-select').style.display = '';
    document.getElementById('element-multi-select').style.display = 'none';
    return;
  }
  if (enableMulti.checked) {
    document.getElementById('element-single-select').style.display = 'none';
    document.getElementById('element-multi-select').style.display = '';
  } else {
    document.getElementById('element-single-select').style.display = '';
    document.getElementById('element-multi-select').style.display = 'none';
  }
}

// ========== 監聽切換單/多選UI ==========
if (document.getElementById('enable-multi-element')) {
  document.getElementById('enable-multi-element').addEventListener('change', function() {
    updateElementUI();
    syncElementValueToUI();
  });
}

// ========== 單/多選值與 formData 同步 ==========
function syncElementValueToUI() {
  // 多選狀態
  const enableMulti = document.getElementById('enable-multi-element');
  if (userRole === 'admin' && enableMulti.checked) {
    // 勾選還原
    document.querySelectorAll('.element-multi-checkbox').forEach(cb => {
      cb.checked = (formData.element && formData.element.includes(cb.value));
      cb.addEventListener('change', function() {
        let arr = Array.from(document.querySelectorAll('.element-multi-checkbox:checked')).map(c => c.value);
        formData.element = arr;
        updateStudentCard();
      });
    });
  } else {
    // 下拉單選
    const elSelect = document.getElementById('element');
    elSelect.value = (formData.element && formData.element.length > 0) ? formData.element[0] : '';
    elSelect.onchange = function() {
      formData.element = this.value ? [this.value] : [];
      updateStudentCard();
    };
  }
}

// ========== 其他第六頁欄位監聽 ==========
['weakness_id', 'preferred_role', 'starting_position'].forEach(id => {
  document.getElementById(id).addEventListener('change', function() {
    formData[id] = this.value;
    updateStudentCard();
  });
});

// ==========================
// (8) 第6頁的下一步/上一步按鈕
// ==========================
document.getElementById('btn-step-6').onclick = function () {
  // admin 可以空值, 其他人不行
  if (userRole !== 'admin' && (!formData.element || formData.element.length === 0)) {
    alert('請選擇屬性');
    return;
  }
  if (!formData.preferred_role) {
    alert('請選擇定位');
    return;
  }
  if (userRole !== 'admin' && !formData.starting_position) {
    alert('請選擇起始站位');
    return;
  }
  showStep(7);
};
document.getElementById('back-6').onclick = function () {
  showStep(5);
};


// ==========================
// (9) 你的步驟切換與 notes 相關全保留
// ==========================
document.getElementById('btn-step-1').onclick = function () {
  const nameVal = document.getElementById('name').value.trim();
  const nickVal = document.getElementById('nickname').value.trim();
  if (!nameVal) {
    alert('請輸入角色本名');
    return;
  }
  formData.name = nameVal;
  formData.nickname = nickVal;
  updateStudentCard();
  showStep(2);
};
document.getElementById('back-2').onclick = function () { showStep(1); };

document.getElementById('btn-step-2').onclick = function () {
  const alignVal = document.getElementById('alignment').value;
  const genderVal = document.getElementById('gender').value;
  let ageVal = parseInt(document.getElementById('age').value, 10) || 0;
  let heightVal = parseInt(document.getElementById('height').value, 10) || '';
  let weightVal = parseFloat(document.getElementById('weight').value) || '';
  const raceVal = document.getElementById('race').value.trim();

  if (!(ageVal === 0 || (ageVal >= 13 && ageVal <= 25))) {
    alert('年齡像學生點');
    return;
  }
  if (!(heightVal >= 130 && heightVal <= 200)) {
    alert('身高寫正常點');
    return;
  }
  if (!alignVal) { alert('請選擇陣營'); return; }
  if (!genderVal) { alert('請選擇性別'); return; }
  if (!heightVal) { alert('請填寫身高'); return; }
  if (!weightVal) { alert('請填寫體重'); return; }
  if (!raceVal) { alert('請填寫種族'); return; }

  formData.alignment = alignVal;
  formData.gender = genderVal;
  formData.age = ageVal;
  formData.height = heightVal;
  formData.weight = weightVal;
  formData.race = raceVal;
  updateStudentCard();
  showStep(3);
};
document.getElementById('back-3').onclick = function () { showStep(2); };

document.getElementById('btn-step-3').onclick = function () {
  formData.personality = document.getElementById('personality').value.trim();
  formData.likes = document.getElementById('likes').value.trim();
  formData.hate = document.getElementById('hate').value.trim();
  updateStudentCard();
  showStep(4);
};
document.getElementById('back-4').onclick = function () { showStep(3); };

document.getElementById('btn-step-4').onclick = function () {
  const backgroundVal = document.getElementById('background').value.trim();
  formData.background = backgroundVal;
  updateStudentCard();
  showStep(5);
};
document.getElementById('back-5').onclick = function () { showStep(4); };

document.getElementById('btn-step-5').onclick = function () {
  const hasValidNote = formData.notes.some(note => note.content.trim());
  if (!hasValidNote) {
    alert('請至少填寫一條角色設定/裏設定！');
    return;
  }
  const allFilled = formData.notes.every(note => note.content.trim());
  if (!allFilled) {
    alert('請勿寫空白設定！');
    return;
  }
  showStep(6);
};

// ==========================
// (10) notes 功能全保留
// ==========================
function initNotesForm() {
  if (!formData.notes || formData.notes.length === 0) {
    formData.notes = [{ content: '', is_public: true }];
  }
  renderNotesRows();
}
function renderNotesRows() {
  const notesContainer = document.getElementById('note-list');
  notesContainer.innerHTML = '';
  formData.notes.forEach((note, idx) => {
    const row = document.createElement('div');
    row.className = 'note-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginBottom = '0.5em';

    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.marginRight = '0.6em';
    label.style.margin= '5px';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'note-public';
    checkbox.checked = note.is_public;
    checkbox.style.margin = '5px';
    checkbox.style.width = '20%';
    checkbox.addEventListener('change', function() {
      note.is_public = this.checked;
      syncStudentNoteCard();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode('顯示'));
    row.appendChild(label);

    const ta = document.createElement('textarea');
    ta.className = 'note-content';
    ta.value = note.content;
    ta.rows = 2;
    ta.placeholder = '請輸入角色設定／裏設定';
    ta.style.flex = '1';
    ta.style.resize = 'none';
    ta.style.overflow = 'hidden';
    ta.style.margin= '5px';
    ta.style.width = '65%';
    ta.addEventListener('input', function() {
      note.content = this.value;
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      syncStudentNoteCard();
    });
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    row.appendChild(ta);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '刪除';
    delBtn.className = 'delete-note-btn';
    delBtn.style.background = '#e74c3c'; 
    delBtn.style.margin= '5px';
    delBtn.style.width = '15%';

    delBtn.onclick = function() { deleteNote(idx); };
    if (formData.notes.length === 1) delBtn.disabled = true;
    row.appendChild(delBtn);

    notesContainer.appendChild(row);
  });

  syncStudentNoteCard();
}
function addNote() {
  formData.notes.push({ content: '', is_public: true });
  renderNotesRows();
}
function deleteNote(idx) {
  if (formData.notes.length > 1) {
    formData.notes.splice(idx, 1);
    renderNotesRows();
  }
}
document.getElementById('add-note-btn').onclick = addNote;

// ==========================
// (11) 學生證卡片資料同步
// ==========================
function updateStudentCard() {
  document.querySelectorAll('[data-key="students.name"]').forEach(el => el.textContent = formData.name);
  document.querySelectorAll('.littlename-box').forEach(box => {
    if (formData.nickname && formData.nickname.trim()) {
      box.style.display = '';
      box.querySelector('[data-key="students.nickname"]').textContent = formData.nickname;
    } else {
      box.style.display = 'none';
      let nick = box.querySelector('[data-key="students.nickname"]');
      if(nick) nick.textContent = '';
    }
  });
  document.querySelectorAll('[data-key="students.alignment"]').forEach(el => {
    el.textContent = formData.alignment === 'white' ? '白' : (formData.alignment === 'black' ? '黑' : '');
  });
  document.querySelectorAll('[data-key="students.gender"]').forEach(el => {
    if (formData.gender === 'M') el.textContent = '男';
    else if (formData.gender === 'F') el.textContent = '女';
    else if (formData.gender === 'O') el.textContent = '其他';
    else el.textContent = '';
  });
  document.querySelectorAll('[data-key="students.age"]').forEach(el => {
    el.textContent = (!formData.age || formData.age === 0) ? '?' : formData.age;
  });
  document.querySelectorAll('[data-key="students.height"]').forEach(el => el.textContent = formData.height || '');
  document.querySelectorAll('[data-key="students.weight"]').forEach(el => el.textContent = formData.weight || '');
  document.querySelectorAll('[data-key="students.race"]').forEach(el => el.textContent = formData.race || '');
  document.querySelectorAll('[data-key="students.personality"]').forEach(el => el.textContent = formData.personality || '');
  document.querySelectorAll('[data-key="students.likes"]').forEach(el => el.textContent = formData.likes || '');
  document.querySelectorAll('[data-key="students.hate"]').forEach(el => el.textContent = formData.hate || '');
  document.querySelectorAll('[data-key="students.background"]').forEach(el => el.textContent = formData.background || '');
  // ========== 第六頁資料同步卡片 ==========
// 屬性（支援多選陣列）
document.querySelectorAll('[data-key="students.element"]').forEach(el => {
  const translate = {
    fire: '火', water: '水', ice: '冰', wind: '風',
    earth: '土', thunder: '雷', dark: '暗', light: '光'
  };
  let output = '';

  if (Array.isArray(formData.element)) {
    output = formData.element.map(e => translate[e] || '').filter(Boolean).join(' / ');
    if (!output) output = '無';
  } else if (typeof formData.element === 'string') {
    output = translate[formData.element] || '無';
  } else {
    output = '無';
  }

  el.textContent = output;
});


// 屬性弱點（需同步顯示弱點屬性）
document.querySelectorAll('[data-key="element_weakness.element"]').forEach(el => {
  if (!formData.weakness_id) {
    // 選擇無弱點時
    el.textContent = '無'; // 或改成 '—'
  } else if (!window.weaknessDict) {
    el.textContent = '';
  } else {
    const w = window.weaknessDict[formData.weakness_id];
    if (w && w.element) {
      let text = '';
      switch(w.element) {
        case 'fire': text = '火'; break;
        case 'water': text = '水'; break;
        case 'ice': text = '冰'; break;
        case 'wind': text = '風'; break;
        case 'earth': text = '土'; break;
        case 'thunder': text = '雷'; break;
        case 'dark': text = '暗'; break;
        case 'light': text = '光'; break;
        default: text = '';
      }
      el.textContent = text;
    } else {
      el.textContent = '';
    }
  }
});

// 定位
document.querySelectorAll('[data-key="students.preferred_role"]').forEach(el => {
  let val = '';
  switch(formData.preferred_role) {
    case 'melee': val = '近戰攻擊手'; break;
    case 'ranger': val = '遠攻攻擊手'; break;
    case 'balance': val = '普通攻擊手'; break;
    default: val = '';
  }
  el.textContent = val;
});
// 起始站位
document.querySelectorAll('[data-key="students.starting_position"]').forEach(el => {
  let val = '';
  switch(formData.starting_position) {
    case 'close': val = '近戰區'; break;
    case 'far': val = '遠攻區'; break;
    default: val = '近/遠戰區'; // 無選擇時顯示這個
  }
  el.textContent = val;
});

// >>> 職業 <<<
document.querySelectorAll('[data-key="students.occupation_type"]').forEach(el => {
  if (!formData.occupation_type || formData.occupation_type.length === 0) {
    el.textContent = '';
    return;
  }
  const jobDict = {
    attack: '攻擊手',
    tank: '坦克',
    healer: '補師',
    buffer: '增益手',
    jammer: '妨礙手'
  };
  const text = formData.occupation_type.map(j => jobDict[j] || j).join(' / ');
  el.textContent = text;
});


}
function syncStudentNoteCard() {
  let displayLines = formData.notes.map(n => n.is_public
    ? (n.content.trim() ? `# ${n.content.trim()}` : '???')
    : '# ???'
  ).join('\n\n');
  document.querySelectorAll('[data-key="student_notes.content"]').forEach(el => {
    el.textContent = displayLines;
  });
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

  if (jobs.includes(job)) {
    jobs = jobs.filter(j => j !== job);
  } else {
    if (jobs.length < maxCount) jobs.push(job);
  }
  formData.occupation_type = jobs;
  updateJobButtons();
  updateStudentCard(); // <--- 一定要有！
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


//document.querySelectorAll('.form-page').forEach(f=>f.classList.remove('active'));
//ocument.getElementById('form-step-6').classList.add('active');
