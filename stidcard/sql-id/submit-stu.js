async function submitAllStudentData() {
  const submitBtn = document.getElementById('submit-8');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '送出中...';
  }

  const player_id = window.currentPlayerId || localStorage.getItem('player_id');
  if (!player_id) {
    alert('請先登入！');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
    return;
  }

  // 防呆：被動不可搭配移動
  for (let i = 0; i < (formData.skills || []).length; i++) {
    const s = formData.skills[i];
    if (s && s.is_passive && s.use_movement) {
      alert(`技能${i + 1} 不可同時為「被動技能」並勾選「移動技能」！\n請取消其中一項。`);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
      return;
    }
  }

  // 名稱唯一
  const isDup = await checkStudentNameDuplicate(formData.name, formData.student_id);
  if (isDup) {
    alert('角色名稱已被申請，請換一個！');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
    return;
  }

  // 組學生資料
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
    total_skill_score: (formData.skills || []).map(s => (typeof calcSingleSkillStar === "function" ? calcSingleSkillStar(s) : 0)).reduce((a, b) => a + b, 0),
    student_type: (() => {
      let occNum = (formData.occupation_type || []).length;
      let expectScore = occNum === 1 ? 8 : occNum === 2 ? 7 : 3;
      let totalSkillScore = (formData.skills || []).map(s => (typeof calcSingleSkillStar === "function" ? calcSingleSkillStar(s) : 0)).reduce((a, b) => a + b, 0);
      let isOriginal = formData.skills.some(s => s.custom_effect_enable);
      let isPassive = formData.skills.some(s => s.is_passive);
      let isScoreWrong = totalSkillScore !== expectScore;
      let isMultiJob = occNum > 2;
      if (isMultiJob || isScoreWrong) return "problem";
      else if (isOriginal || isPassive) return "special";
      return "normal";
    })(),
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
      alert('角色名稱已被申請，請換一個！');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
      return;
    }
    alert('角色基本資料寫入失敗：' + (stuErr?.message || ''));
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
    return;
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
    if (noteErr) {
      alert('角色設定寫入失敗：' + noteErr.message);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
      return;
    }
  }

  // 3.1. 查出舊技能
  const { data: oldSkills } = await client.from('student_skills')
    .select('id, custom_skill_uuid, passive_trigger_id')
    .eq('student_id', student_id);

  // 3.2. 砍所有技能效果/負作用連結表
  if (oldSkills && oldSkills.length) {
    for (let s of oldSkills) {
      await client.from('student_skill_effect_links').delete().eq('skill_id', s.id);
      await client.from('student_skill_debuff_links').delete().eq('skill_id', s.id);
    }
    // 3.3. 砍所有 student_skills
    await client.from('student_skills').delete().eq('student_id', student_id);

    // 3.4. 砍 passive_trigger / skill_effects
    for (let s of oldSkills) {
      if (s.passive_trigger_id)
        await client.from('passive_trigger').delete().eq('trigger_id', s.passive_trigger_id);
      if (s.custom_skill_uuid)
        await client.from('skill_effects').delete().eq('effect_id', s.custom_skill_uuid);
    }
  }

  // 4. 處理原創技能（先產生 UUID）
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    if (skill.custom_effect_enable && !skill.custom_skill_uuid) {
      skill.custom_skill_uuid = crypto.randomUUID();
    }
  }

  // 5. 處理被動觸發條件
  for (let i = 0; i < formData.skills.length; i++) {
    let skill = formData.skills[i];
    let passive_trigger_id = null;
    if (skill.is_passive && skill.passive_trigger_condition && skill.passive_trigger_condition.trim()) {
      let { data: pData, error: pErr } = await client
        .from('passive_trigger')
        .insert([{ condition: skill.passive_trigger_condition }])
        .select()
        .single();
      if (pErr) {
        alert('被動技能觸發條件寫入失敗：' + pErr.message);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
        return;
      }
      passive_trigger_id = pData.trigger_id;
      skill.passive_trigger_id = passive_trigger_id;
    } else {
      passive_trigger_id = null;
    }
    skill._passive_trigger_id_to_save = passive_trigger_id;
  }

  // 6. 寫 skill_effects（原創技能）
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
      if (effErr) {
        alert('原創技能寫入失敗：' + effErr.message);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
        return;
      }
    }
  }

  // 7. 寫入 student_skills
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
      alert(`技能${i + 1}寫入失敗：` + (skillErr?.message || ''));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '送出'; }
      return;
    }
    skill._skill_id = skillData.id;
  }

  // 8. 技能效果/負作用連結表
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

  // 9. 新增審核狀態
  await client.from('student_reviews').delete().eq('student_id', student_id);
  await client.from('student_reviews').insert([{
    reviewer_id: null,
    student_id,
    status: null,
    review_notes: null,
    submitted_at: new Date().toISOString()
  }]);

  alert("啊! 有一隻貓把申請單叼走了!!");
  // 送出成功就不恢復按鈕了，因為頁面跳轉
  window.location.href = 'https://shierusha.github.io/create-student/player_manage';
}
