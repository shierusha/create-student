//BATA 測試用JS


function resetSkillEffectsAndMovement(skill) {
  skill.effect_ids = [];
  skill.effect_scores = [];
  skill.use_movement = false;
  skill.move_ids = '';
  skill.debuffs = [];
  skill.move_score = 0;  
  skill.custom_effect_enable = false; 
  skill.custom_effect_score = 0;     
}
//===========抓顯示用CD==========================
function getSkillFinalCD(skill, idx) {
  // 被動技能直接顯示 X
  if (skill.is_passive) return 'X';
  // 指定ID強制CD=0
  let cdForceZeroEffectId = '27004404-af5a-43b0-bcd4-b8396616e4d8';
  if (skill.effect_ids && skill.effect_ids.includes(cdForceZeroEffectId)) return 0;
  // 管理員自訂CD
  if (typeof userRole !== 'undefined' && userRole === 'admin' && skill.cd_val !== undefined && skill.cd_val !== null) return skill.cd_val;
  // 一般自動計算CD
  if (typeof calcSkillCD === "function") return calcSkillCD(idx, skill);
  // 預設顯示 X
  return 'X';
}

// ========== 技能CD計算（補師例外/移動判斷版） ==========
function calcSkillCD(idx, skill) {
  let cd = 0;
  // 技能效果加總
  if (Array.isArray(skill.effect_ids) && window.skillEffectsList) {
    skill.effect_ids.forEach(eid => {
      let eff = window.skillEffectsList.find(e => e.effect_id === eid);
      if (eff && eff.extra_cd) cd += Number(eff.extra_cd);
    });
  }
  // 移動技能
  if (skill.use_movement && window.movementSkillsList) {
    let move = window.movementSkillsList.find(m => m.move_id === skill.move_ids);
    if (move && move.extra_cd) cd += Number(move.extra_cd);
  }
  // 負作用
  if (Array.isArray(skill.debuffs) && window.skillDebuffList) {
    skill.debuffs.forEach(d => {
      let deb = window.skillDebuffList.find(k => k.debuff_id === d.debuff_id);
      if (deb && deb.extra_cd) cd += Number(deb.extra_cd);
    });
  }
  // 原創技能
  if (skill.custom_effect_enable) cd += 3;
  // 補師 all_zone +1（只有純補師、且沒移動例外不加）
  const occ = Array.isArray(formData.occupation_type) ? formData.occupation_type : [];
  const isPureHealer = occ.length === 1 && occ[0] === 'healer';
  if (skill.range === 'all_zone') {
    if (!(isPureHealer && !skill.use_movement)) cd += 1;
  }
  return cd;
}

// ========== 技能星級計算 (每個技能專用) ==========
function calcSingleSkillStar(skill) {
  let scoreSum = 0;
  if (Array.isArray(skill.effect_scores)) scoreSum += skill.effect_scores.reduce((a, b) => a + b, 0);
  let occCount = Array.isArray(formData.occupation_type) ? formData.occupation_type.length : 0;
  if (skill.use_movement) scoreSum += (occCount === 1 ? 20 : 15);
  if (skill.custom_effect_enable) scoreSum += 15;
  let skillStarNum = Math.floor(scoreSum / 5);
  if (skill.is_passive && skill.passive_trigger_limit === 'once') skillStarNum -= 1;
  return Math.max(0, skillStarNum);
}

// ========== 更新頂部主星條與狀態（技能有動就要 call） ==========
function updateCurrentSkillStarTotal() {
  let totalStar = 0;
  (formData.skills || []).forEach(skill => {
    totalStar += calcSingleSkillStar(skill);
  });

  let occCount = Array.isArray(formData.occupation_type) ? formData.occupation_type.length : 0;
  let targetStar = 3, isProblem = false;
  if (occCount === 1) targetStar = 8;
  else if (occCount === 2) targetStar = 7;
  else if (occCount === 0) targetStar = 3;
  else isProblem = true;

  const starBar = document.getElementById('role-star-bar');
  const starStatus = document.getElementById('star-status');
  const currentStarTotal = document.getElementById('current-star-total');
  const submitBtn = document.querySelector('#form-step-8 button[type=submit], #form-step-8 input[type=submit]');

  // ★這裡只更新主星條：目標星數
  if (starBar) {
    if (isProblem) starBar.innerHTML = '✯✯✯✯✯✯✯✯';
    else starBar.innerHTML = '✯'.repeat(targetStar);
  }

  // ★這裡才是即時更新現在星級
  if (currentStarTotal) {
    currentStarTotal.innerHTML = '✯'.repeat(totalStar);
  }

  // 狀態字
  if (starStatus) {
    if (isProblem) {
      starStatus.innerHTML = `<span style="color:#099">完美! 太完美了!</span>`;
    } else if (totalStar > targetStar) {
      starStatus.innerHTML = `<span style="color:#c32">技能星數太多，請減少技能分數</span>`;
    } else if (totalStar < targetStar) {
      starStatus.innerHTML = `<span style="color:#c32">技能星數太少，請提高技能分數</span>`;
    } else {
      starStatus.innerHTML = `<span style="color:#1a7b12">完美</span>`;
    }
  }

// 控管送出if (submitBtn) {
  if ((typeof userRole !== 'undefined' && userRole === 'admin') || (!isProblem && totalStar === targetStar)) {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '';
    submitBtn.title = '';
  } else {
    submitBtn.disabled = true;
    submitBtn.style.opacity = 0.6;
    submitBtn.title = '技能星數需剛好才可送出';
  }
}


// ========== 技能星級＋平衡星級提示（每個技能專用，技能區塊用） ==========
function renderSkillStarHintBlock(idx, skill) {
  let skillStarNum = calcSingleSkillStar(skill);
  // 平衡星級（累積☆）
  let extraStar = 0;
  if (typeof renderSkillAccumStarBlock === 'function') {
    let fakeDiv = document.createElement('div');
    renderSkillAccumStarBlock(idx, fakeDiv, skill);
    let m = fakeDiv.innerHTML.match(/累積：([☆]+)/);
    extraStar = m ? m[1].length : 0;
  }
  let box = document.createElement('div');
  box.className = 'skill-star-hint-block';
  box.style = 'margin-bottom:0.7em; font-size:1.13em;';
  box.innerHTML =
    `技能星級：<span class="star-yellow">${'✯'.repeat(skillStarNum)}</span><br>
     平衡星級：<span style="color:#2477c8">${'☆'.repeat(extraStar)}</span><br>
     <span style="color:#9d3b2d;font-size:0.97em;">如有☆ 請至負作用區累積足夠的★來抵銷☆</span>`;
  return box;
}

// ========== 即時刷新每顆技能星級提示 ==========
function refreshSkillStarHint(idx, skill) {
  const starHintBlock = document.querySelectorAll('.skill-star-hint-block')[idx];
  if (starHintBlock) {
    starHintBlock.replaceWith(renderSkillStarHintBlock(idx, skill));
  }
  // 主星條也要即時刷新
  if (typeof updateCurrentSkillStarTotal === "function") updateCurrentSkillStarTotal();
}

// ========== 技能快取載入（全部都要 call 這個） ==========
function initAllSkillListsThenRender() {
  const finish = () => {
    renderSkillsPage(formData.skills);
    if (typeof updateCurrentSkillStarTotal === "function") updateCurrentSkillStarTotal();
  };
  if (window.skillEffectsList && window.movementSkillsList && window.skillDebuffList) {
    finish();
    return;
  }
  initSkillEffectsList(() => {
    initMovementSkillsList(() => {
      initSkillDebuffList(() => {
        finish();
      });
    });
  });
}

// ========== main.js 是否載入檢查 ==========
if (typeof formData === 'undefined') {
  alert('請先載入 main.js！');
}

// ========== showModal 彈窗 ==========
function showModal(title, body) {
  document.getElementById('info-modal-title').innerText = title || '';
  document.getElementById('info-modal-body').innerText = body || '';
  document.getElementById('info-modal').style.display = '';
  document.getElementById('info-modal').onclick = function(e){
    if(e.target === this) this.style.display = 'none';
  }
}

// ================
// 3. 技能頁面主程式（renderSkillsPage）
// ================

