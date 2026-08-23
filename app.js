/* Bréviaire — version web. Textes : AELF (api.aelf.org). Voix : synthèse vocale du navigateur. */
(() => {
'use strict';

// ------------------------------------------------------------------ données
const OFFICES = [
  { api: 'lectures', label: 'Office des lectures', hint: 'Vigiles — la nuit ou tôt le matin', hour: 6 },
  { api: 'laudes', label: 'Laudes', hint: 'Prière du matin', hour: 7 },
  { api: 'tierce', label: 'Tierce', hint: 'Milieu de la matinée (vers 9 h)', hour: 9 },
  { api: 'sexte', label: 'Sexte', hint: 'Milieu du jour (vers 12 h)', hour: 12 },
  { api: 'none', label: 'None', hint: "Milieu de l'après-midi (vers 15 h)", hour: 15 },
  { api: 'vepres', label: 'Vêpres', hint: 'Prière du soir', hour: 18 },
  { api: 'complies', label: 'Complies', hint: 'Avant le coucher', hour: 21 },
  { api: 'messes', label: 'Messe du jour', hint: 'Lectures de la messe', hour: 10 },
];
const ZONES = [
  ['france', 'France (Martinique, Antilles, métropole)'], ['romain', 'Calendrier romain général'], ['afrique', 'Afrique'],
  ['belgique', 'Belgique'], ['canada', 'Canada'], ['luxembourg', 'Luxembourg'], ['suisse', 'Suisse'],
];
const officeByApi = api => OFFICES.find(o => o.api === api);
const officeForHour = h => h < 5 ? 'complies' : h < 9 ? 'laudes' : h < 11 ? 'tierce' : h < 14 ? 'sexte' : h < 17 ? 'none' : h < 21 ? 'vepres' : 'complies';

const GLORIA = '<p>Gloire au Père, et au Fils, et au Saint-Esprit,<br/>au Dieu qui est, qui était et qui vient,<br/>pour les siècles des siècles. Amen.</p>';
const NOTRE_PERE = "<p>Notre Père, qui es aux cieux,<br/>que ton nom soit sanctifié,<br/>que ton règne vienne,<br/>que ta volonté soit faite sur la terre comme au ciel.<br/>Donne-nous aujourd'hui notre pain de ce jour.<br/>Pardonne-nous nos offenses,<br/>comme nous pardonnons aussi à ceux qui nous ont offensés.<br/>Et ne nous laisse pas entrer en tentation,<br/>mais délivre-nous du Mal.<br/>Amen.</p>";
const BENEDICTION = "<p>Que le Seigneur nous bénisse, qu'il nous garde de tout mal, et nous conduise à la vie éternelle.<br/>Amen.</p>";
const CONCLUSION = '<p>Bénissons le Seigneur.<br/>— Nous rendons grâce à Dieu.</p>';
const CONFITEOR = "<p>Je confesse à Dieu tout-puissant, je reconnais devant vous, frères et sœurs, que j'ai péché en pensée, en parole, par action et par omission. Oui, j'ai vraiment péché.</p><p>C'est pourquoi je supplie la bienheureuse Vierge Marie, les anges et tous les saints, et vous aussi, frères et sœurs, de prier pour moi le Seigneur notre Dieu.</p><p>Que Dieu tout-puissant nous fasse miséricorde ; qu'il nous pardonne nos péchés et nous conduise à la vie éternelle. Amen.</p>";

// ------------------------------------------------------------------ réglages
const DEFAULTS = {
  zone: 'france', theme: 'system', fontSize: 'normal', showVerses: true, gloria: true, repeatAntienne: true,
  readTitles: true, sayMarks: false, voice: '', rate: 1, pitch: 1, pauseMs: 900, prefetchDays: 7, keepAwake: true,
};
const prefs = new Proxy({}, {
  get(_, k) { try { const v = localStorage.getItem('brev_' + k); return v === null ? DEFAULTS[k] : JSON.parse(v); } catch { return DEFAULTS[k]; } },
  set(_, k, v) { try { localStorage.setItem('brev_' + k, JSON.stringify(v)); } catch {} return true; },
});
const FONT_PX = { small: 15, normal: 17, large: 20, xlarge: 24 };

function applyTheme() {
  const t = prefs.theme;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--fs', FONT_PX[prefs.fontSize] + 'px');
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ------------------------------------------------------------------ nettoyage du texte
const Text = (() => {
  const verseTag = /<span[^>]*class\s*=\s*["']?verse_number["']?[^>]*>(.*?)<\/span>/gi;
  const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", laquo: '«', raquo: '»', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', oelig: 'œ', OElig: 'Œ', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â', ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', ccedil: 'ç', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', deg: '°', middot: '·' };
  const decode = s => s.replace(/&#(x[0-9a-fA-F]+|\d+);/g, (m, v) => { const c = v[0] === 'x' || v[0] === 'X' ? parseInt(v.slice(1), 16) : parseInt(v, 10); return c > 0 ? String.fromCodePoint(c) : m; })
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m);

  function displayHtml(html, showVerses) {
    let h = html;
    h = showVerses ? h.replace(verseTag, (m, n) => `<sup>${n.trim()}</sup>&nbsp;`) : h.replace(verseTag, '');
    h = h.replace(/(?<![\p{L}\d])([RV])\//gu, '<b>$1/</b>');
    // sécurité minimale : on ne garde que des balises de mise en forme
    h = h.replace(/<(?!\/?(p|br|b|i|u|em|strong|sup|sub|small|span|div|ul|ol|li|h\d|blockquote)\b)[^>]*>/gi, '');
    h = h.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return h.replace(/\r/g, '').replace(/\n/g, ' ');
  }

  function htmlToPlain(html) {
    let h = html.replace(/\r/g, '').replace(/\s*\n\s*/g, ' ');
    h = h.replace(verseTag, '');
    h = h.replace(/<br\s*\/?>/gi, '\n');
    h = h.replace(/<\/(p|div|li|h\d|blockquote|tr)>/gi, '\n\n');
    h = h.replace(/<[^>]+>/g, '');
    h = decode(h).replace(/ /g, ' ');
    h = h.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n');
    return h.trim();
  }

  function toSpeechChunks(html, sayMarks, maxLen = 1500) {
    let t = htmlToPlain(html);
    t = t.replace(/℟/g, 'R/').replace(/℣/g, 'V/');
    t = t.replace(/(?<![\p{L}\d])([RV])\//gu, (m, k) => !sayMarks ? '' : k === 'R' ? 'Répons. ' : 'Verset. ');
    t = t.replace(/\s*[*+]\s*(?=\n|$)/g, '').replace(/\s\*\s/g, ' ');
    t = t.replace(/^[—–-]\s*/gm, '');
    t = t.replace(/\(\s*\)/g, '').replace(/\[[^\]]*\]/g, '');
    t = t.replace(/[ \t ]+/g, ' ');
    t = t.split('\n').map(l => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n');
    const out = [];
    for (const stanza of t.split('\n\n')) {
      const lines = stanza.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) continue;
      let s = lines.join(' ').replace(/\s+/g, ' ').trim().replace(/[,\s+*]+$/, '');
      if (!s) continue;
      if (!/[.!?…;:»)"]$/.test(s)) s += '.';
      if (s.length <= maxLen) out.push(s);
      else {
        let buf = '';
        for (const sent of s.split(/(?<=[.!?…;:])\s+/)) {
          if (buf.length + sent.length + 1 > maxLen && buf) { out.push(buf.trim()); buf = ''; }
          buf += sent + ' ';
        }
        if (buf.trim()) out.push(buf.trim());
      }
    }
    return out;
  }

  function humanizeCaps(s) {
    const words = s.split(' ').map(w => {
      const letters = w.replace(/[^\p{L}]/gu, '');
      return letters.length >= 3 && letters === letters.toUpperCase() && !/^[IVXLC]+$/.test(letters) ? w.toLowerCase() : w;
    });
    const out = words.join(' ').replace(/\s{2,}/g, ' ').trim();
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  const BOOKS = { Gn: 'Genèse', Ex: 'Exode', Lv: 'Lévitique', Nb: 'Nombres', Dt: 'Deutéronome', Jos: 'Josué', Jg: 'Juges', Rt: 'Ruth', '1 S': 'premier livre de Samuel', '2 S': 'deuxième livre de Samuel', '1 R': 'premier livre des Rois', '2 R': 'deuxième livre des Rois', '1 Ch': 'premier livre des Chroniques', '2 Ch': 'deuxième livre des Chroniques', Esd: 'Esdras', Ne: 'Néhémie', Tb: 'Tobie', Jdt: 'Judith', Est: 'Esther', '1 M': "premier livre des Martyrs d'Israël", '2 M': "deuxième livre des Martyrs d'Israël", Jb: 'Job', Ps: 'Psaume', Pr: 'Proverbes', Qo: 'Qohèleth', Ct: 'Cantique des cantiques', Sg: 'Sagesse', Si: 'Ben Sira le Sage', Is: 'Isaïe', Jr: 'Jérémie', Lm: 'Lamentations', Ba: 'Baruch', Ez: 'Ézékiel', Dn: 'Daniel', Os: 'Osée', Jl: 'Joël', Am: 'Amos', Ab: 'Abdias', Jon: 'Jonas', Mi: 'Michée', Na: 'Nahum', Ha: 'Habacuc', So: 'Sophonie', Ag: 'Aggée', Za: 'Zacharie', Ml: 'Malachie', Mt: 'Matthieu', Mc: 'Marc', Lc: 'Luc', Jn: 'Jean', Ac: 'Actes des Apôtres', Rm: 'Romains', '1 Co': 'première lettre aux Corinthiens', '2 Co': 'deuxième lettre aux Corinthiens', Ga: 'Galates', Ep: 'Éphésiens', Ph: 'Philippiens', Col: 'Colossiens', '1 Th': 'première lettre aux Thessaloniciens', '2 Th': 'deuxième lettre aux Thessaloniciens', '1 Tm': 'première lettre à Timothée', '2 Tm': 'deuxième lettre à Timothée', Tt: 'Tite', Phm: 'Philémon', He: 'Hébreux', Jc: 'Jacques', '1 P': 'première lettre de Pierre', '2 P': 'deuxième lettre de Pierre', '1 Jn': 'première lettre de Jean', '2 Jn': 'deuxième lettre de Jean', '3 Jn': 'troisième lettre de Jean', Jude: 'Jude', Ap: 'Apocalypse' };
  function referenceToSpeech(ref) {
    let r = (ref || '').trim();
    if (!r) return r;
    r = r.replace(/^(\d)\s*([A-Za-z])/, '$1 $2');
    const m = r.match(/^((?:\d\s)?[A-Za-zéÉ]+)\b/);
    if (m) {
      const abbr = m[1];
      const full = BOOKS[abbr] ?? Object.entries(BOOKS).find(([k]) => k.toLowerCase() === abbr.toLowerCase())?.[1];
      if (full) r = full + r.slice(m[0].length);
    }
    r = r.replace(/(\d+[a-z]?)\s*-\s*(\d+[a-z]?)/g, '$1 à $2').replace(/(\d)([a-z]{1,2})\b/g, '$1 $2').replace(/;/g, ',');
    return r;
  }
  return { displayHtml, htmlToPlain, toSpeechChunks, humanizeCaps, referenceToSpeech };
})();

// ------------------------------------------------------------------ découpage des offices
const Parser = (() => {
  const s = (o, k) => { const v = o && o[k]; return typeof v === 'string' && v.trim() ? v.trim() : null; };
  const o = (obj, k) => { const v = obj && obj[k]; return v && typeof v === 'object' && !Array.isArray(v) ? v : null; };
  const stripP = x => x == null ? null : x.trim().replace(/^<p>/i, '').replace(/<\/p>$/i, '').trim();

  function parseInfo(j) {
    if (!j) return null;
    return { date: s(j, 'date') || '', zone: s(j, 'zone') || '', couleur: s(j, 'couleur') || '', annee: s(j, 'annee') || '', temps: s(j, 'temps_liturgique') || '', semaine: s(j, 'semaine') || '', jour: s(j, 'jour') || '', nom: s(j, 'jour_liturgique_nom') || s(j, 'ligne1') || '', fete: s(j, 'fete') || '', ligne1: s(j, 'ligne1') || '', ligne2: s(j, 'ligne2') || '', ligne3: s(j, 'ligne3') || '' };
  }

  function psalmTitle(ref, titre) {
    if (titre && titre.toLowerCase() !== 'psaume') {
      const r = ref && ref.trim();
      if (r && !titre.includes(r)) return [`${titre} (${r})`, `${titre}. ${Text.referenceToSpeech(r)}`];
      return [titre, titre];
    }
    const r = (ref || '').trim();
    if (!r) return ['Psaume', 'Psaume'];
    if (/^\d+[a-zA-Z]?$/.test(r)) return [`Psaume ${r}`, 'Psaume ' + r.replace(/(\d)([a-zA-Z])/, '$1 $2').toUpperCase()];
    const mp = r.match(/^(\d+[a-zA-Z]?)\s*[-–]\s*([IVX]+)$/);
    if (mp) {
      const parts = { I: 'première partie', II: 'deuxième partie', III: 'troisième partie', IV: 'quatrième partie', V: 'cinquième partie' };
      return [`Psaume ${mp[1]} — ${mp[2]}`, `Psaume ${mp[1].replace(/(\d)([a-zA-Z])/, '$1 $2').toUpperCase()}, ${parts[mp[2]] || 'partie ' + mp[2]}`];
    }
    if (/^cantique/i.test(r)) {
      const rest = r.slice(8).trim().replace(/\.$/, '');
      const display = rest ? `Cantique ${rest}` : 'Cantique';
      const inner = rest.match(/\(([^)]*)\)/);
      const speech = inner ? ('Cantique ' + rest.split('(')[0].trim() + '. ' + Text.referenceToSpeech(inner[1])).replace(/\s+\./g, '.') : display;
      return [display, speech];
    }
    if (/^ps/i.test(r)) { const n = r.slice(2).trim(); return [`Psaume ${n}`, `Psaume ${n}`]; }
    if (/^\d/.test(r)) return [`Psaume ${r}`, `Psaume ${r}`];
    return [r, Text.referenceToSpeech(r)];
  }

  function build() {
    const list = [];
    return {
      list,
      add(id, title, subtitle, html, speechTitle) {
        if (!html || !String(html).trim()) return;
        const st = speechTitle || (Text.humanizeCaps(title) + (subtitle ? '. ' + Text.humanizeCaps(subtitle) : ''));
        list.push({ id: `${id}-${list.length}`, title, subtitle: subtitle || null, html, speechTitle: st });
      },
    };
  }

  function psalmSection(b, id, antienne, ps, opt, forcedTitle, forcedSpeech) {
    if (!ps) return;
    const texte = s(ps, 'texte'); if (!texte) return;
    const ref = s(ps, 'reference'), titre = s(ps, 'titre');
    const [title, speech] = forcedTitle ? [forcedTitle, forcedSpeech || forcedTitle] : psalmTitle(ref, titre);
    const ant = stripP(antienne);
    const subtitle = forcedTitle && ref && !forcedTitle.includes(ref) ? ref : null;
    let html = '';
    if (ant) html += `<p><i>Antienne :</i> ${ant}</p>`;
    html += texte;
    if (opt.gloria) html += GLORIA;
    if (ant && opt.repeatAntienne) html += `<p><i>Antienne :</i> ${ant}</p>`;
    b.add(id, title, subtitle, html, speech);
  }

  function parseHours(type, x, opt) {
    const b = build();
    b.add('intro', 'Introduction', null, s(x, 'introduction'), 'Introduction');
    if (type === 'laudes') {
      const ps = o(x, 'psaume_invitatoire');
      if (ps) { const ref = s(ps, 'reference') || '94'; psalmSection(b, 'invit', s(x, 'antienne_invitatoire'), ps, opt, `Invitatoire — Psaume ${ref}`, `Invitatoire. Psaume ${ref}`); }
    }
    if (type === 'complies') b.add('confiteor', 'Acte pénitentiel', 'Je confesse à Dieu', CONFITEOR, 'Acte pénitentiel');
    const h = o(x, 'hymne');
    if (h) { const titre = s(h, 'titre'), auteur = s(h, 'auteur'); const sub = [titre, auteur].filter(Boolean).join(' — '); b.add('hymne', 'Hymne', sub || null, s(h, 'texte'), 'Hymne.' + (titre ? ' ' + titre : '')); }
    const maxPs = type === 'complies' ? 2 : 3;
    for (let i = 1; i <= maxPs; i++) psalmSection(b, 'ps' + i, s(x, 'antienne_' + i), o(x, 'psaume_' + i), opt);
    if (type === 'lectures') {
      b.add('verset', 'Verset', null, s(x, 'verset_psaume'), 'Verset');
      const l = o(x, 'lecture');
      if (l) {
        const ref = s(l, 'reference'), titre = s(l, 'titre');
        let html = (titre ? `<p><b>${titre}</b></p>` : '') + (ref ? `<p><i>${ref}</i></p>` : '') + (s(l, 'texte') || '');
        const rep = s(x, 'repons_lecture'); if (rep) html += '<p><b>Répons</b></p>' + rep;
        b.add('lecture', 'Lecture biblique', [titre, ref].filter(Boolean).join(' — ') || null, html, 'Lecture biblique.' + (ref ? ` ${Text.referenceToSpeech(ref)}.` : '') + (titre ? ` ${titre}` : ''));
      }
      const tp = s(x, 'texte_patristique');
      if (tp) {
        const titre = s(x, 'titre_patristique');
        let html = (titre ? `<p><b>${titre}</b></p>` : '') + tp;
        const rep = s(x, 'repons_patristique'); if (rep) html += '<p><b>Répons</b></p>' + rep;
        b.add('patristique', 'Lecture patristique', titre, html, 'Lecture patristique.' + (titre ? ' ' + Text.humanizeCaps(titre) : ''));
      }
      const td = o(x, 'te_deum'); if (td) b.add('tedeum', s(td, 'titre') || 'Te Deum', null, s(td, 'texte'), 'Té Déum');
    } else {
      const p = o(x, 'pericope');
      if (p) { const ref = s(p, 'reference'); b.add('parole', 'Parole de Dieu', ref, (ref ? `<p><i>${ref}</i></p>` : '') + (s(p, 'texte') || ''), 'Parole de Dieu.' + (ref ? ' ' + Text.referenceToSpeech(ref) : '')); }
      b.add('repons', 'Répons', null, s(x, 'repons'), 'Répons');
    }
    if (type === 'laudes') psalmSection(b, 'zacharie', s(x, 'antienne_zacharie'), o(x, 'cantique_zacharie'), opt, 'Cantique de Zacharie (Benedictus)', 'Cantique de Zacharie');
    if (type === 'vepres') psalmSection(b, 'magnificat', s(x, 'antienne_magnificat'), o(x, 'cantique_mariale'), opt, 'Cantique de Marie (Magnificat)', 'Cantique de Marie, Magnificat');
    if (type === 'complies') psalmSection(b, 'symeon', s(x, 'antienne_symeon'), o(x, 'cantique_symeon'), opt, 'Cantique de Syméon (Nunc dimittis)', 'Cantique de Syméon');
    b.add('intercession', 'Intercession', null, s(x, 'intercession'), 'Intercession');
    if (('notre_pere' in (x || {})) || type === 'laudes' || type === 'vepres') b.add('np', 'Notre Père', null, NOTRE_PERE, 'Notre Père');
    b.add('oraison', 'Oraison', null, s(x, 'oraison'), 'Oraison');
    if (type === 'laudes' || type === 'vepres') b.add('benediction', 'Bénédiction', null, BENEDICTION, 'Bénédiction');
    else if (type === 'complies') {
      b.add('benediction', 'Bénédiction', null, s(x, 'benediction') || BENEDICTION, 'Bénédiction');
      const hm = o(x, 'hymne_mariale'); if (hm) b.add('mariale', 'Hymne à la Vierge Marie', s(hm, 'titre'), s(hm, 'texte'), 'Hymne à la Vierge Marie.' + (s(hm, 'titre') ? ' ' + s(hm, 'titre') : ''));
    } else b.add('conclusion', 'Conclusion', null, CONCLUSION, 'Conclusion');
    return b.list;
  }

  const LT = { lecture_1: 'Première lecture', lecture_2: 'Deuxième lecture', lecture_3: 'Troisième lecture', lecture_4: 'Quatrième lecture', lecture_5: 'Cinquième lecture', lecture_6: 'Sixième lecture', lecture_7: 'Septième lecture', epitre: 'Épître', psaume: 'Psaume', cantique: 'Cantique', sequence: 'Séquence', evangile: 'Évangile' };
  function parseMesse(arr) {
    const b = build();
    if (!Array.isArray(arr) || !arr.length) return b.list;
    const several = arr.length > 1;
    arr.forEach((m, i) => {
      const nom = s(m, 'nom') || 'Messe';
      if (several) b.add('messe' + i, nom, null, `<p><b>${nom}</b></p>`, nom);
      (m.lectures || []).forEach((l, k) => {
        const type = s(l, 'type'), titre = s(l, 'titre'), ref = s(l, 'ref'), intro = s(l, 'intro_lue'), refrain = s(l, 'refrain_psalmique'), verset = s(l, 'verset_evangile'), contenu = s(l, 'contenu');
        if (!contenu) return;
        const title = LT[type] || (type ? type.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : (titre || 'Lecture'));
        let html = '';
        if (titre && type !== 'psaume') html += `<p><b>${titre}</b></p>`;
        if (ref) html += `<p><i>${ref}</i></p>`;
        if (type === 'evangile' && verset) html += verset;
        if (intro) html += `<p><i>${intro}</i></p>`;
        if (refrain) html += refrain;
        html += contenu;
        if (type === 'evangile') html += '<p>— Acclamons la Parole de Dieu.<br/>— Louange à toi, Seigneur Jésus.</p>';
        else if ((type || '').startsWith('lecture') || type === 'epitre') html += '<p>— Parole du Seigneur.<br/>— Nous rendons grâce à Dieu.</p>';
        const sub = [several ? nom : null, ref].filter(Boolean).join(' — ') || null;
        b.add(`lecture${i}-${k}`, title, sub, html, title + '.' + (ref ? ' ' + Text.referenceToSpeech(ref) + '.' : ''));
      });
    });
    return b.list;
  }

  function parse(type, root) {
    const opt = { gloria: prefs.gloria, repeatAntienne: prefs.repeatAntienne };
    const info = parseInfo(root.informations);
    const sections = type === 'messes' ? parseMesse(root.messes) : parseHours(type, o(root, type) || {}, opt);
    return { type, info, title: officeByApi(type).label, sections };
  }
  return { parse, parseInfo };
})();

// ------------------------------------------------------------------ accès AELF (le service worker assure le cache hors ligne)
const API = 'https://api.aelf.org/v1';
const Repo = {
  async fetchJson(url, force) {
    const res = await fetch(url, force ? { cache: 'reload' } : {});
    if (!res.ok) throw new Error('Réponse ' + res.status + ' du serveur AELF');
    return res.json();
  },
  async office(type, date, zone, force = false) {
    const json = await this.fetchJson(`${API}/${type}/${date}/${zone}`, force);
    const data = Parser.parse(type, json);
    data.date = date; data.zone = zone;
    return data;
  },
  async info(date, zone, force = false) {
    const json = await this.fetchJson(`${API}/informations/${date}/${zone}`, force);
    return Parser.parseInfo(json.informations);
  },
  async prefetch(zone, days) {
    if (!days || !navigator.onLine) return;
    const caches_ = 'caches' in window ? await caches.open('aelf-data') : null;
    for (let d = 0; d <= days; d++) {
      const date = isoDate(addDays(new Date(), d));
      for (const o of OFFICES) {
        const url = `${API}/${o.api}/${date}/${zone}`;
        try {
          if (caches_ && await caches_.match(url)) continue;
          await fetch(url);
          await new Promise(r => setTimeout(r, 250));
        } catch { return; }
      }
    }
  },
};

// ------------------------------------------------------------------ lecture à voix haute
const Speech = {
  office: null, utts: [], cursor: 0, playing: false, section: -1, finished: false, token: 0,
  listeners: new Set(), current: null, sleepTimer: null, sleepAt: 0, wakeLock: null, voices: [],
  supported: 'speechSynthesis' in window,

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit() { for (const fn of this.listeners) try { fn(this); } catch (e) { console.error(e); } },

  loadVoices() {
    if (!this.supported) return [];
    const all = speechSynthesis.getVoices() || [];
    const fr = all.filter(v => /^fr/i.test(v.lang));
    fr.sort((a, b) => (a.lang === 'fr-FR' ? 0 : 1) - (b.lang === 'fr-FR' ? 0 : 1) || (a.localService ? 0 : 1) - (b.localService ? 0 : 1) || a.name.localeCompare(b.name));
    this.voices = fr;
    return fr;
  },
  pickVoice() {
    const want = prefs.voice;
    const v = this.voices.find(v => v.voiceURI === want || v.name === want);
    return v || this.voices[0] || null;
  },

  buildUtts(office) {
    const list = [];
    const pause = Math.min(5000, Math.max(0, +prefs.pauseMs || 0));
    office.sections.forEach((s, i) => {
      if (prefs.readTitles && s.speechTitle) { list.push({ section: i, text: s.speechTitle.replace(/\.+$/, '') + '.' }); list.push({ section: i, ms: 450 }); }
      const chunks = Text.toSpeechChunks(s.html, prefs.sayMarks);
      chunks.forEach((c, k) => { list.push({ section: i, text: c }); if (k < chunks.length - 1) list.push({ section: i, ms: 350 }); });
      if (i < office.sections.length - 1) list.push({ section: i, ms: pause });
    });
    return list;
  },

  play(office, sectionIdx = 0) {
    if (!this.supported) { toast("La lecture à voix haute n'est pas disponible dans ce navigateur."); return; }
    if (!this.office || this.office !== office) { this.office = office; this.utts = this.buildUtts(office); }
    else if (!this.utts.length) this.utts = this.buildUtts(office);
    const sec = Math.max(0, Math.min(office.sections.length - 1, sectionIdx));
    const start = this.utts.findIndex(u => u.section === sec);
    this.cursor = Math.max(0, start);
    this.finished = false;
    this.startSpeaking();
  },
  startSpeaking() {
    this.stopEngine();
    this.playing = true;
    this.token++;
    this.requestWake();
    this.updateMediaSession();
    this.emit();
    // Chrome : un cancel() immédiatement suivi de speak() est parfois ignoré.
    setTimeout(() => this.speakNext(this.token), 60);
  },
  speakNext(token) {
    if (token !== this.token || !this.playing) return;
    if (this.cursor >= this.utts.length) { this.playing = false; this.finished = true; this.releaseWake(); this.emit(); return; }
    const u = this.utts[this.cursor];
    if (u.section !== this.section) { this.section = u.section; this.emit(); }
    if (u.ms != null) { setTimeout(() => { if (token === this.token && this.playing) { this.cursor++; this.speakNext(token); } }, u.ms); return; }
    const ut = new SpeechSynthesisUtterance(u.text);
    const v = this.pickVoice();
    if (v) ut.voice = v;
    ut.lang = (v && v.lang) || 'fr-FR';
    ut.rate = Math.min(3, Math.max(0.3, +prefs.rate || 1));
    ut.pitch = Math.min(2, Math.max(0.5, +prefs.pitch || 1));
    const done = () => { if (token !== this.token || !this.playing) return; this.cursor++; this.speakNext(token); };
    ut.onend = done;
    ut.onerror = e => { if (e.error === 'interrupted' || e.error === 'canceled') return; console.warn('TTS', e.error); done(); };
    this.current = ut; // évite que l'objet soit ramassé par le GC avant la fin
    speechSynthesis.speak(ut);
    // Chrome de bureau coupe parfois les longues lectures : on le réveille régulièrement.
    if (!this._keep && !/Android|iPhone|iPad/i.test(navigator.userAgent)) this._keep = setInterval(() => { if (this.playing && speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 10000);
  },
  stopEngine() { try { speechSynthesis.cancel(); } catch {} },
  pause() { if (!this.playing) return; this.playing = false; this.token++; this.stopEngine(); this.releaseWake(); this.updateMediaSession(); this.emit(); },
  resume() {
    if (!this.office) return;
    if (this.playing) return;
    if (this.finished || this.cursor >= this.utts.length) { this.play(this.office, 0); return; }
    this.startSpeaking();
  },
  toggle() { this.playing ? this.pause() : this.resume(); },
  next() { if (!this.office) return; const n = Math.min(this.office.sections.length - 1, this.section + 1); if (n === this.section) return; this.goto(n); },
  prev() { if (!this.office) return; this.goto(Math.max(0, this.section - 1)); },
  goto(n) { const start = this.utts.findIndex(u => u.section === n); this.cursor = Math.max(0, start); this.section = n; if (this.playing) this.startSpeaking(); else this.emit(); },
  stop() { this.playing = false; this.token++; this.stopEngine(); this.section = -1; this.finished = false; this.office = null; this.utts = []; this.releaseWake(); this.setSleep(0); if (this._keep) { clearInterval(this._keep); this._keep = null; } this.emit(); },
  settingsChanged(rebuild) {
    if (!this.office) return;
    if (rebuild) { const sec = Math.max(0, this.section); this.utts = this.buildUtts(this.office); this.cursor = Math.max(0, this.utts.findIndex(u => u.section === sec)); }
    if (this.playing) this.startSpeaking();
  },
  sample(text) {
    const wasPlaying = this.playing; if (wasPlaying) this.pause();
    this.stopEngine();
    const ut = new SpeechSynthesisUtterance(text);
    const v = this.pickVoice(); if (v) ut.voice = v; ut.lang = (v && v.lang) || 'fr-FR'; ut.rate = +prefs.rate || 1; ut.pitch = +prefs.pitch || 1;
    this.current = ut;
    setTimeout(() => speechSynthesis.speak(ut), 60);
  },
  setSleep(minutes) {
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = null; this.sleepAt = 0;
    if (minutes > 0) { this.sleepAt = Date.now() + minutes * 60000; this.sleepTimer = setTimeout(() => { this.pause(); this.sleepAt = 0; this.emit(); }, minutes * 60000); }
    this.emit();
  },
  async requestWake() {
    if (!prefs.keepAwake || !('wakeLock' in navigator)) return;
    try { this.wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  },
  releaseWake() { try { this.wakeLock?.release(); } catch {} this.wakeLock = null; },
  updateMediaSession() {
    if (!('mediaSession' in navigator) || !this.office) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: this.office.title, artist: fmtDate(this.office.date), album: this.office.info?.nom || 'Bréviaire' });
      navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
    } catch {}
  },
};
if (Speech.supported) { Speech.loadVoices(); speechSynthesis.onvoiceschanged = () => Speech.loadVoices(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Speech.playing) Speech.requestWake(); });

// ------------------------------------------------------------------ utilitaires
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const fmtDate = iso => cap(parseIso(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
const fmtShort = iso => parseIso(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtRate = r => (Math.round(r * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '×';
const COLORS = { vert: '#2E7D32', blanc: '#EEEEEE', rouge: '#C62828', violet: '#6A1B9A', rose: '#EC407A', noir: '#000000' };
const I = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>',
  tune: '<svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>',
  volume: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  book: '<svg viewBox="0 0 24 24"><path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>',
};
let toastTimer;
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3500);
}

// ------------------------------------------------------------------ navigation
const app = document.getElementById('app');
const state = { date: isoDate(new Date()), deferredInstall: null };
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredInstall = e; if (location.hash === '' || location.hash === '#/') renderHome(); });

function route() {
  if (unsubHome) { unsubHome(); unsubHome = null; }
  if (unsubOffice) { unsubOffice(); unsubOffice = null; }
  window.scrollTo(0, 0);
  const h = location.hash.replace(/^#\/?/, '');
  const [view, a, b] = h.split('/');
  if (view === 'office' && a && b) renderOffice(a, b);
  else if (view === 'settings') renderSettings();
  else renderHome();
}
window.addEventListener('hashchange', route);

function header(title, sub, left, right) {
  return `<header class="bar">${left || ''}<h1>${esc(title)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</h1>${right || ''}</header>`;
}

// ---- Accueil
let unsubHome = null, unsubOffice = null;
async function renderHome() {
  if (unsubHome) { unsubHome(); unsubHome = null; }
  const d = state.date;
  const nowOffice = officeByApi(officeForHour(new Date().getHours()));
  app.innerHTML = header('Bréviaire', null, '', `<button class="icon-btn" id="btnSettings" title="Réglages">${I.settings}</button>`) + `
  <main>
    ${state.deferredInstall ? `<div class="install">📲 Ajouter Bréviaire à l'écran d'accueil pour l'ouvrir comme une application. <button class="btn small" id="btnInstall">Installer</button></div>` : ''}
    <div class="daterow">
      <button class="icon-btn" id="prevDay" style="color:var(--primary)">${I.left}</button>
      <label class="date">${fmtDate(d)}<input type="date" id="datePick" value="${d}"></label>
      <button class="icon-btn" id="nextDay" style="color:var(--primary)">${I.right}</button>
    </div>
    <div class="chips"><button class="chip ${d === isoDate(new Date()) ? 'on' : ''}" id="today">Aujourd'hui</button></div>
    <div class="card info" id="infoCard"><div class="dot" id="dot" style="background:#C9A24D"></div><div><b id="infoName">Chargement…</b><span id="infoDetails"></span></div></div>
    <button class="btn" id="btnNow">${I.volume} Écouter maintenant : ${esc(nowOffice.label)}</button>
    <h2 class="section">Les offices du jour</h2>
    <div id="offices">${OFFICES.map(o => `
      <div class="card office" data-api="${o.api}">
        <div class="t"><b>${esc(o.label)}</b><small>${esc(o.hint)}</small><small class="off" data-off="${o.api}" hidden>✓ disponible hors connexion</small></div>
        <button class="icon-btn" data-read="${o.api}" title="Lire" style="color:var(--text)">${I.book}</button>
        <button class="icon-btn" data-listen="${o.api}" title="Écouter">${I.volume}</button>
      </div>`).join('')}</div>
    <p class="src">Textes liturgiques : AELF (aelf.org) — Liturgie des Heures.<br>Lecture à voix haute par le navigateur.</p>
  </main>
  <div class="mini" id="mini" hidden><div class="t"><b id="miniTitle"></b><small id="miniSub"></small></div><button class="icon-btn" id="miniPlay">${I.pause}</button><button class="icon-btn" id="miniStop">${I.stop}</button></div>`;

  const go = (api, listen) => { location.hash = `#/office/${api}/${state.date}` + (listen ? '?play' : ''); };
  app.querySelector('#btnSettings').onclick = () => location.hash = '#/settings';
  app.querySelector('#prevDay').onclick = () => { state.date = isoDate(addDays(parseIso(state.date), -1)); renderHome(); };
  app.querySelector('#nextDay').onclick = () => { state.date = isoDate(addDays(parseIso(state.date), 1)); renderHome(); };
  app.querySelector('#today').onclick = () => { state.date = isoDate(new Date()); renderHome(); };
  app.querySelector('#datePick').onchange = e => { if (e.target.value) { state.date = e.target.value; renderHome(); } };
  app.querySelector('#btnNow').onclick = () => go(nowOffice.api, true);
  app.querySelectorAll('[data-read]').forEach(b => b.onclick = e => { e.stopPropagation(); go(b.dataset.read, false); });
  app.querySelectorAll('[data-listen]').forEach(b => b.onclick = e => { e.stopPropagation(); go(b.dataset.listen, true); });
  app.querySelectorAll('.office').forEach(c => c.onclick = () => go(c.dataset.api, false));
  const inst = app.querySelector('#btnInstall');
  if (inst) inst.onclick = async () => { const p = state.deferredInstall; if (!p) return; p.prompt(); await p.userChoice; state.deferredInstall = null; renderHome(); };

  // mini lecteur
  const mini = app.querySelector('#mini');
  const renderMini = () => {
    if (!document.contains(mini)) return;
    if (!Speech.office || Speech.section < 0) { mini.hidden = true; return; }
    mini.hidden = false;
    app.querySelector('#miniTitle').textContent = `${Speech.office.title} — ${fmtShort(Speech.office.date)}`;
    app.querySelector('#miniSub').textContent = Speech.office.sections[Speech.section]?.title || '';
    app.querySelector('#miniPlay').innerHTML = Speech.playing ? I.pause : I.play;
  };
  app.querySelector('#miniPlay').onclick = e => { e.stopPropagation(); Speech.toggle(); };
  app.querySelector('#miniStop').onclick = e => { e.stopPropagation(); Speech.stop(); };
  mini.onclick = () => { if (Speech.office) location.hash = `#/office/${Speech.office.type}/${Speech.office.date}`; };
  unsubHome = Speech.on(renderMini); renderMini();

  // disponibilité hors connexion
  if ('caches' in window) {
    const c = await caches.open('aelf-data');
    for (const o of OFFICES) { const hit = await c.match(`${API}/${o.api}/${d}/${prefs.zone}`); const el = app.querySelector(`[data-off="${o.api}"]`); if (el) el.hidden = !hit; }
  }
  // informations liturgiques
  try {
    const info = await Repo.info(d, prefs.zone);
    if (state.date !== d) return;
    const name = app.querySelector('#infoName'), det = app.querySelector('#infoDetails'), dot = app.querySelector('#dot');
    if (!info) { name.textContent = '—'; return; }
    name.textContent = info.nom || info.ligne1;
    const lines = [];
    if (info.fete && info.fete !== info.nom) lines.push(info.fete);
    if (info.ligne2) lines.push(info.ligne2);
    if (info.ligne3) lines.push(info.ligne3);
    lines.push(`Temps ${(info.temps || '').toLowerCase()}${info.annee ? ' · Année ' + info.annee : ''}${info.couleur ? ' · Couleur : ' + info.couleur : ''}`);
    det.textContent = lines.join('\n');
    dot.style.background = COLORS[(info.couleur || '').toLowerCase()] || '#C9A24D';
  } catch (e) {
    const name = app.querySelector('#infoName'); if (name) { name.textContent = 'Informations indisponibles hors connexion'; app.querySelector('#infoDetails').textContent = e.message || ''; }
  }
  Repo.prefetch(prefs.zone, +prefs.prefetchDays).catch(() => {});
}

// ---- Office
let currentOffice = null, lastScrolled = -1;
async function renderOffice(api, dateWithQuery) {
  if (unsubOffice) { unsubOffice(); unsubOffice = null; }
  const [date, query] = dateWithQuery.split('?');
  const autoplay = query === 'play';
  const o = officeByApi(api); if (!o) { location.hash = '#/'; return; }
  state.date = date;
  app.innerHTML = header(o.label, fmtDate(date), `<button class="icon-btn" id="back">${I.back}</button>`,
    `<button class="icon-btn" id="btnShare" title="Partager">${I.share}</button><button class="icon-btn" id="btnVoice" title="Voix et vitesse">${I.tune}</button>`) + `
  <main><div class="center"><span class="spin"></span></div></main>
  <div class="player">
    <div class="row"><div class="prog" id="prog">Prêt à lire</div><button class="btn secondary small" id="btnSpeed">${I.tune} ${fmtRate(prefs.rate)}</button></div>
    <div class="row">
      <button class="font" id="fontMinus">A−</button>
      <button class="icon-btn" id="btnPrev">${I.prev}</button>
      <button class="fab" id="btnPlay">${I.play}</button>
      <button class="icon-btn" id="btnNext">${I.next}</button>
      <button class="font big" id="fontPlus">A+</button>
    </div>
  </div>`;
  app.querySelector('#back').onclick = () => { location.hash = '#/'; };
  app.querySelector('#btnVoice').onclick = app.querySelector('#btnSpeed').onclick = () => openVoiceSheet();
  app.querySelector('#fontMinus').onclick = () => changeFont(-1);
  app.querySelector('#fontPlus').onclick = () => changeFont(1);

  let office;
  try {
    office = await Repo.office(api, date, prefs.zone);
  } catch (e) {
    app.querySelector('main').innerHTML = `<div class="center err">${esc(e.message)}<br><br>Vérifiez la connexion internet. Les offices déjà consultés restent disponibles hors connexion.<br><br><button class="btn small" id="retry">${I.refresh} Réessayer</button></div>`;
    app.querySelector('#retry').onclick = () => renderOffice(api, dateWithQuery);
    return;
  }
  currentOffice = (Speech.office && Speech.office.type === api && Speech.office.date === date && Speech.office.zone === prefs.zone) ? Speech.office : office;
  if (office.info) app.querySelector('header .sub').textContent = `${fmtDate(date)} · ${office.info.nom}`;
  const main = app.querySelector('main');
  if (!currentOffice.sections.length) { main.innerHTML = `<div class="center">Aucun texte n'est disponible pour cet office à cette date.</div>`; return; }
  main.innerHTML = currentOffice.sections.map((s, i) => `
    <div class="card sec" data-i="${i}">
      <h3>${esc(s.title)}<span class="spk" style="color:var(--primary)">${I.volume}</span>${isSingable(s) ? `<button class="sing" data-sing="${i}">♪ Chanter</button>` : ''}</h3>
      ${s.subtitle ? `<div class="st">${esc(s.subtitle)}</div>` : ''}
      <div class="body">${Text.displayHtml(s.html, prefs.showVerses)}</div>
    </div>`).join('');
  main.querySelectorAll('.sec').forEach(el => el.onclick = () => Speech.play(currentOffice, +el.dataset.i));
  main.querySelectorAll('[data-sing]').forEach(b => b.onclick = e => { e.stopPropagation(); openChantSheet(currentOffice.sections[+b.dataset.sing]); });

  app.querySelector('#btnShare').onclick = async () => {
    const text = `${currentOffice.title} — ${fmtDate(date)}\n\n` + currentOffice.sections.map(s => s.title.toUpperCase() + (s.subtitle ? ` (${s.subtitle})` : '') + '\n' + Text.htmlToPlain(s.html)).join('\n\n') + '\n\nSource : AELF (aelf.org)';
    if (navigator.share) { try { await navigator.share({ title: currentOffice.title, text }); } catch {} }
    else { try { await navigator.clipboard.writeText(text); toast('Texte copié'); } catch { toast('Partage non disponible'); } }
  };
  const mine = () => Speech.office === currentOffice;
  app.querySelector('#btnPlay').onclick = () => {
    if (mine() && Speech.section >= 0 && !Speech.finished) Speech.toggle();
    else Speech.play(currentOffice, mine() && Speech.section >= 0 ? Speech.section : Math.max(0, highlighted()));
  };
  const highlighted = () => { const c = main.querySelector('.sec.cur'); return c ? +c.dataset.i : -1; };
  const scrollTo = i => { const el = main.querySelector(`.sec[data-i="${i}"]`); if (el) { const y = el.getBoundingClientRect().top + window.scrollY - 70; window.scrollTo({ top: y, behavior: 'smooth' }); } };
  const mark = i => { main.querySelectorAll('.sec').forEach(el => el.classList.toggle('cur', +el.dataset.i === i)); };
  app.querySelector('#btnPrev').onclick = () => { if (mine() && Speech.section >= 0) Speech.prev(); else { const i = Math.max(0, highlighted() - 1); mark(i); scrollTo(i); } };
  app.querySelector('#btnNext').onclick = () => { if (mine() && Speech.section >= 0) Speech.next(); else { const i = Math.min(currentOffice.sections.length - 1, highlighted() + 1); mark(i); scrollTo(i); } };

  const render = () => {
    const prog = app.querySelector('#prog'), play = app.querySelector('#btnPlay');
    if (!prog) return;
    app.querySelector('#btnSpeed').innerHTML = `${I.tune} ${fmtRate(prefs.rate)}`;
    if (!mine()) { play.innerHTML = I.play; prog.textContent = 'Prêt à lire'; return; }
    play.innerHTML = Speech.playing ? I.pause : I.play;
    const n = currentOffice.sections.length;
    if (Speech.finished) prog.textContent = 'Lecture terminée';
    else if (Speech.section >= 0) prog.textContent = `${Speech.playing ? '▶' : '⏸'} ${currentOffice.sections[Speech.section].title} · ${Speech.section + 1}/${n}`;
    else prog.textContent = 'Prêt à lire';
    if (Speech.section >= 0) { mark(Speech.section); if (Speech.playing && lastScrolled !== Speech.section) { lastScrolled = Speech.section; scrollTo(Speech.section); } }
  };
  unsubOffice = Speech.on(render); render();
  if (autoplay && !(mine() && Speech.playing)) {
    // Certains navigateurs exigent un geste : on propose un bouton si le démarrage automatique est refusé.
    Speech.play(currentOffice, 0);
    history.replaceState(null, '', `#/office/${api}/${date}`);
  }
}
function changeFont(delta) {
  const order = ['small', 'normal', 'large', 'xlarge'];
  const i = Math.max(0, Math.min(order.length - 1, Math.max(0, order.indexOf(prefs.fontSize)) + delta));
  prefs.fontSize = order[i]; applyTheme();
}

// ---- Feuille voix
function openVoiceSheet() {
  const voices = Speech.loadVoices();
  const cur = prefs.voice;
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  const sleepLeft = Speech.sleepAt > Date.now() ? Math.round((Speech.sleepAt - Date.now()) / 60000) : 0;
  const activeSleep = !sleepLeft ? 0 : sleepLeft <= 15 ? 15 : sleepLeft <= 30 ? 30 : 60;
  bg.innerHTML = `<div class="sheet">
    <h2>Voix et lecture</h2>
    <label class="l">Voix</label>
    <select id="voice">${voices.length ? voices.map((v, i) => `<option value="${esc(v.voiceURI)}" ${(cur === v.voiceURI || cur === v.name || (!cur && i === 0)) ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)}${v.localService ? '' : ', internet'})</option>`).join('') : '<option value="">Aucune voix française trouvée</option>'}</select>
    <div class="help">Les voix proviennent du téléphone / navigateur. Pour en ajouter sur Android : Paramètres → Accessibilité → Synthèse vocale → Google → Installer des voix (Français). Sur iPhone : Réglages → Accessibilité → Contenu énoncé → Voix.</div>
    <label class="l" id="lblRate">Vitesse : ${fmtRate(prefs.rate)}</label>
    <input type="range" id="rate" min="50" max="250" step="5" value="${Math.round(prefs.rate * 100)}">
    <label class="l" id="lblPitch">Hauteur de la voix : ${pitchText(prefs.pitch)}</label>
    <input type="range" id="pitch" min="60" max="150" step="5" value="${Math.round(prefs.pitch * 100)}">
    <label class="l" id="lblPause">Silence entre les parties : ${(prefs.pauseMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s</label>
    <input type="range" id="pause" min="0" max="4000" step="100" value="${prefs.pauseMs}">
    <div class="sw"><span>Annoncer le titre de chaque partie (Hymne, Psaume…)</span><input type="checkbox" id="titles" ${prefs.readTitles ? 'checked' : ''}></div>
    <div class="sw"><span>Annoncer « Verset » et « Répons » (V/ et R/)</span><input type="checkbox" id="marks" ${prefs.sayMarks ? 'checked' : ''}></div>
    <div class="sw"><span>Garder l'écran allumé pendant la lecture</span><input type="checkbox" id="awake" ${prefs.keepAwake ? 'checked' : ''}></div>
    <label class="l">Arrêt automatique</label>
    <div class="chips" style="justify-content:flex-start">${[[0, 'Non'], [15, '15 min'], [30, '30 min'], [60, '60 min']].map(([m, l]) => `<button class="chip ${m === activeSleep ? 'on' : ''}" data-sleep="${m}">${l}</button>`).join('')}</div>
    <button class="btn" id="test">${I.volume} Écouter un essai avec ces réglages</button>
    <button class="btn secondary" id="close">Fermer</button>
  </div>`;
  document.body.appendChild(bg);
  const q = sel => bg.querySelector(sel);
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  q('#close').onclick = () => bg.remove();
  q('#voice').onchange = e => { prefs.voice = e.target.value; Speech.settingsChanged(false); };
  q('#rate').oninput = e => { prefs.rate = +e.target.value / 100; q('#lblRate').textContent = 'Vitesse : ' + fmtRate(prefs.rate) + (prefs.rate < 0.8 ? ' (lente)' : prefs.rate > 1.3 ? ' (rapide)' : ''); };
  q('#rate').onchange = () => { Speech.settingsChanged(false); Speech.emit(); };
  q('#pitch').oninput = e => { prefs.pitch = +e.target.value / 100; q('#lblPitch').textContent = 'Hauteur de la voix : ' + pitchText(prefs.pitch); };
  q('#pitch').onchange = () => Speech.settingsChanged(false);
  q('#pause').oninput = e => { prefs.pauseMs = +e.target.value; q('#lblPause').textContent = `Silence entre les parties : ${(prefs.pauseMs / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`; };
  q('#pause').onchange = () => Speech.settingsChanged(true);
  q('#titles').onchange = e => { prefs.readTitles = e.target.checked; Speech.settingsChanged(true); };
  q('#marks').onchange = e => { prefs.sayMarks = e.target.checked; Speech.settingsChanged(true); };
  q('#awake').onchange = e => { prefs.keepAwake = e.target.checked; if (!e.target.checked) Speech.releaseWake(); else if (Speech.playing) Speech.requestWake(); };
  bg.querySelectorAll('[data-sleep]').forEach(b => b.onclick = () => { const m = +b.dataset.sleep; Speech.setSleep(m); bg.querySelectorAll('[data-sleep]').forEach(x => x.classList.toggle('on', x === b)); if (m) toast(`La lecture s'arrêtera dans ${m} min`); });
  q('#test').onclick = () => Speech.sample('Dieu, viens à mon aide. Seigneur, à notre secours. Gloire au Père, et au Fils, et au Saint-Esprit, pour les siècles des siècles. Amen.');
}
const pitchText = p => p < 0.85 ? 'grave' : p > 1.15 ? 'aiguë' : 'normale';

// ---- Psalmodie grégorienne
const isSingable = s => /^(hymne|ps\d|invit|zacharie|magnificat|symeon|tedeum|mariale)/.test(s.id) || /^(Psaume|Cantique|Hymne|Invitatoire|Te Deum)/i.test(s.title);

function openChantSheet(section) {
  if (!window.Chant) { toast('Module de chant indisponible'); return; }
  if (Speech.playing) Speech.pause();
  const verses = Chant.parseVerses(section.html);
  if (!verses.length) { toast('Texte non psalmodiable'); return; }
  const cp = { tone: prefs.chantTone || '8', transpose: prefs.chantTranspose ?? -4, tempo: prefs.chantTempo || 160, drone: prefs.chantDrone ?? true, intonationEach: prefs.chantIntonationEach ?? false, notes: prefs.chantNotes ?? true, timbre: prefs.chantTimbre || 'choir', speak: prefs.chantSpeak ?? false };
  const save = () => { prefs.chantTone = cp.tone; prefs.chantTranspose = cp.transpose; prefs.chantTempo = cp.tempo; prefs.chantDrone = cp.drone; prefs.chantIntonationEach = cp.intonationEach; prefs.chantNotes = cp.notes; prefs.chantTimbre = cp.timbre; prefs.chantSpeak = cp.speak; };
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  const trText = v => v === 0 ? 'hauteur d\'origine' : (v > 0 ? '+' : '') + v + ' demi-ton' + (Math.abs(v) > 1 ? 's' : '');
  bg.innerHTML = `<div class="sheet chant">
    <h2>♪ ${esc(section.title)}</h2>
    <div class="help">Psalmodie sur les tons grégoriens : la mélodie est jouée à l'orgue, syllabe par syllabe, pour chanter dessus. Les syllabes de cadence sont en couleur, l'accent est souligné (accents du psautier AELF).</div>
    <label class="l">Ton</label>
    <select id="tone">${Chant.TONES.map(t => `<option value="${t.id}" ${t.id === cp.tone ? 'selected' : ''}>${t.name} — ${t.mode}</option>`).join('')}</select>
    <div class="formula" id="formula"></div>
    <label class="l">Qui chante ?</label>
    <select id="timbre">
      <option value="choir" ${cp.timbre === 'choir' ? 'selected' : ''}>Voix chantée (chœur qui chante les syllabes)</option>
      <option value="organ" ${cp.timbre === 'organ' ? 'selected' : ''}>Orgue seul</option>
    </select>
    <div class="sw"><span>Dire aussi les paroles (voix du téléphone par-dessus la mélodie)</span><input type="checkbox" id="speakWords" ${cp.speak ? 'checked' : ''}></div>
    <div class="ctrl">
      <button class="btn secondary" id="playTone">${I.volume} Écouter le ton</button>
      <button class="btn" id="sing">${I.play} Chanter</button>
      <button class="btn secondary" id="stopChant">${I.stop} Arrêter</button>
    </div>
    <label class="l" id="lblTr">Hauteur : ${trText(cp.transpose)}</label>
    <input type="range" id="tr" min="-12" max="8" step="1" value="${cp.transpose}">
    <label class="l" id="lblTempo">Allure : ${cp.tempo} syllabes / min</label>
    <input type="range" id="tempo" min="90" max="260" step="10" value="${cp.tempo}">
    <div class="sw"><span>Bourdon d'orgue (note de teneur tenue)</span><input type="checkbox" id="drone" ${cp.drone ? 'checked' : ''}></div>
    <div class="sw"><span>Intonation à chaque verset (sinon au premier seulement)</span><input type="checkbox" id="intEach" ${cp.intonationEach ? 'checked' : ''}></div>
    <div class="sw"><span>Afficher le nom des notes sous les syllabes</span><input type="checkbox" id="showNotes" ${cp.notes ? 'checked' : ''}></div>
    <div id="verses" style="margin-top:10px"></div>
    <button class="btn secondary" id="close" style="margin-top:14px">Fermer</button>
  </div>`;
  document.body.appendChild(bg);
  const q = sel => bg.querySelector(sel);
  const ROLE = { flex: '†', med: '*', term: '' };
  function renderVerses() {
    const t = Chant.toneById(cp.tone);
    q('#formula').textContent = `${t.name} — ${Chant.formula(t)}`;
    q('#verses').innerHTML = verses.map((v, vi) => `<div class="verse" data-v="${vi}">` + v.lines.map((l, li) => {
      const syls = Chant.pointLine(l.text, l.role, t, vi === 0 || cp.intonationEach);
      let html = `<span class="line">`;
      syls.forEach((s, si) => {
        const cls = ['syl', s.kind === 'acc' ? 'acc' : s.kind === 'cad' ? 'cad' : s.kind === 'int' ? 'int' : ''].filter(Boolean).join(' ');
        const sep = si > 0 ? (s.wordStart ? ' ' : `<span class="sep">-${cp.notes ? '<small></small>' : ''}</span>`) : '';
        const note = cp.notes ? `<small>${s.kind !== 'ten' ? s.notes.map(Chant.noteName).join(' ') : ''}</small>` : '';
        html += sep + `<span class="${cls}" data-v="${vi}" data-l="${li}" data-s="${si}">${esc(s.text)}${note}</span>`;
      });
      if (l.role === 'flex') html += ' <span class="role">†</span>';
      return html + '</span>';
    }).join('') + '</div>').join('');
    bg.querySelectorAll('.verse').forEach(el => el.onclick = () => singFrom(+el.dataset.v));
  }
  let lastSyl = null;
  const opts = () => ({ transpose: cp.transpose, tempo: cp.tempo, drone: cp.drone, intonationEachVerse: cp.intonationEach,
    timbre: cp.timbre, speak: cp.speak, speakVoice: Speech.pickVoice(),
    onVerse: vi => { bg.querySelectorAll('.verse').forEach(el => el.classList.toggle('cur', +el.dataset.v === vi)); const el = bg.querySelector(`.verse[data-v="${vi}"]`); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); },
    onSyllable: (vi, li, si) => { if (lastSyl) lastSyl.classList.remove('now'); lastSyl = bg.querySelector(`.syl[data-v="${vi}"][data-l="${li}"][data-s="${si}"]`); if (lastSyl) lastSyl.classList.add('now'); },
    onEnd: () => { if (lastSyl) lastSyl.classList.remove('now'); bg.querySelectorAll('.verse').forEach(el => el.classList.remove('cur')); },
  });
  q('#tone').onchange = e => { cp.tone = e.target.value; save(); renderVerses(); if (Chant.isPlaying()) Chant.sing(verses, cp.tone, opts()); };
  q('#timbre').onchange = e => { cp.timbre = e.target.value; save(); };
  q('#speakWords').onchange = e => { cp.speak = e.target.checked; save(); };
  q('#tr').oninput = e => { cp.transpose = +e.target.value; q('#lblTr').textContent = 'Hauteur : ' + trText(cp.transpose); };
  q('#tr').onchange = () => save();
  q('#tempo').oninput = e => { cp.tempo = +e.target.value; q('#lblTempo').textContent = `Allure : ${cp.tempo} syllabes / min`; };
  q('#tempo').onchange = () => save();
  q('#drone').onchange = e => { cp.drone = e.target.checked; save(); };
  q('#intEach').onchange = e => { cp.intonationEach = e.target.checked; save(); renderVerses(); };
  q('#showNotes').onchange = e => { cp.notes = e.target.checked; save(); renderVerses(); };
  q('#playTone').onclick = () => Chant.playTone(cp.tone, opts());
  q('#sing').onclick = () => Chant.sing(verses, cp.tone, opts());
  q('#stopChant').onclick = () => { Chant.stop(); opts().onEnd(); };
  function singFrom(vi) {
    const o = opts();
    Chant.sing(verses.slice(vi), cp.tone, Object.assign({}, o, { intonationEachVerse: cp.intonationEach || vi === 0, onVerse: i => o.onVerse(i + vi), onSyllable: (i, li, si) => o.onSyllable(i + vi, li, si) }));
  }
  renderVerses();
  const close = () => { Chant.stop(); bg.remove(); };
  q('#close').onclick = close;
  bg.onclick = e => { if (e.target === bg) close(); };
}

// ---- Réglages
function renderSettings() {
  if (unsubHome) { unsubHome(); unsubHome = null; }
  const sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const sw = (id, val) => `<input type="checkbox" id="${id}" ${val ? 'checked' : ''} style="width:22px;height:22px">`;
  app.innerHTML = header('Réglages', null, `<button class="icon-btn" id="back">${I.back}</button>`) + `
  <main class="settings">
    <h2 class="section">Calendrier liturgique</h2>
    <div class="card"><div class="row"><span>Calendrier (zone)</span>${sel('zone', ZONES, prefs.zone)}</div></div>
    <h2 class="section">Affichage</h2>
    <div class="card">
      <div class="row"><span>Thème</span>${sel('theme', [['system', 'Comme le téléphone'], ['light', 'Clair'], ['dark', 'Sombre']], prefs.theme)}</div>
      <div class="row"><span>Taille du texte</span>${sel('fontSize', [['small', 'Petite'], ['normal', 'Normale'], ['large', 'Grande'], ['xlarge', 'Très grande']], prefs.fontSize)}</div>
      <div class="row"><span>Afficher les numéros de versets</span>${sw('showVerses', prefs.showVerses)}</div>
    </div>
    <h2 class="section">Contenu des offices</h2>
    <div class="card">
      <div class="row"><span>« Gloire au Père » après chaque psaume</span>${sw('gloria', prefs.gloria)}</div>
      <div class="row"><span>Reprendre l'antienne après le psaume</span>${sw('repeatAntienne', prefs.repeatAntienne)}</div>
    </div>
    <h2 class="section">Lecture à voix haute</h2>
    <div class="card">
      <div class="row"><span>Annoncer le titre de chaque partie</span>${sw('readTitles', prefs.readTitles)}</div>
      <div class="row"><span>Annoncer « Verset » et « Répons »</span>${sw('sayMarks', prefs.sayMarks)}</div>
      <div class="row"><span>Garder l'écran allumé pendant la lecture</span>${sw('keepAwake', prefs.keepAwake)}</div>
      <div class="row"><span>Voix, vitesse, hauteur</span><button class="btn small" id="voiceBtn">${I.tune} Ouvrir</button></div>
    </div>
    <h2 class="section">Hors connexion</h2>
    <div class="card">
      <div class="row"><span>Télécharger à l'avance</span>${sel('prefetchDays', [[0, 'Aucun'], [3, '3 jours'], [7, '7 jours'], [14, '14 jours']], prefs.prefetchDays)}</div>
      <div class="row"><span>Textes conservés</span><button class="btn small secondary" id="clear">Vider</button></div>
    </div>
    <h2 class="section">À propos</h2>
    <div class="card"><div class="row" style="display:block;font-size:14px;color:var(--muted)">Bréviaire — Liturgie des Heures lue à voix haute.<br>Textes : AELF, Association Épiscopale Liturgique pour les pays Francophones (aelf.org).<br>Voix : synthèse vocale du navigateur.<br>Les textes consultés sont conservés sur l'appareil pour une lecture hors connexion.</div></div>
  </main>`;
  app.querySelector('#back').onclick = () => { location.hash = '#/'; };
  app.querySelector('#voiceBtn').onclick = () => openVoiceSheet();
  for (const id of ['zone', 'theme', 'fontSize', 'prefetchDays']) app.querySelector('#' + id).onchange = e => { prefs[id] = id === 'prefetchDays' ? +e.target.value : e.target.value; applyTheme(); if (id === 'zone') toast('Calendrier modifié'); };
  for (const id of ['showVerses', 'gloria', 'repeatAntienne', 'readTitles', 'sayMarks', 'keepAwake']) app.querySelector('#' + id).onchange = e => { prefs[id] = e.target.checked; if (id === 'readTitles' || id === 'sayMarks') Speech.settingsChanged(true); };
  app.querySelector('#clear').onclick = async () => { if ('caches' in window) { await caches.delete('aelf-data'); } toast('Textes supprimés'); };
}

// ------------------------------------------------------------------ démarrage
applyTheme();
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
