// 先把判斷角色名稱是否重複的方法放最前面
async function checkStudentNameDuplicate(name, student_id = null) {
  let query = client.from('students').select('student_id').eq('name', name);
  if (student_id) {
    query = query.neq('student_id', student_id);
  }
  let { data, error } = await query;
  return data && data.length > 0;
}

// --- 主送出方法 ---
async function submitAllStudentData() {
  const player_id = window.currentPlayerId || localStorage.getItem('player_id');
  if (!player_id) {
    alert('請先登入！');
    return;
  }

  // 檢查名稱唯一
  const isDup = await checkStudentNameDuplicate(formData.name, formData.student_id);
  if (isDup) {
    alert('角色名稱已被申請，請換一個！');
    return;
  }

  // 分數、類型自動判斷
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

  let studentsInsert = {
  player_id,
  name: formData.name,
  nickname: formData.nickname,
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
// 這裡才加上 student_id，只有編輯時才會有
if (formData.student_id) {
  studentsInsert.student_id = formData.student_id;
}


  // ---------- 1. upsert 學生 ----------
  let { data: stuData, error: stuErr } = await client
    .from('students')
    .upsert([studentsInsert], { onConflict: 'student_id' })
    .select()
    .single();

  if (stuErr) {
    if (stuErr.message && stuErr.message.includes('students_name_key')) {
      alert('角色名稱已被申請，請換一個！');
      return;
    }
    alert('角色基本資料寫入失敗：' + (stuErr?.message || ''));
    return;
  }
  const student_id = stuData.student_id;

  // ---------- 2. notes ----------
  await client.from('student_notes').delete().eq('student_id', student_id);
  const notes = (formData.notes || []).map((n, i) => ({
    student_id,
    content: n.content,
    is_public: !!n.is_public,
    sort_order: i + 1
  }));
  if (notes.length > 0) {
    let { error: noteErr } = await client.from('student_notes').insert(notes);
    if (noteErr) {
      alert('角色設定寫入失敗：' + noteErr.message);
      return;
    }
  }

  // ---------- 3. 原創技能 skill_effects（如有） ----------
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    if (skill.custom_effect_enable && !skill.custom_skill_uuid) {
      let { data: effData, error: effErr } = await client.from('skill_effects').insert([{
        effect_name: formData.name + '的原創技能',
        description: skill.custom_effect_description,
        target_faction: skill.target_faction,
        max_targets: skill.max_targets,
        effect_type: null,
        score: 15,
        cc_score: null,
        effect_code: '',
        effect_id_code: ''
      }]).select().single();
      if (effErr) {
        alert('原創技能寫入失敗：' + effErr.message);
        return;
      }
      skill.custom_skill_uuid = effData.effect_id;
    }
  }

  // ---------- 4. 處理被動技能觸發條件 passive_trigger ----------
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    let passive_trigger_id = null;
    if (skill.is_passive && skill.passive_trigger_condition && skill.passive_trigger_condition.trim()) {
      // 編輯
      if (skill.passive_trigger_id) {
        let { error: pErr } = await client
          .from('passive_trigger')
          .update({ condition: skill.passive_trigger_condition })
          .eq('trigger_id', skill.passive_trigger_id);
        if (pErr) { alert('被動技能觸發條件寫入失敗：' + pErr.message); return; }
        passive_trigger_id = skill.passive_trigger_id;
      } else {
        // 新增
        let { data: pData, error: pErr } = await client
          .from('passive_trigger')
          .insert([{ condition: skill.passive_trigger_condition }])
          .select()
          .single();
        if (pErr) { alert('被動技能觸發條件寫入失敗：' + pErr.message); return; }
        passive_trigger_id = pData.trigger_id;
        skill.passive_trigger_id = passive_trigger_id; // 寫回防重複
      }
    } else {
      passive_trigger_id = null;
    }
    skill._passive_trigger_id_to_save = passive_trigger_id;
  }
// ---------- 5. 技能 student_skills ----------

// 1. 先查出所有舊的技能
const { data: oldSkills } = await client.from('student_skills')
  .select('id, custom_skill_uuid, passive_trigger_id')
  .eq('student_id', student_id);

if (oldSkills && oldSkills.length) {
  for (let s of oldSkills) {
    // 砍 custom_skill_uuid 對應的原創技能（如果有）
    if (s.custom_skill_uuid) {
      await client.from('skill_effects').delete().eq('effect_id', s.custom_skill_uuid);
    }
    // 砍 passive_trigger_id 對應的被動條件（如果有）
    if (s.passive_trigger_id) {
      await client.from('passive_trigger').delete().eq('trigger_id', s.passive_trigger_id);
    }
    // 砍技能效果/負作用連結
    await client.from('student_skill_effect_links').delete().eq('skill_id', s.id);
    await client.from('student_skill_debuff_links').delete().eq('skill_id', s.id);
  }
}

// 2. 再刪掉技能本體
await client.from('student_skills').delete().eq('student_id', student_id);

// 3. 重新寫入新技能（這就是你原本的 for 迴圈）
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
    target_faction: skill.target_faction,
    require_cc: Array.isArray(skill.effect_ids) && skill.effect_ids.some(eid => {
      let eff = window.skillEffectsList.find(e => e.effect_id === eid);
      return eff && (eff.effect_type === 'attack' || eff.effect_type === 'attack_only');
    }),
    custom_skill_uuid: skill.custom_skill_uuid || null,
    range: skill.range || null,
    passive_trigger_id: skill._passive_trigger_id_to_save || null
  };
  let { data: skillData, error: skillErr } = await client.from('student_skills').insert([skillInsert]).select().single();
  if (skillErr || !skillData) {
    alert(`技能${i + 1}寫入失敗：` + (skillErr?.message || ''));
    return;
  }
  skill._skill_id = skillData.id;
}

  // ---------- 6. 技能效果/負作用連結表 ----------
  // 改：先查所有 skill_id 再 in 刪除
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

  // ---------- 7. 新增審核狀態 student_reviews ----------
  await client.from('student_reviews').delete().eq('student_id', student_id);
  await client.from('student_reviews').insert([{
    reviewer_id: null,
    student_id,
    status: null,
    review_notes: null,
    submitted_at: new Date().toISOString()
  }]);
  window.location.href = 'https://shierusha.github.io/create-student/player_manage';

}