function renderSkillsPage(skillsArr) {
  // ========== 進入頁面時自動偵測有沒有換職業/定位 ==========  
  // 用 window 變數記錄上一次的值
  const currRole = formData.preferred_role;
  const currOcc = JSON.stringify(formData.occupation_type || []);
  if (
    window._lastPreferredRole !== currRole ||
    window._lastOccupationType !== currOcc
  ) {
    // 發現有換 → 重置技能資料
    formData.skills = [
      {}, // 技能1
      {}, // 技能2
    ];
    // 更新暫存
    window._lastPreferredRole = currRole;
    window._lastOccupationType = currOcc;
    // 強制再跑一次(保證清空後正確進入)
    setTimeout(() => renderSkillsPage(formData.skills), 0);
    return;
  }

  let occupationCount = Array.isArray(formData.occupation_type) ? formData.occupation_type.length : 0;
  let starNum = 3, isProblem = false;
  if (occupationCount === 1) starNum = 8;
  else if (occupationCount === 2) starNum = 7;
  else if (occupationCount === 0) starNum = 3;
  else isProblem = true;

  // 上方主星狀態
  const starBar = document.getElementById('role-star-bar');
  const status = document.getElementById('star-status');
  if (starBar && status) {
    if (isProblem) {
      starBar.innerHTML = '?????';
      status.innerText = '本角色為問題學生';
    } else {
      starBar.innerHTML = '✯'.repeat(starNum);
      status.innerText = '';
    }
  }

  // 產生技能區塊
  const container = document.querySelector('.skills-container');
  if (!container) return;
  container.innerHTML = '';

  // 清空事件時專用：重置所有效果&移動

  for (let idx = 0; idx < skillsArr.length; idx++) {
    const skill = skillsArr[idx] || {};
    const block = document.createElement('div');
    block.className = 'skill-block';
    
    block.appendChild(renderSkillStarHintBlock(idx, skill));

    // --- 技能名稱區 ---
    const skillHeader = document.createElement('div');
    skillHeader.className = 'skill-header';
    skillHeader.innerHTML = `<label for="skill${idx + 1}-name">技能${idx + 1} 名稱</label>`;
    block.appendChild(skillHeader);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `skill${idx + 1}-name`;
    nameInput.placeholder = '請輸入技能名稱';
    nameInput.value = skill.skill_name || '';
    nameInput.addEventListener('input', (e) => {
        formData.skills[idx].skill_name = e.target.value;
        updateSkillPreview(); 
    });
    updateSkillPreview();
    block.appendChild(nameInput);

    // --- 3.5區：被動+CD ---
    let passiveAndCdDiv = document.createElement('div');
    passiveAndCdDiv.className = 'cd-block';
    renderSkillPassiveAndCdBlock(idx, passiveAndCdDiv, skill);
    block.appendChild(passiveAndCdDiv);

    // --- 3.55區：技能敘述 ---
    let descDiv = document.createElement('div');
    descDiv.className = 'desc-block';
    let descLabel = document.createElement('label');
    descLabel.innerText = '技能敘述';
    descDiv.appendChild(descLabel);
    let descInput = document.createElement('textarea');
    descInput.rows = 2;
    descInput.style.width = '100%';
    descInput.placeholder = '請填寫技能描述...';
    descInput.value = skill.description || '';
    descInput.addEventListener('input', (e) => {
        formData.skills[idx].description = e.target.value;
        updateSkillPreview();
    });
    descDiv.appendChild(descInput);
    block.appendChild(descDiv);

    // --- 技能施放對象 ---
    const targetMap = {
        tank:   ['self', 'enemy', 'ally'],
        attack: ['enemy', 'ally'],
        jammer: ['enemy', 'ally'],
        healer: ['self', 'ally', 'team'],
        buffer: ['self', 'ally', 'team'],
    };
    const labelMap = { self: '自身', enemy: '敵方', ally: '隊友(不含自身)', team: '我方', 'self+enemy': '自身+敵方' };
    const occ = Array.isArray(formData.occupation_type) ? formData.occupation_type : [];
    let allowedSet = new Set();
    occ.forEach(job => {
        if (targetMap[job]) targetMap[job].forEach(t => allowedSet.add(t));
    });
    // 四大特殊組合
    const hasAttack = occ.includes('attack'), hasJammer = occ.includes('jammer'), hasHealer = occ.includes('healer'), hasBuffer = occ.includes('buffer');
    if ((hasAttack && hasBuffer) || (hasAttack && hasHealer) || (hasJammer && hasHealer) || (hasJammer && hasBuffer)) allowedSet.add('self+enemy');
    let targetSelect = null;
   if (allowedSet.size > 0) {
    const targetLabel = document.createElement('label');
    targetLabel.innerText = '技能施放對象';
    block.appendChild(targetLabel);
    targetSelect = document.createElement('select');

    // 新增「請選擇」option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.innerText = '請選擇';
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    targetSelect.appendChild(placeholderOption);

    ['self','enemy','ally','team','self+enemy'].forEach(key => {
        if (allowedSet.has(key)) {
            const option = document.createElement('option');
            option.value = key;
            option.innerText = labelMap[key];
            targetSelect.appendChild(option);
        }
    });

    // 一開始預設為空

targetSelect.value = skill.target_faction || '';
    block.appendChild(targetSelect);
}


    // --- 技能施放對象人數 ---
    const maxTargetLabel = document.createElement('label');
    maxTargetLabel.innerText = '技能施放對象人數';
    block.appendChild(maxTargetLabel);
    const maxTargetSelect = document.createElement('select');
    [{ val: 1, label: '單體' }, { val: 2, label: '範圍 (2)' }, { val: 3, label: '範圍 (3)' }].forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.innerText = opt.label;
        maxTargetSelect.appendChild(option);
    });
    maxTargetSelect.value = skill.max_targets || 1;
    formData.skills[idx].max_targets = parseInt(maxTargetSelect.value, 10);   // <-- 關鍵：同步到 formData

    function syncMaxTargetWithTarget() {
        if (!targetSelect) return;
        const val = targetSelect.value;
        if (val === 'self' || val === 'self+enemy') {
            maxTargetSelect.value = 1;
            maxTargetSelect.disabled = true;
            formData.skills[idx].max_targets = 1;
        } else {
            maxTargetSelect.disabled = false;
            formData.skills[idx].max_targets = parseInt(maxTargetSelect.value, 10);
        }
    }
    if (targetSelect) syncMaxTargetWithTarget();
    block.appendChild(maxTargetSelect);

    // --- 技能有效距離 ---
    const rangeOptionsMap = {
        melee: [{ val: 'same_zone', label: '近距離（同區）' }],
        ranger: [{ val: 'cross_zone', label: '遠距離（跨區）' }, { val: 'all_zone', label: '遠近皆可（無限制距離）' }],
        balance: [{ val: 'same_zone', label: '近距離（同區）' }, { val: 'cross_zone', label: '遠距離（跨區）' }, { val: 'all_zone', label: '遠近皆可（無限制距離）' }]
    };
    const preferredRole = formData.preferred_role || 'balance';
    const rangeOptions = rangeOptionsMap[preferredRole] || rangeOptionsMap['balance'];
    const rangeLabel = document.createElement('label');
    rangeLabel.innerText = '技能有效距離';
    block.appendChild(rangeLabel);
    const rangeSelect = document.createElement('select');
    rangeOptions.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.val;
        option.innerText = opt.label;
        rangeSelect.appendChild(option);
    });
    rangeSelect.value = skill.range || rangeOptions[0].val;
    formData.skills[idx].range = rangeSelect.value;   // <-- 關鍵：同步到 formData
    block.appendChild(rangeSelect);



    // ====== 四大主要功能區塊，各自包一個 div ======
    let skillEffectDiv = document.createElement('div');
    block.appendChild(skillEffectDiv);

    let movementSkillDiv = document.createElement('div');
    block.appendChild(movementSkillDiv);

    let customSkillDiv = document.createElement('div');
    block.appendChild(customSkillDiv);

    // ========== 新增：負作用區塊上方的「累積☆」 ==========
    let extraStarDiv = document.createElement('div');
    extraStarDiv.className = 'accum-star-block';
    extraStarDiv.style.margin = '0.8em 0 0.3em 0';
    block.appendChild(extraStarDiv);
    let debuffDiv = document.createElement('div');
    block.appendChild(debuffDiv);

    // ======== 四大區塊首次渲染 ========
    renderSkillEffectBlock(idx, skillEffectDiv, targetSelect, maxTargetSelect, rangeSelect);
    renderMovementSkillsBlock(idx, movementSkillDiv, targetSelect, maxTargetSelect, rangeSelect, occ);
    renderCustomSkillEffectBlock(idx, customSkillDiv, targetSelect, maxTargetSelect);
    renderSkillDebuffBlock(idx, debuffDiv, occ, targetSelect, maxTargetSelect);
    renderSkillAccumStarBlock(idx, extraStarDiv, formData.skills[idx]);

    // ============ 三大 select 監聽 ============
    if (targetSelect) {
      targetSelect.addEventListener('change', () => {
        formData.skills[idx].target_faction = targetSelect.value;
        syncMaxTargetWithTarget();
        resetSkillEffectsAndMovement(formData.skills[idx]);
        renderSkillEffectBlock(idx, skillEffectDiv, targetSelect, maxTargetSelect, rangeSelect);
        renderMovementSkillsBlock(idx, movementSkillDiv, targetSelect, maxTargetSelect, rangeSelect, occ);
        renderCustomSkillEffectBlock(idx, customSkillDiv, targetSelect, maxTargetSelect);
        renderSkillDebuffBlock(idx, debuffDiv, occ, targetSelect, maxTargetSelect);
        renderSkillPassiveAndCdBlock(idx, block.querySelector('.cd-block'), formData.skills[idx]);
        renderSkillAccumStarBlock(idx, extraStarDiv, formData.skills[idx]);
        updateSkillPreview();
      });
    }
    maxTargetSelect.addEventListener('change', (e) => {
      formData.skills[idx].max_targets = parseInt(e.target.value, 10);
      resetSkillEffectsAndMovement(formData.skills[idx]);
      renderSkillEffectBlock(idx, skillEffectDiv, targetSelect, maxTargetSelect, rangeSelect);
      renderMovementSkillsBlock(idx, movementSkillDiv, targetSelect, maxTargetSelect, rangeSelect, occ);
      renderCustomSkillEffectBlock(idx, customSkillDiv, targetSelect, maxTargetSelect);
      renderSkillDebuffBlock(idx, debuffDiv, occ, targetSelect, maxTargetSelect);
      renderSkillPassiveAndCdBlock(idx, block.querySelector('.cd-block'), formData.skills[idx]);
      renderSkillAccumStarBlock(idx, extraStarDiv, formData.skills[idx]);
      updateSkillPreview();
    });
    rangeSelect.addEventListener('change', (e) => {
      formData.skills[idx].range = e.target.value;
      resetSkillEffectsAndMovement(formData.skills[idx]);
      renderMovementSkillsBlock(idx, movementSkillDiv, targetSelect, maxTargetSelect, rangeSelect, occ);
      renderSkillEffectBlock(idx, skillEffectDiv, targetSelect, maxTargetSelect, rangeSelect);
      renderCustomSkillEffectBlock(idx, customSkillDiv, targetSelect, maxTargetSelect);
      renderSkillDebuffBlock(idx, debuffDiv, occ, targetSelect, maxTargetSelect);
      renderSkillPassiveAndCdBlock(idx, block.querySelector('.cd-block'), formData.skills[idx]);
      renderSkillAccumStarBlock(idx, extraStarDiv, formData.skills[idx]);
      updateSkillPreview();

    });

    // --- 管理員刪除技能按鈕 ---
    if (typeof userRole !== 'undefined' && userRole === 'admin' && idx >= 2) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = '刪除此技能';
      delBtn.style.marginTop = '1em';
      delBtn.style.width = '100%';
      delBtn.style.background = '#c33';
      delBtn.style.color = '#fff';
      delBtn.onclick = function () {
        if (confirm('確定要刪除此技能嗎？')) {
          formData.skills.splice(idx, 1);
          initAllSkillListsThenRender();
        }
      };
      block.appendChild(delBtn);
    }

    container.appendChild(block);
  }
}


