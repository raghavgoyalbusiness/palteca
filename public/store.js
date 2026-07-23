/* ===================== Palteca — gamification store ===================== */
(function () {
  'use strict';
  const KEY = 'palteca:game:v1';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function isoOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isoToday() { return isoOf(new Date()); }

  const DEFAULT = { xp: 0, perfectCount: 0, days: {}, ach: {}, dialogues: { es: {}, fr: {}, zh: {} }, dailyGoal: 30, longestStreak: 0, created: null };

  function load() {
    let d;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
    d = Object.assign({}, DEFAULT, d || {});
    d.days = d.days || {}; d.ach = d.ach || {};
    d.dialogues = Object.assign({ es: {}, fr: {}, zh: {} }, d.dialogues || {});
    if (!d.created) d.created = isoToday();
    return d;
  }
  const data = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }

  const RANKS = [
    { min: 1, name: 'Sprout', emoji: '🌱' },
    { min: 3, name: 'Explorer', emoji: '🧭' },
    { min: 5, name: 'Traveler', emoji: '🎒' },
    { min: 8, name: 'Chatterbox', emoji: '💬' },
    { min: 12, name: 'Conversational', emoji: '🗣️' },
    { min: 16, name: 'Fluent-ish', emoji: '✨' },
    { min: 22, name: 'Polyglot', emoji: '🌍' },
  ];
  function levelInfo() {
    const level = Math.floor(data.xp / 100) + 1;
    const into = data.xp % 100;
    let rank = RANKS[0];
    for (const r of RANKS) if (level >= r.min) rank = r;
    return { level, into, need: 100, pct: into, rank: rank.name, rankEmoji: rank.emoji, xp: data.xp };
  }

  function dayMet(ds) { const b = data.days[ds]; return !!(b && b.xp >= data.dailyGoal); }
  function streak() {
    let s = 0; const cur = new Date();
    if (!dayMet(isoToday())) cur.setDate(cur.getDate() - 1);
    while (dayMet(isoOf(cur))) { s++; cur.setDate(cur.getDate() - 1); }
    return s;
  }
  function daysPracticed() { return Object.keys(data.days).filter(d => (data.days[d].xp || 0) > 0).length; }

  function addXp(n, kind) {
    if (!n) n = 0;
    data.xp += n;
    const t = isoToday();
    const b = data.days[t] || (data.days[t] = { xp: 0, words: 0, correct: 0 });
    b.xp += n;
    if (kind === 'word') b.words++;
    if (kind === 'perfect') { b.correct++; data.perfectCount++; }
    const s = streak();
    if (s > data.longestStreak) data.longestStreak = s;
    save();
  }
  function markDialogue(code, id) {
    data.dialogues[code] = data.dialogues[code] || {};
    data.dialogues[code][id] = (data.dialogues[code][id] || 0) + 1;
    save();
  }
  function setGoal(g) { data.dailyGoal = g; const s = streak(); if (s > data.longestStreak) data.longestStreak = s; save(); }

  function heatmap(nDays) {
    const out = []; const goal = data.dailyGoal || 30;
    const start = new Date(); start.setDate(start.getDate() - (nDays - 1));
    for (let i = 0; i < nDays; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = isoOf(d); const xp = (data.days[ds] && data.days[ds].xp) || 0;
      let lvl = 0;
      if (xp > 0) lvl = 1;
      if (xp >= goal * 0.5) lvl = 2;
      if (xp >= goal) lvl = 3;
      if (xp >= goal * 2) lvl = 4;
      out.push({ date: ds, xp, level: lvl, dow: d.getDay() });
    }
    return out;
  }

  const ACHIEVEMENTS = [
    { id: 'first_steps', emoji: '👣', title: 'First Steps', desc: 'Earn your first XP', test: s => s.xp > 0 },
    { id: 'word_10', emoji: '🌱', title: 'Getting Started', desc: 'Learn 10 words', test: s => s.wordsTotal >= 10, prog: s => ({ cur: Math.min(s.wordsTotal, 10), max: 10 }) },
    { id: 'word_50', emoji: '📖', title: 'Word Collector', desc: 'Learn 50 words', test: s => s.wordsTotal >= 50, prog: s => ({ cur: Math.min(s.wordsTotal, 50), max: 50 }) },
    { id: 'word_100', emoji: '📚', title: 'Vocabulary Builder', desc: 'Learn 100 words', test: s => s.wordsTotal >= 100, prog: s => ({ cur: Math.min(s.wordsTotal, 100), max: 100 }) },
    { id: 'streak_3', emoji: '🔥', title: 'On a Roll', desc: 'Reach a 3-day streak', test: s => s.bestStreak >= 3, prog: s => ({ cur: Math.min(s.bestStreak, 3), max: 3 }) },
    { id: 'streak_7', emoji: '🗓️', title: 'Week Warrior', desc: 'Reach a 7-day streak', test: s => s.bestStreak >= 7, prog: s => ({ cur: Math.min(s.bestStreak, 7), max: 7 }) },
    { id: 'streak_30', emoji: '🏆', title: 'Unstoppable', desc: 'Reach a 30-day streak', test: s => s.bestStreak >= 30, prog: s => ({ cur: Math.min(s.bestStreak, 30), max: 30 }) },
    { id: 'xp_250', emoji: '⭐', title: 'Rising Star', desc: 'Earn 250 XP', test: s => s.xp >= 250, prog: s => ({ cur: Math.min(s.xp, 250), max: 250 }) },
    { id: 'xp_1000', emoji: '🌟', title: 'Star Student', desc: 'Earn 1,000 XP', test: s => s.xp >= 1000, prog: s => ({ cur: Math.min(s.xp, 1000), max: 1000 }) },
    { id: 'perfect_25', emoji: '🎯', title: 'Sharp Tongue', desc: 'Nail 25 pronunciations', test: s => s.perfect >= 25, prog: s => ({ cur: Math.min(s.perfect, 25), max: 25 }) },
    { id: 'talker', emoji: '💬', title: 'Conversationalist', desc: 'Finish a conversation', test: s => s.dialoguesTotal >= 1 },
    { id: 'talker_all', emoji: '🎭', title: 'Smooth Talker', desc: 'Finish every conversation in a language', test: s => s.dialoguesMaxPerLang >= 4, prog: s => ({ cur: Math.min(s.dialoguesMaxPerLang, 4), max: 4 }) },
    { id: 'polyglot', emoji: '🌍', title: 'Polyglot', desc: 'Learn a word in all 3 languages', test: s => s.polyglotCount >= 1 },
    { id: 'lang_half', emoji: '🥑', title: 'Halfway There', desc: 'Learn 29 words in one language', test: s => s.wordsMaxPerLang >= 29, prog: s => ({ cur: Math.min(s.wordsMaxPerLang, 29), max: 29 }) },
    { id: 'theme_master', emoji: '🧩', title: 'Topic Master', desc: 'Complete a full topic', test: s => s.themesCompleted >= 1 },
    { id: 'lang_complete', emoji: '🎓', title: 'Fluent Foundations', desc: 'Learn every word in a language', test: s => s.languagesComplete >= 1 },
    { id: 'all_languages', emoji: '👑', title: 'Triple Threat', desc: 'Complete all three languages', test: s => s.languagesComplete >= 3, prog: s => ({ cur: s.languagesComplete, max: 3 }) },
  ];

  function evaluate(stats) {
    stats = stats || {};
    stats.bestStreak = Math.max(stats.streak || 0, data.longestStreak || 0);
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (data.ach[a.id]) continue;
      try { if (a.test(stats)) { data.ach[a.id] = isoToday(); newly.push(a); } } catch (e) {}
    }
    if (newly.length) save();
    return newly;
  }
  function achievementsFor(stats) {
    stats = stats || {};
    stats.bestStreak = Math.max(stats.streak || 0, data.longestStreak || 0);
    return ACHIEVEMENTS.map(a => {
      const unlocked = !!data.ach[a.id];
      let prog = null;
      if (!unlocked && a.prog) { try { prog = a.prog(stats); } catch (e) {} }
      return { id: a.id, emoji: a.emoji, title: a.title, desc: a.desc, unlocked, unlockedDate: data.ach[a.id] || null, prog };
    });
  }

  window.PalStore = {
    data, save, addXp, markDialogue, setGoal,
    isoToday, isoOf, streak, daysPracticed, levelInfo, heatmap,
    evaluate, achievementsFor, ACHIEVEMENTS,
  };
})();
