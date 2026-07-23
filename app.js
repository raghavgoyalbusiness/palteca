/* ===================== Palteca app ===================== */
(function () {
  'use strict';
  const C = window.PALTECA_CONTENT;
  const $ = (s, r) => (r || document).querySelector(s);
  const el = (t, cls, html) => { const n = document.createElement(t); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  const views = $('#views');
  const topbar = $('#topbar');
  const crumb = $('#crumb');
  const backBtn = $('#backBtn');
  const themeToggle = $('#themeToggle');
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

  /* ---------- persistence ---------- */
  const PKEY = 'palteca:progress:v1';
  function loadProg() { try { return JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { return {}; } }
  function saveProg(p) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {} }
  let progress = loadProg();
  function langProg(code) { if (!progress[code]) progress[code] = { learned: {}, strength: {} }; return progress[code]; }
  function markLearned(code, id) { const lp = langProg(code); lp.learned[id] = true; lp.strength[id] = Math.min((lp.strength[id] || 0) + 1, 5); saveProg(progress); }
  function bumpStrength(code, id, delta) { const lp = langProg(code); lp.strength[id] = Math.max(0, Math.min((lp.strength[id] || 0) + delta, 5)); lp.learned[id] = true; saveProg(progress); }

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
  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.classList.remove('show'); setTimeout(() => (toastEl.hidden = true), 300); }, ms || 2600);
  }

  /* ---------- speech synthesis (native pronunciation) ---------- */
  let VOICES = [];
  function refreshVoices() { VOICES = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
  if (window.speechSynthesis) {
    refreshVoices();
    speechSynthesis.onvoiceschanged = refreshVoices;
  }
  function pickVoice(bcp47) {
    if (!VOICES.length) refreshVoices();
    const lang = bcp47.toLowerCase();
    const base = lang.split('-')[0];
    // exact match first, then base-language, prefer local/higher-quality
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
    const v = pickVoice(bcp47);
    if (v) u.voice = v;
    u.rate = opts.rate != null ? opts.rate : 0.82; // a touch slow for learners
    u.pitch = 1;
    if (!v) {
      // No matching voice installed — still attempt with lang, but warn once.
      if (!speak._warned) { speak._warned = {}; }
      if (!speak._warned[bcp47]) { speak._warned[bcp47] = 1; toast('Tip: install a ' + bcp47 + ' system voice for best audio'); }
    }
    speechSynthesis.speak(u);
  }

  /* ---------- speech recognition (pronunciation check) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SR_SUPPORTED = !!SR;
  function normalize(s, code) {
    if (!s) return '';
    s = s.toLowerCase().trim();
    if (code === 'zh') {
      // keep Han characters only
      const han = s.match(/[一-鿿]/g);
      return han ? han.join('') : s.replace(/[\s，。！？、,.!?]/g, '');
    }
    // strip accents & punctuation for es/fr/en
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/['’‘\-–—.,!?¡¿;:"()]/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    const d = new Array(n + 1);
    for (let j = 0; j <= n; j++) d[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = d[j];
        d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return d[n];
  }
  function similarity(a, b) {
    if (!a && !b) return 1;
    const L = Math.max(a.length, b.length) || 1;
    return 1 - levenshtein(a, b) / L;
  }

  let activeRec = null;
  function listen(bcp47, code, onDone) {
    if (!SR_SUPPORTED) { onDone({ unsupported: true }); return null; }
    let rec;
    try { rec = new SR(); } catch (e) { onDone({ unsupported: true }); return null; }
    rec.lang = bcp47; rec.interimResults = false; rec.maxAlternatives = 3; rec.continuous = false;
    let got = false;
    rec.onresult = (ev) => {
      got = true;
      const alts = [];
      const r = ev.results[0];
      for (let i = 0; i < r.length; i++) alts.push(r[i].transcript);
      onDone({ transcript: alts[0], alternatives: alts });
    };
    rec.onerror = (ev) => { onDone({ error: ev.error || 'error' }); };
    rec.onend = () => { if (!got) onDone({ ended: true }); activeRec = null; };
    try { rec.start(); activeRec = rec; } catch (e) { onDone({ error: 'start' }); }
    return rec;
  }
  function stopListening() { if (activeRec) { try { activeRec.stop(); } catch (e) {} activeRec = null; } }

  /* ---------- helpers ---------- */
  function themeItems(code, themeId) { return C.languages[code].items.filter(i => i.theme === themeId); }
  function activeThemes(code) {
    return C.themes.filter(t => themeItems(code, t.id).length > 0);
  }
  function langCompletion(code) {
    const items = C.languages[code].items;
    if (!items.length) return 0;
    const lp = langProg(code);
    const done = items.filter(i => lp.learned[i.id]).length;
    return Math.round((done / items.length) * 100);
  }

  /* ---------- navigation ---------- */
  const state = { view: 'home', code: null, themeId: null };
  function go(view, data) {
    Object.assign(state, data || {});
    state.view = view;
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }
  backBtn.addEventListener('click', () => {
    stopListening(); try { speechSynthesis.cancel(); } catch (e) {}
    if (state.view === 'themes') go('home');
    else if (state.view === 'lesson' || state.view === 'review' || state.view === 'done') go('themes');
    else go('home');
  });

  function render() {
    const isHome = state.view === 'home';
    topbar.hidden = false; // bar stays (holds the theme toggle); Back is hidden on home
    backBtn.style.visibility = isHome ? 'hidden' : 'visible';
    if (state.view === 'home') renderHome();
    else if (state.view === 'themes') renderThemes();
    else if (state.view === 'lesson') renderLesson();
    else if (state.view === 'review') renderReview();
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

    // method card
    wrap.appendChild(el('div', 'section-label', 'The Palteca Method'));
    const m = el('div', 'method');
    m.appendChild(el('h3', null, 'See it → Hear it → Say it'));
    m.appendChild(el('p', null, 'Every word travels through seven quick steps so it sticks in your mouth, not just your notebook. No translation crutch — you link the picture straight to the sound.'));
    const steps = el('div', 'steps');
    PAL.forEach(s => {
      const st = el('div', 'step');
      st.appendChild(el('div', 'k', s.k));
      st.appendChild(el('div', 'w', s.w));
      st.appendChild(el('div', 'd', s.d));
      steps.appendChild(st);
    });
    m.appendChild(steps);
    wrap.appendChild(m);

    // languages
    wrap.appendChild(el('div', 'section-label', 'Choose a language'));
    const grid = el('div', 'lang-grid');
    Object.keys(C.languages).forEach(code => {
      const L = C.languages[code];
      const pct = langCompletion(code);
      const card = el('button', 'lang-card');
      card.appendChild(el('div', 'flag', L.flag || '🌐'));
      const info = el('div');
      info.appendChild(el('div', 'name', L.language));
      info.appendChild(el('div', 'native', (L.native || '') + ' · ' + L.items.length + ' words'));
      const bar = el('div', 'bar'); const fill = el('i'); fill.style.width = pct + '%'; bar.appendChild(fill);
      info.appendChild(bar);
      info.appendChild(el('div', 'pct', pct > 0 ? pct + '% learned' : 'Start learning →'));
      card.appendChild(info);
      card.addEventListener('click', () => go('themes', { code, themeId: null }));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    wrap.appendChild(el('div', 'footer', SR_SUPPORTED
      ? '🎤 Speaking practice is on. Best in Chrome. Your voice never leaves the pronunciation check.'
      : '🔊 Listening & pronunciation coaching enabled. For live speech scoring, open in Chrome.'));

    views.replaceChildren(wrap);
  }

  /* ===================== THEMES ===================== */
  function renderThemes() {
    const L = C.languages[state.code];
    crumb.textContent = L.language;
    const wrap = el('div');

    const head = el('div', 'lang-head');
    head.appendChild(el('div', 'flag', L.flag || '🌐'));
    const ht = el('div');
    ht.appendChild(el('div', 't', L.language));
    ht.appendChild(el('div', 's', langCompletion(state.code) + '% learned · pick a topic to practice speaking'));
    head.appendChild(ht);
    wrap.appendChild(head);

    const grid = el('div', 'theme-grid');
    activeThemes(state.code).forEach(t => {
      const items = themeItems(state.code, t.id);
      const lp = langProg(state.code);
      const done = items.filter(i => lp.learned[i.id]).length;
      const pct = Math.round((done / items.length) * 100);
      const card = el('button', 'theme-card');
      card.appendChild(el('div', 'ic', t.icon));
      card.appendChild(el('div', 'tt', t.title));
      const meta = el('div', 'meta');
      const ring = el('div', 'ring' + (pct >= 100 ? ' done' : ''));
      ring.style.setProperty('--p', pct);
      if (pct >= 100) ring.textContent = '';
      meta.appendChild(ring);
      meta.appendChild(el('div', 'cnt', done + ' / ' + items.length));
      card.appendChild(meta);
      card.addEventListener('click', () => startLesson(state.code, t.id));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    // review
    const lp = langProg(state.code);
    const learnedCount = Object.keys(lp.learned).length;
    const rv = el('button', 'review-cta');
    rv.innerHTML = '🔁 Review everything you\'ve learned' + (learnedCount ? ' (' + learnedCount + ')' : '');
    rv.disabled = learnedCount < 3;
    if (learnedCount < 3) rv.innerHTML = '🔒 Learn a few words to unlock Review';
    rv.addEventListener('click', () => startReview(state.code));
    wrap.appendChild(rv);

    views.replaceChildren(wrap);
  }

  /* ===================== LESSON (PALTECA loop) ===================== */
  const lesson = { code: null, items: [], idx: 0, correct: 0, spoken: 0 };
  function startLesson(code, themeId) {
    lesson.code = code; lesson.themeId = themeId;
    lesson.items = themeItems(code, themeId).slice();
    lesson.idx = 0; lesson.correct = 0; lesson.spoken = 0;
    go('lesson', { code, themeId });
  }

  function renderLesson() {
    const L = C.languages[lesson.code];
    const theme = C.themes.find(t => t.id === lesson.themeId);
    crumb.textContent = L.language + ' · ' + (theme ? theme.title : '');

    if (lesson.idx >= lesson.items.length) return renderDone();

    const item = lesson.items[lesson.idx];
    const stepDone = { P: false, A: false, L: false, T: false, E: false, C: false, A2: false };

    const wrap = el('div');

    // progress
    const pt = el('div', 'progress-top');
    const bar = el('div', 'bar'); const fill = el('i');
    fill.style.width = ((lesson.idx) / lesson.items.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar);
    pt.appendChild(el('div', 'num', (lesson.idx + 1) + ' / ' + lesson.items.length));
    wrap.appendChild(pt);

    // pal tracker
    const track = el('div', 'paltrack');
    const palEls = PAL.map((s, i) => {
      const p = el('div', 'pal', s.k); p.title = s.w; p.dataset.i = i; track.appendChild(p); return p;
    });
    wrap.appendChild(track);
    let curStep = 0;
    function setStep(i) {
      curStep = i;
      palEls.forEach((p, k) => { p.dataset.on = k <= i ? '1' : '0'; p.dataset.cur = k === i ? '1' : '0'; });
    }

    // card
    const card = el('div', 'card');
    card.appendChild(el('div', 'pic', item.emoji || '🗣️'));
    card.appendChild(el('div', 'target', item.target));
    card.appendChild(el('div', 'phon', item.phonetic || ''));
    if (item.note) card.appendChild(el('div', 'note-pin', item.note));

    // speak row
    const row = el('div', 'speak-row');
    const playBtn = el('button', 'btn play', '🔊 Listen');
    const slowBtn = el('button', 'btn ghost', '🐢 Slow');
    const micBtn = el('button', 'btn mic', SR_SUPPORTED ? '🎤 Say it' : '🎤 Say it (self-check)');
    row.appendChild(playBtn); row.appendChild(slowBtn); row.appendChild(micBtn);
    card.appendChild(row);

    // feedback
    const fb = el('div', 'feedback');
    card.appendChild(fb);

    // reveal (Link + Connect)
    const revealBtn = el('button', 'btn ghost', '👁️ Tap to reveal the meaning');
    revealBtn.style.marginTop = '14px';
    card.appendChild(revealBtn);

    const reveal = el('div', 'reveal'); reveal.style.display = 'none';
    const trans = el('div', 'trans', item.translation + (item.article ? ' ' : ''));
    if (item.article) { const a = el('span', 'art', ' · ' + item.article + ' ' + item.target); trans.appendChild(a); }
    reveal.appendChild(trans);
    const ex = el('div', 'example');
    const exT = el('div', 'ex-t');
    exT.appendChild(el('div', 'ex-x', item.example || ''));
    exT.appendChild(el('div', 'ex-e', item.exampleTranslation || ''));
    const exMini = el('button', 'mini', '🔊');
    ex.appendChild(exT); ex.appendChild(exMini);
    if (item.example) reveal.appendChild(ex);
    card.appendChild(reveal);

    wrap.appendChild(card);

    // nav
    const nav = el('div', 'nav-row');
    const skipBtn = el('button', 'btn sec', 'Skip');
    const nextBtn = el('button', 'btn primary', (lesson.idx === lesson.items.length - 1 ? 'Finish ✓' : 'Next →'));
    nav.appendChild(skipBtn); nav.appendChild(nextBtn);
    wrap.appendChild(nav);

    wrap.appendChild(el('div', 'hint', SR_SUPPORTED
      ? 'Hear it, then tap 🎤 and repeat. We\'ll score how close you got.'
      : 'Tap 🔊 and repeat aloud. Reveal the meaning once you\'ve tried.'));

    views.replaceChildren(wrap);

    // ---- behavior ----
    setStep(0); // Picture shown
    // auto play audio shortly after render (Audio step)
    setTimeout(() => { speak(item.target, L.bcp47); if (curStep < 1) setStep(1); }, 320);

    playBtn.addEventListener('click', () => { speak(item.target, L.bcp47); if (curStep < 1) setStep(1); });
    slowBtn.addEventListener('click', () => { speak(item.target, L.bcp47, { rate: 0.55 }); if (curStep < 1) setStep(1); });
    exMini.addEventListener('click', () => { speak(item.example, L.bcp47, { rate: 0.85 }); if (curStep < 5) setStep(5); });

    revealBtn.addEventListener('click', () => {
      reveal.style.display = 'block';
      revealBtn.style.display = 'none';
      if (curStep < 2) setStep(2); // Link
    });

    let recording = false;
    micBtn.addEventListener('click', () => {
      if (!SR_SUPPORTED) {
        // self-check fallback
        if (curStep < 4) setStep(4);
        showFeedback('mid', '👍 Nice try! Tap 🔊 to compare with the native pronunciation.', '');
        lesson.spoken++;
        return;
      }
      if (recording) { stopListening(); return; }
      recording = true;
      micBtn.classList.add('rec'); micBtn.textContent = '● Listening…';
      if (curStep < 3) setStep(3); // Try
      listen(L.bcp47, lesson.code, (res) => {
        recording = false;
        micBtn.classList.remove('rec'); micBtn.textContent = '🎤 Say it';
        if (res.unsupported) { showFeedback('mid', 'Live scoring needs Chrome. Repeat after the audio instead 🔊', ''); return; }
        if (res.error === 'not-allowed' || res.error === 'service-not-allowed') { showFeedback('bad', '🎤 Microphone blocked. Allow mic access to practice speaking.', ''); return; }
        if (res.error || res.ended || !res.transcript) { showFeedback('mid', 'Didn\'t catch that — try again a bit louder 🔊', ''); return; }
        lesson.spoken++;
        // score against best alternative
        const target = normalize(item.target, lesson.code);
        let best = 0, heard = res.transcript;
        (res.alternatives || [res.transcript]).forEach(a => {
          const s = similarity(normalize(a, lesson.code), target);
          if (s > best) { best = s; }
        });
        setStep(4); // Echo
        if (best >= 0.8) {
          lesson.correct++;
          bumpStrength(lesson.code, item.id, 1);
          showFeedback('good', '🎉 ¡Excelente! That sounded great.', 'Heard: “' + heard + '”');
        } else if (best >= 0.5) {
          showFeedback('mid', '👏 Close! Listen once more and echo the rhythm.', 'Heard: “' + heard + '”');
        } else {
          showFeedback('bad', '🔁 Not quite — tap 🐢 Slow, then try again.', 'Heard: “' + heard + '”');
        }
      });
    });

    function showFeedback(kind, msg, heard) {
      fb.className = 'feedback show ' + kind;
      fb.innerHTML = '<div>' + msg + (heard ? '<span class="heard">' + heard + '</span>' : '') + '</div>';
    }

    function advance() {
      stopListening(); try { speechSynthesis.cancel(); } catch (e) {}
      setStep(6); // Apply
      markLearned(lesson.code, item.id);
      lesson.idx++;
      renderLesson();
    }
    nextBtn.addEventListener('click', advance);
    skipBtn.addEventListener('click', () => { stopListening(); try { speechSynthesis.cancel(); } catch (e) {} lesson.idx++; renderLesson(); });
  }

  function renderDone() {
    const L = C.languages[lesson.code];
    const theme = C.themes.find(t => t.id === lesson.themeId);
    crumb.textContent = L.language + ' · done';
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '🥑'));
    wrap.appendChild(el('h2', null, '¡Lesson complete!'));
    wrap.appendChild(el('p', null, 'You worked through ' + lesson.items.length + ' words in ' + (theme ? theme.title : 'this topic') + '. Keep them fresh with a quick review.'));
    const stats = el('div', 'stat-row');
    const s1 = el('div', 'stat'); s1.innerHTML = '<b>' + lesson.items.length + '</b><span>words seen</span>';
    const s2 = el('div', 'stat'); s2.innerHTML = '<b>' + lesson.spoken + '</b><span>times you spoke</span>';
    const s3 = el('div', 'stat'); s3.innerHTML = '<b>' + langCompletion(lesson.code) + '%</b><span>of ' + L.language + '</span>';
    stats.appendChild(s1); stats.appendChild(s2); stats.appendChild(s3);
    wrap.appendChild(stats);
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '420px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 Review these');
    const back = el('button', 'btn primary', 'More topics →');
    again.addEventListener('click', () => startReview(lesson.code, lesson.items.map(i => i.id)));
    back.addEventListener('click', () => go('themes', { code: lesson.code }));
    nav.appendChild(again); nav.appendChild(back);
    wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  /* ===================== REVIEW ===================== */
  const review = { code: null, items: [], idx: 0, correct: 0 };
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function startReview(code, ids) {
    const L = C.languages[code];
    let pool;
    if (ids && ids.length) pool = L.items.filter(i => ids.indexOf(i.id) >= 0);
    else { const lp = langProg(code); pool = L.items.filter(i => lp.learned[i.id]); }
    if (pool.length < 1) { toast('Nothing to review yet'); return; }
    // weight weaker items first
    const lp = langProg(code);
    pool.sort((a, b) => (lp.strength[a.id] || 0) - (lp.strength[b.id] || 0));
    review.items = shuffle(pool).slice(0, Math.min(pool.length, 15));
    review.code = code; review.idx = 0; review.correct = 0;
    go('review', { code });
  }

  function renderReview() {
    const L = C.languages[review.code];
    crumb.textContent = L.language + ' · Review';
    if (review.idx >= review.items.length) return renderReviewDone();
    const item = review.items[review.idx];
    const wrap = el('div');

    const pt = el('div', 'progress-top');
    const bar = el('div', 'bar'); const fill = el('i');
    fill.style.width = (review.idx / review.items.length * 100) + '%'; bar.appendChild(fill);
    pt.appendChild(bar);
    pt.appendChild(el('div', 'num', (review.idx + 1) + ' / ' + review.items.length));
    wrap.appendChild(pt);

    const card = el('div', 'card');
    card.appendChild(el('div', 'pic', item.emoji || '🗣️'));
    card.appendChild(el('div', 'target', '❔'));
    const prompt = el('div', 'phon', 'Can you say this in ' + L.language + '?');
    card.appendChild(prompt);

    const row = el('div', 'speak-row');
    const micBtn = el('button', 'btn mic', SR_SUPPORTED ? '🎤 Say it' : '🎤 I said it');
    const revealBtn = el('button', 'btn play', '👁️ Reveal');
    row.appendChild(micBtn); row.appendChild(revealBtn);
    card.appendChild(row);

    const fb = el('div', 'feedback'); card.appendChild(fb);

    const reveal = el('div', 'reveal'); reveal.style.display = 'none';
    reveal.appendChild(el('div', 'target', item.target));
    reveal.appendChild(el('div', 'phon', item.phonetic || ''));
    reveal.appendChild(el('div', 'trans', item.translation));
    const playBtn = el('button', 'btn play', '🔊 Hear it');
    playBtn.style.marginTop = '12px';
    reveal.appendChild(playBtn);
    card.appendChild(reveal);
    wrap.appendChild(card);

    const nav = el('div', 'nav-row');
    const hardBtn = el('button', 'btn sec', '😕 Again');
    const goodBtn = el('button', 'btn primary', '✅ Got it');
    nav.appendChild(hardBtn); nav.appendChild(goodBtn);
    wrap.appendChild(nav);
    views.replaceChildren(wrap);

    function doReveal() {
      reveal.style.display = 'block'; revealBtn.style.display = 'none';
      card.querySelector('.target').textContent = item.target;
      prompt.style.display = 'none';
      speak(item.target, L.bcp47);
    }
    revealBtn.addEventListener('click', doReveal);
    playBtn.addEventListener('click', () => speak(item.target, L.bcp47));

    let recording = false;
    micBtn.addEventListener('click', () => {
      if (!SR_SUPPORTED) { doReveal(); return; }
      if (recording) { stopListening(); return; }
      recording = true; micBtn.classList.add('rec'); micBtn.textContent = '● Listening…';
      listen(L.bcp47, review.code, (res) => {
        recording = false; micBtn.classList.remove('rec'); micBtn.textContent = '🎤 Say it';
        if (res.unsupported || res.error || res.ended || !res.transcript) { doReveal(); return; }
        const s = Math.max.apply(null, (res.alternatives || [res.transcript]).map(a => similarity(normalize(a, review.code), normalize(item.target, review.code))));
        card.querySelector('.target').textContent = item.target;
        prompt.style.display = 'none'; reveal.style.display = 'block'; revealBtn.style.display = 'none';
        if (s >= 0.8) { fb.className = 'feedback show good'; fb.innerHTML = '🎉 Perfect — “' + res.transcript + '”'; }
        else { fb.className = 'feedback show mid'; fb.innerHTML = '👂 Heard: “' + res.transcript + '”. Compare below.'; speak(item.target, L.bcp47); }
      });
    });

    hardBtn.addEventListener('click', () => { bumpStrength(review.code, item.id, -1); review.idx++; renderReview(); });
    goodBtn.addEventListener('click', () => { bumpStrength(review.code, item.id, 1); review.correct++; review.idx++; renderReview(); });
  }

  function renderReviewDone() {
    const L = C.languages[review.code];
    const wrap = el('div', 'done');
    wrap.appendChild(el('div', 'big', '🌟'));
    wrap.appendChild(el('h2', null, 'Review done!'));
    wrap.appendChild(el('p', null, 'You recalled ' + review.correct + ' of ' + review.items.length + ' — great practice. Little and often is how speaking sticks.'));
    const nav = el('div', 'nav-row'); nav.style.maxWidth = '420px'; nav.style.margin = '10px auto 0';
    const again = el('button', 'btn sec', '🔁 Again');
    const back = el('button', 'btn primary', 'Back to topics →');
    again.addEventListener('click', () => startReview(review.code));
    back.addEventListener('click', () => go('themes', { code: review.code }));
    nav.appendChild(again); nav.appendChild(back);
    wrap.appendChild(nav);
    views.replaceChildren(wrap);
  }

  /* ---------- boot ---------- */
  initTheme();
  go('home');
})();