// ===============================
// 3.5 技能 CD 與被動技能區塊（完整版）
// ===============================

function renderSkillPassiveAndCdBlock(idx, block, skill) {
  block.innerHTML = '';

  // ========== 被動技能部分（第二技能起才出現） ========== 
  if (idx >= 1) {
    let passiveDiv = document.createElement('div');
    passiveDiv.className = 'passive-block';
    passiveDiv.style.margin = '0.8em 0';

    // 強制被動（不可取消、不可輸入、radio只能選once）
    let forcePassive = !!skill.is_passive && skill.passive_trigger_condition === '當角色血量<=0時觸發';

    // checkbox 和文字同一行
    let passiveLabel = document.createElement('label');
    passiveLabel.style.cursor = forcePassive ? 'not-allowed' : 'pointer';
    passiveLabel.style.display = 'inline-flex';
    passiveLabel.style.alignItems = 'center';
    passiveLabel.style.fontSize = '1.08em';

    let passiveChk = document.createElement('input');
    passiveChk.type = 'checkbox';
    passiveChk.id = `passive-chk-${idx}`;
    passiveChk.checked = !!skill.is_passive;
    passiveChk.disabled = forcePassive;

    passiveLabel.appendChild(passiveChk);
    passiveLabel.appendChild(document.createTextNode(' 被動技能'));
    passiveDiv.appendChild(passiveLabel);

    // 下方選項
    let passiveOptionsDiv = document.createElement('div');
    passiveOptionsDiv.style.display = passiveChk.checked ? '' : 'none';
    passiveOptionsDiv.style.marginTop = '0.4em';

    // radio 垂直排列
    let limits = [
      { val: 'once', label: '整場戰鬥只能觸發一次', star: '<span class="star-yellow">✯</span>-1' },
      { val: 'per_turn', label: '每回合至多可以觸發一次', star: '' },
      { val: 'unlimited', label: '達成條件即可觸發', star: '☆☆☆☆' }
    ];
    limits.forEach(opt => {
      let wrapper = document.createElement('div');
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.marginBottom = '0.25em';

      let radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `passive-limit-${idx}`;
      radio.value = opt.val;
      radio.checked = skill.passive_trigger_limit === opt.val;

      // 有弱點才能選 unlimited
     if (opt.val === 'unlimited') {
  let hasWeakness = !!formData.weakness_id;
  // 只有不是管理員才限制
  if (!hasWeakness && !(typeof userRole !== 'undefined' && userRole === 'admin')) {
    radio.disabled = true;
    wrapper.style.opacity = 0.45;
  }
}

      if (forcePassive) {
        radio.disabled = (opt.val !== 'once');
      }
      radio.style.marginRight = '7px';

      radio.addEventListener('change', (e) => {
        if (!forcePassive) formData.skills[idx].passive_trigger_limit = opt.val;
        // 立即更新累積星
        renderSkillAccumStarBlock && renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
        // 立即更新技能星級提示區塊（如有）
        if (typeof refreshSkillStarHint === "function") refreshSkillStarHint(idx, formData.skills[idx]);
      });

      let labelSpan = document.createElement('span');
      labelSpan.innerHTML = opt.label + (opt.star ? ' ' + opt.star : '');

      wrapper.appendChild(radio);
      wrapper.appendChild(labelSpan);
      passiveOptionsDiv.appendChild(wrapper);
    });

    // 觸發條件
    let condLabel = document.createElement('label');
    condLabel.innerText = '觸發條件：';
    condLabel.style.marginLeft = '1.4em';
    passiveOptionsDiv.appendChild(condLabel);
   let condInput = document.createElement('textarea');
condInput.style.marginLeft = '0.5em';
condInput.style.width = '70%';
condInput.rows = 1;
condInput.value = skill.passive_trigger_condition || '';
condInput.placeholder = '例：自身血量小於4時...（可多行輸入）';
condInput.disabled = forcePassive;
condInput.style.minHeight = '2.3em';
condInput.style.overflowY = 'hidden';
condInput.style.borderRadius = "0.5em";
condInput.style.fontSize = "1.02em";
condInput.style.padding = "0.5em";
condInput.style.background = "#f7f7fb";

// 自動高度
condInput.addEventListener('input', (e) => {
  if (!forcePassive) formData.skills[idx].passive_trigger_condition = e.target.value;
  condInput.style.height = '2.3em'; // 先重設
  condInput.style.height = (condInput.scrollHeight) + "px";
  renderSkillAccumStarBlock && renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
  if (typeof refreshSkillStarHint === "function") refreshSkillStarHint(idx, formData.skills[idx]);
    updateSkillPreview();

});
// 初始自動高度
setTimeout(()=>{ 
  condInput.style.height = '2.3em';
  condInput.style.height = (condInput.scrollHeight) + "px";
}, 0);

passiveOptionsDiv.appendChild(condInput);


    passiveChk.addEventListener('change', (e) => {
      if (forcePassive) return;
      formData.skills[idx].is_passive = e.target.checked;
      if (!e.target.checked) {
        formData.skills[idx].passive_trigger_limit = null;
        formData.skills[idx].passive_trigger_condition = '';
      }
      passiveOptionsDiv.style.display = e.target.checked ? '' : 'none';
      renderSkillPassiveAndCdBlock(idx, block, formData.skills[idx]);
      renderSkillAccumStarBlock && renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
      if (typeof refreshSkillStarHint === "function") refreshSkillStarHint(idx, formData.skills[idx]);
        updateSkillPreview();
    });

    passiveDiv.appendChild(passiveOptionsDiv);
    block.appendChild(passiveDiv);
  }

  // ========== 技能CD區（自動＋手動） ==========
  let cdDiv = document.createElement('div');
  cdDiv.className = 'cd-edit-block';
  cdDiv.style.display = 'flex';
  cdDiv.style.alignItems = 'center';
  cdDiv.style.margin = '0.7em 0';

  // 強制CD=0的技能效果ID
  let cdForceZeroEffectId = '27004404-af5a-43b0-bcd4-b8396616e4d8';
  let hasForceZero = (skill.effect_ids || []).includes(cdForceZeroEffectId);

  let isPassive = !!skill.is_passive;

  // 自動CD計算
  let autoCD = (hasForceZero ? 0 : ((typeof calcSkillCD === "function") ? calcSkillCD(idx, skill) : 0));
  let adminCD = (typeof userRole !== 'undefined' && userRole === 'admin' && skill.cd_val !== undefined) ? skill.cd_val : null;
  let finalCD = isPassive ? '' : (hasForceZero ? 0 : (adminCD !== null ? adminCD : autoCD));

  
// --- 顯示CD編輯區 ---
let calcLabel = document.createElement('label');
calcLabel.innerText = '計算CD ';
calcLabel.style.fontWeight = 'bold';
calcLabel.style.marginRight = '0.5em';
cdDiv.appendChild(calcLabel);

let calcInput = document.createElement('input');
calcInput.type = 'number';
calcInput.value = autoCD;
calcInput.style.width = '4em';
calcInput.style.margin = '0 8px 0 0';
calcInput.disabled = true;
calcInput.style.background = '#f3f3f3';
calcInput.style.color = '#888';
cdDiv.appendChild(calcInput);

// 管理員編輯
if (typeof userRole !== 'undefined' && userRole === 'admin' && !hasForceZero && !isPassive) {
  let cdLabel = document.createElement('label');
  cdLabel.innerText = '修改CD ';
  cdLabel.style.fontWeight = 'bold';
  cdLabel.style.marginLeft = '1.1em';
  cdDiv.appendChild(cdLabel);

  let cdInput = document.createElement('input');
  cdInput.type = 'number';
  cdInput.min = 0;
  cdInput.value = (adminCD !== null ? adminCD : autoCD);
  cdInput.style.width = '4em';
  cdInput.style.margin = '0 6px';
  cdDiv.appendChild(cdInput);

  let editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.innerText = '修改';
  editBtn.style.background = '#cc3232';
  editBtn.style.color = '#fff';
  editBtn.style.fontSize = '0.93em';
  editBtn.style.padding = '0 0.6em';
  editBtn.style.height = '1.7em';
  editBtn.style.width = '3em';
  editBtn.style.margin = '0.7em';
  editBtn.style.border = 'none';
  editBtn.style.borderRadius = '0.4em';
  editBtn.onclick = function () {
    formData.skills[idx].cd_val = Number(cdInput.value) || 0;
    renderSkillPassiveAndCdBlock(idx, block, formData.skills[idx]);
  updateSkillPreview();

  };
  cdDiv.appendChild(editBtn);
}

block.appendChild(cdDiv);

// ========== 技能CD實際顯示區 ==========
let cdShow = document.createElement('div');
cdShow.style.fontSize = '1em';
cdShow.style.color = '#222';
cdShow.style.marginTop = '0.25em';

if (isPassive) {
  cdShow.innerText = '技能CD：被動';
} else if (hasForceZero) {
  cdShow.innerText = '技能CD：0（已套用指定技能效果）';
} else {
  cdShow.innerText = `技能CD：${finalCD !== null && finalCD !== undefined && finalCD !== '' ? finalCD : ''}`;
}
block.appendChild(cdShow);
}



