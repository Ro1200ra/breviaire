/* Bréviaire — psalmodie grégorienne : syllabation du texte, formules des tons, mélodie jouée au synthétiseur. */
window.Chant = (() => {
'use strict';

// ---------------------------------------------------------------- les tons (hauteurs en demi-tons depuis do4 ; formules simplifiées d'après les toni communes)
// cad = { pre: notes des syllabes qui précèdent l'accent, acc: note de la syllabe accentuée, post: notes des syllabes après l'accent }
const C = 0, D = 2, E = 4, F = 5, G = 7, A = 9, Bb = 10, B = 11, C5 = 12, D5 = 14, E5 = 16;
const TONES = [
  { id: '1', name: 'Ton I', mode: 'mode de ré (protus authente)', int: [F, G, A], ten: A, flex: G, med: { pre: [B], acc: A, post: [G, A] }, ten2: A, term: { pre: [G, A], acc: G, post: [F, D] } },
  { id: '2', name: 'Ton II', mode: 'mode de ré (protus plagal)', int: [C, D, F], ten: F, flex: D, med: { pre: [G], acc: F, post: [E, F] }, ten2: F, term: { pre: [F], acc: E, post: [D] } },
  { id: '3', name: 'Ton III', mode: 'mode de mi (deuterus authente)', int: [G, B, C5], ten: C5, flex: A, med: { pre: [D5], acc: C5, post: [B, C5] }, ten2: C5, term: { pre: [C5, B], acc: A, post: [G, A] } },
  { id: '4', name: 'Ton IV', mode: 'mode de mi (deuterus plagal)', int: [A, G, A], ten: A, flex: G, med: { pre: [G], acc: A, post: [B, A] }, ten2: A, term: { pre: [A, G], acc: A, post: [G, E] } },
  { id: '5', name: 'Ton V', mode: 'mode de fa (tritus authente)', int: [F, A, C5], ten: C5, flex: A, med: { pre: [C5], acc: D5, post: [C5] }, ten2: C5, term: { pre: [C5, D5], acc: C5, post: [B, A] } },
  { id: '6', name: 'Ton VI', mode: 'mode de fa (tritus plagal)', int: [F, G, A], ten: A, flex: G, med: { pre: [G], acc: A, post: [Bb, A] }, ten2: A, term: { pre: [A, G], acc: A, post: [G, F] } },
  { id: '7', name: 'Ton VII', mode: 'mode de sol (tetrardus authente)', int: [C5, D5, E5], ten: D5, flex: C5, med: { pre: [E5], acc: D5, post: [C5, D5] }, ten2: D5, term: { pre: [D5, C5], acc: B, post: [A] } },
  { id: '8', name: 'Ton VIII', mode: 'mode de sol (tetrardus plagal)', int: [G, A, C5], ten: C5, flex: A, med: { pre: [C5], acc: D5, post: [C5] }, ten2: C5, term: { pre: [C5, B], acc: A, post: [G] } },
  { id: 'p', name: 'Ton pérégrin', mode: 'tonus peregrinus (teneur mobile la → sol)', int: [G, A], ten: A, flex: G, med: { pre: [A], acc: Bb, post: [A, G] }, ten2: G, term: { pre: [G], acc: F, post: [E, D] } },
];
const NOTE_NAMES = ['do', 'do♯', 'ré', 'mi♭', 'mi', 'fa', 'fa♯', 'sol', 'la♭', 'la', 'si♭', 'si'];
const noteName = n => NOTE_NAMES[((n % 12) + 12) % 12];
const toneById = id => TONES.find(t => t.id === id) || TONES[0];
function formula(t) {
  const seq = arr => arr.map(noteName).join(' ');
  return `intonation : ${seq(t.int)} · teneur : ${noteName(t.ten)} · médiante : ${seq([...t.med.pre, t.med.acc, ...t.med.post])}` +
    (t.ten2 !== t.ten ? ` · 2ᵉ teneur : ${noteName(t.ten2)}` : '') + ` · finale : ${seq([...t.term.pre, t.term.acc, ...t.term.post])}`;
}

// ---------------------------------------------------------------- syllabation (approximative, adaptée au chant : e muets prononcés)
const ACC = '\u0001';   // marque d'accent (voyelle soulignée dans le psautier AELF)
const VERSE = '\u0002'; // marque de début de verset (numéro de verset)
const VOWELS = 'aáàâäãeéèêëiíìîïoóòôöõuúùûüyÿœæ';
const isV = ch => !!ch && VOWELS.includes(ch.toLowerCase());
const letters = s => s.toLowerCase().replace(/[^a-zàâäãáéèêëíìîïóòôöõúùûüÿœæ'’]/g, '');

/** Syllabes d'un mot (sans marque) : [{text, start, end}] — le texte garde la ponctuation attachée. */
function syllabifyWord(word) {
  const chars = [...word];
  const groups = [];
  let i = 0;
  while (i < chars.length) {
    if (isV(chars[i])) { let j = i; while (j < chars.length && isV(chars[j])) j++; groups.push([i, j]); i = j; } else i++;
  }
  if (!groups.length) return [{ text: word, start: 0, end: chars.length }];
  const syls = [];
  let start = 0;
  for (let k = 0; k < groups.length; k++) {
    const ge = groups[k][1];
    let end;
    if (k === groups.length - 1) end = chars.length;
    else {
      const nextStart = groups[k + 1][0];
      const cons = nextStart - ge;
      const lastTwo = chars.slice(nextStart - 2, nextStart).join('').toLowerCase();
      const inseparable = cons >= 2 && /^(ch|ph|th|gn|[bcdfgkptv][lr])$/.test(lastTwo); // pa-trie, ou-vre, ri-che, sanc-tuai-re, en-trer
      end = cons <= 1 ? ge : inseparable ? nextStart - 2 : nextStart - 1;
    }
    syls.push({ text: chars.slice(start, end).join(''), start, end });
    start = end;
  }
  return syls;
}

/** Découpe une ligne (avec marques ACC) en syllabes ; renvoie { syls:[{text, acc, wordStart}], accent:index }. */
function syllabifyLine(line) {
  const words = line.replace(/[«»"“”(){}\[\]*+]/g, ' ').replace(/[—–]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const syls = [];
  words.forEach((w, wi) => {
    const word = w.replace(/^[.,;:!?…'’]+/, '');
    if (!letters(word)) return;
    // qu'il, l'âme, d'un : la partie sans voyelle est collée à la suivante
    const parts = word.split(/(?<=['’])/);
    const merged = [];
    for (const p of parts) { if (merged.length && !/[aeiouyéèêàâîïôûœæ]/i.test(merged[merged.length - 1].replace(ACC, ''))) merged[merged.length - 1] += p; else merged.push(p); }
    merged.forEach((part, pi) => {
      const accPos = part.indexOf(ACC);
      const plain = part.replace(ACC, '');
      const ws = syllabifyWord(plain).map(s => ({ text: s.text, acc: accPos >= 0 && accPos >= s.start && accPos < s.end }));
      // élision : e muet final devant voyelle (notre âme -> no-tr'âme)
      const next = words[wi + 1];
      if (pi === merged.length - 1 && ws.length > 1 && next && /^[aeiouyéèêàâîïôûœæh]/i.test(letters(next)) && /e[.,;:!?…]*$/i.test(ws[ws.length - 1].text) && !/[éè]/i.test(letters(ws[ws.length - 1].text).slice(-1))) {
        const last = ws.pop(); ws[ws.length - 1].text += last.text; ws[ws.length - 1].acc = ws[ws.length - 1].acc || last.acc;
      }
      ws.forEach((s, k) => syls.push({ text: s.text, acc: s.acc, wordStart: k === 0 }));
    });
  });
  let accent = syls.findIndex(s => s.acc);
  if (accent < 0 && syls.length) {
    accent = syls.length - 1;
    // accent sur l'avant-dernière si la ligne finit par un e muet (Pè-re, hym-nes, ai-ment)
    const last = letters(syls[syls.length - 1].text);
    if (syls.length > 1 && /(e|es|ent)$/.test(last) && !syls[syls.length - 1].wordStart) accent = syls.length - 2;
  }
  return { syls, accent };
}

// ---------------------------------------------------------------- du HTML AELF vers des versets
function htmlToLines(html) {
  let h = html.replace(/\r/g, '').replace(/\s*\n\s*/g, ' ');
  h = h.replace(/<span[^>]*class\s*=\s*["']?verse_number["']?[^>]*>(.*?)<\/span>/gi, VERSE);
  h = h.replace(/<u>\s*([^<]*?)\s*<\/u>/gi, (m, v) => ACC + v);
  h = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '');
  h = h.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return h.split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim());
}

/**
 * Versets : [{ lines: [{text, role:'flex'|'med'|'term'}] }] ; les lignes « Antienne : » sont ignorées.
 * Dans le psautier AELF : « + » = flexe, « * » = médiante, voyelle soulignée = accent de cadence ;
 * une ligne sans accent est le début de l'hémistiche suivant (retour à la ligne de mise en page).
 */
function parseVerses(html) {
  const rawLines = htmlToLines(html);
  const hasAccents = rawLines.some(l => l.includes(ACC));
  // 1. strophes (séparées par des lignes vides), lignes de mise en page fusionnées
  const stanzas = [];
  let st = [], pending = '', pendingNum = false;
  const flush = () => { if (pending) { st.push({ text: pending.trim(), num: pendingNum }); pending = ''; pendingNum = false; } if (st.length) stanzas.push(st); st = []; };
  for (const raw0 of rawLines) {
    if (!raw0) { flush(); continue; }
    if (/^Antienne\s*:/i.test(raw0.replace(/[\u0001\u0002]/g, ''))) { flush(); continue; }
    const num = raw0.includes(VERSE);
    const raw = raw0.replace(/\u0002/g, '').trim();
    if (!raw) continue;
    if (hasAccents && !raw.includes(ACC) && !/[*+]\s*$/.test(raw)) { pending += (pending ? ' ' : '') + raw; if (num) pendingNum = true; continue; }
    st.push({ text: (pending ? pending + ' ' : '') + raw, num: num || pendingNum });
    pending = ''; pendingNum = false;
  }
  flush();
  // 2. versets
  const out = [];
  for (const lines of stanzas) {
    const verses = [];
    let cur = [];
    const close = () => { if (cur.length) verses.push(cur); cur = []; };
    for (const l of lines) {
      const flex = /\+\s*$/.test(l.text), med = /\*\s*$/.test(l.text);
      if (l.num && cur.length && !cur[cur.length - 1].flex && !cur[cur.length - 1].med) close();
      cur.push({ text: l.text, flex, med, plain: !flex && !med });
      if (!flex && !med) {
        const plainCount = cur.filter(x => x.plain).length;
        if (cur.some(x => x.med) || plainCount >= 2) close();
      }
    }
    if (cur.length === 1 && cur[0].plain && verses.length && verses[verses.length - 1].every(x => x.plain) && verses[verses.length - 1].length === 2) {
      verses[verses.length - 1].push(cur[0]); cur = [];
    }
    close();
    for (const v of verses) {
      const n = v.length;
      v.forEach((x, i) => {
        x.role = x.flex ? 'flex' : x.med ? 'med' : (i === n - 1 ? 'term' : (n === 3 && i === 0 && !v.some(y => y.flex || y.med) ? 'flex' : 'med'));
        x.text = x.text.replace(/\s*[*+]\s*$/, '');
      });
      out.push({ lines: v.map(x => ({ text: x.text, role: x.role })) });
    }
  }
  return out;
}

// ---------------------------------------------------------------- mélodie d'une ligne
/** Renvoie [{text, notes:[...], kind:'int'|'ten'|'cad'|'acc', acc, wordStart}] */
function melodize(lineText, role, tone, withIntonation) {
  const { syls, accent } = syllabifyLine(lineText);
  const n = syls.length;
  if (!n) return [];
  const ten = role === 'term' ? tone.ten2 : tone.ten;
  const res = syls.map(s => ({ text: s.text, notes: [ten], kind: 'ten', acc: false, wordStart: s.wordStart }));
  if (role === 'flex') {
    for (let i = accent; i < n; i++) { res[i].notes = [tone.flex]; res[i].kind = i === accent ? 'acc' : 'cad'; }
    res[accent].acc = true;
  } else {
    const cad = role === 'med' ? tone.med : tone.term;
    const p = Math.min(cad.pre.length, accent);
    for (let k = 0; k < p; k++) { const i = accent - p + k; res[i].notes = [cad.pre[cad.pre.length - p + k]]; res[i].kind = 'cad'; }
    res[accent].notes = [cad.acc]; res[accent].kind = 'acc'; res[accent].acc = true;
    const after = n - accent - 1;
    for (let k = 0; k < after; k++) { res[accent + 1 + k].notes = [cad.post[Math.min(k, cad.post.length - 1)] ?? cad.acc]; res[accent + 1 + k].kind = 'cad'; }
    if (after < cad.post.length) res[n - 1].notes = res[n - 1].notes.concat(cad.post.slice(after)); // mélisme sur la dernière syllabe
  }
  if (withIntonation && role !== 'term') {
    const firstCad = res.findIndex(r => r.kind !== 'ten');
    const free = firstCad < 0 ? n : firstCad;
    const k = Math.min(tone.int.length, Math.max(0, free - 1));
    for (let i = 0; i < k; i++) { res[i].notes = [tone.int[i]]; res[i].kind = 'int'; }
    if (k > 0 && k < tone.int.length) res[k - 1].notes = tone.int.slice(k - 1);
  }
  return res;
}

// ---------------------------------------------------------------- synthétiseur
let ctx = null, master = null, droneNodes = null, scheduled = [], timers = [], playing = false, onEvent = () => {};
function audio() {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const freq = semi => 261.63 * Math.pow(2, semi / 12);

function voice(semi, t0, dur, vol = 0.8) {
  const c = audio();
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.04);
  g.gain.setValueAtTime(vol, Math.max(t0 + 0.04, t0 + dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.02);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  g.connect(lp).connect(master);
  const parts = [[1, 'sine', 1], [2, 'triangle', 0.25], [3, 'sine', 0.12], [1.003, 'sine', 0.5]];
  parts.forEach(([mult, type, amp]) => {
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq(semi) * mult;
    const og = c.createGain(); og.gain.value = amp; o.connect(og).connect(g);
    o.start(t0); o.stop(t0 + dur + 0.05); scheduled.push(o);
  });
}

function startDrone(semi) {
  stopDrone();
  const c = audio();
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.8);
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
  g.connect(lp).connect(master);
  const oscs = [[0.5, 'sine'], [1, 'triangle'], [0.5015, 'sine']].map(([m, type]) => { const o = c.createOscillator(); o.type = type; o.frequency.value = freq(semi) * m; o.connect(g); o.start(); return o; });
  droneNodes = { g, oscs };
}
function stopDrone() {
  if (!droneNodes) return;
  const { g, oscs } = droneNodes; droneNodes = null;
  try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5); } catch {}
  setTimeout(() => oscs.forEach(o => { try { o.stop(); } catch {} }), 600);
}

function stop() {
  const was = playing;
  playing = false;
  timers.forEach(clearTimeout); timers = [];
  scheduled.forEach(o => { try { o.stop(); } catch {} }); scheduled = [];
  stopDrone();
  if (was) onEvent({ type: 'stop' });
}

/** Joue la formule du ton (intonation, teneur, médiante, teneur, finale). */
function playTone(toneId, opts = {}) {
  stop(); playing = true;
  const t = toneById(toneId), tr = opts.transpose || 0, base = 60 / Math.max(60, Math.min(300, opts.tempo || 160));
  const seq = [...t.int, t.ten, t.ten, t.ten, ...t.med.pre, t.med.acc, ...t.med.post, null, t.ten2, t.ten2, t.ten2, ...t.term.pre, t.term.acc, ...t.term.post];
  const c = audio();
  let at = c.currentTime + 0.1;
  seq.forEach((n, i) => {
    if (n == null) { at += base; return; }
    const last = i === seq.length - 1 || seq[i + 1] == null;
    voice(n + tr, at, last ? base * 2 : base); at += last ? base * 2.2 : base;
  });
  timers.push(setTimeout(() => { playing = false; onEvent({ type: 'stop' }); }, (at - c.currentTime + 0.3) * 1000));
}

/**
 * Chante une liste de versets (de parseVerses) sur un ton.
 * opts: { transpose, tempo (syllabes/min), intonationEachVerse, drone, onSyllable(vi, li, si), onVerse(vi), onEnd() }
 */
function sing(verses, toneId, opts = {}) {
  stop(); playing = true;
  const t = toneById(toneId), tr = opts.transpose || 0;
  const base = 60 / Math.max(60, Math.min(300, opts.tempo || 160));
  const c = audio();
  if (opts.drone) startDrone(t.ten + tr - 12);
  let at = c.currentTime + 0.25;
  const startAt = at;
  const plan = verses.map((v, vi) => v.lines.map(l => ({ role: l.role, syls: melodize(l.text, l.role, t, vi === 0 || !!opts.intonationEachVerse) })));
  plan.forEach((lines, vi) => {
    timers.push(setTimeout(() => opts.onVerse && opts.onVerse(vi), Math.max(0, (at - c.currentTime) * 1000)));
    lines.forEach((line, li) => {
      line.syls.forEach((s, si) => {
        const isLast = si === line.syls.length - 1;
        const stretch = s.kind === 'ten' || s.kind === 'int' ? 1 : 1.3;
        const t0 = at;
        s.notes.forEach((n, k) => {
          const d = base * stretch * (isLast && k === s.notes.length - 1 ? 1.8 : 1) * (s.notes.length > 1 ? 0.8 : 1);
          voice(n + tr, at, d); at += d;
        });
        timers.push(setTimeout(() => opts.onSyllable && opts.onSyllable(vi, li, si), Math.max(0, (t0 - c.currentTime) * 1000)));
      });
      at += line.role === 'term' ? base * 1.6 : base * 0.9; // respiration
    });
  });
  timers.push(setTimeout(() => { playing = false; stopDrone(); opts.onEnd && opts.onEnd(); onEvent({ type: 'stop' }); }, (at - c.currentTime + 0.2) * 1000));
  return { plan, duration: at - startAt };
}

function isPlaying() { return playing; }
function setListener(fn) { onEvent = fn || (() => {}); }
function pointLine(lineText, role, tone, withIntonation) { return melodize(lineText, role, tone, withIntonation); }

return { TONES, toneById, formula, noteName, parseVerses, pointLine, playTone, sing, stop, isPlaying, setListener };
})();
