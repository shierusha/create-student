const OVERRIDE_STUDENT_IDS = ['434cbc99-9a4f-4334-bc71-7236b8daf51c'];

let lastSubmitTime = 0;
const submitCooldown = 60 * 1000; // 60秒

// 角色名稱重複檢查
async function checkStudentNameDuplicate(name, student_id = null) {
  let query = client.from('students').select('student_id').eq('name', name);
  if (student_id) query = query.neq('student_id', student_id);
  let { data } = await query;
  return data && data.length > 0;
}

// 主送出
async function submitAllStudentData() {
  const now = Date.now();
  if (now - lastSubmitTime < submitCooldown) return;
  lastSubmitTime = now;

  const player_id = window.currentPlayerId || localStorage.getItem('player_id');
  if (!player_id) { alert('請先登入！'); return; }

  // －－－ 新增：越權旗標 －－－
  let overrideUsed = false;

  // 0. 非法請求檢查（WAIT / PASS / ERROR 視為越權）— 但允許白名單 student_id 直接越過
  if (formData && formData.student_id) {
    // 若是允許越權的學生，直接跳過檢查
    if (OVERRIDE_STUDENT_IDS.includes(formData.student_id)) {
      overrideUsed = true; // 記錄有啟用越權
    } else {
      const { data: reviewRow, error: reviewErr } = await client
        .from('student_reviews')
        .select('status')
        .eq('student_id', formData.student_id)
        .maybeSingle();

      if (reviewErr) {
        alert('檢查審核狀態失敗，請稍後再試：' + reviewErr.message);
        lastSubmitTime = 0;
        return;
      }

      // 非白名單的話：WAIT / PASS / ERROR 都視為越權入侵 → 銷毀 + 跳走
      if (reviewRow && ['WAIT', 'PASS', 'ERROR'].includes(reviewRow.status)) {
        try {
          await client.from('student_reviews')
            .update({ status: 'ERROR' })
            .eq('student_id', formData.student_id);

          await client.from('students')
            .update({ student_code: null })
            .eq('student_id', formData.student_id);
        } catch (e) { /* 忽略 */ }

        lastSubmitTime = 0;
        const go = confirm('非法入侵!非法入侵!非法入侵! 資料已銷毀！');
        if (go) {
          window.location.href = 'https://shierusha.github.io/login/login';
        }
        return;
      }
    }
  }
// 保險：先確認 formData 存在，再確保 skills 一定是陣列
  if (!formData) {
    alert('表單資料遺失，請重新整理頁面');
    lastSubmitTime = 0;
    return;
  }
  if (!Array.isArray(formData.skills)) formData.skills = [];
  // 防呆：被動不可搭配移動
  for (let i = 0; i < (formData.skills || []).length; i++) {
    const s = formData.skills[i];
    if (s && s.is_passive && s.use_movement) {
      alert(`技能${i + 1} 不可同時為「被動技能」並勾選「移動技能」！\n請取消其中一項。`);
        lastSubmitTime = 0;
      return;
    }
  }

  // 名稱唯一
  const isDup = await checkStudentNameDuplicate(formData.name, formData.student_id);
  if (isDup) { alert('角色名稱已被申請，請換一個！');
      lastSubmitTime = 0;
  return; }

  // 計算總分與分類
  let totalSkillScore = (formData.skills || [])
    .map(s => (typeof calcSingleSkillStar === "function" ? calcSingleSkillStar(s) : 0))
    .reduce((a, b) => a + b, 0);
  let occNum = (formData.occupation_type || []).length;
  let expectScore = occNum === 1 ? 8 : occNum === 2 ? 7 : 3;
  let isOriginal = formData.skills.some(s => s.custom_effect_enable);
  let isPassive = formData.skills.some(s => s.is_passive);
  let isScoreWrong = totalSkillScore !== expectScore;
  let isMultiJob = occNum > 2;
  let stuType = "normal";
  if (isMultiJob || isScoreWrong) stuType = "problem";
  else if (isOriginal || isPassive) stuType = "special";

  // 組學生資料
  let studentsInsert = {
    player_id,
    name: formData.name,
    nickname: formData.nickname,
    hide_name: !!formData.hide_name,   // 👈 就是這一行
    alignment: formData.alignment,
    gender: formData.gender,
    age: formData.age,
    height: formData.height,
    weight: formData.weight,
    race: formData.race,
    personality: formData.personality,
    background: formData.background,
    likes: formData.likes,
    hate: formData.hate,
    element: Array.isArray(formData.element) && formData.element.length > 0 ? formData.element : null,
    weakness_id: formData.weakness_id || null,
    preferred_role: formData.preferred_role,
    starting_position: formData.starting_position || null,
    occupation_type: Array.isArray(formData.occupation_type) && formData.occupation_type.length > 0 ? formData.occupation_type : null,
    total_skill_score: totalSkillScore,
    student_type: stuType,
    student_code: null
  };
  if (formData.student_id) studentsInsert.student_id = formData.student_id;

  // 1. upsert 學生
  let { data: stuData, error: stuErr } = await client
    .from('students')
    .upsert([studentsInsert], { onConflict: 'student_id' })
    .select()
    .single();
  if (stuErr) {
    if (stuErr.message && stuErr.message.includes('students_name_key')) {
      alert('角色名稱已被申請，請換一個！'); return;
    }
    alert('角色基本資料寫入失敗：' + (stuErr?.message || '')); return;
  }
  const student_id = stuData.student_id;

  // 2. notes（全刪再寫）
  await client.from('student_notes').delete().eq('student_id', student_id);
  const notes = (formData.notes || []).map((n, i) => ({
    student_id,
    content: n.content,
    is_public: !!n.is_public,
    sort_order: i + 1
  }));
  if (notes.length > 0) {
    let { error: noteErr } = await client.from('student_notes').insert(notes);
    if (noteErr) { alert('角色設定寫入失敗：' + noteErr.message); return; }
  }

  // ⭐️ 3.1. 查出舊技能，收集要砍掉的 custom_skill_uuid & passive_trigger_id
  const { data: oldSkills } = await client.from('student_skills')
    .select('id, custom_skill_uuid, passive_trigger_id')
    .eq('student_id', student_id);

  // ⭐️ 3.2. 砍所有技能效果/負作用連結表
  if (oldSkills && oldSkills.length) {
    for (let s of oldSkills) {
      await client.from('student_skill_effect_links').delete().eq('skill_id', s.id);
      await client.from('student_skill_debuff_links').delete().eq('skill_id', s.id);
    }
    // ⭐️ 3.3. 砍所有 student_skills（主表要先砍，才能砍 FK 物件）
    await client.from('student_skills').delete().eq('student_id', student_id);

    // ⭐️ 3.4. 砍 passive_trigger / skill_effects（只砍本角色用過的）
    for (let s of oldSkills) {
      if (s.passive_trigger_id)
        await client.from('passive_trigger').delete().eq('trigger_id', s.passive_trigger_id);
      if (s.custom_skill_uuid)
        await client.from('skill_effects').delete().eq('effect_id', s.custom_skill_uuid);
    }
  }

  // ⭐️ 4. 處理原創技能（新資料：先產生 UUID，之後要插入 skill_effects 用）
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    if (skill.custom_effect_enable && !skill.custom_skill_uuid) {
      skill.custom_skill_uuid = crypto.randomUUID();
    }
  }

  // ⭐️ 5. 處理被動觸發條件（新資料，先建立被動技能條件，再記錄 id）
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    let passive_trigger_id = null;
    if (skill.is_passive && skill.passive_trigger_condition && skill.passive_trigger_condition.trim()) {
      // 永遠都 insert 新的 passive_trigger
let { data: pData, error: pErr } = await client
  .from('passive_trigger')
  .insert([{
    condition: skill.passive_trigger_condition,
    asso_stu: student_id      // ★ 加這個，方便之後刪除過 RLS
  }])
  .select()
  .single();
      if (pErr) { alert('被動技能觸發條件寫入失敗：' + pErr.message); return; }
      passive_trigger_id = pData.trigger_id;
      skill.passive_trigger_id = passive_trigger_id;
    } else {
      passive_trigger_id = null;
    }
    skill._passive_trigger_id_to_save = passive_trigger_id;
  }

  // ⭐️ 6. 寫 skill_effects（原創技能，這時舊的已經砍掉，可以直接 insert）
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    if (skill.custom_effect_enable && skill.custom_skill_uuid) {
      let { error: effErr } = await client.from('skill_effects').insert([{
        effect_id: skill.custom_skill_uuid,
        effect_name: formData.name + '的原創技能',
        description: skill.custom_effect_description,
        target_faction: skill.target_faction,
        max_targets: skill.max_targets,
        effect_type: null,
        score: 15,
        cc_score: null,
        effect_code: '',
        effect_id_code: ''
      }]);
      if (effErr) { alert('原創技能寫入失敗：' + effErr.message); return; }
    }
  }

  // ⭐️ 7. 寫入 student_skills（這時所有 FK id 都已經拿到）
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    const cd = typeof getSkillFinalCD === "function" ? getSkillFinalCD(skill, i) : null;
    let skillInsert = {
      student_id,
      skill_slot: i + 1,
      skill_name: skill.skill_name,
      description: skill.description,
      final_score: typeof calcSingleSkillStar === "function" ? calcSingleSkillStar(skill) : 0,
      final_cd: (cd === "X" || cd === "" || cd == null) ? null : Number(cd),
      is_passive: !!skill.is_passive,
      passive_trigger_limit: skill.passive_trigger_limit || null,
      linked_movement_id: skill.use_movement ? skill.move_ids : null,
      max_targets: skill.max_targets,
      target_faction: (skill.target_faction === '自身+敵人') ? null : skill.target_faction,
      require_cc: Array.isArray(skill.effect_ids) && skill.effect_ids.some(eid => {
        let eff = window.skillEffectsList.find(e => e.effect_id === eid);
        return eff && (eff.effect_type === 'attack' || eff.effect_type === 'attack_only');
      }),
      custom_skill_uuid: skill.custom_effect_enable ? skill.custom_skill_uuid : null,
      range: skill.range || null,
      passive_trigger_id: skill._passive_trigger_id_to_save || null
    };
    let { data: skillData, error: skillErr } = await client.from('student_skills').insert([skillInsert]).select().single();
    if (skillErr || !skillData) {
      alert(`技能${i + 1}寫入失敗：` + (skillErr?.message || '')); return;
    }
    skill._skill_id = skillData.id;
  }

  // ⭐️ 8. 技能效果/負作用連結表（新技能建立後才可以寫連結）
  const { data: skills } = await client.from('student_skills').select('id').eq('student_id', student_id);
  const skillIds = skills.map(s => s.id);

  if (skillIds.length > 0) {
    await client.from('student_skill_effect_links').delete().in('skill_id', skillIds);
    await client.from('student_skill_debuff_links').delete().in('skill_id', skillIds);
  }
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    if (Array.isArray(skill.effect_ids) && skill.effect_ids.length > 0) {
      let rows = skill.effect_ids.map(eid => ({
        skill_id: skill._skill_id,
        effect_id: eid
      }));
      await client.from('student_skill_effect_links').insert(rows);
    }
    if (Array.isArray(skill.debuffs) && skill.debuffs.length > 0) {
      let rows = skill.debuffs.map(d => ({
        skill_id: skill._skill_id,
        debuff_id: d.debuff_id,
        applied_to: d.applied_to || 'self'
      }));
      await client.from('student_skill_debuff_links').insert(rows);
    }
  }

 // 9. 審核狀態：只有「新建學生」時才補一筆（status = NULL），修改時完全不動審核表
if (!formData.student_id) {
  // 只在不存在時插入，status 一律 NULL（空值）
  const { data: existed } = await client
    .from('student_reviews')
    .select('review_id')
    .eq('student_id', student_id)
    .maybeSingle();

  if (!existed) {
    await client.from('student_reviews').insert([{
      reviewer_id: null,
      student_id,
      status: null,               
      review_notes: null,
      submitted_at: new Date().toISOString()
    }]);
  }
} 
  alert(overrideUsed
    ? '班班長的工具寵尋著班班長的味道來了_ 喵'
    : '啊! 有一隻看起來很厭世的戴貓帽子的公務貓把申請單叼走了!!'
  );
  window.location.href = 'https://shierusha.github.io/create-student/player_manage';
}