// ===============================
// 4. 技能效果區塊 (完整版，含互斥/特殊、CD即時刷新)
// ===============================

function renderSkillEffectBlock(idx, block, targetSelect, maxTargetSelect, rangeSelect) {
  block.innerHTML = '';

  const OCC_TO_EFFECT = {
    attack:  ['attack', 'attack_only'],
    tank:    ['tank', 'tank_only'],
    healer:  ['heal', 'heal_only'],
    buffer:  ['buff', 'buff_only'],
    jammer:  ['debuff', 'debuff_only']
  };
  const EFFECT_TYPE_LABEL = {
    attack: '攻擊', attack_only: '攻擊',
    heal: '恢復', heal_only: '恢復',
    tank: '坦克', tank_only: '坦克',
    buff: '增益', buff_only: '增益',
    debuff: '妨礙', debuff_only: '妨礙'
  };
  const banInSkill2 = 
        ["1511fbab-3767-4616-b45a-548a45251435",
  "56950199-5e6d-43f9-9857-64cb7b9de393",
  "81dd47b8-22be-44b4-8e06-c1cf8ff15ff1"
];
  const onlyInSkill2 = ["59f833c2-03da-4bc6-a67d-2dc15e156e4d"];
  const specialSkill2Id = "59f833c2-03da-4bc6-a67d-2dc15e156e4d";

  let occArr = Array.isArray(formData.occupation_type) ? formData.occupation_type : [];
  let typeList = [];
  if (occArr.length === 1) typeList = OCC_TO_EFFECT[occArr[0]] || [];
  else if (occArr.length === 2) occArr.forEach(j => { if (OCC_TO_EFFECT[j]) typeList.push(OCC_TO_EFFECT[j][0]); });
  else if (occArr.length >= 3) occArr.forEach(j => { if (OCC_TO_EFFECT[j]) typeList = typeList.concat(OCC_TO_EFFECT[j]); });
  typeList = [...new Set(typeList)];

  let target_faction = targetSelect ? targetSelect.value : '';
  let max_targets = maxTargetSelect ? Number(maxTargetSelect.value) : 1;

  // ====== 1. 標題 ======
  let title = document.createElement('label');
  title.style.fontWeight = 'bold';
  title.innerText = '技能效果';
  block.appendChild(title);

  // ====== 2. 資料源載入檢查 ======
  if (!window.skillEffectsList) {
    let loading = document.createElement('div');
    loading.innerText = '技能效果載入中...';
    loading.style.color = '#888';
    block.appendChild(loading);
    return;
  }
  let list = window.skillEffectsList;
  if (!list.length) {
    let none = document.createElement('div');
    none.innerText = '（沒有可用的技能效果）';
    none.style.color = '#c00';
    block.appendChild(none);
    return;
  }

  // ====== 3. 分組、顯示目標類型 ======
  let groupMap = {};
  list.forEach(eff => {
    let matchTarget = false;
    if (!target_faction) {
      matchTarget = true;
    } else if (target_faction === 'self+enemy') {
      matchTarget = (eff.target_faction === 'self' || eff.target_faction === 'enemy');
    } else {
      matchTarget = (eff.target_faction === target_faction);
    }
    if (idx === 1) {
      if (banInSkill2.includes(eff.effect_id)) return;
    } else {
      if (onlyInSkill2.includes(eff.effect_id)) return;
    }
    if (typeList.includes(eff.effect_type) && matchTarget && (!max_targets || eff.max_targets === max_targets)) {
      let t = eff.effect_type.replace('_only', '');
      if (!groupMap[t]) groupMap[t] = [];
      groupMap[t].push(eff);
    }
  });

  // 初始化已選
  if (!Array.isArray(formData.skills[idx].effect_ids)) formData.skills[idx].effect_ids = [];
  if (!Array.isArray(formData.skills[idx].effect_scores)) formData.skills[idx].effect_scores = [];

  // 處理互斥
  function getDisabledMap() {
    let effect_ids = formData.skills[idx].effect_ids || [];
    let disabledMap = {};
    [
      ['27004404-af5a-43b0-bcd4-b8396616e4d8', '1511fbab-3767-4616-b45a-548a45251435'],//CD0 追+1
      ['d29f8d8a-adcc-4042-8152-083348a1d9b9', '288abba4-f5ee-40fa-aeed-e09a40f2d431', 'e9e7e646-ebed-486b-acb9-e1743a276924'],// 123 單傷
      ['5de8e7ba-1365-4f42-89e8-53d66ab965ea', 'e5131613-2c90-4b29-abcc-070264bc7943'],//3人 /-1 -2 
      ['d646fbeb-e4e3-425c-99a5-59578a9d07a7', '69818ec2-50f6-490b-9a44-a7f8e622d721'],//2人 /-1 -2
      ['a7a479bd-75e4-4633-90cd-e50374e01ed4', '27004404-af5a-43b0-bcd4-b8396616e4d8'],// CC100 CD0
      ['417c9b84-5152-4070-9203-59d1e71238b2', 'ec1b764a-be7d-4aa5-ba91-e1e2da393fa9'],// 自身 +1 +2 
      ['b60ffd20-c804-4b7d-b040-91a4464acdd8', '46da302a-34a7-4729-ab30-1c8f35a28db6', 'd2b1d34a-30a6-4e0b-bb7b-3feb35ad8795', '6b2f058b-5726-4f71-8a91-e3cb19155a6d', '2f143df3-eee0-4458-a941-88fd329aead7'],//單回 +1 +2 +1~2 +3 +2~3
      ['c5c1fe8a-23d8-4678-8206-87673fc5f584', 'c9c2660b-f5c2-4b69-af47-143093af01b9'],//3人 / +1 +2 
      ['a774cb0a-385a-43ed-91ef-e810c31cc06b', '846d3cac-45b0-4737-9e2f-5970bb159b3b'],//2人 / +1  +2 
      ['24a11705-e6e0-4df9-a7a9-1d418f62c3af', '79f5bbd5-a67d-4d1b-bb1c-e7a5347b3c6a', '38b89849-588f-447d-86d0-d8306c38a6d9'],//盾*3
      ['6efb26b5-424a-41d7-bd53-79143fd4670d', '2427e58b-542b-47a7-a2c2-ae2eb232ee20'],//T自 +1 +2 
      ['89aa0bcb-827f-4d1b-adae-0842c5380b74', '0cac3649-8020-4573-bfbe-facff2be4a57', '80687236-6444-4559-852f-c6082b56ade8'],// 自防 +123
      ['deccc6b9-345a-4150-9548-f3ecbf749559', '4aa87d4a-9743-461a-86dd-ed902d1a03ca'],//笨蛋但咧
      ['d68e2730-d0c2-4db6-b69d-4eeef7be8336', 'ae5049cd-0dc6-434c-9f1b-fb993c0c0600'],//自攻CC +10 +5
      ['547a42fc-2e19-45fa-b832-95cb3e561b85', '2ad6ff82-65ce-4326-a141-d9a257fa5c8f'],//自閃CC +10 +5 
      ['03eab683-09e2-4914-b2a1-42e84613fef1', '9fbd94ba-3ba6-4c48-bef9-749a085fa747'],//單攻CC +10+5
      ['fdeb1522-d01c-44b6-ac59-a31d5dfecb02', '76ce35b8-39cf-4e69-a6b9-6f81119a2608'],//單閃CC +10+5
      ['94d3738a-7a21-4660-b21d-a354c99ddc57', '564c74d5-8458-4a94-8a02-0832d77e1c58'],//2人攻C+5 +10
      ['4abbc2f2-9263-4480-92bc-def9de161497', '6cdc252b-92cb-4b35-a160-a0932bea534a'],//2人閃C +5 +10
      ['24f12a39-20ba-4720-8909-d04c46388b98', '5c402704-1edb-4980-b600-81f2bd22b2e8'],//恢復量上升1 2
      ['ef9de935-9f1e-4896-b285-1ebb32c7f38f', '4fd41ef1-0e8a-4720-aec7-d76ac498d360'],//攻擊力上升 1 2
      ['ae8d0eb6-e9d3-4f98-a8f3-38298dd3f14d', 'c411cb6d-e9aa-4c6a-9e4e-463b3b3d36c2'],//防禦力上升 1 2
      ['08197b19-1585-4186-b0ae-893c1a2fef04', 'd0a9ae30-e7b3-40d1-8b71-e699c47911d7'],//單攻CC-5-10
      ['4bb43c90-b0c6-4d92-8dfe-b02f7913013c', '9eb3cd58-f516-4512-944d-d5b1a6b60e6f'],//單閃CC -5-10
      ['80810c2d-7443-459e-a08f-2be070d14bec', '6008abaf-bd51-45a6-90b4-e0536d40415c'],//2人攻C -5 -10
      ['4745cd68-aa15-47f3-9d4d-8d3a19da8a77', '2b060db8-e49e-4bd8-bc29-c4ef9bce3ee7'],//2人閃C -5 -10
      ['9308d0d5-b341-412f-96bf-2a216ad100c3', '81dd47b8-22be-44b4-8e06-c1cf8ff15ff1'],//修但空大
      ['9308d0d5-b341-412f-96bf-2a216ad100c3', '53c83c44-9d2f-44f9-804a-c3c6a642c69a'],//空大+CD
      ['3d93b6e2-efcb-4c9d-bc1c-d0c3b6557aa5', 'f41d22f5-5c8f-4ae1-92e7-268739adccac'],
      ['5148fdd5-b62c-47b9-9c83-a579f8696005', 'dfa810db-d56d-4908-be12-4204240b8b43'],
      ['7e66d6be-962b-404d-9d45-261706489fc1', 'd93898e5-e9cd-46e3-a13d-f227c72ca83c'],
    ].forEach(group => {
      let checked = group.find(id => effect_ids.includes(id));
      if (checked) group.forEach(id => { if (id !== checked) disabledMap[id] = true; });
    });
    return disabledMap;
  }
  let disabledMap = getDisabledMap();

  let effectIds = formData.skills[idx].effect_ids || [];
  let isSpecialSkill2Checked = effectIds.includes(specialSkill2Id);
  let hasOtherSkillChecked = effectIds.some(eid => eid !== specialSkill2Id);

  Object.keys(groupMap).forEach(type => {
    let groupTitle = document.createElement('div');
    groupTitle.className = 'effect-group-title';
    groupTitle.innerText = EFFECT_TYPE_LABEL[type] || type;
    groupTitle.style = "margin-top:0.7em;font-weight:bold;color:#223B77;font-size:1.09em;";
    block.appendChild(groupTitle);

    groupMap[type].forEach(effect => {
      let wrap = document.createElement('label');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.fontSize = '1em';
      wrap.style.margin = '0.14em';

      let chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.value = effect.effect_id;
      chk.checked = effectIds.includes(effect.effect_id);

      if (disabledMap[effect.effect_id]) chk.disabled = true;
      if (effect.effect_id === specialSkill2Id) {
        if (idx !== 1) chk.disabled = true;
        if (hasOtherSkillChecked && !chk.checked) chk.disabled = true;
        chk.onchange = (e) => {
          if (e.target.checked) {
            formData.skills[idx].effect_ids = [specialSkill2Id];
            formData.skills[idx].effect_scores = [effect.score || 0];
            formData.skills[idx].use_movement = false;
            formData.skills[idx].move_ids = '';
            formData.skills[idx].is_passive = true;
            formData.skills[idx].passive_trigger_limit = 'once';
            formData.skills[idx].passive_trigger_condition = '當角色血量<=0時觸發';
          } else {
            formData.skills[idx].effect_ids = [];
            formData.skills[idx].effect_scores = [];
            formData.skills[idx].is_passive = false;
            formData.skills[idx].passive_trigger_limit = null;
            formData.skills[idx].passive_trigger_condition = '';
          }
          renderSkillEffectBlock(idx, block, targetSelect, maxTargetSelect, rangeSelect);
          renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
          renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
          refreshSkillStarHint(idx, formData.skills[idx]); 
          if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
          updateSkillPreview();
        };
      } else {
        if (isSpecialSkill2Checked) chk.disabled = true;
        chk.onchange = (e) => {
          let arr = formData.skills[idx].effect_ids;
          let scoreArr = formData.skills[idx].effect_scores;
          let score = effect.score || 0;
          if (e.target.checked) {
            if (!arr.includes(effect.effect_id)) arr.push(effect.effect_id);
            scoreArr.push(score);
          } else {
            let pos = arr.indexOf(effect.effect_id);
            if (pos !== -1) arr.splice(pos, 1);
            let scorePos = scoreArr.indexOf(score);
            if (scorePos !== -1) scoreArr.splice(scorePos, 1);
          }
          renderSkillEffectBlock(idx, block, targetSelect, maxTargetSelect, rangeSelect);
          renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
          renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
          refreshSkillStarHint(idx, formData.skills[idx]); 
          if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
          updateSkillPreview();
        };
      }

      wrap.appendChild(chk);
      let nameSpan = document.createElement('span');
      nameSpan.innerText = ` ${effect.effect_name} `;
      wrap.appendChild(nameSpan);

      let infoLink = document.createElement('a');
      infoLink.href = '#';
      infoLink.innerText = '詳細';
      infoLink.className = 'effect-detail-link';
      infoLink.style.fontSize = '0.5rem';
      infoLink.style.marginLeft = '6px';
      infoLink.style.textDecoration = 'underline';
      infoLink.style.color = '#2477c8';
      infoLink.addEventListener('click', (e) => {
        e.preventDefault();
        showModal(effect.effect_name, effect.description);
      });
      wrap.appendChild(infoLink);

      let starSpan = document.createElement('span');
      starSpan.className = 'star-yellow';
      starSpan.style.marginLeft = '4px';
      let score = effect.score || 0;
      starSpan.innerHTML = '✯'.repeat(Math.floor(score / 5));
      wrap.appendChild(starSpan);

      block.appendChild(wrap);
    });
  });
}


