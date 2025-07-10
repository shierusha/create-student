// Supabase 初始化
const client = window.supabase.createClient(
  'https://wfhwhvodgikpducrhgda.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmaHdodm9kZ2lrcGR1Y3JoZ2RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMTAwNjEsImV4cCI6MjA2MzU4NjA2MX0.P6P-x4SxjiR4VdWH6VFgY_ktgMac_OzuI4Bl7HWskz8'
);

/*let currentPlayerId = null;

async function checkPlayer() {
  let { data: { user } } = await client.auth.getUser();
  if (!user) {
    location.href='https://shierusha.github.io/login/login.html';
    return;
  }
  // 把user.id存在全域變數，之後送出資料時可以直接用
  currentPlayerId = user.id;
  // 你也可以在這裡繼續載入頁面
}

// 頁面載入時執行
window.addEventListener('DOMContentLoaded', checkPlayer);

*/

let currentPlayerId = null;

// ==========================
// 收集每頁輸入資料用的 formData
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
  hate: '',         // 討厭
  background: '',     // 背景故事 
notes: [{content:'', is_public:true}]
  // 下一頁繼續加
};
let currentStep = 1;

// ==========================
// 共用步驟切換 function
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
  updateStudentCard(); // 回頁面時同步一次卡片
}

// ==========================
// 下一步/上一步邏輯
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

document.getElementById('back-2').onclick = function () {
  showStep(1);
};

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

document.getElementById('back-3').onclick = function () {
  showStep(2);
};

document.getElementById('btn-step-3').onclick = function () {
  formData.personality = document.getElementById('personality').value.trim();
  formData.likes = document.getElementById('likes').value.trim();
  formData.hate = document.getElementById('hate').value.trim();
  updateStudentCard();
  showStep(4);
};
// ----------- 第四頁 上一步 -----------
document.getElementById('back-4').onclick = function () {
  showStep(3);
};

// ----------- 第四頁 下一步 -----------
document.getElementById('btn-step-4').onclick = function () {
  const backgroundVal = document.getElementById('background').value.trim();
  formData.background = backgroundVal;
  updateStudentCard();
  showStep(5); // 下一頁
};


// 進入這一頁前要先初始化，沒資料就自動加一條空白
function initNotesForm() {
  if (!formData.notes || formData.notes.length === 0) {
    formData.notes = [{ content: '', is_public: true }];
  }
  renderNotesRows();
}

// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
//  渲染 notes 欄位的 function
// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

// 這裡會把 notes 陣列渲染到畫面上
// 這裡統一換成 note-list（你HTML的ID）
function renderNotesRows() {
  const notesContainer = document.getElementById('note-list');
  notesContainer.innerHTML = ''; // 清空

  formData.notes.forEach((note, idx) => {
    // 外層
    const row = document.createElement('div');
    row.className = 'note-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginBottom = '0.5em';

    // 勾選框
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

    // textarea
    const ta = document.createElement('textarea');
    ta.className = 'note-content';
    ta.value = note.content;
    ta.rows = 2;
    ta.maxLength = 80;
    ta.placeholder = '請輸入角色設定／裏設定';
    ta.style.flex = '1';
    ta.style.resize = 'none';
    ta.style.overflow = 'hidden';
    ta.style.margin= '5px';
    ta.style.width = '65%';   // 固定寬度
    // 自動高度
    ta.addEventListener('input', function() {
      note.content = this.value;
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      syncStudentNoteCard();
    });
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    row.appendChild(ta);

    // 刪除按鈕
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '刪除';
    delBtn.className = 'delete-note-btn';
    delBtn.style.background = '#e74c3c'; 
    delBtn.style.margin= '5px';
    delBtn.style.width = '15%';   // 固定寬度

    delBtn.onclick = function() { deleteNote(idx); };
    if (formData.notes.length === 1) delBtn.disabled = true; // 至少保留一條
    row.appendChild(delBtn);

    notesContainer.appendChild(row);
  });

  syncStudentNoteCard();
}


// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
//  notes 新增／刪除 function
// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

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

// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
//   第5頁的上下頁按鈕
// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
document.getElementById('btn-step-5').onclick = function () {
  // 至少要有一條有內容（且 is_public 為 true 才會顯示在學生證，可依需求調整！）
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

document.getElementById('back-5').onclick = function () {
  showStep(4);
};


// ==========================
// 同步學生證卡片所有資料
// ==========================
function updateStudentCard() {
  // 名稱
  document.querySelectorAll('[data-key="students.name"]').forEach(el => el.textContent = formData.name);

  // 暱稱（如果為空，littlename-box整塊隱藏）
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

  // 陣營
  document.querySelectorAll('[data-key="students.alignment"]').forEach(el => {
    el.textContent = formData.alignment === 'white' ? '白' : (formData.alignment === 'black' ? '黑' : '');
  });
  // 性別
  document.querySelectorAll('[data-key="students.gender"]').forEach(el => {
    if (formData.gender === 'M') el.textContent = '男';
    else if (formData.gender === 'F') el.textContent = '女';
    else if (formData.gender === 'O') el.textContent = '其他';
    else el.textContent = '';
  });
  // 年齡
  document.querySelectorAll('[data-key="students.age"]').forEach(el => {
    el.textContent = (!formData.age || formData.age === 0) ? '?' : formData.age;
  });
  // 身高、體重
  document.querySelectorAll('[data-key="students.height"]').forEach(el => el.textContent = formData.height || '');
  document.querySelectorAll('[data-key="students.weight"]').forEach(el => el.textContent = formData.weight || '');
  // 種族
  document.querySelectorAll('[data-key="students.race"]').forEach(el => el.textContent = formData.race || '');
  // 個性、喜歡、討厭
  document.querySelectorAll('[data-key="students.personality"]').forEach(el => el.textContent = formData.personality || '');
  document.querySelectorAll('[data-key="students.likes"]').forEach(el => el.textContent = formData.likes || '');
  document.querySelectorAll('[data-key="students.hate"]').forEach(el => el.textContent = formData.hate || '');
//背景故事
document.querySelectorAll('[data-key="students.background"]').forEach(el => el.textContent = formData.background || '');
}


// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
//           5. 同步到學生證卡片
// ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝

function syncStudentNoteCard() {
  // 假設學生證卡片有 <span data-key="student_notes.content">
  let displayLines = formData.notes.map(n => n.is_public
    ? (n.content.trim() ? `# ${n.content.trim()}` : '???')
    : '# ???'
  ).join('\n\n');
  document.querySelectorAll('[data-key="student_notes.content"]').forEach(el => {
    el.textContent = displayLines;
  });
}

// ==========================
// 即時同步：第一頁
// ==========================
document.getElementById('name').addEventListener('input', function() {
  formData.name = this.value;
  updateStudentCard();
});
document.getElementById('nickname').addEventListener('input', function() {
  formData.nickname = this.value;
  updateStudentCard();
});

// ==========================
// 即時同步：第二頁
// ==========================
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

// ==========================
// 自動高度 textarea + 即時同步（第三、四頁共用）
// ==========================
['personality', 'likes', 'hate', 'background'].forEach(id => {
  const ta = document.getElementById(id);
  if (!ta) return;
  ta.addEventListener('input', function() {
    this.style.height = 'auto'; // reset
    this.style.height = this.scrollHeight + 'px';
    formData[id] = this.value;
    updateStudentCard();
  });
});



document.getElementById('add-note-btn').onclick = addNote;
