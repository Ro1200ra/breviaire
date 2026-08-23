/* Bréviaire — psalmodie par la voix humaine de synthèse (a cappella, sans aucun instrument) :
   chaque ligne du psaume est réellement prononcée par la voix du téléphone, lentement et posément,
   avec une légère montée à la médiante (*) et une descente à la finale, comme une psalmodie récitée. */
window.Chant = (() => {
'use strict';

// ---------------------------------------------------------------- du HTML AELF vers des versets
const ACC = '\u0001';   // marque d'accent (voyelle soulignée dans le psautier AELF)
const VERSE = '\u0002'; // marque de début de verset (numéro de verset)

function htmlToLines(html) {
  let h = html.replace(/\r/g, '').replace(/\s*\n\s*/g, ' ');
  h = h.replace(/<span[^>]*class\s*=\s*["']?verse_number["']?[^>]*>(.*?)<\/span>/gi, VERSE);
  h = h.replace(/<u>\s*([^<]*?)\s*<\/u>/gi, (m, v) => ACC + v);
  h = h.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '');
  h = h.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  h = h.replace(/\[[^\]]*]/g, ''); // annotations de versets : [10-12]
  return h.split('\n').map(l => { const t = l.replace(/[ \t ]+/g, ' ').trim(); return /\p{L}/u.test(t) ? t : ''; });
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

// ---------------------------------------------------------------- psalmodie (voix seule)
let playing = false, token = 0;

function stop() {
  playing = false;
  token++;
  try { speechSynthesis.cancel(); } catch {}
}

/**
 * Psalmodie une liste de versets (de parseVerses) avec la voix de synthèse.
 * opts: { voice, rate (vitesse de lecture de l'utilisateur), pitch (hauteur de l'utilisateur),
 *         onVerse(vi), onEnd() }
 */
function sing(verses, opts = {}) {
  stop();
  if (!('speechSynthesis' in window)) { opts.onEnd && opts.onEnd(); return; }
  playing = true;
  const my = token;
  const voice = opts.voice || null;
  // Allure lente et posée, indexée sur la vitesse de lecture choisie par l'utilisateur.
  const rate = Math.max(0.4, Math.min(1.1, (+opts.rate || 1) * 0.72));
  const basePitch = Math.max(0.5, Math.min(2, +opts.pitch || 1));
  const items = []; // {text, pitch, vi} ou {pause}
  verses.forEach((v, vi) => {
    v.lines.forEach(l => {
      const text = l.text.replace(/[\u0001\u0002]/g, '').trim();
      if (!text) return;
      // Contour de psalmodie : médiante légèrement plus haute, finale plus grave.
      const factor = l.role === 'med' ? 1.059 : l.role === 'term' ? 0.944 : 1;
      items.push({ text, pitch: Math.max(0.5, Math.min(2, basePitch * factor)), vi });
      items.push({ pause: 200 });
    });
    if (vi < verses.length - 1) items.push({ pause: 550 });
  });
  if (!items.some(it => it.text)) { playing = false; opts.onEnd && opts.onEnd(); return; }
  let i = 0, lastVerse = -1;
  const next = () => {
    if (my !== token) return; // arrêté ou remplacé entre-temps
    if (i >= items.length) { playing = false; opts.onEnd && opts.onEnd(); return; }
    const it = items[i++];
    if (it.pause) { setTimeout(next, it.pause); return; }
    if (it.vi !== lastVerse) { lastVerse = it.vi; opts.onVerse && opts.onVerse(it.vi); }
    const u = new SpeechSynthesisUtterance(it.text);
    if (voice) u.voice = voice;
    u.lang = (voice && voice.lang) || 'fr-FR';
    u.rate = rate;
    u.pitch = it.pitch;
    u.onend = () => next();
    u.onerror = () => next();
    speechSynthesis.speak(u);
  };
  next();
}

function isPlaying() { return playing; }

return { parseVerses, sing, stop, isPlaying };
})();