// ===============================
// 5.移動技能區塊區塊
// ===============================

function renderMovementSkillsBlock(idx, block, targetSelect, maxTargetSelect, rangeSelect, occArr) {
  block.innerHTML = '';

  if (formData.skills[idx].is_passive) {
    formData.skills[idx].use_movement = false;
    formData.skills[idx].move_ids = '';
    return;
  }
  let max_targets = maxTargetSelect ? Number(maxTargetSelect.value) : 1;
  if (max_targets !== 1) {
    formData.skills[idx].use_movement = false;
    formData.skills[idx].move_ids = '';
    return;
  }
  if (!window.movementSkillsList) {
    let loading = document.createElement('div');
    loading.innerText = '移動技能載入中...';
    loading.style.color = '#888';
    block.appendChild(loading);
    return;
  }
  let list = window.movementSkillsList.slice();
  const mustShowMoveId = "80c6f054-b655-4ff7-8660-009a29a41f8a";
  if (!list.some(m => m.move_id === mustShowMoveId)) {
    // 你可自定義自動補特殊技能
  }
  let target_faction = targetSelect ? targetSelect.value : '';
  let range = rangeSelect ? rangeSelect.value : '';
  let showList = list.filter(move => {
    if (move.move_id === mustShowMoveId) return true;
    let f = (!target_faction || move.target_faction === target_faction);
    let t = (!max_targets || move.max_targets === max_targets);
    let r = (!range || move.range === range);
    return f && t && r;
  });

  let outerLabel = document.createElement('label');
  outerLabel.style.display = 'flex';
  outerLabel.style.alignItems = 'center';
  let moveStarNum = (occArr && occArr.length === 1) ? 4 : 3;

  let mainChk = document.createElement('input');
  mainChk.type = 'checkbox';
  mainChk.checked = !!formData.skills[idx].use_movement;
  mainChk.style.marginRight = '4px';
  outerLabel.appendChild(mainChk);

  let titleSpan = document.createElement('span');
  titleSpan.innerText = '移動技能  ';
  outerLabel.appendChild(titleSpan);

  let starSpan = document.createElement('span');
  starSpan.className = 'star-yellow';
  starSpan.style.marginLeft = '8px';
  starSpan.innerHTML = '✯'.repeat(moveStarNum);
  outerLabel.appendChild(starSpan);

  block.appendChild(outerLabel);

  mainChk.addEventListener('change', (e) => {
    formData.skills[idx].use_movement = e.target.checked;
    formData.skills[idx].move_score = e.target.checked ? 15 : 0;
    if (!e.target.checked) {
      formData.skills[idx].move_ids = '';
    } else {
      if (showList.length > 0) {
        formData.skills[idx].move_ids = showList[0].move_id;
      }
    }
    renderMovementSkillsBlock(idx, block, targetSelect, maxTargetSelect, rangeSelect, occArr);
    renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
      refreshSkillStarHint(idx, formData.skills[idx]); 
    renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
    if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
    updateSkillPreview();
  });

  if (mainChk.checked) {
    if (!showList.length) {
      let noneTip = document.createElement('div');
      noneTip.style.color = '#888';
      noneTip.innerText = '（沒有符合條件的移動技能）';
      block.appendChild(noneTip);
      return;
    }
    showList.forEach(move => {
      let wrap = document.createElement('label');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.fontSize = '1em';
      wrap.style.marginBottom = '0.14em';
      wrap.style.marginLeft = '1.8em';

      let radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `move_radio_${idx}`;
      radio.value = move.move_id;
      radio.checked = formData.skills[idx].move_ids === move.move_id;
      radio.addEventListener('change', (e) => {
        formData.skills[idx].move_ids = e.target.value;
        renderMovementSkillsBlock(idx, block, targetSelect, maxTargetSelect, rangeSelect, occArr);
        renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
        refreshSkillStarHint(idx, formData.skills[idx]); 
        renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
        if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
          updateSkillPreview();

      });
      wrap.appendChild(radio);

      let nameSpan = document.createElement('span');
      nameSpan.innerText = ` ${move.move_name || '[未命名]'} `;
      wrap.appendChild(nameSpan);

      let infoLink = document.createElement('a');
      infoLink.href = '#';
      infoLink.innerText = '詳細';
      infoLink.className = 'move-detail-link';
      infoLink.style.fontSize = '0.5rem';
      infoLink.style.marginLeft = '6px';
      infoLink.style.textDecoration = 'underline';
      infoLink.style.color = '#2477c8';
      infoLink.addEventListener('click', (e) => {
        e.preventDefault();
        showModal(move.move_name, move.description);
      });
      wrap.appendChild(infoLink);

      block.appendChild(wrap);
    });
  }
}


