/* ===================== Palteca app ===================== */
(function () {
  'use strict';
  const C = window.PALTECA_CONTENT;
  const DLG = window.PALTECA_DIALOGUES || {};
  const MORSE = window.PALTECA_MORSE || { groups: [], items: [] };
  const SIGN = window.PALTECA_SIGN || { groups: [], items: [] };
  const G = window.PalStore;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, cls, html) => { const n = document.createElement(t); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  const views = $('#views');
  const topbar = $('#topbar');
  const crumb = $('#crumb');
  const backBtn = $('#backBtn');
  const themeToggle = $('#themeToggle');
  const playerchip = $('#playerchip');
  const toastEl = $('#toast');

  /* The PALTECA method — Picture · Audio · Link · Try · Echo · Connect · Apply */
  const PAL = [
    { k: 'P', w: 'Picture', d: 'See the image' },
    { k: 'A', w: 'Audio', d: 'Hear a native' },
    { k: 'L', w: 'Link', d: 'Sound → meaning' },
    { k: 'T', w: 'Try', d: 'Say it aloud' },
    { k: 'E', w: 'Echo', d: 'Repeat & refine' },
    { k: 'C', w: 'Connect', d: 'In a sentence' },
    { k: 'A', w: 'Apply', d: 'Lock it in' },
  ];

  /* ---------- word progress ---------- */
  const PKEY = 'palteca:progress:v1';
  function loadProg() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
  let progress = loadProg();
  function langProg(code) { if (!progress[code]) progress[code] = { learned: {}, strength: {} }; return progress[code]; }
  function markLearned(code, id) { const lp = langProg(code); lp.learned[id] = true; lp.strength[id] = Math.min((lp.strength[id] || 0) + 1, 5); saveProg(progress); }
  function bumpStrength(code, id, delta) { const lp = langProg(code); lp.strength[id] = Math.max(0, Math.min((lp.strength[id] || 0) + delta, 5)); lp.learned[id] = true; saveProg(progress); }
  function wordsLearned(code) { return C.languages[code] ? Object.keys(langProg(code).learned).filter(id => langProg(code).learned[id]).length : 0; }

  /* ---------- gamification glue ---------- */
  function gatherStats() {
    const codes = Object.keys(C.languages);
    let wordsTotal = 0, wordsMax = 0, langComplete = 0, themesCompleted = 0;
    const sets = {};
    codes.forEach(code => {
      const lp = langProg(code);
      const ids = Object.keys(lp.learned).filter(id => lp.learned[id]);
      sets[code] = new Set(ids);
      const n = ids.length; wordsTotal += n; if (n > wordsMax) wordsMax = n;
      const total = C.languages[code].items.length;
      if (total > 0 && n >= total) langComplete++;
      C.themes.forEach(t => {
        const items = C.languages[code].items.filter(i => i.theme === t.id);
        if (items.length && items.every(i => lp.learned[i.id])) themesCompleted++;
      });
    });
    let polyglotCount = 0;
    if (codes.length >= 3) {
      const a = sets[codes[0]], b = sets[codes[1]], c = sets[codes[2]];
      a.forEach(id => { if (b.has(id) && c.has(id)) polyglotCount++; });
    }
    let dTotal = 0, dMax = 0;
    codes.forEach(code => { const done = (G.data.dialogues[code] || {}); const n = Object.keys(done).length; dTotal += n; if (n > dMax) dMax = n; });
    // Morse & Sign tracks (separate progress under codes 'morse' / 'sign')
    const mLearn = langProg('morse').learned, sLearn = langProg('sign').learned;
    const morseLettersTotal = MORSE.items.filter(i => i.group === 'letters').length;
    const signLettersTotal = SIGN.items.filter(i => i.group === 'alphabet').length;
    const morseLettersLearned = MORSE.items.filter(i => i.group === 'letters' && mLearn[i.id]).length;
    const signLettersLearned = SIGN.items.filter(i => i.group === 'alphabet' && sLearn[i.id]).length;
    const morseLearned = Object.keys(mLearn).filter(id => mLearn[id]).length;
    const signLearned = Object.keys(sLearn).filter(id => sLearn[id]).length;
    return {
      xp: G.data.xp, streak: G.streak(), perfect: G.data.perfectCount,
      wordsTotal, wordsMaxPerLang: wordsMax, languagesComplete: langComplete,
      themesCompleted, polyglotCount, dialoguesTotal: dTotal, dialoguesMaxPerLang: dMax,
      morseLearned, morseLettersLearned, morseLettersTotal, sosLearned: !!mLearn['sos'],
      signLearned, signLettersLearned, signLettersTotal,
    };
  }
  function award(n, kind) {
    if (!G) return;
    G.addXp(n, kind);
    const na = G.evaluate(gatherStats());
    na.forEach(a => celebrateAch(a));
    updatePlayerChip();
  }
  function celebrateAch(a) { toast('🏅 Achievement · ' + a.title, 3600, 'ach'); }

  function updatePlayerChip() {
    if (!G) { playerchip.hidden = true; return; }
    const li = G.levelInfo();
    if (state.view === 'home' || li.xp <= 0) { playerchip.hidden = true; return; }
    playerchip.hidden = false;
    playerchip.innerHTML = '<span class="lv">Lv ' + li.level + '</span> · <span class="flame">🔥' + G.streak() + '</span> · ⭐' + li.xp;
  }

  /* ---------- theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem('palteca:theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    syncThemeIcon();
  }
  function syncThemeIcon() {
    const isDark = (document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    themeToggle.textContent = isDark ? '☀️' : '🌙';
  }
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme')
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('palteca:theme', next);
    syncThemeIcon();
  });

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg, ms, cls) {
    toastEl.textContent = msg; toastEl.hidden = false;
    toastEl.className = 'toast' + (cls ? ' ' + cls : '');
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.classList.remove('show'); setTimeout(() => (toastEl.hidden = true), 300); }, ms || 2600);
  }

  /* ---------- speech synthesis ---------- */
  let VOICES = [];
  function refreshVoices() { VOICES = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
  if (window.speechSynthesis) { refreshVoices(); speechSynthesis.onvoiceschanged = refreshVoices; }
  function pickVoice(bcp47) {
    if (!VOICES.length) refreshVoices();
    const lang = bcp47.toLowerCase(); const base = lang.split('-')[0];
    const cand = VOICES.filter(v => v.lang && v.lang.toLowerCase() === lang)
      .concat(VOICES.filter(v => v.lang && v.lang.toLowerCase().split('-')[0] === base));
    cand.sort((a, b) => (b.localService === true) - (a.localService === true));
    return cand[0] || null;
  }
  function speak(text, bcp47, opts) {
    opts = opts || {};
    if (!window.speechSynthesis) { toast('Audio not supported in this browser'); return; }
    try { speechSynthesis.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = bcp47;
    const v = pickVoice(bcp47); if (v) u.voice = v;
    u.rate = opts.rate != null ? opts.rate : 0.82; u.pitch = 1;
    if (!v) { if (!speak._warned) speak._warned = {}; if (!speak._warned[bcp47]) { speak._warned[bcp47] = 1; toast('Tip: install a ' + bcp47 + ' system voice for best audio'); } }
    speechSynthesis.speak(u);
  }

  /* ---------- speech recognition ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SR_SUPPORTED = !!SR;
  function normalize(s, code) {
    if (!s) return '';
    s = s.toLowerCase().trim();
    if (code === 'zh') { const han = s.match(/[一-鿿]/g); return han ? han.join('') : s.replace(/[\s，。！？、,.!?]/g, ''); }
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/['’‘\-–—.,!?¡¿;:"()]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }
  function levenshtein(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    const d = new Array(n + 1); for (let j = 0; j <= n; j++) d[j] = j;
    for (let i = 1; i <= m; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= n; j++) { const tmp = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = tmp; } }
    return d[n];
  }
  function similarity(a, b) { if (!a && !b) return 1; const L = Math.max(a.length, b.length) || 1; return 1 - levenshtein(a, b) / L; }
  function scoreSpeech(alts, target, code) { let best = 0; (alts || []).forEach(a => { const s = similarity(normalize(a, code), normalize(target, code)); if (s > best) best = s; }); return best; }

  let activeRec = null;
  function listen(bcp47, onDone) {
    if (!SR_SUPPORTED) { onDone({ unsupported: true }); return null; }
    let rec; try { rec = new SR(); } catch (e) { onDone({ unsupported: true }); return null; }
    rec.lang = bcp47; rec.interimResults = false; rec.maxAlternatives = 3; rec.continuous = false;
    let got = false;
    rec.onresult = (ev) => { got = true; const alts = []; const r = ev.results[0]; for (let i = 0; i < r.length; i++) alts.push(r[i].transcript); onDone({ transcript: alts[0], alternatives: alts }); };
    rec.onerror = (ev) => onDone({ error: ev.error || 'error' });
    rec.onend = () => { if (!got) onDone({ ended: true }); activeRec = null; };
    try { rec.start(); activeRec = rec; } catch (e) { onDone({ error: 'start' }); }
    return rec;
  }
  function stopListening() { if (activeRec) { try { activeRec.stop(); } catch (e) {} activeRec = null; } }
  function stopAll() { stopListening(); try { speechSynthesis.cancel(); } catch (e) {} }

  /* ---------- content helpers ---------- */
  function themeItems(code, themeId) { return C.languages[code].items.filter(i => i.theme === themeId); }
  function activeThemes(code) { return C.themes.filter(t => themeItems(code, t.id).length > 0); }
  function langCompletion(code) { const items = C.languages[code].items; if (!items.length) return 0; return Math.round((wordsLearned(code) / items.length) * 100); }
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------- navigation (history stack) ---------- */
  const state = { view: 'home', code: null, themeId: null, scenarioId: null };
  let hist = [];
  function scrollTop() { try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { window.scrollTo(0, 0); } }
  function go(view, data) { hist.push({ view: state.view, code: state.code, themeId: state.themeId, scenarioId: state.scenarioId }); Object.assign(state, data || {}); state.view = view; render(); scrollTop(); }
  function back() { stopAll(); if (hist.length) { Object.assign(state, hist.pop()); render(); scrollTop(); } else { state.view = 'home'; render(); scrollTop(); } }
  backBtn.addEventListener('click', back);
  playerchip.addEventListener('click', () => { if (state.view !== 'stats') go('stats'); });

  function render() {
    const isHome = state.view === 'home';
    topbar.hidden = false;
    backBtn.style.visibility = isHome ? 'hidden' : 'visible';
    const map = { home: renderHome, themes: renderThemes, lesson: renderLesson, review: renderReview, stats: renderStats, achievements: renderAchievements, dialogues: renderDialogues, dialogue: renderDialogue, quiz: renderQuiz, morse: renderMorseHub, morselearn: renderMorseLearn, morsequiz: renderMorseQuiz, morsetrans: renderMorseTrans, sign: renderSignHub, signlearn: renderSignLearn, signquiz: renderSignQuiz, signspell: renderSignSpell };
    (map[state.view] || renderHome)();
    updatePlayerChip();
  }

  /* ===================== HOME ===================== */
  function renderHome() {
    crumb.textContent = '';
    const wrap = el('div');

    const hero = el('div', 'hero');
    hero.appendChild(el('div', 'logo', '🥑'));
    hero.appendChild(el('div', 'wordmark', 'Palteca'));
    hero.appendChild(el('p', 'tagline', 'Learn to <b>speak</b> a language the visual way — see it, hear it, and say it out loud.'));
    wrap.appendChild(hero);

    // player card
    if (G) wrap.appendChild(playerCard());

    // languages
    wrap.appendChild(el('div', 'section-label', 'Choose a language'));
    const grid = el('div', 'lang-grid');
    Object.keys(C.languages).forEach(code => {
      const L = C.languages[code]; const pct = langCompletion(code);
      const card = el('button', 'lang-card');
      card.appendChild(el('div', 'flag', L.flag || '🌐'));
      const info = el('div');
      info.appendChild(el('div', 'name', L.language));
      info.appendChild(el('div', 'native', (L.native || '') + ' · ' + L.items.length + ' words'));
      const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill); info.appendChild(bar);
      info.appendChild(el('div', 'pct', pct > 0 ? pct + '% learned' : 'Start learning →'));
      card.appendChild(info);
      card.addEventListener('click', () => go('themes', { code, themeId: null }));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    // other ways to communicate
    wrap.appendChild(el('div', 'section-label', 'Beyond speech'));
    const beyond = el('div', 'lang-grid');
    beyond.appendChild(trackCard('morse', '📡', 'Morse Code', trackPct('morse', MORSE.items.length) + '% · dots & dashes', () => go('morse')));
    beyond.appendChild(trackCard('sign', '🤟', 'ASL Fingerspelling', trackPct('sign', SIGN.items.length) + '% · the manual alphabet', () => go('sign')));
    wrap.appendChild(beyond);

    // global nav
    const nav = el('div', 'home-nav');
    nav.appendChild(modeCard('📊', 'Progress', 'stats & streaks', () => go('stats')));
    nav.appendChild(modeCard('🏅', 'Achievements', badgeSummary(), () => go('achievements')));
    wrap.appendChild(nav);

    // method
    wrap.appendChild(el('div', 'section-label', 'The Palteca Method'));
    const m = el('div', 'method');
    m.appendChild(el('h3', null, 'See it → Hear it → Say it'));
    m.appendChild(el('p', null, 'Every word travels through seven quick steps so it sticks in your mouth, not just your notebook. No translation crutch — you link the picture straight to the sound.'));
    const steps = el('div', 'steps');
    PAL.forEach(s => { const st = el('div', 'step'); st.appendChild(el('div', 'k', s.k)); st.appendChild(el('div', 'w', s.w)); st.appendChild(el('div', 'd', s.d)); steps.appendChild(st); });
    m.appendChild(steps);
    wrap.appendChild(m);

    // install
    if (window.__canInstall) {
      const ib = el('button', 'install-btn', '⬇️ Install Palteca as an app');
      ib.addEventListener('click', () => window.__promptInstall && window.__promptInstall());
      wrap.appendChild(ib);
    }

    wrap.appendChild(el('div', 'footer', SR_SUPPORTED
      ? '🎤 Speaking practice is on — best in Chrome. Works offline once installed.'
      : '🔊 Listening & pronunciation coaching enabled. For live speech scoring, open in Chrome.'));

    views.replaceChildren(wrap);
  }

  function badgeSummary() {
    const list = G ? G.achievementsFor(gatherStats()) : [];
    const on = list.filter(a => a.unlocked).length;
    return on + ' / ' + (list.length || G.ACHIEVEMENTS.length) + ' unlocked';
  }

  function playerCard() {
    const li = G.levelInfo(); const st = G.streak();
    const card = el('div', 'player');
    const top = el('div', 'player-top');
    const ring = el('div', 'lvl-ring'); ring.style.setProperty('--p', li.pct); ring.appendChild(el('b', null, '' + li.level));
    top.appendChild(ring);
    const id = el('div', 'player-id');
    id.appendChild(el('div', 'rank', li.rankEmoji + ' ' + li.rank));
    id.appendChild(el('div', 'sub', 'Level ' + li.level + ' · ' + li.into + '/' + li.need + ' XP to level ' + (li.level + 1)));
    top.appendChild(id);
    card.appendChild(top);

    const tiles = el('div', 'player-tiles');
    const t1 = el('div', 'ptile flame'); t1.innerHTML = '<b>' + st + '</b><div class="lab">day streak</div>'; tiles.appendChild(t1);
    const t2 = el('div', 'ptile xp'); t2.innerHTML = '<b>' + li.xp + '</b><div class="lab">total XP</div>'; tiles.appendChild(t2);
    const todayXp = (G.data.days[G.isoToday()] && G.data.days[G.isoToday()].xp) || 0;
    const goalPct = Math.min(100, Math.round(todayXp / G.data.dailyGoal * 100));
    const t3 = el('div', 'ptile'); const gr = el('div', 'goalring'); gr.style.setProperty('--p', goalPct);
    t3.appendChild(gr); t3.appendChild(el('div', 'lab', todayXp + '/' + G.data.dailyGoal + ' today')); tiles.appendChild(t3);
    card.appendChild(tiles);
    card.addEventListener('click', () => go('stats'));
    card.style.cursor = 'pointer';
    return card;
  }

  function modeCard(icon, title, sub, onClick, disabled) {
    const b = el('button', 'mode-card');
    b.appendChild(el('div', 'mi', icon));
    b.appendChild(el('div', 'mt', title));
    if (sub) b.appendChild(el('div', 'ms', sub));
    if (disabled) b.disabled = true; else b.addEventListener('click', onClick);
    return b;
  }

  /* ===================== THEMES + modes ===================== */
  function renderThemes() {
    const L = C.languages[state.code];
    crumb.textContent = L.language;
    const wrap = el('div');

    const head = el('div', 'lang-head');
    head.appendChild(el('div', 'flag', L.flag || '🌐'));
    const ht = el('div');
    ht.appendChild(el('div', 't', L.language));
    ht.appendChild(el('div', 's', langCompletion(state.code) + '% learned · ' + wordsLearned(state.code) + ' of ' + L.items.length + ' words'));
    head.appendChild(ht);
    wrap.appendChild(head);

    // modes
    const modes = el('div', 'modes');
    const nScen = (DLG[state.code] || []).length;
    modes.appendChild(modeCard('💬', 'Conversations', nScen + ' role-plays', () => go('dialogues', { code: state.code })));
    modes.appendChild(modeCard('🎯', 'Challenge', 'quiz yourself', () => startQuiz(state.code)));
    modes.appendChild(modeCard('🔁', 'Review', 'spaced practice', () => startReview(state.code), Object.keys(langProg(state.code).learned).length < 3));
    modes.appendChild(modeCard('📊', 'Progress', 'your stats', () => go('stats')));
    wrap.appendChild(modes);

    wrap.appendChild(el('div', 'section-label', 'Lessons'));
    const grid = el('div', 'theme-grid');
    activeThemes(state.code).forEach(t => {
      const items = themeItems(state.code, t.id); const lp = langProg(state.code);
      const done = items.filter(i => lp.learned[i.id]).length; const pct = Math.round((done / items.length) * 100);
      const card = el('button', 'theme-card');
      card.appendChild(el('div', 'ic', t.icon));
      card.appendChild(el('div', 'tt', t.title));
      const meta = el('div', 'meta');
      const ring = el('div', 'ring' + (pct >= 100 ? ' done' : '')); ring.style.setProperty('--p', pct);
      if (pct >= 100) ring.textContent = '';
      meta.appendChild(ring); meta.appendChild(el('div', 'cnt', done + ' / ' + items.length));
      card.appendChild(meta);
      card.addEventListener('click', () => startLesson(state.code, t.id));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    views.replaceChildren(wrap);
  }

  /* ===================== LESSON (PALTECA loop) ===================== */
  const lesson = { code: null, items: [], idx: 0, correct: 0, spoken: 0, perf: null };
  function startLesson(code, themeId) {
    lesson.code = code; lesson.themeId = themeId; lesson.items = themeItems(code, themeId).slice();
    lesson.idx = 0; lesson.correct = 0; lesson.spoken = 0; lesson.perf = {};
    go('lesson', { code, themeId });
  }
  function renderLesson() {
    const L = C.languages[lesson.code];
    const theme = C.themes.find(t => t.id === lesson.themeId);
    crumb.textContent = L.language + ' · ' + (theme ? theme.title : '');
    if (lesson.idx >= lesson.items.length) return renderDone();

    const item = lesson.items[lesson.idx];
    const wrap = el('div');

    const pt = el('div', 'progress-top');
    const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (lesson.idx / lesson.items.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (lesson.idx + 1) + ' / ' + lesson.items.length));
    wrap.appendChild(pt);

    const track = el('div', 'paltrack');
    const palEls = PAL.map((s, i) => { const p = el('div', 'pal', s.k); p.title = s.w; track.appendChild(p); return p; });
    wrap.appendChild(track);
    let curStep = 0;
    function setStep(i) { curStep = i; palEls.forEach((p, k) => { p.dataset.on = k <= i ? '1' : '0'; p.dataset.cur = k === i ? '1' : '0'; }); }

    const card = el('div', 'card');
    card.appendChild(el('div', 'pic', item.emoji || '🗣️'));
    card.appendChild(el('div', 'target', item.target));
    card.appendChild(el('div', 'phon', item.phonetic || ''));
    if (item.note) card.appendChild(el('div', 'note-pin', item.note));

    const row = el('div', 'speak-row');
    const playBtn = el('button', 'btn play', '🔊 Listen');
    const slowBtn = el('button', 'btn ghost', '🐢 Slow');
    const micBtn = el('button', 'btn mic', SR_SUPPORTED ? '🎤 Say it' : '🎤 Say it (self-check)');
    row.appendChild(playBtn); row.appendChild(slowBtn); row.appendChild(micBtn);
    card.appendChild(row);

    const fb = el('div', 'feedback'); card.appendChild(fb);

    const revealBtn = el('button', 'btn ghost', '👁️ Tap to reveal the meaning'); revealBtn.style.marginTop = '14px';
    card.appendChild(revealBtn);
    const reveal = el('div', 'reveal'); reveal.style.display = 'none';
    const trans = el('div', 'trans', item.translation);
    if (item.article) trans.appendChild(el('span', 'art', ' · ' + item.article + ' ' + item.target));
    reveal.appendChild(trans);
    if (item.example) {
      const ex = el('div', 'example'); const exT = el('div', 'ex-t');
      exT.appendChild(el('div', 'ex-x', item.example)); exT.appendChild(el('div', 'ex-e', item.exampleTranslation || ''));
      const exMini = el('button', 'mini', '🔊'); ex.appendChild(exT); ex.appendChild(exMini); reveal.appendChild(ex);
      exMini.addEventListener('click', () => { speak(item.example, L.bcp47, { rate: 0.85 }); if (curStep < 5) setStep(5); });
    }
    card.appendChild(reveal);
    wrap.appendChild(card);

    const nav = el('div', 'nav-row');
    const skipBtn = el('button', 'btn sec', 'Skip');
    const nextBtn = el('button', 'btn primary', (lesson.idx === lesson.items.length - 1 ? 'Finish ✓' : 'Next →'));
    nav.appendChild(skipBtn); nav.appendChild(nextBtn); wrap.appendChild(nav);
    wrap.appendChild(el('div', 'hint', SR_SUPPORTED ? 'Hear it, then tap 🎤 and repeat. We\'ll score how close you got.' : 'Tap 🔊 and repeat aloud. Reveal the meaning once you\'ve tried.'));

    views.replaceChildren(wrap);

    setStep(0);
    setTimeout(() => { speak(item.target, L.bcp47); if (curStep < 1) setStep(1); }, 320);
    playBtn.addEventListener('click', () => { speak(item.target, L.bcp47); if (curStep < 1) setStep(1); });
    slowBtn.addEventListener('click', () => { speak(item.target, L.bcp47, { rate: 0.55 }); if (curStep < 1) setStep(1); });
    revealBtn.addEventListener('click', () => { reveal.style.display = 'block'; revealBtn.style.display = 'none'; if (curStep < 2) setStep(2); });

    let recording = false;
    micBtn.addEventListener('click', () => {
      if (!SR_SUPPORTED) { if (curStep < 4) setStep(4); showFeedback(fb, 'mid', '👍 Nice try! Tap 🔊 to compare with the native pronunciation.'); lesson.spoken++; return; }
      if (recording) { stopListening(); return; }
      recording = true; micBtn.classList.add('rec'); micBtn.textContent = '● Listening…'; if (curStep < 3) setStep(3);
      listen(L.bcp47, (res) => {
        recording = false; micBtn.classList.remove('rec'); micBtn.textContent = '🎤 Say it';
        if (res.unsupported) return showFeedback(fb, 'mid', 'Live scoring needs Chrome. Repeat after the audio 🔊');
        if (res.error === 'not-allowed' || res.error === 'service-not-allowed') return showFeedback(fb, 'bad', '🎤 Microphone blocked. Allow mic access to practice speaking.');
        if (res.error || res.ended || !res.transcript) return showFeedback(fb, 'mid', 'Didn\'t catch that — try again a bit louder 🔊');
        lesson.spoken++;
        const best = scoreSpeech(res.alternatives || [res.transcript], item.target, lesson.code);
        setStep(4);
        if (best >= 0.8) {
          lesson.correct++; bumpStrength(lesson.code, item.id, 1);
          if (!lesson.perf[item.id]) { lesson.perf[item.id] = 1; award(5, 'perfect'); }
          showFeedback(fb, 'good', '🎉 Great! That sounded spot on.', 'Heard: “' + res.transcript + '”');
        } else if (best >= 0.5) showFeedback(fb, 'mid', '👏 Close! Listen once more and echo the rhythm.', 'Heard: “' + res.transcript + '”');
        else showFeedback(fb, 'bad', '🔁 Not quite — tap 🐢 Slow, then try again.', 'Heard: “' + res.transcript + '”');
      });
    });

    function advance() {
      stopAll(); setStep(6);
      const wasLearned = langProg(lesson.code).learned[item.id];
      markLearned(lesson.code, item.id);
      if (!wasLearned) award(10, 'word'); else { G && G.evaluate(gatherStats()); }
      lesson.idx++; renderLesson();
    }
    nextBtn.addEventListener('click', advance);
    skipBtn.addEventListener('click', () => { stopAll(); lesson.idx++; renderLesson(); });
  }
  function showFeedback(fb, kind, msg, heard) { fb.className = 'feedback show ' + kind; fb.innerHTML = '<div>' + msg + (heard ? '<span class="heard">' + heard + '</span>' : '') + '</div>'; }

  function renderDone() {
    const L = C.languages[lesson.code]; const theme = C.themes.find(t => t.id === lesson.themeId);
    crumb.textContent = L.language + ' · done';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '🥑'));
    wrap.appendChild(el('h2', null, '¡Lesson complete!'));
    wrap.appendChild(el('p', null, 'You worked through ' + lesson.items.length + ' words in ' + (theme ? theme.title : 'this topic') + '. Keep them fresh with a quick review.'));
    const stats = el('div', 'stat-row');
    stats.appendChild(statBox(lesson.items.length, 'words seen'));
    stats.appendChild(statBox(lesson.spoken, 'times you spoke'));
    stats.appendChild(statBox(langCompletion(lesson.code) + '%', 'of ' + L.language));
    wrap.appendChild(stats);
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 Review these');
    const back2 = el('button', 'btn primary', 'More topics →');
    again.addEventListener('click', () => startReview(lesson.code, lesson.items.map(i => i.id)));
    back2.addEventListener('click', () => go('themes', { code: lesson.code }));
    nav.appendChild(again); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }
  function statBox(v, lab) { const s = el('div', 'stat'); s.innerHTML = '<b>' + v + '</b><span>' + lab + '</span>'; return s; }

  /* ===================== REVIEW ===================== */
  const review = { code: null, items: [], idx: 0, correct: 0, perf: null };
  function startReview(code, ids) {
    const L = C.languages[code]; let pool;
    if (ids && ids.length) pool = L.items.filter(i => ids.indexOf(i.id) >= 0);
    else { const lp = langProg(code); pool = L.items.filter(i => lp.learned[i.id]); }
    if (pool.length < 1) { toast('Nothing to review yet'); return; }
    const lp = langProg(code); pool.sort((a, b) => (lp.strength[a.id] || 0) - (lp.strength[b.id] || 0));
    review.items = shuffle(pool).slice(0, Math.min(pool.length, 15)); review.code = code; review.idx = 0; review.correct = 0; review.perf = {};
    go('review', { code });
  }
  function renderReview() {
    const L = C.languages[review.code];
    crumb.textContent = L.language + ' · Review';
    if (review.idx >= review.items.length) return renderReviewDone();
    const item = review.items[review.idx];
    const wrap = el('div');
    const pt = el('div', 'progress-top'); const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (review.idx / review.items.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (review.idx + 1) + ' / ' + review.items.length)); wrap.appendChild(pt);

    const card = el('div', 'card');
    card.appendChild(el('div', 'pic', item.emoji || '🗣️'));
    const tEl = el('div', 'target', '❔'); card.appendChild(tEl);
    const prompt = el('div', 'phon', 'Can you say this in ' + L.language + '?'); card.appendChild(prompt);
    const row = el('div', 'speak-row');
    const micBtn = el('button', 'btn mic', SR_SUPPORTED ? '🎤 Say it' : '🎤 I said it');
    const revealBtn = el('button', 'btn play', '👁️ Reveal'); row.appendChild(micBtn); row.appendChild(revealBtn); card.appendChild(row);
    const fb = el('div', 'feedback'); card.appendChild(fb);
    const reveal = el('div', 'reveal'); reveal.style.display = 'none';
    reveal.appendChild(el('div', 'target', item.target)); reveal.appendChild(el('div', 'phon', item.phonetic || '')); reveal.appendChild(el('div', 'trans', item.translation));
    const playBtn = el('button', 'btn play', '🔊 Hear it'); playBtn.style.marginTop = '12px'; reveal.appendChild(playBtn); card.appendChild(reveal);
    wrap.appendChild(card);
    const nav = el('div', 'nav-row');
    const hardBtn = el('button', 'btn sec', '😕 Again'); const goodBtn = el('button', 'btn primary', '✅ Got it');
    nav.appendChild(hardBtn); nav.appendChild(goodBtn); wrap.appendChild(nav);
    views.replaceChildren(wrap);

    function doReveal() { reveal.style.display = 'block'; revealBtn.style.display = 'none'; tEl.textContent = item.target; prompt.style.display = 'none'; speak(item.target, L.bcp47); }
    revealBtn.addEventListener('click', doReveal);
    playBtn.addEventListener('click', () => speak(item.target, L.bcp47));
    let recording = false;
    micBtn.addEventListener('click', () => {
      if (!SR_SUPPORTED) { doReveal(); return; }
      if (recording) { stopListening(); return; }
      recording = true; micBtn.classList.add('rec'); micBtn.textContent = '● Listening…';
      listen(L.bcp47, (res) => {
        recording = false; micBtn.classList.remove('rec'); micBtn.textContent = '🎤 Say it';
        if (res.unsupported || res.error || res.ended || !res.transcript) { doReveal(); return; }
        const s = scoreSpeech(res.alternatives || [res.transcript], item.target, review.code);
        tEl.textContent = item.target; prompt.style.display = 'none'; reveal.style.display = 'block'; revealBtn.style.display = 'none';
        if (s >= 0.8) { fb.className = 'feedback show good'; fb.innerHTML = '🎉 Perfect — “' + res.transcript + '”'; if (!review.perf[item.id]) { review.perf[item.id] = 1; award(5, 'perfect'); } }
        else { fb.className = 'feedback show mid'; fb.innerHTML = '👂 Heard: “' + res.transcript + '”. Compare below.'; speak(item.target, L.bcp47); }
      });
    });
    hardBtn.addEventListener('click', () => { bumpStrength(review.code, item.id, -1); review.idx++; renderReview(); });
    goodBtn.addEventListener('click', () => { bumpStrength(review.code, item.id, 1); review.correct++; award(3, 'review'); review.idx++; renderReview(); });
  }
  function renderReviewDone() {
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '🌟'));
    wrap.appendChild(el('h2', null, 'Review done!'));
    wrap.appendChild(el('p', null, 'You recalled ' + review.correct + ' of ' + review.items.length + ' — great practice. Little and often is how speaking sticks.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 Again'); const back2 = el('button', 'btn primary', 'Back to topics →');
    again.addEventListener('click', () => startReview(review.code)); back2.addEventListener('click', () => go('themes', { code: review.code }));
    nav.appendChild(again); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  /* ===================== STATS ===================== */
  function renderStats() {
    crumb.textContent = 'Your progress';
    const s = gatherStats(); const li = G.levelInfo();
    const wrap = el('div');

    const hero = el('div', 'stat-hero');
    const ring = el('div', 'big-ring'); ring.style.setProperty('--p', li.pct);
    const inner = el('div', 'inner'); inner.innerHTML = '<b>' + li.level + '</b><span>LEVEL</span>'; ring.appendChild(inner); hero.appendChild(ring);
    hero.appendChild(el('div', 'rankname', li.rankEmoji + ' ' + li.rank));
    hero.appendChild(el('div', 'xpline', li.xp + ' XP · ' + (li.need - li.into) + ' to level ' + (li.level + 1)));
    wrap.appendChild(hero);

    // daily goal
    const goalP = el('div', 'panel');
    goalP.appendChild(el('h3', null, '🎯 Daily goal'));
    goalP.appendChild(el('p', 'psub', 'Hit your goal each day to keep your streak alive.'));
    const seg = el('div', 'goal-seg');
    [{ g: 20, n: 'Casual' }, { g: 30, n: 'Regular' }, { g: 50, n: 'Serious' }].forEach(o => {
      const b = el('button', null, o.g + ' XP<b>' + o.n + '</b>');
      b.setAttribute('aria-pressed', G.data.dailyGoal === o.g ? 'true' : 'false');
      b.addEventListener('click', () => { G.setGoal(o.g); renderStats(); });
      seg.appendChild(b);
    });
    goalP.appendChild(seg);
    wrap.appendChild(goalP);

    // streak + heatmap
    const heatP = el('div', 'panel');
    heatP.appendChild(el('h3', null, '🔥 ' + s.streak + '-day streak · best ' + G.data.longestStreak));
    heatP.appendChild(el('p', 'psub', 'Last 5 weeks — brighter means more practice.'));
    const heat = el('div', 'heat');
    G.heatmap(35).forEach(c => { const cell = el('div', 'cell' + (c.level ? ' l' + c.level : '')); cell.title = c.date + ' · ' + c.xp + ' XP'; heat.appendChild(cell); });
    heatP.appendChild(heat);
    const legend = el('div', 'heat-legend'); legend.innerHTML = 'less <span class="cell"></span><span class="cell l1"></span><span class="cell l2"></span><span class="cell l3"></span><span class="cell l4"></span> more';
    heatP.appendChild(legend);
    wrap.appendChild(heatP);

    // mastery per language
    const mP = el('div', 'panel');
    mP.appendChild(el('h3', null, '📚 Language mastery'));
    const mastery = el('div', 'mastery');
    Object.keys(C.languages).forEach(code => {
      const L = C.languages[code]; const n = wordsLearned(code); const pct = Math.round(n / L.items.length * 100);
      const row = el('div', 'mrow');
      row.appendChild(el('div', 'mflag', L.flag || '🌐'));
      const mid = el('div', 'mmid');
      const name = el('div', 'mname'); name.innerHTML = L.language + '<span>' + n + '/' + L.items.length + ' · ' + pct + '%</span>'; mid.appendChild(name);
      const bar = el('div', 'mbar'); const fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill); mid.appendChild(bar);
      row.appendChild(mid);
      row.style.cursor = 'pointer'; row.addEventListener('click', () => go('themes', { code }));
      mastery.appendChild(row);
    });
    mastery.appendChild(masteryRow('📡', 'Morse Code', s.morseLearned, MORSE.items.length, () => go('morse')));
    mastery.appendChild(masteryRow('🤟', 'ASL Fingerspelling', s.signLearned, SIGN.items.length, () => go('sign')));
    mP.appendChild(mastery);
    wrap.appendChild(mP);

    // KPIs
    const kP = el('div', 'panel');
    kP.appendChild(el('h3', null, '⭐ Totals'));
    const kpis = el('div', 'kpis');
    kpis.appendChild(kpi(s.wordsTotal, 'words learned'));
    kpis.appendChild(kpi(s.perfect, 'great pronunciations'));
    kpis.appendChild(kpi(s.dialoguesTotal, 'conversations'));
    kpis.appendChild(kpi(G.daysPracticed(), 'days practiced'));
    kP.appendChild(kpis);
    wrap.appendChild(kP);

    const ab = el('button', 'review-cta', '🏅 View achievements (' + badgeSummary() + ')');
    ab.addEventListener('click', () => go('achievements'));
    wrap.appendChild(ab);

    views.replaceChildren(wrap);
  }
  function kpi(v, lab) { const k = el('div', 'kpi'); k.innerHTML = '<b>' + v + '</b><span>' + lab + '</span>'; return k; }

  /* ===================== ACHIEVEMENTS ===================== */
  function renderAchievements() {
    crumb.textContent = 'Achievements';
    const list = G.achievementsFor(gatherStats());
    const on = list.filter(a => a.unlocked).length;
    const wrap = el('div');
    const head = el('div', 'lang-head');
    head.appendChild(el('div', 'flag', '🏅'));
    const ht = el('div'); ht.appendChild(el('div', 't', 'Achievements')); ht.appendChild(el('div', 's', on + ' of ' + list.length + ' unlocked')); head.appendChild(ht);
    wrap.appendChild(head);
    const grid = el('div', 'ach-grid');
    list.forEach(a => {
      const c = el('div', 'ach' + (a.unlocked ? ' on' : ''));
      c.appendChild(el('div', 'badge', a.emoji));
      c.appendChild(el('div', 'at', a.title));
      c.appendChild(el('div', 'ad', a.desc));
      if (a.unlocked) c.appendChild(el('div', 'adate', '✓ ' + a.unlockedDate));
      else if (a.prog) { const pb = el('div', 'apbar'); const f = el('i'); f.style.width = Math.round(a.prog.cur / a.prog.max * 100) + '%'; pb.appendChild(f); c.appendChild(pb); c.appendChild(el('div', 'ad', a.prog.cur + ' / ' + a.prog.max)); }
      grid.appendChild(c);
    });
    wrap.appendChild(grid);
    views.replaceChildren(wrap);
  }

  /* ===================== CONVERSATIONS ===================== */
  function renderDialogues() {
    const L = C.languages[state.code];
    crumb.textContent = L.language + ' · Conversations';
    const wrap = el('div');
    const head = el('div', 'lang-head');
    head.appendChild(el('div', 'flag', '💬'));
    const ht = el('div'); ht.appendChild(el('div', 't', 'Conversations')); ht.appendChild(el('div', 's', 'Role-play a real ' + L.language + ' exchange — you speak your lines.')); head.appendChild(ht);
    wrap.appendChild(head);
    const grid = el('div', 'theme-grid');
    (DLG[state.code] || []).forEach(sc => {
      const done = (G.data.dialogues[state.code] || {})[sc.id];
      const card = el('button', 'theme-card');
      card.appendChild(el('div', 'ic', sc.icon));
      card.appendChild(el('div', 'tt', sc.title));
      card.appendChild(el('div', 'cnt', sc.setting));
      const meta = el('div', 'meta'); meta.style.marginTop = '10px';
      meta.appendChild(el('div', 'cnt', (done ? '✅ Completed' : '▶ ' + sc.lines.filter(l => l.speaker === 'you').length + ' lines to say')));
      card.appendChild(meta);
      card.addEventListener('click', () => startDialogue(state.code, sc.id));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    views.replaceChildren(wrap);
  }

  const dlg = { code: null, scenario: null, idx: 0, perf: null, awarded: false };
  function startDialogue(code, id) {
    const sc = (DLG[code] || []).find(s => s.id === id); if (!sc) return;
    dlg.code = code; dlg.scenario = sc; dlg.idx = 0; dlg.perf = {}; dlg.awarded = false;
    go('dialogue', { code, scenarioId: id });
  }
  function renderDialogue() {
    const L = C.languages[dlg.code]; const sc = dlg.scenario;
    crumb.textContent = L.language + ' · ' + sc.title;
    if (dlg.idx >= sc.lines.length) return renderDialogueDone();
    const wrap = el('div');

    const head = el('div', 'scene-head');
    head.appendChild(el('div', 'si', sc.icon));
    const ht = el('div'); ht.appendChild(el('div', 'st', sc.title)); ht.appendChild(el('div', 'ss', sc.setting)); head.appendChild(ht);
    wrap.appendChild(head);

    const chat = el('div', 'chat');
    for (let i = 0; i < dlg.idx; i++) chat.appendChild(bubble(sc.lines[i], L, false));
    const cur = sc.lines[dlg.idx];
    if (cur.speaker === 'them') {
      chat.appendChild(bubble(cur, L, true));
      wrap.appendChild(chat);
      const cta = el('div', 'turn-cta'); const b = el('button', 'btn primary', 'Continue ▸');
      b.addEventListener('click', () => { stopAll(); dlg.idx++; renderDialogue(); }); cta.appendChild(b); wrap.appendChild(cta);
      views.replaceChildren(wrap);
      setTimeout(() => speak(cur.target, L.bcp47), 260);
    } else {
      wrap.appendChild(chat);
      const yt = el('div', 'yourturn');
      yt.appendChild(el('div', 'yt-lab', '🎤 Your line'));
      yt.appendChild(el('div', 'yt-en', '“' + cur.translation + '”'));
      yt.appendChild(el('div', 'yt-target', cur.target));
      yt.appendChild(el('div', 'yt-ph', cur.phonetic || ''));
      const fb = el('div', 'feedback'); yt.appendChild(fb);
      const actions = el('div', 'yt-actions');
      const hearBtn = el('button', 'btn play', '🔊 Hear it');
      const micBtn = el('button', 'btn mic', SR_SUPPORTED ? '🎤 Say it' : '🎤 Practice');
      actions.appendChild(hearBtn); actions.appendChild(micBtn); yt.appendChild(actions);
      wrap.appendChild(yt);
      const cta = el('div', 'turn-cta'); const nextB = el('button', 'btn primary', 'Say & continue ▸'); cta.appendChild(nextB); wrap.appendChild(cta);
      views.replaceChildren(wrap);
      setTimeout(() => speak(cur.target, L.bcp47), 200);

      hearBtn.addEventListener('click', () => speak(cur.target, L.bcp47));
      let recording = false;
      micBtn.addEventListener('click', () => {
        if (!SR_SUPPORTED) { showFeedback(fb, 'mid', '👍 Practiced! Tap 🔊 to compare, then continue.'); return; }
        if (recording) { stopListening(); return; }
        recording = true; micBtn.classList.add('rec'); micBtn.textContent = '● Listening…';
        listen(L.bcp47, (res) => {
          recording = false; micBtn.classList.remove('rec'); micBtn.textContent = '🎤 Say it';
          if (res.unsupported || res.error || res.ended || !res.transcript) return showFeedback(fb, 'mid', 'Didn\'t catch that — try again 🔊');
          const best = scoreSpeech(res.alternatives || [res.transcript], cur.target, dlg.code);
          if (best >= 0.75) { if (!dlg.perf[dlg.idx]) { dlg.perf[dlg.idx] = 1; award(5, 'perfect'); } showFeedback(fb, 'good', '🎉 Nice! Ready to continue.', 'Heard: “' + res.transcript + '”'); }
          else if (best >= 0.45) showFeedback(fb, 'mid', '👏 Close — hear it once more.', 'Heard: “' + res.transcript + '”');
          else showFeedback(fb, 'bad', '🔁 Try again after the audio.', 'Heard: “' + res.transcript + '”');
        });
      });
      nextB.addEventListener('click', () => { stopAll(); award(3, 'dialogue'); dlg.idx++; renderDialogue(); });
    }
  }
  function bubble(line, L, active) {
    const b = el('div', 'bubble ' + (line.speaker === 'you' ? 'you' : 'them'));
    b.appendChild(el('div', 'bemoji', line.emoji || (line.speaker === 'you' ? '🗣️' : '💬')));
    b.appendChild(el('div', 'btxt', line.target));
    if (line.phonetic) b.appendChild(el('div', 'bph', line.phonetic));
    b.appendChild(el('div', 'btr', line.translation));
    const mic = el('div', 'bmic'); const play = el('button', 'chip', '🔊'); play.addEventListener('click', () => speak(line.target, L.bcp47)); mic.appendChild(play); b.appendChild(mic);
    return b;
  }
  function renderDialogueDone() {
    const L = C.languages[dlg.code]; const sc = dlg.scenario;
    if (!dlg.awarded) { dlg.awarded = true; G.markDialogue(dlg.code, sc.id); award(15, 'dialogue'); }
    crumb.textContent = L.language + ' · complete';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '🎭'));
    wrap.appendChild(el('h2', null, 'Conversation complete!'));
    wrap.appendChild(el('p', null, 'You held your own through “' + sc.title + '” in ' + L.language + '. That\'s real speaking practice.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 Replay');
    const more = el('button', 'btn primary', 'More conversations →');
    again.addEventListener('click', () => startDialogue(dlg.code, sc.id));
    more.addEventListener('click', () => go('dialogues', { code: dlg.code }));
    nav.appendChild(again); nav.appendChild(more); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  /* ===================== CHALLENGE (quiz) ===================== */
  const quiz = { code: null, qs: [], idx: 0, correct: 0, answered: false };
  function startQuiz(code) {
    const L = C.languages[code]; const lp = langProg(code);
    let pool = L.items.filter(i => lp.learned[i.id]);
    if (pool.length < 4) pool = L.items.slice();
    const chosen = shuffle(pool).slice(0, Math.min(10, pool.length));
    const qs = chosen.map((item, i) => {
      let type = ['listen', 'meaning', 'speak'][i % 3];
      if (type === 'speak' && !SR_SUPPORTED) type = 'meaning';
      const others = shuffle(L.items.filter(x => x.id !== item.id)).slice(0, 3);
      const opts = shuffle([item].concat(others));
      return { type, item, opts };
    });
    quiz.code = code; quiz.qs = qs; quiz.idx = 0; quiz.correct = 0; quiz.answered = false;
    go('quiz', { code });
  }
  function renderQuiz() {
    const L = C.languages[quiz.code];
    crumb.textContent = L.language + ' · Challenge';
    if (quiz.idx >= quiz.qs.length) return renderQuizDone();
    const q = quiz.qs[quiz.idx]; const item = q.item;
    const wrap = el('div');

    const pt = el('div', 'progress-top'); const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (quiz.idx / quiz.qs.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (quiz.idx + 1) + ' / ' + quiz.qs.length)); wrap.appendChild(pt);

    const dots = el('div', 'qscore'); quiz.qs.forEach((x, i) => { const d = el('div', 'qdot' + (x._res === true ? ' ok' : x._res === false ? ' no' : '')); dots.appendChild(d); }); wrap.appendChild(dots);

    quiz.answered = false;
    const card = el('div', 'card');

    if (q.type === 'listen') {
      card.appendChild(el('div', 'quiz-q', '🔊 What did you hear?'));
      const rep = el('button', 'btn play', '🔊 Play again'); rep.style.margin = '0 auto 6px'; rep.addEventListener('click', () => speak(item.target, L.bcp47)); card.appendChild(rep);
      card.appendChild(el('div', 'quiz-sub', 'Tap the word you heard.'));
      card.appendChild(optionGrid(q, 'listen', L));
      wrap.appendChild(card); views.replaceChildren(wrap);
      setTimeout(() => speak(item.target, L.bcp47), 300);
    } else if (q.type === 'meaning') {
      card.appendChild(el('div', 'quiz-emoji', item.emoji || '❓'));
      card.appendChild(el('div', 'quiz-q', item.target));
      card.appendChild(el('div', 'quiz-sub', 'What does it mean?'));
      card.appendChild(optionGrid(q, 'meaning', L));
      wrap.appendChild(card); views.replaceChildren(wrap);
    } else { // speak
      card.appendChild(el('div', 'quiz-emoji', item.emoji || '🗣️'));
      card.appendChild(el('div', 'quiz-q', 'Say: “' + item.translation + '”'));
      card.appendChild(el('div', 'quiz-sub', 'Speak it in ' + L.language + '.'));
      const fb = el('div', 'feedback'); card.appendChild(fb);
      const row = el('div', 'speak-row');
      const micBtn = el('button', 'btn mic', '🎤 Say it'); const skip = el('button', 'btn ghost', 'Reveal');
      row.appendChild(micBtn); row.appendChild(skip); card.appendChild(row);
      wrap.appendChild(card); views.replaceChildren(wrap);
      let recording = false, done = false;
      function settle(ok, heard) {
        if (done) return; done = true;
        q._res = ok; if (ok) { quiz.correct++; award(5, 'quiz'); }
        fb.className = 'feedback show ' + (ok ? 'good' : 'bad');
        fb.innerHTML = (ok ? '🎉 Correct! ' : '❌ The answer: ') + '<b>' + item.target + '</b>' + (heard ? '<span class="heard">Heard: “' + heard + '”</span>' : '');
        speak(item.target, L.bcp47);
        const nx = el('div', 'nav-row'); const nb = el('button', 'btn primary', quiz.idx === quiz.qs.length - 1 ? 'Finish ✓' : 'Next →'); nb.addEventListener('click', () => { quiz.idx++; renderQuiz(); }); nx.appendChild(nb); card.appendChild(nx);
      }
      micBtn.addEventListener('click', () => {
        if (recording) { stopListening(); return; }
        recording = true; micBtn.classList.add('rec'); micBtn.textContent = '● Listening…';
        listen(L.bcp47, (res) => {
          recording = false; micBtn.classList.remove('rec'); micBtn.textContent = '🎤 Say it';
          if (res.unsupported || res.error || res.ended || !res.transcript) { settle(false, res.transcript || ''); return; }
          const best = scoreSpeech(res.alternatives || [res.transcript], item.target, quiz.code);
          settle(best >= 0.6, res.transcript);
        });
      });
      skip.addEventListener('click', () => settle(false, ''));
    }
  }
  function optionGrid(q, mode, L) {
    const grid = el('div', 'q-options');
    let done = false;
    q.opts.forEach(opt => {
      const b = el('button', 'q-opt');
      if (mode === 'listen') b.innerHTML = '<span class="oe">' + (opt.emoji || '') + '</span>' + opt.translation;
      else b.textContent = opt.translation;
      b.addEventListener('click', () => {
        if (done) return; done = true;
        const ok = opt.id === q.item.id;
        q._res = ok; if (ok) { quiz.correct++; award(5, 'quiz'); }
        Array.from(grid.children).forEach(ch => { ch.disabled = true; });
        b.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) { Array.from(grid.children).forEach((ch, i) => { if (q.opts[i].id === q.item.id) ch.classList.add('correct'); }); }
        speak(q.item.target, L.bcp47);
        const nx = el('div', 'nav-row'); nx.style.marginTop = '16px';
        const nb = el('button', 'btn primary', quiz.idx === quiz.qs.length - 1 ? 'Finish ✓' : 'Next →');
        nb.addEventListener('click', () => { quiz.idx++; renderQuiz(); }); nx.appendChild(nb);
        grid.parentElement.appendChild(nx);
      });
      grid.appendChild(b);
    });
    return grid;
  }
  function renderQuizDone() {
    const L = C.languages[quiz.code]; const total = quiz.qs.length; const pct = Math.round(quiz.correct / total * 100);
    if (!quiz._awarded) { quiz._awarded = true; const bonus = 5 + Math.round(pct / 10); award(bonus, 'quiz'); }
    crumb.textContent = L.language + ' · Challenge';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '🌱'));
    wrap.appendChild(el('h2', null, quiz.correct + ' / ' + total + ' correct'));
    wrap.appendChild(el('p', null, pct >= 80 ? 'Outstanding — you\'ve really got these!' : pct >= 50 ? 'Solid work. A quick review will push you higher.' : 'Good effort — practice the lessons and try again.'));
    const stats = el('div', 'stat-row'); stats.appendChild(statBox(pct + '%', 'accuracy')); stats.appendChild(statBox(quiz.correct, 'correct')); wrap.appendChild(stats);
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 New challenge'); const back2 = el('button', 'btn primary', 'Back to topics →');
    again.addEventListener('click', () => { quiz._awarded = false; startQuiz(quiz.code); }); back2.addEventListener('click', () => go('themes', { code: quiz.code }));
    nav.appendChild(again); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  /* ===================== shared track helpers ===================== */
  function trackLearnedCount(code) { const lp = langProg(code).learned; return Object.keys(lp).filter(id => lp[id]).length; }
  function trackPct(code, total) { if (!total) return 0; return Math.round(trackLearnedCount(code) / total * 100); }
  function trackCard(code, icon, title, sub, onClick) {
    const card = el('button', 'lang-card');
    card.appendChild(el('div', 'flag', icon));
    const info = el('div');
    info.appendChild(el('div', 'name', title));
    info.appendChild(el('div', 'native', sub));
    const total = code === 'morse' ? MORSE.items.length : SIGN.items.length;
    const pct = trackPct(code, total);
    const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill); info.appendChild(bar);
    info.appendChild(el('div', 'pct', pct > 0 ? pct + '% learned' : 'Start →'));
    card.appendChild(info);
    card.addEventListener('click', onClick);
    return card;
  }
  function masteryRow(icon, name, n, total, onClick) {
    const pct = total ? Math.round(n / total * 100) : 0;
    const row = el('div', 'mrow');
    row.appendChild(el('div', 'mflag', icon));
    const mid = el('div', 'mmid');
    const nm = el('div', 'mname'); nm.innerHTML = name + '<span>' + n + '/' + total + ' · ' + pct + '%</span>'; mid.appendChild(nm);
    const bar = el('div', 'mbar'); const f = el('i'); f.style.width = pct + '%'; bar.appendChild(f); mid.appendChild(bar);
    row.appendChild(mid);
    if (onClick) { row.style.cursor = 'pointer'; row.addEventListener('click', onClick); }
    return row;
  }
  function trackGroupGrid(items, groups, code, onPick) {
    const grid = el('div', 'theme-grid');
    groups.forEach(gp => {
      const gi = items.filter(i => i.group === gp.id); const lp = langProg(code);
      const done = gi.filter(i => lp.learned[i.id]).length; const pct = gi.length ? Math.round(done / gi.length * 100) : 0;
      const card = el('button', 'theme-card');
      card.appendChild(el('div', 'ic', gp.icon)); card.appendChild(el('div', 'tt', gp.title));
      const meta = el('div', 'meta'); const ring = el('div', 'ring' + (pct >= 100 ? ' done' : '')); ring.style.setProperty('--p', pct);
      if (pct >= 100) ring.textContent = ''; meta.appendChild(ring); meta.appendChild(el('div', 'cnt', done + ' / ' + gi.length)); card.appendChild(meta);
      card.addEventListener('click', () => onPick(gp.id));
      grid.appendChild(card);
    });
    return grid;
  }

  /* ===================== MORSE ===================== */
  const MORSE_MAP = {};
  MORSE.items.forEach(i => { if (i.char && i.char.length === 1) MORSE_MAP[i.char.toUpperCase()] = i.pattern; });

  const MorseAudio = {
    ctx: null, freq: 620, wpm: 13,
    ensure() { try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { this.ctx = null; } return this.ctx; },
    unit(slow) { return (1.2 / this.wpm) * (slow ? 1.9 : 1); },
    _tone(g, t, on) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.006); g.gain.setValueAtTime(0.28, t + on - 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + on); },
    playPattern(pattern, slow) {
      const ctx = this.ensure(); if (!ctx) return 0;
      const u = this.unit(slow); let t = ctx.currentTime + 0.06;
      const osc = ctx.createOscillator(); const g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = this.freq; osc.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); osc.start();
      for (const sym of pattern) { if (sym !== '.' && sym !== '-') continue; const on = (sym === '-' ? 3 : 1) * u; this._tone(g, t, on); t += on + u; }
      osc.stop(t + 0.05); return t - ctx.currentTime;
    },
    playText(text, slow) {
      const ctx = this.ensure(); if (!ctx) return 0;
      const u = this.unit(slow); let t = ctx.currentTime + 0.06;
      const osc = ctx.createOscillator(); const g = ctx.createGain(); osc.type = 'sine'; osc.frequency.value = this.freq; osc.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime); osc.start();
      const words = String(text).toUpperCase().trim().split(/\s+/);
      words.forEach((w) => {
        w.split('').forEach((ch) => {
          const pat = MORSE_MAP[ch]; if (!pat) return;
          for (const sym of pat) { const on = (sym === '-' ? 3 : 1) * u; this._tone(g, t, on); t += on + u; }
          t += 2 * u; // char gap (total 3u)
        });
        t += 4 * u; // word gap (total 7u)
      });
      osc.stop(t + 0.05); return t - ctx.currentTime;
    },
  };

  function morsePatternEl(pattern, big) {
    const w = el('div', 'morse-pattern' + (big ? ' big' : ''));
    for (const sym of pattern) { if (sym === '.') w.appendChild(el('span', 'dot')); else if (sym === '-') w.appendChild(el('span', 'dash')); }
    return w;
  }
  function prettyPattern(pattern) { return pattern.replace(/\./g, '·').replace(/-/g, '−'); }

  function renderMorseHub() {
    crumb.textContent = 'Morse Code';
    const wrap = el('div');
    const head = el('div', 'lang-head'); head.appendChild(el('div', 'flag', '📡'));
    const ht = el('div'); ht.appendChild(el('div', 't', 'Morse Code'));
    ht.appendChild(el('div', 's', trackPct('morse', MORSE.items.length) + '% learned · hear the dots & dashes')); head.appendChild(ht); wrap.appendChild(head);
    const modes = el('div', 'modes');
    modes.appendChild(modeCard('📖', 'Learn', 'see & hear', () => startMorseLearn('letters')));
    modes.appendChild(modeCard('🎧', 'Decode', 'listen & guess', () => startMorseQuiz()));
    modes.appendChild(modeCard('🔤', 'Translator', 'text ↔ code', () => go('morsetrans')));
    modes.appendChild(modeCard('📊', 'Progress', 'your stats', () => go('stats')));
    wrap.appendChild(modes);
    wrap.appendChild(el('div', 'section-label', 'Learn by set'));
    wrap.appendChild(trackGroupGrid(MORSE.items, MORSE.groups, 'morse', startMorseLearn));
    views.replaceChildren(wrap);
  }

  const morseLesson = { items: [], idx: 0, groupId: null, perf: null };
  function startMorseLearn(groupId) {
    morseLesson.items = MORSE.items.filter(i => i.group === groupId).slice();
    morseLesson.idx = 0; morseLesson.groupId = groupId; morseLesson.perf = {};
    go('morselearn', {});
  }
  function renderMorseLearn() {
    const items = morseLesson.items;
    const gp = MORSE.groups.find(g => g.id === morseLesson.groupId) || {};
    crumb.textContent = 'Morse · ' + (gp.title || '');
    if (morseLesson.idx >= items.length) return renderMorseDone();
    const item = items[morseLesson.idx];
    const wrap = el('div');
    const pt = el('div', 'progress-top'); const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (morseLesson.idx / items.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (morseLesson.idx + 1) + ' / ' + items.length)); wrap.appendChild(pt);

    const card = el('div', 'card');
    card.appendChild(el('div', 'morse-char', item.char));
    card.appendChild(morsePatternEl(item.pattern, true));
    card.appendChild(el('div', 'phon', item.name));
    if (item.mnem) card.appendChild(el('div', 'note-pin', 'rhythm: ' + item.mnem));
    const row = el('div', 'speak-row');
    const playBtn = el('button', 'btn play', '🔊 Play'); const slowBtn = el('button', 'btn ghost', '🐢 Slow');
    row.appendChild(playBtn); row.appendChild(slowBtn); card.appendChild(row);

    card.appendChild(el('div', 'tap-label', 'Tap it back:'));
    const tapOut = el('div', 'tap-out');
    const tapBtns = el('div', 'tap-btns');
    const dit = el('button', 'btn tapbtn', '· dit'); const dah = el('button', 'btn tapbtn', '− dah'); const clr = el('button', 'btn ghost', '⌫');
    tapBtns.appendChild(dit); tapBtns.appendChild(dah); tapBtns.appendChild(clr);
    card.appendChild(tapOut); card.appendChild(tapBtns);
    const fb = el('div', 'feedback'); card.appendChild(fb);
    wrap.appendChild(card);

    const nav = el('div', 'nav-row');
    const skip = el('button', 'btn sec', 'Skip'); const next = el('button', 'btn primary', (morseLesson.idx === items.length - 1 ? 'Finish ✓' : 'Next →'));
    nav.appendChild(skip); nav.appendChild(next); wrap.appendChild(nav);
    views.replaceChildren(wrap);

    setTimeout(() => MorseAudio.playPattern(item.pattern), 320);
    playBtn.addEventListener('click', () => MorseAudio.playPattern(item.pattern));
    slowBtn.addEventListener('click', () => MorseAudio.playPattern(item.pattern, true));

    let input = '';
    function drawTap() { tapOut.replaceChildren(); if (!input) { tapOut.appendChild(el('span', 'tap-ph', 'tap · and − to match')); return; } for (const s of input) tapOut.appendChild(s === '.' ? el('span', 'dot') : el('span', 'dash')); }
    drawTap();
    function addSym(s) { if (input.length >= item.pattern.length) input = ''; input += s; drawTap(); MorseAudio.playPattern(s); if (input.length >= item.pattern.length) check(); }
    dit.addEventListener('click', () => addSym('.'));
    dah.addEventListener('click', () => addSym('-'));
    clr.addEventListener('click', () => { input = ''; drawTap(); fb.className = 'feedback'; });
    function check() {
      if (input === item.pattern) { fb.className = 'feedback show good'; fb.innerHTML = '🎉 Correct rhythm!'; if (!morseLesson.perf[item.id]) { morseLesson.perf[item.id] = 1; award(2, 'try'); } }
      else { fb.className = 'feedback show bad'; fb.innerHTML = '❌ It\'s <b>' + prettyPattern(item.pattern) + '</b> — tap ⌫ and retry.'; }
    }
    function advance() { const was = langProg('morse').learned[item.id]; markLearned('morse', item.id); if (!was) award(6, 'word'); else if (G) G.evaluate(gatherStats()); morseLesson.idx++; renderMorseLearn(); }
    next.addEventListener('click', advance);
    skip.addEventListener('click', () => { morseLesson.idx++; renderMorseLearn(); });
  }
  function renderMorseDone() {
    crumb.textContent = 'Morse · done';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '📡'));
    wrap.appendChild(el('h2', null, 'Set complete!'));
    wrap.appendChild(el('p', null, 'Great work. Test yourself with the Decode challenge, or send a message in the Translator.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const q = el('button', 'btn sec', '🎧 Decode'); const back2 = el('button', 'btn primary', 'More sets →');
    q.addEventListener('click', () => startMorseQuiz()); back2.addEventListener('click', () => go('morse'));
    nav.appendChild(q); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  const morseQuiz = { qs: [], idx: 0, correct: 0, _awarded: false };
  function startMorseQuiz() {
    const pool = MORSE.items.filter(i => i.group === 'letters' || i.group === 'numbers');
    const lp = langProg('morse'); let learned = pool.filter(i => lp.learned[i.id]); if (learned.length < 4) learned = pool;
    const chosen = shuffle(learned).slice(0, Math.min(10, learned.length));
    morseQuiz.qs = chosen.map(item => { const others = shuffle(pool.filter(x => x.id !== item.id)).slice(0, 3); return { item, opts: shuffle([item].concat(others)) }; });
    morseQuiz.idx = 0; morseQuiz.correct = 0; morseQuiz._awarded = false;
    go('morsequiz', {});
  }
  function renderMorseQuiz() {
    crumb.textContent = 'Morse · Decode';
    if (morseQuiz.idx >= morseQuiz.qs.length) return renderMorseQuizDone();
    const q = morseQuiz.qs[morseQuiz.idx]; const item = q.item;
    const wrap = el('div');
    const pt = el('div', 'progress-top'); const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (morseQuiz.idx / morseQuiz.qs.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (morseQuiz.idx + 1) + ' / ' + morseQuiz.qs.length)); wrap.appendChild(pt);
    const dots = el('div', 'qscore'); morseQuiz.qs.forEach(x => dots.appendChild(el('div', 'qdot' + (x._res === true ? ' ok' : x._res === false ? ' no' : '')))); wrap.appendChild(dots);
    const card = el('div', 'card');
    card.appendChild(el('div', 'quiz-q', '🎧 Which character?'));
    const rep = el('button', 'btn play', '🔊 Play again'); rep.style.margin = '0 auto 10px'; rep.addEventListener('click', () => MorseAudio.playPattern(item.pattern)); card.appendChild(rep);
    card.appendChild(morsePatternEl(item.pattern, true));
    const grid = el('div', 'q-options'); grid.style.marginTop = '16px';
    let done = false;
    q.opts.forEach(opt => {
      const b = el('button', 'q-opt'); b.textContent = opt.char;
      b.addEventListener('click', () => {
        if (done) return; done = true; const ok = opt.id === item.id; q._res = ok;
        if (ok) { morseQuiz.correct++; award(5, 'quiz'); markLearned('morse', item.id); }
        Array.from(grid.children).forEach(c => { c.disabled = true; });
        b.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) Array.from(grid.children).forEach((c, i) => { if (q.opts[i].id === item.id) c.classList.add('correct'); });
        MorseAudio.playPattern(item.pattern);
        const nx = el('div', 'nav-row'); nx.style.marginTop = '16px'; const nb = el('button', 'btn primary', morseQuiz.idx === morseQuiz.qs.length - 1 ? 'Finish ✓' : 'Next →');
        nb.addEventListener('click', () => { morseQuiz.idx++; renderMorseQuiz(); }); nx.appendChild(nb); card.appendChild(nx);
      });
      grid.appendChild(b);
    });
    card.appendChild(grid); wrap.appendChild(card);
    views.replaceChildren(wrap);
    setTimeout(() => MorseAudio.playPattern(item.pattern), 320);
  }
  function renderMorseQuizDone() {
    const total = morseQuiz.qs.length; const pct = total ? Math.round(morseQuiz.correct / total * 100) : 0;
    if (!morseQuiz._awarded) { morseQuiz._awarded = true; award(5 + Math.round(pct / 10), 'quiz'); }
    crumb.textContent = 'Morse · Decode';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '🌱'));
    wrap.appendChild(el('h2', null, morseQuiz.correct + ' / ' + total + ' correct'));
    wrap.appendChild(el('p', null, pct >= 80 ? 'Sharp ears! You\'re reading Morse by sound.' : 'Keep practising — replay the audio and listen for the rhythm.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 New round'); const back2 = el('button', 'btn primary', 'Back →');
    again.addEventListener('click', () => startMorseQuiz()); back2.addEventListener('click', () => go('morse'));
    nav.appendChild(again); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  function renderMorseTrans() {
    crumb.textContent = 'Morse · Translator';
    const wrap = el('div');
    const head = el('div', 'lang-head'); head.appendChild(el('div', 'flag', '🔤'));
    const ht = el('div'); ht.appendChild(el('div', 't', 'Translator')); ht.appendChild(el('div', 's', 'Type text to see and hear it in Morse.')); head.appendChild(ht); wrap.appendChild(head);
    const panel = el('div', 'panel');
    const ta = document.createElement('textarea'); ta.className = 'trans-input'; ta.setAttribute('placeholder', 'Type a message…'); ta.value = 'SOS';
    panel.appendChild(ta);
    const out = el('div', 'trans-out'); panel.appendChild(out);
    const ctrl = el('div', 'trans-ctrl');
    const playBtn = el('button', 'btn mic', '▶ Play'); const slowBtn = el('button', 'btn ghost', '🐢 Slow: off');
    ctrl.appendChild(playBtn); ctrl.appendChild(slowBtn); panel.appendChild(ctrl);
    wrap.appendChild(panel);
    const ref = el('div', 'panel'); ref.appendChild(el('h3', null, 'Common abbreviations'));
    const list = el('div', 'abbr'); (MORSE.abbrev || []).forEach(a => { const r = el('div', 'abbr-row'); r.innerHTML = '<b>' + a.t + '</b>' + morsePatternText(a.t) + '<span>' + a.d + '</span>'; list.appendChild(r); }); ref.appendChild(list); wrap.appendChild(ref);
    views.replaceChildren(wrap);

    let slow = false, awarded = false;
    function toMorse(text) { return String(text).toUpperCase().split('').map(ch => { if (ch === ' ') return '/'; const p = MORSE_MAP[ch]; return p ? prettyPattern(p) : (ch.trim() ? '·?·' : ''); }).filter(Boolean).join('   '); }
    function refresh() { out.textContent = ta.value.trim() ? toMorse(ta.value) : '·−·· …'; }
    ta.addEventListener('input', refresh); refresh();
    playBtn.addEventListener('click', () => { MorseAudio.playText(ta.value, slow); if (!awarded) { awarded = true; award(3, 'quiz'); } });
    slowBtn.addEventListener('click', () => { slow = !slow; slowBtn.textContent = '🐢 Slow: ' + (slow ? 'on' : 'off'); });
  }
  function morsePatternText(word) { const p = word.toUpperCase().split('').map(c => MORSE_MAP[c] ? prettyPattern(MORSE_MAP[c]) : '').filter(Boolean).join(' '); return p ? ' <i>' + p + '</i> ' : ' '; }

  /* ===================== SIGN (ASL fingerspelling) ===================== */
  const SIGN_MAP = {}; SIGN.items.forEach(i => { SIGN_MAP[i.char.toUpperCase()] = i; });
  let signTimer = null;
  function clearSignTimer() { if (signTimer) { clearInterval(signTimer); signTimer = null; } }

  function signHand(cfg) {
    cfg = cfg || {};
    const W = 150, H = 180;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="hand-svg" xmlns="http://www.w3.org/2000/svg">';
    const wrist = '<rect class="hf" x="54" y="150" width="46" height="24" rx="10"/>';
    if (cfg.shape === 'O') { s += '<circle class="ho" cx="76" cy="86" r="40"/>' + wrist + '</svg>'; return s; }
    if (cfg.shape === 'C') { s += '<path class="hc" d="M 108 55 A 44 44 0 1 0 108 121"/>' + wrist + '</svg>'; return s; }
    const palmTop = 92, palmBot = 150;
    s += '<rect class="hf" x="48" y="' + palmTop + '" width="60" height="' + (palmBot - palmTop) + '" rx="18"/>';
    const fx = { i: 60, m: 76, r: 92, p: 106 };
    const tops = { i: 34, m: 30, r: 40, p: 54 };
    const baseY = palmTop + 8;
    ['i', 'm', 'r', 'p'].forEach(fk => {
      const st = cfg[fk] || 'curl'; let top;
      if (st === 'up') top = tops[fk];
      else if (st === 'half') top = baseY - 30;
      else if (st === 'hook') top = baseY - 32;
      else top = baseY - 14;
      const w = fk === 'p' ? 11 : 13; const cx = fx[fk];
      s += '<rect class="hf" x="' + (cx - w / 2) + '" y="' + top + '" width="' + w + '" height="' + (baseY - top + 12) + '" rx="' + (w / 2) + '"/>';
      if (st === 'hook') s += '<rect class="hf" x="' + (cx - w / 2) + '" y="' + (top - 3) + '" width="' + w + '" height="13" rx="' + (w / 2) + '" transform="rotate(38 ' + cx + ' ' + top + ')"/>';
    });
    // thumb
    const th = cfg.thumb || 'side';
    if (th === 'out') s += '<rect class="hf" x="16" y="98" width="34" height="14" rx="7"/>';
    else if (th === 'across') s += '<rect class="hf" x="50" y="120" width="48" height="14" rx="7"/>';
    else if (th === 'up') s += '<rect class="hf" x="64" y="64" width="12" height="36" rx="6"/>';
    else if (th === 'tuck1' || th === 'tuck2' || th === 'tuck3' || th === 'tuck') s += '<rect class="hf" x="42" y="112" width="13" height="18" rx="6"/>';
    else s += '<rect class="hf" x="38" y="104" width="14" height="36" rx="7"/>'; // side
    // decorative touch circles
    if (cfg.shape === 'circleF' || cfg.shape === 'circleD') s += '<circle class="hl" cx="' + fx.i + '" cy="' + (palmTop - 4) + '" r="10"/>';
    if (cfg.shape === 'touchP') s += '<circle class="hl" cx="' + fx.p + '" cy="' + (baseY - 12) + '" r="9"/>';
    if (cfg.shape === 'touchR') s += '<circle class="hl" cx="' + fx.r + '" cy="' + (baseY - 12) + '" r="9"/>';
    if (cfg.shape === 'touchM') s += '<circle class="hl" cx="' + fx.m + '" cy="' + (baseY - 12) + '" r="9"/>';
    if (cfg.shape === 'cross') s += '<line class="hx" x1="' + (fx.i - 4) + '" y1="' + (tops.i + 6) + '" x2="' + (fx.m + 4) + '" y2="' + (tops.m + 22) + '"/>';
    s += wrist + '</svg>';
    return s;
  }
  function handEl(cfg, cls) { const d = el('div', 'hand ' + (cls || '')); d.innerHTML = signHand(cfg); return d; }

  function renderSignHub() {
    crumb.textContent = 'ASL Fingerspelling';
    const wrap = el('div');
    const head = el('div', 'lang-head'); head.appendChild(el('div', 'flag', '🤟'));
    const ht = el('div'); ht.appendChild(el('div', 't', 'ASL Fingerspelling'));
    ht.appendChild(el('div', 's', trackPct('sign', SIGN.items.length) + '% learned · the American manual alphabet')); head.appendChild(ht); wrap.appendChild(head);
    const noteC = el('div', 'method'); noteC.style.marginBottom = '14px';
    noteC.appendChild(el('p', null, '👐 ' + (SIGN.note || '')));
    wrap.appendChild(noteC);
    const modes = el('div', 'modes');
    modes.appendChild(modeCard('📖', 'Alphabet', 'A–Z', () => startSignLearn('alphabet')));
    modes.appendChild(modeCard('🔢', 'Numbers', '0–9', () => startSignLearn('numbers')));
    modes.appendChild(modeCard('🔤', 'Fingerspell', 'any word', () => go('signspell')));
    modes.appendChild(modeCard('🎯', 'Quiz', 'name the sign', () => startSignQuiz()));
    wrap.appendChild(modes);
    views.replaceChildren(wrap);
  }

  const signLesson = { items: [], idx: 0, groupId: null };
  function startSignLearn(groupId) {
    signLesson.items = SIGN.items.filter(i => i.group === groupId).slice();
    signLesson.idx = 0; signLesson.groupId = groupId;
    go('signlearn', {});
  }
  function renderSignLearn() {
    const items = signLesson.items;
    const gp = SIGN.groups.find(g => g.id === signLesson.groupId) || {};
    crumb.textContent = 'ASL · ' + (gp.title || '');
    if (signLesson.idx >= items.length) return renderSignDone();
    const item = items[signLesson.idx];
    const wrap = el('div');
    const pt = el('div', 'progress-top'); const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (signLesson.idx / items.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (signLesson.idx + 1) + ' / ' + items.length)); wrap.appendChild(pt);

    const card = el('div', 'card');
    card.appendChild(handEl(item.cfg, 'big'));
    card.appendChild(el('div', 'target', item.char));
    if (item.motion) card.appendChild(el('div', 'motion-badge', '✍️ involves motion'));
    card.appendChild(el('div', 'sign-desc', item.desc));
    wrap.appendChild(card);

    const nav = el('div', 'nav-row');
    const skip = el('button', 'btn sec', 'Skip'); const next = el('button', 'btn primary', (signLesson.idx === items.length - 1 ? 'Finish ✓' : 'Got it →'));
    nav.appendChild(skip); nav.appendChild(next); wrap.appendChild(nav);
    wrap.appendChild(el('div', 'hint', 'Form the shape with your hand, then continue. Diagrams are a schematic guide — watch video for exact form.'));
    views.replaceChildren(wrap);

    function advance() { const was = langProg('sign').learned[item.id]; markLearned('sign', item.id); if (!was) award(6, 'word'); else if (G) G.evaluate(gatherStats()); signLesson.idx++; renderSignLearn(); }
    next.addEventListener('click', advance);
    skip.addEventListener('click', () => { signLesson.idx++; renderSignLearn(); });
  }
  function renderSignDone() {
    crumb.textContent = 'ASL · done';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '🤟'));
    wrap.appendChild(el('h2', null, 'Set complete!'));
    wrap.appendChild(el('p', null, 'Nice. Try the Quiz to test your recognition, or fingerspell your own name.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const q = el('button', 'btn sec', '🎯 Quiz'); const back2 = el('button', 'btn primary', 'Back →');
    q.addEventListener('click', () => startSignQuiz()); back2.addEventListener('click', () => go('sign'));
    nav.appendChild(q); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  const signQuiz = { qs: [], idx: 0, correct: 0, _awarded: false };
  function startSignQuiz() {
    const pool = SIGN.items.filter(i => i.group === 'alphabet');
    const lp = langProg('sign'); let learned = pool.filter(i => lp.learned[i.id]); if (learned.length < 4) learned = pool;
    const chosen = shuffle(learned).slice(0, Math.min(10, learned.length));
    signQuiz.qs = chosen.map(item => { const others = shuffle(pool.filter(x => x.id !== item.id)).slice(0, 3); return { item, opts: shuffle([item].concat(others)) }; });
    signQuiz.idx = 0; signQuiz.correct = 0; signQuiz._awarded = false;
    go('signquiz', {});
  }
  function renderSignQuiz() {
    crumb.textContent = 'ASL · Quiz';
    if (signQuiz.idx >= signQuiz.qs.length) return renderSignQuizDone();
    const q = signQuiz.qs[signQuiz.idx]; const item = q.item;
    const wrap = el('div');
    const pt = el('div', 'progress-top'); const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = (signQuiz.idx / signQuiz.qs.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar); pt.appendChild(el('div', 'num', (signQuiz.idx + 1) + ' / ' + signQuiz.qs.length)); wrap.appendChild(pt);
    const dots = el('div', 'qscore'); signQuiz.qs.forEach(x => dots.appendChild(el('div', 'qdot' + (x._res === true ? ' ok' : x._res === false ? ' no' : '')))); wrap.appendChild(dots);
    const card = el('div', 'card');
    card.appendChild(el('div', 'quiz-q', 'Which letter is this?'));
    card.appendChild(handEl(item.cfg, 'big'));
    if (item.motion) card.appendChild(el('div', 'motion-badge', '✍️ involves motion'));
    const grid = el('div', 'q-options'); grid.style.marginTop = '14px';
    let done = false;
    q.opts.forEach(opt => {
      const b = el('button', 'q-opt'); b.textContent = opt.char;
      b.addEventListener('click', () => {
        if (done) return; done = true; const ok = opt.id === item.id; q._res = ok;
        if (ok) { signQuiz.correct++; award(5, 'quiz'); markLearned('sign', item.id); }
        Array.from(grid.children).forEach(c => { c.disabled = true; });
        b.classList.add(ok ? 'correct' : 'wrong');
        if (!ok) Array.from(grid.children).forEach((c, i) => { if (q.opts[i].id === item.id) c.classList.add('correct'); });
        const nx = el('div', 'nav-row'); nx.style.marginTop = '16px'; const nb = el('button', 'btn primary', signQuiz.idx === signQuiz.qs.length - 1 ? 'Finish ✓' : 'Next →');
        nb.addEventListener('click', () => { signQuiz.idx++; renderSignQuiz(); }); nx.appendChild(nb); card.appendChild(nx);
      });
      grid.appendChild(b);
    });
    card.appendChild(grid); wrap.appendChild(card);
    views.replaceChildren(wrap);
  }
  function renderSignQuizDone() {
    const total = signQuiz.qs.length; const pct = total ? Math.round(signQuiz.correct / total * 100) : 0;
    if (!signQuiz._awarded) { signQuiz._awarded = true; award(5 + Math.round(pct / 10), 'quiz'); }
    crumb.textContent = 'ASL · Quiz';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', pct >= 80 ? '🏆' : pct >= 50 ? '💪' : '🌱'));
    wrap.appendChild(el('h2', null, signQuiz.correct + ' / ' + total + ' correct'));
    wrap.appendChild(el('p', null, pct >= 80 ? 'Excellent recognition!' : 'Keep going — review the alphabet and try again.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '440px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 New round'); const back2 = el('button', 'btn primary', 'Back →');
    again.addEventListener('click', () => startSignQuiz()); back2.addEventListener('click', () => go('sign'));
    nav.appendChild(again); nav.appendChild(back2); wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  function renderSignSpell() {
    clearSignTimer();
    crumb.textContent = 'ASL · Fingerspell';
    const wrap = el('div');
    const head = el('div', 'lang-head'); head.appendChild(el('div', 'flag', '🔤'));
    const ht = el('div'); ht.appendChild(el('div', 't', 'Fingerspell')); ht.appendChild(el('div', 's', 'Type a word to see it signed, letter by letter.')); head.appendChild(ht); wrap.appendChild(head);
    const panel = el('div', 'panel');
    const ta = document.createElement('input'); ta.type = 'text'; ta.className = 'trans-input'; ta.setAttribute('placeholder', 'Type a word or name…'); ta.value = 'HELLO'; ta.maxLength = 24;
    panel.appendChild(ta);
    const ctrl = el('div', 'trans-ctrl');
    const playBtn = el('button', 'btn mic', '▶ Step through'); ctrl.appendChild(playBtn); panel.appendChild(ctrl);
    const out = el('div', 'spell-out'); panel.appendChild(out);
    wrap.appendChild(panel);
    views.replaceChildren(wrap);

    let awarded = false;
    function build() {
      out.replaceChildren();
      const chars = String(ta.value).toUpperCase().split('');
      chars.forEach(ch => {
        if (ch === ' ') { out.appendChild(el('div', 'spell-gap')); return; }
        const item = SIGN_MAP[ch]; if (!item) return;
        const cell = el('div', 'spell-cell');
        cell.appendChild(handEl(item.cfg, 'mini'));
        cell.appendChild(el('div', 'spell-l', item.char));
        out.appendChild(cell);
      });
    }
    ta.addEventListener('input', build); build();
    playBtn.addEventListener('click', () => {
      clearSignTimer();
      const cells = Array.from(out.querySelectorAll('.spell-cell'));
      if (!cells.length) return;
      cells.forEach(c => c.classList.remove('on'));
      let i = 0;
      cells[0].classList.add('on');
      signTimer = setInterval(() => {
        if (!document.body.contains(out)) { clearSignTimer(); return; }
        cells.forEach(c => c.classList.remove('on'));
        i++;
        if (i >= cells.length) { clearSignTimer(); return; }
        cells[i].classList.add('on');
      }, 700);
      if (!awarded) { awarded = true; award(3, 'quiz'); }
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener('pal:caninstall', () => { if (state.view === 'home') renderHome(); });
  initTheme();
  render();
})();
