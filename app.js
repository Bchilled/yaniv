/* Yaniv app */
const $ = (id) => document.getElementById(id);

const state = {
  accounts: [],
  account: null,
  settings: null,
  stats: null,
  game: null,
  sessionRules: null,
  selected: new Set(),
  lang: 'en',
};

let installPrompt = null;

const DEFAULT_SETTINGS = {
  language: 'en',
  players: 3,
  yanivLimit: 7,
  handSize: 5,
  discards: 'set-run',
  jokers: 'on',
  assaf: 30,
  end: 'elim',
  reset: 'off',
};

const DEFAULT_STATS = { wins: 0, losses: 0, games: 0 };

const PRESETS = {
  classic: { yanivLimit: 7, handSize: 5, discards: 'set-run' },
  strict: { yanivLimit: 5, handSize: 5, discards: 'set' },
  relaxed: { yanivLimit: 7, handSize: 5, discards: 'set' },
};

const LANGUAGE_LIST = [
  { code: 'en', label: 'English' },
  { code: 'he', label: 'עברית' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ne', label: 'नेपाली' },
];

const NAMES = buildNames();

const i18nCache = new Map();
let i18n = {};

function buildNames() {
  const first = ['Ari','Lior','Noa','Tal','Yael','Maya','Eli','Nina','Oren','Rina','Ziv','Adi','Shai','Rafi','Dana','Lana','Ilan','Gali','Hila','Yoni','Erez','Liat','Noy','Gav','Roi','Omer','Shir','Neri','Bar','Rotem','Ido','Sivan','Ofir','Hadar','Nave','Yair','Elin','Hod','Dvir','Tali'];
  const last = ['Cohen','Levi','Mizrahi','Peretz','Bitan','Amar','Ben-Ami','Shalev','Barak','Arieli','Katz','Mor','Dayan','Zohar','Noy','Raz','Ben-David','Halevy','Efrat','Lind','Ofek','Gal','Shahar','Oz','Hadar'];
  const names = [];
  for (let i = 0; i < first.length; i++) {
    for (let j = 0; j < last.length; j++) {
      names.push(`${first[i]} ${last[j]}`);
      if (names.length >= 1000) return names;
    }
  }
  return names;
}

async function loadLanguage(lang) {
  if (i18nCache.has(lang)) {
    i18n = i18nCache.get(lang);
    return;
  }
  try {
    const res = await fetch(`i18n/${lang}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error('load failed');
    const data = await res.json();
    i18nCache.set(lang, data);
    i18n = data;
  } catch {
    if (lang !== 'en') return loadLanguage('en');
    i18n = {};
  }
}

function t(key) {
  return i18n[key] || key;
}

function tFmt(key, vars) {
  let s = t(key);
  Object.keys(vars).forEach((k) => {
    s = s.replaceAll(`{${k}}`, String(vars[k]));
  });
  return s;
}

function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = (state.lang === 'he' || state.lang === 'ar') ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
}

function buildLanguageOptions() {
  const sel = $('opt-lang');
  sel.innerHTML = '';
  LANGUAGE_LIST.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = l.label;
    sel.appendChild(opt);
  });
}

function showScreen(id) {
  ['screen-login', 'screen-home', 'screen-quick', 'screen-settings', 'screen-game', 'screen-how', 'screen-rankings', 'screen-install'].forEach((sid) => {
    $(sid).classList.toggle('hidden', sid !== id);
  });
}

function showOverlay(text) {
  $('overlay-text').textContent = text;
  $('overlay').classList.remove('hidden');
}

function hideOverlay() {
  $('overlay').classList.add('hidden');
}

function loadAccounts() {
  const raw = localStorage.getItem('yaniv.accounts');
  state.accounts = raw ? JSON.parse(raw) : [];
  const currentId = localStorage.getItem('yaniv.account.current');
  const account = state.accounts.find((a) => a.id === currentId) || null;
  setCurrentAccount(account);
}

function saveAccounts() {
  localStorage.setItem('yaniv.accounts', JSON.stringify(state.accounts));
  if (state.account) localStorage.setItem('yaniv.account.current', state.account.id);
}

function setCurrentAccount(account) {
  state.account = account;
  if (!account) {
    state.settings = { ...DEFAULT_SETTINGS };
    state.stats = { ...DEFAULT_STATS };
    state.lang = state.settings.language || 'en';
    return;
  }
  state.settings = { ...DEFAULT_SETTINGS, ...account.settings };
  state.stats = { ...DEFAULT_STATS, ...account.stats };
  state.lang = state.settings.language || 'en';
}

function createAccount(name, email) {
  const id = `acc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const legacyStats = safeParse(localStorage.getItem('yaniv.stats')) || null;
  const legacySettings = safeParse(localStorage.getItem('yaniv.settings')) || null;
  const account = {
    id,
    name,
    email,
    createdAt: new Date().toISOString(),
    stats: legacyStats || { ...DEFAULT_STATS },
    settings: { ...DEFAULT_SETTINGS, ...(legacySettings || {}), language: state.lang },
  };
  state.accounts.push(account);
  setCurrentAccount(account);
  saveAccounts();
}

function signIn(name, email) {
  const match = state.accounts.find((a) =>
    (email && a.email && a.email.toLowerCase() === email.toLowerCase()) ||
    (!email && a.name.toLowerCase() === name.toLowerCase())
  );
  if (!match) return false;
  setCurrentAccount(match);
  saveAccounts();
  return true;
}

function logout() {
  localStorage.removeItem('yaniv.account.current');
  setCurrentAccount(null);
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function saveSettings() {
  if (!state.account) return;
  state.account.settings = { ...state.settings };
  saveAccounts();
}

function saveStats() {
  if (!state.account) return;
  state.account.stats = { ...state.stats };
  saveAccounts();
}

function ratingFromStats(stats) {
  const base = 1000;
  const rating = base + stats.wins * 12 - stats.losses * 8;
  return clamp(rating, 600, 2600);
}

function difficultyStrength() {
  const rating = ratingFromStats(state.stats);
  const scaled = Math.round(3 + (rating - 600) / 250);
  return clamp(scaled, 3, 10);
}

function aiSkillForOpponent(rating) {
  const norm = clamp((rating - 600) / 2000, 0, 1);
  return 0.4 + norm * 0.6;
}

function renderGlobalStats() {
  const rating = ratingFromStats(state.stats);
  $('global-stats').textContent = `${t('label_games')}: ${state.stats.games} · ${t('label_wins')}: ${state.stats.wins} · ${t('label_losses')}: ${state.stats.losses} · ${t('label_rating')}: ${rating}`;
  renderProfile();
}

function renderProfile() {
  const card = $('profile-card');
  if (!card) return;
  const games = state.stats.games || 0;
  const winRate = games ? Math.round((state.stats.wins / games) * 100) : 0;
  const rating = ratingFromStats(state.stats);
  card.innerHTML = `
    <div style="font-weight:700; margin-bottom:6px;">${state.account ? state.account.name : t('label_guest')}</div>
    <div>${t('label_rating')}: <strong>${rating}</strong></div>
    <div>${t('label_record')}: ${state.stats.wins}-${state.stats.losses}</div>
    <div>${t('label_winrate')}: ${winRate}%</div>
  `;
}

function applySettingsToUI() {
  $('opt-lang').value = state.lang;
  $('opt-players').value = String(state.settings.players);
  $('opt-yaniv').value = String(state.settings.yanivLimit);
  $('opt-hand').value = String(state.settings.handSize);
  $('opt-discards').value = state.settings.discards;
  $('opt-jokers').value = state.settings.jokers;
  $('opt-assaf').value = String(state.settings.assaf);
  $('opt-end').value = state.settings.end;
  $('opt-reset').value = state.settings.reset;
}

function readSettingsFromUI() {
  state.settings = {
    ...state.settings,
    language: $('opt-lang').value,
    players: Number($('opt-players').value),
    yanivLimit: Number($('opt-yaniv').value),
    handSize: Number($('opt-hand').value),
    discards: $('opt-discards').value,
    jokers: $('opt-jokers').value,
    assaf: Number($('opt-assaf').value),
    end: $('opt-end').value,
    reset: $('opt-reset').value,
  };
  state.lang = state.settings.language || 'en';
}

function rules() {
  return state.sessionRules || state.settings;
}

const actionLog = [];

function log(msg) {
  const el = $('log');
  const time = new Date().toLocaleTimeString();
  actionLog.unshift(`[${time}] ${msg}`);
  while (actionLog.length > 6) actionLog.pop();
  el.textContent = actionLog.join('\n');
}

function makeDeck() {
  const suits = ['S', 'H', 'D', 'C'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) {
    for (let i = 0; i < ranks.length; i++) {
      deck.push({ rank: ranks[i], suit: s, value: i === 0 ? 1 : i >= 10 ? 10 : i + 1, id: `${ranks[i]}${s}` });
    }
  }
  if (rules().jokers !== 'off') {
    deck.push({ rank: 'Joker', suit: '*', value: 0, id: 'Joker1' });
    deck.push({ rank: 'Joker', suit: '*', value: 0, id: 'Joker2' });
  }
  return shuffle(deck);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawCard(game) {
  if (game.drawPile.length === 0) {
    const top = game.discardPile.pop();
    game.drawPile = shuffle(game.discardPile);
    game.discardPile = [top];
  }
  return game.drawPile.pop();
}

function deal(game) {
  for (let i = 0; i < rules().handSize; i++) {
    for (const p of game.players) {
      p.hand.push(drawCard(game));
    }
  }
  game.discardPile.push(drawCard(game));
}

function loadOpponentPool() {
  const raw = localStorage.getItem('yaniv.opponents');
  if (raw) return JSON.parse(raw);
  const pool = NAMES.map((name) => ({
    name,
    rating: randBetween(800, 2400),
    record: { wins: randBetween(10, 200), losses: randBetween(10, 200) },
    lastSeen: Date.now() - randBetween(10, 300) * 60000,
  }));
  localStorage.setItem('yaniv.opponents', JSON.stringify(pool));
  return pool;
}

function saveOpponentPool(pool) {
  localStorage.setItem('yaniv.opponents', JSON.stringify(pool));
}

function tickOpponents() {
  const pool = loadOpponentPool();
  for (let i = 0; i < pool.length; i += 25) {
    const p = pool[i];
    p.record.wins += randBetween(0, 2);
    p.record.losses += randBetween(0, 2);
    p.rating = clamp(p.rating + randBetween(-12, 16), 600, 2600);
    p.lastSeen = Date.now() - randBetween(1, 240) * 60000;
  }
  saveOpponentPool(pool);
}

function pickOpponent(pool, used, playerRating) {
  let candidate = null;
  for (let i = 0; i < 60; i++) {
    const pick = pool[randBetween(0, pool.length - 1)];
    if (used.has(pick.name)) continue;
    if (Math.abs(pick.rating - playerRating) > 500) continue;
    candidate = pick;
    break;
  }
  if (!candidate) candidate = pool.find((p) => !used.has(p.name)) || pool[0];
  return candidate;
}

function createMatch() {
  const playerRating = ratingFromStats(state.stats);
  const opponents = [];
  const used = new Set([state.account.name]);
  const pool = loadOpponentPool();
  for (let i = 1; i < rules().players; i++) {
    const opp = pickOpponent(pool, used, playerRating);
    used.add(opp.name);
    opponents.push(opp);
  }
  return { playerRating, opponents };
}

function createPlayers(match) {
  const players = [];
  players.push({ name: state.account.name, isHuman: true, hand: [], score: 0, rating: match.playerRating });
  for (const opp of match.opponents) {
    players.push({ name: opp.name, isHuman: false, hand: [], score: 0, rating: opp.rating, record: opp.record, lastSeen: opp.lastSeen });
  }
  return players;
}

function startGame() {
  const match = createMatch();
  state.game = {
    players: createPlayers(match),
    drawPile: makeDeck(),
    discardPile: [],
    turn: 0,
    round: 1,
    phase: 'discard',
    match,
  };
  deal(state.game);
  state.selected.clear();
  renderGame(true);
  log(t('msg_round_start'));
}

function renderGame(isDeal = false) {
  const game = state.game;
  if (!game) return;

  $('match-header').textContent = tFmt('match_header', { rating: game.match.playerRating, names: game.match.opponents.map((o) => o.name).join(', ') });

  const oppEl = $('opponents');
  oppEl.innerHTML = '';
  game.players.forEach((p, idx) => {
    if (p.isHuman) return;
    const div = document.createElement('div');
    div.className = 'opponent';
    const rating = p.rating ? ` · ${t('label_rating')} ${p.rating}` : '';
    div.textContent = `${p.name}${rating} · ${t('label_hand')} ${p.hand.length} · ${t('label_score')} ${p.score}`;
    div.addEventListener('click', () => showProfile(p.name, p.record, p.rating, p.lastSeen));
    if (idx === game.turn && game.phase !== 'round-end') div.style.borderColor = 'var(--accent)';
    oppEl.appendChild(div);
  });

  const top = game.discardPile[game.discardPile.length - 1];
  renderCard($('discard-top'), top);
  $('draw-count').textContent = `${game.drawPile.length} ${t('label_cards')}`;

  const hand = $('player-hand');
  hand.innerHTML = '';
  game.players[0].hand.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'card';
    renderCard(div, c);
    if (isDeal) div.classList.add('deal');
    if (state.selected.has(idx)) div.classList.add('selected');
    div.addEventListener('click', () => toggleSelect(idx));
    hand.appendChild(div);
  });

  $('btn-discard').disabled = game.turn !== 0 || game.phase !== 'discard';
  $('btn-draw').disabled = game.turn !== 0 || game.phase !== 'draw';
  $('btn-take').disabled = game.turn !== 0 || game.phase !== 'draw';
  $('btn-yaniv').disabled = game.turn !== 0 || game.phase !== 'discard';
  $('btn-next').classList.toggle('hidden', game.phase !== 'round-end');
}

function renderCard(el, card) {
  if (!card) {
    el.innerHTML = '';
    return;
  }
  if (card.rank === 'Joker') {
    el.innerHTML = `<div class="card-rank top">J</div><div class="card-suit">★</div><div class="card-rank bottom">J</div>`;
    el.classList.remove('red');
    return;
  }
  const suit = suitSymbol(card.suit);
  const isRed = card.suit === 'H' || card.suit === 'D';
  el.innerHTML = `<div class="card-rank top">${card.rank}</div><div class="card-suit">${suit}</div><div class="card-rank bottom">${card.rank}</div>`;
  el.classList.toggle('red', isRed);
}

function suitSymbol(suit) {
  if (suit === 'S') return '♠';
  if (suit === 'H') return '♥';
  if (suit === 'D') return '♦';
  return '♣';
}

function toggleSelect(idx) {
  if (state.game.turn !== 0 || state.game.phase !== 'discard') return;
  if (state.selected.has(idx)) state.selected.delete(idx);
  else state.selected.add(idx);
  renderGame();
}

function selectedCards() {
  const hand = state.game.players[0].hand;
  return Array.from(state.selected).map((i) => ({ card: hand[i], idx: i }));
}

function discardSelected() {
  const picks = selectedCards();
  if (picks.length === 0) return log(t('msg_select_cards'));
  const cards = picks.map((p) => p.card);
  if (!isValidDiscard(cards)) return log(t('msg_invalid_discard'));

  const hand = state.game.players[0].hand;
  const indexes = picks.map((p) => p.idx).sort((a,b) => b - a);
  indexes.forEach((i) => hand.splice(i, 1));
  cards.forEach((c) => state.game.discardPile.push(c));

  playSound('discard');
  state.selected.clear();
  state.game.phase = 'draw';
  log(tFmt('msg_discarded', { count: cards.length }));
  renderGame();
}

function drawFromPile(which) {
  const game = state.game;
  if (game.turn !== 0 || game.phase !== 'draw') return;
  const card = which === 'discard' ? game.discardPile.pop() : drawCard(game);
  game.players[0].hand.push(card);
  playSound('draw');
  log(t('msg_drew'));
  endTurn();
}

function endTurn() {
  const game = state.game;
  game.phase = 'discard';
  game.turn = (game.turn + 1) % game.players.length;
  renderGame();
  if (game.turn !== 0) aiTurn();
  else log(t('msg_your_turn'));
}

function maybeDisconnectWin() {
  const chance = Math.random();
  if (chance < 0.01) {
    state.stats.games += 1;
    state.stats.wins += 1;
    saveStats();
    renderGlobalStats();
    alert(t('msg_disconnect_win'));
    showScreen('screen-home');
    return true;
  }
  return false;
}

function aiTurn() {
  const game = state.game;
  if (maybeDisconnectWin()) return;
  const ai = game.players[game.turn];
  const skill = aiSkillForOpponent(ai.rating || 1400);
  const total = handTotal(ai.hand);

  const callChance = 0.1 + skill * 0.75;
  const willCall = total <= rules().yanivLimit && Math.random() < callChance;

  const thinkDelay = randBetween(400, 1400);
  setTimeout(() => {
    if (willCall) {
      log(`${ai.name} ${t('msg_calls')}`);
      resolveYaniv(game.turn);
      return;
    }

    const discard = aiChooseDiscard(ai.hand, skill);
    discard.forEach((c) => {
      const idx = ai.hand.indexOf(c);
      if (idx >= 0) ai.hand.splice(idx, 1);
      game.discardPile.push(c);
    });
    log(`${ai.name} ${t('msg_discarded_ai')}`);

    const top = game.discardPile[game.discardPile.length - 1];
    const takeDiscard = shouldTakeDiscard(ai.hand, top, skill);
    const drawDelay = randBetween(350, 1100);
    setTimeout(() => {
      const drawn = takeDiscard ? game.discardPile.pop() : drawCard(game);
      ai.hand.push(drawn);
      log(`${ai.name} ${takeDiscard ? t('msg_took') : t('msg_drew_ai')}`);
      game.turn = (game.turn + 1) % game.players.length;
      renderGame();
      if (game.turn === 0) log(t('msg_your_turn'));
      else aiTurn();
    }, drawDelay);
  }, thinkDelay);
}

function aiChooseDiscard(hand, skill) {
  const options = allDiscards(hand);
  if (options.length === 0) return [hand[0]];
  if (skill < 0.5) return options[randBetween(0, options.length - 1)];

  let best = options[0];
  let bestScore = -Infinity;
  for (const opt of options) {
    const remaining = hand.filter((c) => !opt.includes(c));
    const score = -handTotal(remaining) + opt.length * 0.4;
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  if (skill < 0.7 && Math.random() < 0.35) {
    return options[randBetween(0, options.length - 1)];
  }
  return best;
}

function shouldTakeDiscard(hand, top, skill) {
  if (!top) return false;
  const current = handTotal(hand);
  const withTop = handTotal(hand.concat([top]));
  const improvement = current - withTop;
  const threshold = skill > 0.8 ? 1 : skill > 0.6 ? 2 : 3;
  return improvement >= threshold;
}

function isValidDiscard(cards) {
  if (cards.length === 1) return true;
  if (isSet(cards)) return true;
  if (rules().discards === 'set-run' && isRun(cards)) return true;
  return false;
}

function isSet(cards) {
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

function isRun(cards) {
  if (cards.length < 3) return false;
  const nonJokers = cards.filter((c) => c.rank !== 'Joker');
  if (nonJokers.length === 0) return rules().jokers === 'on-run';
  const suit = nonJokers[0].suit;
  if (!nonJokers.every((c) => c.suit === suit)) return false;
  const values = nonJokers.map(rankValue).sort((a,b) => a - b);
  for (let i = 1; i < values.length; i++) if (values[i] === values[i-1]) return false;

  const jokers = cards.length - nonJokers.length;
  if (jokers > 0 && rules().jokers !== 'on-run') return false;

  let gaps = 0;
  for (let i = 1; i < values.length; i++) gaps += (values[i] - values[i-1] - 1);
  return gaps <= jokers;
}

function rankValue(card) {
  if (card.rank === 'A') return 1;
  if (card.rank === 'J') return 11;
  if (card.rank === 'Q') return 12;
  if (card.rank === 'K') return 13;
  if (card.rank === 'Joker') return 0;
  return Number(card.rank);
}

function handTotal(hand) {
  return hand.reduce((sum, c) => sum + c.value, 0);
}

function callYaniv() {
  const total = handTotal(state.game.players[0].hand);
  if (total > rules().yanivLimit) {
    return log(tFmt('msg_too_high', { total, limit: rules().yanivLimit }));
  }
  playSound('yaniv');
  log(t('msg_you_call'));
  resolveYaniv(0);
}

function resolveYaniv(callerIndex) {
  const game = state.game;
  const totals = game.players.map((p) => handTotal(p.hand));
  const callerTotal = totals[callerIndex];
  const assaf = totals.some((t, i) => i !== callerIndex && t <= callerTotal);

  for (let i = 0; i < game.players.length; i++) {
    if (i === callerIndex) {
      game.players[i].score += assaf ? callerTotal + rules().assaf : 0;
    } else {
      game.players[i].score += totals[i];
    }
  }

  const msg = assaf ? t('msg_assaf') : t('msg_yaniv_success');
  log(`${msg} ${t('msg_totals')} ${totals.join(', ')}.`);

  applyResets();
  const ended = checkGameEnd();
  if (ended) return;

  game.round += 1;
  game.drawPile = makeDeck();
  game.discardPile = [];
  game.players.forEach((p) => p.hand = []);
  deal(game);
  game.turn = (callerIndex + 1) % game.players.length;
  game.phase = 'round-end';
  renderGame();
}

function applyResets() {
  if (rules().reset !== 'on') return;
  for (const p of state.game.players) {
    if (p.score === 100) p.score = 50;
    if (p.score === 200) p.score = 100;
  }
}

function checkGameEnd() {
  const game = state.game;
  if (rules().end === 'match') {
    const winner = game.players.reduce((a,b) => (a.score < b.score ? a : b));
    if (game.players.some((p) => p.score >= 200)) {
      finishMatch(winner);
      return true;
    }
    return false;
  }

  const alive = game.players.filter((p) => p.score < 200);
  if (alive.length === 1) {
    finishMatch(alive[0]);
    return true;
  }
  return false;
}

function finishMatch(winner) {
  state.stats.games += 1;
  if (winner.isHuman) state.stats.wins += 1; else state.stats.losses += 1;
  saveStats();
  tickOpponents();
  renderGlobalStats();
  log(tFmt('msg_game_over', { name: winner.name }));
  alert(tFmt('msg_game_over', { name: winner.name }));
  showScreen('screen-home');
}

function allDiscards(hand) {
  const options = [];
  for (const c of hand) options.push([c]);

  const byRank = new Map();
  for (const c of hand) {
    const r = c.rank;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(c);
  }
  for (const group of byRank.values()) if (group.length >= 2) options.push(group);

  if (rules().discards === 'set-run') {
    const bySuit = new Map();
    for (const c of hand) {
      if (c.rank === 'Joker') continue;
      if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
      bySuit.get(c.suit).push(c);
    }
    for (const group of bySuit.values()) {
      const sorted = group.slice().sort((a,b) => rankValue(a) - rankValue(b));
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 2; j < sorted.length; j++) {
          const subset = sorted.slice(i, j + 1);
          if (isRun(subset)) options.push(subset);
        }
      }
    }
  }

  return options;
}

function renderRankings() {
  const list = $('rankings-list');
  list.innerHTML = '';
  const rating = ratingFromStats(state.stats);
  const pool = loadOpponentPool();
  const sorted = pool.slice().sort((a,b) => b.rating - a.rating);
  const top = sorted[0];

  const topRow = document.createElement('div');
  topRow.className = 'ranking-row';
  topRow.innerHTML = `<div class="rank">#1</div><div>${top.name}</div><div class="rating">${top.rating}</div>`;
  list.appendChild(topRow);

  const yourRow = document.createElement('div');
  const yourRank = sorted.findIndex((p) => p.rating <= rating) + 1 || sorted.length + 1;
  yourRow.className = 'ranking-row';
  yourRow.innerHTML = `<div class="rank">#${yourRank}</div><div>${state.account.name} (${t('label_you')})</div><div class="rating">${rating}</div>`;
  list.appendChild(yourRow);
}

function showProfile(name, record, rating, lastSeen) {
  $('modal-title').textContent = name;
  const minutes = Math.max(1, Math.round((Date.now() - (lastSeen || Date.now())) / 60000));
  $('modal-body').innerHTML = `
    <div>${t('label_rating')}: <strong>${rating || '-'}</strong></div>
    <div>${t('label_record')}: ${record ? `${record.wins}-${record.losses}` : '-'}</div>
    <div>${t('label_last_seen')}: ${minutes} ${t('label_minutes')}</div>
  `;
  $('modal').classList.remove('hidden');
}

function hideModal() {
  $('modal').classList.add('hidden');
}

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    const freq = type === 'yaniv' ? 740 : type === 'discard' ? 520 : 440;
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 120);
  } catch {}
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function startQuickFlow(presetId) {
  const jokersOn = $('opt-quick-jokers').checked ? 'on' : 'off';
  state.sessionRules = { ...state.settings, ...PRESETS[presetId], jokers: jokersOn, players: 2 };
  showOverlay(t('msg_connecting'));
  const delay = 900 + Math.floor(Math.random() * 1600);
  setTimeout(() => {
    if (maybeDisconnectWin()) {
      hideOverlay();
      return;
    }
    startGame();
    hideOverlay();
    showScreen('screen-game');
  }, delay);
}

function updatePresetDescriptions() {
  const jokersOn = $('opt-quick-jokers').checked ? 'On' : 'Off';
  document.querySelectorAll('#preset-list .room-meta').forEach((el) => {
    const base = el.getAttribute('data-base') || el.textContent;
    el.textContent = `${base} · Jokers: ${jokersOn}`;
  });
}

// Event wiring
$('btn-login').addEventListener('click', () => {
  const name = $('login-name').value.trim();
  const email = $('login-email').value.trim();
  if (!name) return alert(t('msg_need_name'));
  showOverlay(t('msg_creating'));
  setTimeout(async () => {
    createAccount(name, email);
    await loadLanguage(state.lang);
    applyTranslations();
    renderGlobalStats();
    hideOverlay();
    showScreen('screen-home');
  }, 700);
});

$('btn-signin').addEventListener('click', () => {
  const name = $('login-name').value.trim();
  const email = $('login-email').value.trim();
  showOverlay(t('msg_signing_in'));
  setTimeout(async () => {
    const ok = signIn(name, email);
    hideOverlay();
    if (!ok) return alert(t('msg_account_not_found'));
    await loadLanguage(state.lang);
    applyTranslations();
    renderGlobalStats();
    showScreen('screen-home');
  }, 600);
});

$('btn-quick').addEventListener('click', () => showScreen('screen-quick'));
$('btn-quick-back').addEventListener('click', () => showScreen('screen-home'));
$('opt-quick-jokers').addEventListener('change', updatePresetDescriptions);

Array.from(document.querySelectorAll('.preset')).forEach((card) => {
  const preset = card.getAttribute('data-preset');
  card.querySelector('button').addEventListener('click', () => startQuickFlow(preset));
});

$('btn-new').addEventListener('click', () => {
  if (state.game && !confirm(t('msg_new_game'))) return;
  showScreen('screen-quick');
});

$('btn-settings').addEventListener('click', () => {
  applySettingsToUI();
  showScreen('screen-settings');
});
$('btn-settings-home').addEventListener('click', () => {
  applySettingsToUI();
  showScreen('screen-settings');
});
$('btn-how').addEventListener('click', () => showScreen('screen-how'));
$('btn-back').addEventListener('click', () => showScreen('screen-home'));
$('btn-rankings').addEventListener('click', () => {
  renderRankings();
  showScreen('screen-rankings');
});
$('btn-rankings-back').addEventListener('click', () => showScreen('screen-home'));
$('btn-install-back').addEventListener('click', () => showScreen('screen-home'));
$('btn-switch').addEventListener('click', () => {
  if (!confirm(t('msg_switch_account'))) return;
  logout();
  showScreen('screen-login');
});

$('btn-save').addEventListener('click', () => {
  readSettingsFromUI();
  saveSettings();
  loadLanguage(state.lang).then(() => {
    applyTranslations();
    renderGlobalStats();
    showScreen('screen-home');
  });
});
$('btn-cancel').addEventListener('click', () => showScreen('screen-home'));

$('btn-discard').addEventListener('click', discardSelected);
$('btn-draw').addEventListener('click', () => drawFromPile('draw'));
$('btn-take').addEventListener('click', () => drawFromPile('discard'));
$('btn-yaniv').addEventListener('click', callYaniv);
$('btn-next').addEventListener('click', () => {
  state.game.phase = 'discard';
  renderGame();
  if (state.game.turn !== 0) aiTurn();
  else log(t('msg_your_turn'));
});

$('modal-close').addEventListener('click', hideModal);
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') hideModal(); });

document.querySelectorAll('#emoji-bar .emoji').forEach((btn) => {
  btn.addEventListener('click', () => {
    const emoji = btn.getAttribute('data-emoji');
    log(`${t('msg_you_sent')} ${emoji}`);
    setTimeout(() => {
      const replies = ['⏳','😊','👋','😁','😠','😢','🏆'];
      const pick = replies[Math.floor(Math.random() * replies.length)];
      log(`${t('msg_opp_sent')} ${pick}`);
    }, 600 + Math.random() * 800);
  });
});

$('btn-emoji').addEventListener('click', () => {
  $('emoji-wheel').classList.toggle('hidden');
});

document.querySelectorAll('#emoji-wheel .emoji').forEach((btn) => {
  btn.addEventListener('click', () => {
    $('emoji-wheel').classList.add('hidden');
    const emoji = btn.getAttribute('data-emoji');
    log(`${t('msg_you_sent')} ${emoji}`);
    setTimeout(() => {
      const replies = ['⏳','😊','👋','😁','😠','😢','🏆'];
      const pick = replies[Math.floor(Math.random() * replies.length)];
      log(`${t('msg_opp_sent')} ${pick}`);
    }, 600 + Math.random() * 800);
  });
});

// Initialize
loadAccounts();
buildLanguageOptions();
loadLanguage(state.lang).then(() => {
  applyTranslations();
  renderGlobalStats();
  hideModal();
  tickOpponents();
  updatePresetDescriptions();
  showScreen(state.account ? 'screen-home' : 'screen-login');
});

// Install prompt (Android Chrome)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('btn-install').classList.remove('hidden');
});

$('btn-install').addEventListener('click', async () => {
  if (!installPrompt) {
    showScreen('screen-install');
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('btn-install').classList.add('hidden');
});