// ===============================
// 6. 原創技能效果區塊
// ===============================

function renderCustomSkillEffectBlock(idx, block, targetSelect, maxTargetSelect) {
  let oldDiv = block.querySelector('.custom-effect-block');
  if (oldDiv) oldDiv.remove();
  if (idx < 1) return;

  if (typeof formData.skills[idx].custom_effect_enable !== "boolean")
    formData.skills[idx].custom_effect_enable = false;
  if (typeof formData.skills[idx].custom_effect_score !== "number")
    formData.skills[idx].custom_effect_score = 0;

  let effectDiv = document.createElement('div');
  effectDiv.className = 'custom-effect-block';
  effectDiv.style.marginTop = '1.2em';

  let row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';

  let customChk = document.createElement('input');
  customChk.type = 'checkbox';
  customChk.id = `custom-effect-${idx}`;
  customChk.checked = !!formData.skills[idx].custom_effect_enable;
  customChk.style.marginRight = '4px';

  let label = document.createElement('label');
  label.htmlFor = `custom-effect-${idx}`;
  label.innerText = '原創技能';
  label.style.margin = '5px';

  let starSpan = document.createElement('span');
  starSpan.className = 'star-yellow';
  starSpan.style.marginLeft = '8px';
  starSpan.innerHTML = '✯✯✯';

  row.appendChild(customChk);
  row.appendChild(label);
  row.appendChild(starSpan);
  effectDiv.appendChild(row);

  let inputDiv = document.createElement('div');
  inputDiv.style.marginTop = '0.7em';
  inputDiv.style.display = customChk.checked ? '' : 'none';

  let textarea = document.createElement('textarea');
textarea.placeholder = '請輸入原創技能描述...';
textarea.rows = 3;
textarea.style.width = '100%';
textarea.value = formData.skills[idx].custom_effect_description || '';
textarea.addEventListener('input', (e) => {
  formData.skills[idx].custom_effect_description = e.target.value;
  updateSkillPreview();  
});

inputDiv.appendChild(textarea);

customChk.addEventListener('change', (e) => {
  formData.skills[idx].custom_effect_enable = e.target.checked;
  inputDiv.style.display = e.target.checked ? '' : 'none';
  formData.skills[idx].custom_effect_score = e.target.checked ? 15 : 0;
  renderCustomSkillEffectBlock(idx, block, targetSelect, maxTargetSelect);
  renderSkillAccumStarBlock(idx, document.querySelectorAll('.accum-star-block')[idx], formData.skills[idx]);
  refreshSkillStarHint(idx, formData.skills[idx]); 
  renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
  if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
  updateSkillPreview();  
});


  effectDiv.appendChild(inputDiv);
  block.appendChild(effectDiv);
}


// ===============================
// 6.5 累積☆計算區塊
// ===============================

function renderSkillAccumStarBlock(idx, block, skill) {
  // 清空自己
  block.innerHTML = '';
  block.className = 'accum-star-block';
  block.style.margin = '0.8em 0 0.3em 0';

  let extraStar = 0;
  let starDetail = [];

  // (1) 被動-無限制觸發
  if (skill.is_passive && skill.passive_trigger_limit === 'unlimited') {
    extraStar += 4;
    starDetail.push('被動無限制觸發');
  }

  // (2) 技能分數（效果分、移動分、原創分）
  let scoreSum = 0;
  if (Array.isArray(skill.effect_scores)) scoreSum += skill.effect_scores.reduce((a, b) => a + b, 0);

  // =============== 這裡改成動態分數 ===============
  // 移動技能分數：單職20分，雙職/多職15分
  let occCount = (formData.occupation_type && Array.isArray(formData.occupation_type)) ? formData.occupation_type.length : 0;
  if (skill.use_movement) {
    if (occCount === 1) scoreSum += 20;
    else if (occCount >= 2) scoreSum += 15;
  }
  // ===============================================

  // 原創效果分數，也15分
  if (skill.custom_effect_enable) {
    scoreSum += 15;
  }

  if (scoreSum >= 30) {
    extraStar += 2;
    starDetail.push('技能分數達標 ');
  }
  // (3) cc_score
  let ccScore = 0;
  if (Array.isArray(skill.effect_ids) && window.skillEffectsList) {
    skill.effect_ids.forEach(eid => {
      let eff = window.skillEffectsList.find(e => e.effect_id === eid);
      if (eff && eff.cc_score) ccScore += Number(eff.cc_score);
    });
  }
  let ccStars = 0;
  if (ccScore >= 15) {
    ccStars = Math.floor(ccScore / 5);
    if (ccStars > 6) ccStars = 6; // 最多6顆
    extraStar += ccStars;
    starDetail.push(`平衡打擊`);
  }

  // 內容
  block.innerHTML =
    '累積：' + '☆'.repeat(extraStar) +
    (starDetail.length ? ('　　<span style="color:#2477c8;font-size:0.96em;">（' + starDetail.join('、') + '）</span>') : '');
}

  
// ===============================
// 7. 負作用效果區塊（快取優化版）
// ===============================

