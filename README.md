<div align="center">

# 🥑 Palteca

**Learn to _speak_ a language the visual way — see it, hear it, and say it out loud.**

A visual, speak-along language-learning app for **Spanish 🇪🇸, French 🇫🇷, and Mandarin 🇨🇳**.
No build step, no accounts, no external APIs — just `node server.js`.

</div>

---

## The PALTECA method

Every word travels through seven quick steps so it sticks in your mouth, not just your notebook. You link the **picture** straight to the **sound**, with no translation crutch.

| | Step | What happens |
|---|------|--------------|
| **P** | Picture | A big visual anchors the meaning |
| **A** | Audio | Hear a native pronunciation |
| **L** | Link | Connect the sound to the meaning |
| **T** | Try | Say it aloud |
| **E** | Echo | Repeat and refine |
| **C** | Connect | Use it in a full sentence |
| **A** | Apply | Lock it in with review |

## Features

- 🖼️ **Visual-first lessons** — an emoji anchor for every word and phrase, run through the 7-step PALTECA loop.
- 🔊 **Native pronunciation** — text-to-speech in `es-ES` / `fr-FR` / `zh-CN`, with a 🐢 slow mode for tricky sounds.
- 🎤 **Speak & get scored** — your microphone is transcribed and compared to the target so you get instant feedback on your pronunciation _(live scoring works best in Chrome; a self-check fallback is used elsewhere — your voice never leaves the check)_.
- 💬 **Conversation mode** — role-play real, native-verified exchanges (café, hotel check-in, meeting someone, asking directions) where **you speak your lines** and the app plays the other side.
- 🎯 **Challenge mode** — a 10-question mixed quiz: listen-and-pick, meaning match, and speak-it-aloud, scored with instant feedback.
- 🔁 **Review mode** — lightweight spaced repetition that surfaces your weakest words first.
- 🔥 **Streaks, XP & levels** — daily goals, a level/rank system, and a day-streak to keep you coming back.
- 🏅 **Achievements** — 17 unlockable badges for streaks, vocabulary, pronunciation, and conversations.
- 📊 **Progress dashboard** — level ring, a 5-week practice heatmap, per-language mastery, and lifetime totals.
- 📲 **Installable PWA** — add it to your home screen and use it fully **offline**.
- 🌗 **Light & dark themes.**

## Content

**58 words & phrases per language** across 7 themes — Greetings, Numbers, Food & Drink, Family & People, Colors, Travel & Directions, and Everyday Phrases. Each item includes native text, an English-friendly pronunciation guide (Hanyu Pinyin with tone marks for Mandarin), an emoji visual, and a natural example sentence. The dataset was generated and then reviewed by a native-speaker verification pass for accents, articles, and tone accuracy.

## Run it

Requires [Node.js](https://nodejs.org) (no dependencies to install).

```bash
node server.js
```

Then open **http://localhost:5182**.

Set a custom port with `PORT=8080 node server.js`.

## Project structure

```
palteca/
├── server.js               # zero-dependency static server
└── public/
    ├── index.html
    ├── styles.css
    ├── store.js            # gamification: XP, levels, streaks, achievements
    ├── app.js              # SPA: routing, speech synth + recognition, all modes
    ├── content.js          # lesson data (58 items × 3 languages)
    ├── dialogues.js        # conversation scripts (4 role-plays × 3 languages)
    ├── manifest.webmanifest
    ├── sw.js               # service worker (offline app shell)
    └── icon.svg
```

## Tech

Vanilla JavaScript single-page app. Speech is powered entirely by the browser's built-in [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — `speechSynthesis` for pronunciation and `SpeechRecognition` for the speaking check. No frameworks, no bundler, no keys.

---

<div align="center">
<sub>Built with the Palteca method · <em>palta</em> = avocado 🥑</sub>
</div>
