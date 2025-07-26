async function submitAllStudentData() {
  const player_id = window.currentPlayerId || localStorage.getItem('player_id');
  if (!player_id) {
    alert('請先登入！');
    return;
  }
  // --------- 技能分數計算 ---------
  let totalSkillScore = (formData.skills || [])
    .map(s => (typeof calcSingleSkillStar === "function" ? calcSingleSkillStar(s) : 0))
    .reduce((a, b) => a + b, 0);
  let occNum = (formData.occupation_type || []).length;
  let expectScore = occNum === 1 ? 8 : occNum === 2 ? 7 : 3;

  // --------- 自動判斷 type ---------
  let isOriginal = formData.skills.some(s => s.custom_effect_enable);
  let isPassive = formData.skills.some(s => s.is_passive);
  let isScoreWrong = totalSkillScore !== expectScore;
  let isMultiJob = occNum > 2;
  // 優先順序：問題學生 > 特殊學生 > 一般學生
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

  // --- upsert 學生 ---
  let { data: stuData, error: stuErr } = await client
    .from('students')
    .upsert([studentsInsert], { onConflict: 'student_id' })
    .select()
    .single();

  if (stuErr || !stuData) {
    alert('角色基本資料寫入失敗：' + (stuErr?.message || ''));
    return;
  }
  const student_id = stuData.student_id;

  // --- 角色設定/裏設定 notes ---
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

  // --- 原創技能寫進 skill_effects（如有） ---
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

  // --- 技能資料表 student_skills ---
  await client.from('student_skills').delete().eq('student_id', student_id);
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    let skillInsert = {
      student_id,
      skill_slot: i + 1,
      skill_name: skill.skill_name,
      description: skill.description,
      final_score: typeof calcSingleSkillStar === "function" ? calcSingleSkillStar(skill) : 0,
      final_cd: typeof getSkillFinalCD === "function" ? getSkillFinalCD(skill, i) : null,
      is_passive: !!skill.is_passive,
      passive_trigger_limit: skill.passive_trigger_limit || null,
      passive_trigger_condition: skill.passive_trigger_condition || null,
      passive_trigger_code: null,
      linked_movement_id: skill.use_movement ? skill.move_ids : null,
      max_targets: skill.max_targets,
      target_faction: skill.target_faction,
      require_cc: Array.isArray(skill.effect_ids) && skill.effect_ids.some(eid => {
        let eff = window.skillEffectsList.find(e => e.effect_id === eid);
        return eff && (eff.effect_type === 'attack' || eff.effect_type === 'attack_only');
      }),
      custom_skill_uuid: skill.custom_skill_uuid || null,
      range: skill.range || null,
    };
    let { data: skillData, error: skillErr } = await client.from('student_skills').insert([skillInsert]).select().single();
    if (skillErr || !skillData) {
      alert(`技能${i + 1}寫入失敗：` + (skillErr?.message || ''));
      return;
    }
    skill._skill_id = skillData.id;
  }

  // --- 技能中介表 ---
  await client.from('student_skill_effect_links').delete().eq('student_id', student_id);
  await client.from('student_skill_debuff_links').delete().eq('student_id', student_id);
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    if (Array.isArray(skill.effect_ids) && skill.effect_ids.length > 0) {
      let rows = skill.effect_ids.map(eid => ({
        student_id,
        skill_id: skill._skill_id,
        effect_id: eid
      }));
      await client.from('student_skill_effect_links').insert(rows);
    }
    if (Array.isArray(skill.debuffs) && skill.debuffs.length > 0) {
      let rows = skill.debuffs.map(d => ({
        student_id,
        skill_id: skill._skill_id,
        debuff_id: d.debuff_id
      }));
      await client.from('student_skill_debuff_links').insert(rows);
    }
  }

  // --- 審核狀態 student_reviews ---
  await client.from('student_reviews').delete().eq('student_id', student_id);
  await client.from('student_reviews').insert([{
    reviewer_id: null,
    student_id,
    status: null,
    review_notes: null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null
  }]);

  alert('資料儲存成功！');
}