function renderSkillDebuffBlock(idx, block, occ, targetSelect, maxTargetSelect) {
  block.innerHTML = '';

  let debuffDiv = document.createElement('div');
  debuffDiv.className = 'skill-debuff-block';
  debuffDiv.style.marginTop = '1.2em';

  // 星星顯示
  let skill = formData.skills[idx];
  let holdScore = 0;
  if (Array.isArray(skill.debuffs)) skill.debuffs.forEach(d => {
    if (d.offset_score) holdScore += Number(d.offset_score);
  });
  let holdStarDiv = document.createElement('div');
  let holdStarNum = Math.floor(holdScore / 5);
  holdStarDiv.innerText = `持有：${'★'.repeat(holdStarNum)}`;
  holdStarDiv.style.marginBottom = '0.5em';
  debuffDiv.appendChild(holdStarDiv);

  // 已選負作用區
  let chosenDiv = document.createElement('div');
  chosenDiv.style.marginBottom = '1em';
  if (Array.isArray(skill.debuffs) && skill.debuffs.length) {
    skill.debuffs.forEach((d, chooseIdx) => {
      let row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.margin = '3px 0';
      row.innerHTML = `# ${d.debuff_name || '[未選]'} `;

      let info = document.createElement('a');
      info.href = '#';
      info.innerText = '詳細';
      info.style.margin = '5px';
      info.style.fontSize = '0.5em';
      info.onclick = e => {
        e.preventDefault();
        showModal(d.debuff_name || '', d.description || '');
      };
      row.appendChild(info);

      let star = document.createElement('span');
      let starNum = Math.floor((d.offset_score || 0) / 5);
      star.innerText = '★'.repeat(starNum);
      star.style.margin = '0 5px';
      row.appendChild(star);

      let objLabel = document.createElement('span');
      objLabel.innerText = (d.applied_to === 'toally') ? '目標' : '自身';
      objLabel.style.margin = '0.5em';
      objLabel.style.fontSize = '0.95em';
      objLabel.style.color = '#245';
      objLabel.style.padding = '0';
      row.appendChild(objLabel);

      let delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.innerText = '刪除';
      delBtn.style.padding = '0 0.6em';
      delBtn.style.width = 'auto';
      delBtn.style.height = '1.7em';
      delBtn.style.margin = '8px';
      delBtn.style.fontSize = '0.9em';
     delBtn.onclick = function () {
  formData.skills[idx].debuffs.splice(chooseIdx, 1);
  renderSkillDebuffBlock(idx, block, occ, targetSelect, maxTargetSelect);
  // ↓↓↓ 這三行加上去
  refreshSkillStarHint(idx, formData.skills[idx]);
  renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
  if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
  updateSkillPreview();
};

      row.appendChild(delBtn);

      chosenDiv.appendChild(row);
    });
  } else {
    chosenDiv.innerText = '『請蒐集與☆相同或更多的★』';
  }
  debuffDiv.appendChild(chosenDiv);

  // 狀態控制
  if (!renderSkillDebuffBlock._showAdd) renderSkillDebuffBlock._showAdd = {};
  let isShowAdd = !!renderSkillDebuffBlock._showAdd[idx];

  // 新增/關閉負作用主按鈕
  let mainAddBtn = document.createElement('button');
  mainAddBtn.type = 'button';
  mainAddBtn.textContent = isShowAdd ? '關閉新增負作用' : '新增負作用';
  mainAddBtn.style.marginBottom = '0.7em';
  mainAddBtn.className = 'big-main-btn';
  mainAddBtn.onclick = function () {
    renderSkillDebuffBlock._showAdd[idx] = !isShowAdd;
    renderSkillDebuffBlock(idx, block, occ, targetSelect, maxTargetSelect);
  };
  debuffDiv.appendChild(mainAddBtn);

  // ========== 新增區塊內容（只鎖同id） ==========
  if (isShowAdd) {
    if (!window.skillDebuffList) {
      let loading = document.createElement('div');
      loading.innerText = '負作用資料載入中...';
      loading.style.color = '#888';
      debuffDiv.appendChild(loading);
      block.appendChild(debuffDiv);
      return;
    }
    let debuffList = window.skillDebuffList.slice();
    if (!debuffList.length) {
      let none = document.createElement('div');
      none.innerText = '（沒有任何負作用資料）';
      none.style.color = '#c00';
      debuffDiv.appendChild(none);
      block.appendChild(debuffDiv);
      return;
    }
    let isAdmin = (typeof userRole !== 'undefined' && userRole === 'admin');
    let selfId = formData.student_id;
    debuffList = debuffList.filter(d =>
      (d.debuff_type !== 'special' && d.debuff_type !== 'empty') ||
      (isAdmin || d.student_id === selfId)
    );

    // 取得所有已選的 debuff_id
    let existDebuffIds = Array.isArray(skill.debuffs) ? skill.debuffs.map(d => d.debuff_id) : [];

    // 四個只能給自身的 id
    const mustSelfDebuffIds = [
      "dccd3ff9-5ff5-4229-b3a1-9f6428f53caa",
      "85633080-0b45-44ea-90b9-73fe94a212bf",
      "41941ea2-70ee-4781-9dd1-f7b1a8992341",
      "fae6a1c4-9ff6-48b8-a496-524c9f51c001"
    ];

    let groupBy = {};
    debuffList.forEach(d => {
      if (!groupBy[d.debuff_type]) groupBy[d.debuff_type] = [];
      groupBy[d.debuff_type].push(d);
    });

    let addBlock = document.createElement('div');
    addBlock.style.margin = '0.5em 0 1.2em 0.3em';

    Object.keys(groupBy).forEach(type => {
      let typeLabel = '';
      switch(type) {
        case 'cc': typeLabel = 'CC'; break;
        case 'cd': typeLabel = 'CD'; break;
        case 'pass': typeLabel = '行動機會-1'; break;
        case 'debuff': typeLabel = '一般負面'; break;
        case 'bleed': typeLabel = '損血'; break;
        case 'def': typeLabel = '防禦力提升'; break;
        case 'atk': typeLabel = '攻擊力提升'; break;
        case 'special': typeLabel = '特殊'; break;
        default: typeLabel = type;
      }
      let typeDiv = document.createElement('div');
      typeDiv.style.fontWeight = 'bold';
      typeDiv.innerText = typeLabel;
      addBlock.appendChild(typeDiv);

      groupBy[type].forEach(debuff => {
        // 禁止重複選同一個 debuff_id（只有這個會 disable）
        let disabled = existDebuffIds.includes(debuff.debuff_id);

        let row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.margin = '0.1em 0 0.1em 0.6em';
        row.style.justifyContent = 'space-between';

        let leftWrap = document.createElement('div');
        leftWrap.style.display = 'flex';
        leftWrap.style.alignItems = 'center';

        let radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `add_debuff_${idx}_${type}`;
        radio.value = debuff.debuff_id;
        radio.disabled = disabled;
        leftWrap.appendChild(radio);

        let nameSpan = document.createElement('span');
        nameSpan.innerText = ` ${debuff.debuff_name} `;
        leftWrap.appendChild(nameSpan);

        let detailA = document.createElement('a');
        detailA.href = '#';
        detailA.innerText = '詳細';
        detailA.style.fontSize = '0.5rem';
        detailA.style.marginLeft = '6px';
        detailA.style.textDecoration = 'underline';
        detailA.style.color = '#2477c8';
        detailA.onclick = e => {
          e.preventDefault();
          showModal(debuff.debuff_name, debuff.description);
        };
        leftWrap.appendChild(detailA);

        let starSpan = document.createElement('span');
        starSpan.style.marginLeft = '4px';
        starSpan.innerText = '★'.repeat(Math.floor((debuff.offset_score || 0) / 5));
        leftWrap.appendChild(starSpan);

        row.appendChild(leftWrap);

        // 右區（目標選擇與新增）
        let rightWrap = document.createElement('div');
        rightWrap.style.display = 'flex';
        rightWrap.style.alignItems = 'center';

        // 支援目標選擇（只有補/增單體才出現）
        let allowTarget = false;
        let occStr = occ.slice().sort().join(',');
        if (
          (occStr === 'buffer') ||
          (occStr === 'healer') ||
          (occStr === 'buffer,healer')
        ) {
          if (maxTargetSelect && maxTargetSelect.value == '1') allowTarget = true;
        }
        let objSelect = null;
        if (mustSelfDebuffIds.includes(debuff.debuff_id)) {
          allowTarget = false;
        }
        if (allowTarget) {
          objSelect = document.createElement('select');
          objSelect.style.margin = '5px';
          objSelect.style.fontSize = '0.98em';
          objSelect.style.width = '8em';
          objSelect.style.maxWidth = '4.5em';
          objSelect.style.boxSizing = 'border-box';
          objSelect.style.padding = '2px';
          [
            { val: 'self', label: '自身' },
            { val: 'toally', label: '目標' }
          ].forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.val;
            option.innerText = opt.label;
            objSelect.appendChild(option);
          });
          rightWrap.appendChild(objSelect);
        }

        let addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.innerText = '新增';
        addBtn.style.marginLeft = '0.7em';
        addBtn.style.fontSize = '0.93em';
        addBtn.style.padding = '0 0.6em';
        addBtn.style.margin = '5px';
        addBtn.style.width = 'auto';
        addBtn.style.height = '1.7em';
        addBtn.onclick = function () {
          let allRadios = addBlock.querySelectorAll(`input[name=add_debuff_${idx}_${type}]`);
          let checkedRadio = null;
          allRadios.forEach(r => { if (r.checked) checkedRadio = r; });
          if (!checkedRadio) {
            alert('請先選擇確認一個負作用');
            return;
          }
          let chosen = {
            debuff_id: debuff.debuff_id,
            debuff_name: debuff.debuff_name,
            offset_score: debuff.offset_score,
            effect_code: debuff.effect_code,
            debuff_type: debuff.debuff_type,
            description: debuff.description
          };
          if (mustSelfDebuffIds.includes(debuff.debuff_id)) {
            chosen.applied_to = 'self';
          } else if (allowTarget && objSelect) {
            chosen.applied_to = objSelect.value;
          } else {
            chosen.applied_to = 'self';
          }
          if (!Array.isArray(formData.skills[idx].debuffs)) formData.skills[idx].debuffs = [];
          formData.skills[idx].debuffs.push(chosen);
  renderSkillDebuffBlock._showAdd[idx] = false;
  renderSkillDebuffBlock(idx, block, occ, targetSelect, maxTargetSelect);
  // ↓↓↓ 這三行加上去
  refreshSkillStarHint(idx, formData.skills[idx]);
  renderSkillPassiveAndCdBlock(idx, document.querySelectorAll('.cd-block')[idx], formData.skills[idx]);
  if (typeof updateCurrentSkillStarTotal === 'function') updateCurrentSkillStarTotal();
  updateSkillPreview();
};
        rightWrap.appendChild(addBtn);

        row.appendChild(rightWrap);
        addBlock.appendChild(row);
      });
    });

    let closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.innerText = '關閉新增負作用';
    closeBtn.style.display = 'block';
    closeBtn.style.margin = '1em auto 0 auto';
    closeBtn.className = 'big-main-btn';
    closeBtn.onclick = function () {
      renderSkillDebuffBlock._showAdd[idx] = false;
      renderSkillDebuffBlock(idx, block, occ, targetSelect, maxTargetSelect);
    };
    addBlock.appendChild(closeBtn);

    debuffDiv.appendChild(addBlock);
  }

  block.appendChild(debuffDiv);
}


// ===============================
// 8. 監控職業、頁面、送出
// ===============================
// 職業下拉選單監控
const occSel = document.querySelector('#occupation-type-select');
if (occSel) {
  occSel.addEventListener('change', function () {
    // 你可以根據新職業決定要有幾個技能欄位（下面示範預設2個）
    formData.skills = [
      {},  // 技能1空白
      {}   // 技能2空白
      // 若有更多技能，照這樣再加
    ];
    // 或是直接清空 formData.skills = [];

initAllSkillListsThenRender();
  });
}


// 管理員新增技能按鈕
const addBtn = document.getElementById('admin-add-skill-btn');
if (addBtn) {
  addBtn.onclick = function () {
    formData.skills.push({});
initAllSkillListsThenRender();
  };
  addBtn.style.display = (typeof userRole !== 'undefined' && userRole === 'admin') ? '' : 'none';
}

// 上一步
const backBtn = document.getElementById('back-8');
if (backBtn) {
  backBtn.onclick = function () {
    showStep(7);
  };
}
const formStep8 = document.getElementById('form-step-8');
if (formStep8) {
  formStep8.onsubmit = async function (e) {
    e.preventDefault();
    let allGood = true, errMsg = "";

    formData.skills.forEach((skill, idx) => {
      // 技能名稱必填
      if (!skill.skill_name || !skill.skill_name.trim()) {
        allGood = false;
        errMsg += `請填寫技能${idx + 1}名稱\n`;
      }
      // 技能敘述必填
      if (!skill.description || !skill.description.trim()) {
        allGood = false;
        errMsg += `請填寫技能${idx + 1}敘述\n`;
      }
      // 技能施放對象必選
      if (!skill.target_faction || skill.target_faction === '') {
        allGood = false;
        errMsg += `請選擇技能${idx + 1}的施放對象\n`;
      }






       // --- 檢查有無移動自身、CD == 1 ---
  const MOVE_SELF_ID = '80c6f054-b655-4ff7-8660-009a29a41f8a';
  const CD_ZERO_ID  = '27004404-af5a-43b0-bcd4-b8396616e4d8';
  const skillCD = getSkillFinalCD(skill, idx);

  // 需求一：有自身移動 + CD = 1
  if (
    Array.isArray(skill.effect_ids) &&
    skill.effect_ids.includes(MOVE_SELF_ID) &&
    Number(skillCD) === 1
  ) {
    allGood = false;
    errMsg += `技能${idx+1}「${skill.skill_name||'未命名'}」「自身移動」效果之際能不得 CD=1，請修改技能效果\n`;
  }

  // 需求二：同時選到 CD0 效果 + 自身移動
  if (
    Array.isArray(skill.effect_ids) &&
    skill.effect_ids.includes(MOVE_SELF_ID) &&
    skill.effect_ids.includes(CD_ZERO_ID)
  ) {
    allGood = false;
    errMsg += `技能${idx+1}「${skill.skill_name||'未命名'}」不能同時選擇「CD0」與「自身移動」的技能效果，請重新選擇\n`;
  }







      
      // 技能效果、移動技能、原創技能三選一
      if (
        (!Array.isArray(skill.effect_ids) || skill.effect_ids.length === 0)
        && !skill.use_movement
        && !skill.custom_effect_enable
      ) {
        allGood = false;
        errMsg += `技能${idx + 1}必須至少選一個效果\n`;
      }
      // 累積☆判斷
      let extraStar = 0;
      if (skill.is_passive && skill.passive_trigger_limit === 'unlimited') extraStar += 4;
      let scoreSum = (Array.isArray(skill.effect_scores) ? skill.effect_scores.reduce((a, b) => a + b, 0) : 0)
        + (skill.use_movement ? ((Array.isArray(formData.occupation_type) && formData.occupation_type.length === 1) ? 20 : 15) : 0)
        + (skill.custom_effect_enable ? 15 : 0);
      if (scoreSum >= 30) extraStar += 2;
      let ccScore = 0;
      if (Array.isArray(skill.effect_ids) && window.skillEffectsList) {
        skill.effect_ids.forEach(eid => {
          let eff = window.skillEffectsList.find(e => e.effect_id === eid);
          if (eff && eff.cc_score) ccScore += Number(eff.cc_score);
        });
      }
      let ccStars = 0;
      if (ccScore >= 15) {
        ccStars = Math.floor(ccScore / 5);
        if (ccStars > 6) ccStars = 6;
        extraStar += ccStars;
      }
      let holdScore = (Array.isArray(skill.debuffs) ? skill.debuffs.reduce((a, d) => a + Number(d.offset_score || 0), 0) : 0);
      let holdStar = Math.floor(holdScore / 5);

      if (extraStar > holdStar) {
        allGood = false;
        errMsg += `技能${idx + 1}「${skill.skill_name || '未命名'}」累積☆未被足夠★抵銷！\n`;
      }
    });

    if (!allGood) {
      alert(errMsg);
      return;
    }

    // 真正送出資料
    try {
      await submitAllStudentData();

    } catch (err) {
      alert("送出失敗：" + (err.message || err));
    }
  };
}


// 初始化畫面
if (typeof formData !== 'undefined' && Array.isArray(formData.skills)) {
  initAllSkillListsThenRender();
}


// ========== 同步 ==========
function updateSkillPreview() {
  // 預設 formData.skills 可能沒填滿
  const s1 = formData.skills[0] || {};
  const s2 = formData.skills[1] || {};

  // 技能1
  const domSkill1Name = document.querySelector('[data-key="student_skills.1.skill_name"]');
  if(domSkill1Name) domSkill1Name.innerText = s1.skill_name || '';

 const domSkill1Cd = document.querySelector('[data-key="student_skills.1.final_cd"]');
if(domSkill1Cd) {
  domSkill1Cd.innerText = getSkillFinalCD(s1, 0);
}


  const domSkill1Targets = document.querySelector('[data-key="student_skills.1.max_targets"]');
  if(domSkill1Targets) domSkill1Targets.innerText = s1.max_targets ? 
    (s1.max_targets == 1 ? '單體' : `範圍 (${s1.max_targets})`) : '';

  const domSkill1Range = document.querySelector('[data-key="student_skills.1.range"]');
  if(domSkill1Range) domSkill1Range.innerText = s1.range ?
    ({ same_zone: '近距離', cross_zone: '遠距離', all_zone: '無限制距離' }[s1.range] || s1.range) : '';

  const domSkill1Desc = document.querySelector('[data-key="student_skills.1.description"]');
  if(domSkill1Desc) domSkill1Desc.innerText = s1.description || '';

  const domSkill1Effs = document.querySelector('[data-key="student_skills.1.effectsAndDebuffs"]');
  if(domSkill1Effs) domSkill1Effs.innerText = buildSkillEffectsPreview(s1);

  // 技能2
  const domSkill2Name = document.querySelector('[data-key="student_skills.2.skill_name"]');
  if(domSkill2Name) domSkill2Name.innerText = s2.skill_name || '';

 const domSkill2Cd = document.querySelector('[data-key="student_skills.2.final_cd"]');
if(domSkill2Cd) {
  domSkill2Cd.innerText = getSkillFinalCD(s2, 1);
}


  const domSkill2Targets = document.querySelector('[data-key="student_skills.2.max_targets"]');
  if(domSkill2Targets) domSkill2Targets.innerText = s2.max_targets ?
    (s2.max_targets == 1 ? '單體' : `範圍 (${s2.max_targets})`) : '';

  const domSkill2Range = document.querySelector('[data-key="student_skills.2.range"]');
  if(domSkill2Range) domSkill2Range.innerText = s2.range ?
    ({ same_zone: '近距離', cross_zone: '遠距離', all_zone: '無限制距離' }[s2.range] || s2.range) : '';

  // 技能2的描述需要被動條件
  const domSkill2Desc = document.querySelector('[data-key="student_skills.2.description"]');
  if(domSkill2Desc) {
    let str = '';
    if(s2.is_passive && s2.passive_trigger_condition) str += (s2.passive_trigger_condition + '\n');
    str += s2.description || '';
    domSkill2Desc.innerText = str.trim();
  }

  // 技能2的效果/原創/負作用
  const domSkill2Effs = document.querySelector('[data-key="student_skills.2.effectsAndDebuffs"]');
  if(domSkill2Effs) domSkill2Effs.innerText = buildSkillEffectsPreview(s2, true);

  // 額外技能
const extraSkills = (formData.skills||[]).slice(2);
const domSkillDiamond = document.querySelector('.skill-diamond');
if(domSkillDiamond && extraSkills.length > 0){
  let popupText = extraSkills.map(skill =>
    (skill.skill_name || '[未命名]') + '\n' +
    (skill.description || '')
  ).join('\n\n');
  domSkillDiamond.setAttribute('value', popupText);
  domSkillDiamond.style.display = '';
} else if(domSkillDiamond) {
  domSkillDiamond.setAttribute('value', '');
  domSkillDiamond.style.display = 'none';
}

if (domSkillDiamond) {
  domSkillDiamond.onclick = function() {
    const txt = this.getAttribute('value');
    if (txt && txt.length > 0) {
      showModal('額外技能', txt); // 這裡不用 replace
    }
  };
}

}

// 協助把效果、移動、原創、負作用轉為卡面顯示
function buildSkillEffectsPreview(skill, showCustom) {
  let arr = [];
  // 技能效果
  if(Array.isArray(skill.effect_ids) && window.skillEffectsList) {
    skill.effect_ids.forEach(eid=>{
      let eff = window.skillEffectsList.find(e=>e.effect_id===eid);
      if(eff) arr.push('# '+eff.effect_name);
    });
  }
  // 移動技能
  if(skill.use_movement && window.movementSkillsList) {
    let move = window.movementSkillsList.find(m=>m.move_id===skill.move_ids);
    if(move) arr.push('# '+move.move_name);
  }
  // 原創技能
  if(showCustom && skill.custom_effect_enable && skill.custom_effect_description) {
    arr.push(skill.custom_effect_description);
  }
  // 負作用
if (Array.isArray(skill.debuffs)) {
  skill.debuffs.forEach(d => {
    let label = '';
    // toally → 目標；self → 自身
    if (d.applied_to === 'toally') label = '目標 ';
    else label = '自身 ';
    // 顯示：# 目標 debuff名稱
    arr.push(`# ${label}${d.debuff_name || ''}`);
  });
}

  return arr.join('\n');
}


// 自動切換到第8頁
/*document.querySelectorAll('.form-page').forEach(f => f.classList.remove('active'));
const step8 = document.getElementById('form-step-8');
if (step8) step8.classList.add('active');*/

 
// ========== END ========== 
