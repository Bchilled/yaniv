/* Yaniv ranked match simulator */
const $ = (id) => document.getElementById(id);

const state = {
  settings: null,
  game: null,
  phase: 'idle',
  selected: new Set(),
  mode: 'quick',
};

let installPrompt = null;

const NAMES = buildNames();

const DEFAULT_SETTINGS = {
  playerName: 'Player',
  players: 3,
  yanivLimit: 7,
  handSize: 5,
  discards: 'set',
  jokers: 'on',
  assaf: 30,
  end: 'elim',
  reset: 'off',
  aiStrength: 6,
  fakeRecords: 'on',
};

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

function saveSettings() {
  localStorage.setItem('yaniv.settings', JSON.stringify(state.settings));
}

function loadSettings() {
  const raw = localStorage.getItem('yaniv.settings');
  state.settings = raw ? JSON.parse(raw) : { ...DEFAULT_SETTINGS };
}

function saveStats(stats) {
  localStorage.setItem('yaniv.stats', JSON.stringify(stats));
}

function loadStats() {
  const raw = localStorage.getItem('yaniv.stats');
  return raw ? JSON.parse(raw) : { wins: 0, losses: 0, games: 0 };
}

function ratingFromStats(stats) {
  const base = 1000;
  const rating = base + stats.wins * 12 - stats.losses * 8;
  return clamp(rating, 600, 2600);
}

function showScreen(id) {
  ['screen-home', 'screen-settings', 'screen-game', 'screen-how', 'screen-rankings', 'screen-install', 'screen-rooms'].forEach((sid) => {
    $(sid).classList.toggle('hidden', sid !== id);
  });
}

function renderGlobalStats() {
  const stats = loadStats();
  const rating = ratingFromStats(stats);
  $('global-stats').textContent = `Games: ${stats.games} · Wins: ${stats.wins} · Losses: ${stats.losses} · Rating: ${rating}`;
  renderProfile(stats, rating);
}

function renderProfile(stats, rating) {
  const card = $('profile-card');
  if (!card) return;
  const games = stats.games || 0;
  const winRate = games ? Math.round((stats.wins / games) * 100) : 0;
  card.innerHTML = `
    <div style="font-weight:700; margin-bottom:6px;">${state.settings.playerName}</div>
    <div>Rating: <strong>${rating}</strong></div>
    <div>Record: ${stats.wins}-${stats.losses}</div>
    <div>Win Rate: ${winRate}%</div>
  `;
}

function applySettingsToUI() {
  $('opt-name').value = state.settings.playerName;
  $('opt-players').value = String(state.settings.players);
  $('opt-yaniv').value = String(state.settings.yanivLimit);
  $('opt-hand').value = String(state.settings.handSize);
  $('opt-discards').value = state.settings.discards;
  $('opt-jokers').value = state.settings.jokers;
  $('opt-assaf').value = String(state.settings.assaf);
  $('opt-end').value = state.settings.end;
  $('opt-reset').value = state.settings.reset;
  $('opt-ai').value = String(state.settings.aiStrength);
  $('opt-fake').value = state.settings.fakeRecords;
}

function readSettingsFromUI() {
  state.settings = {
    playerName: $('opt-name').value.trim() || 'Player',
    players: Number($('opt-players').value),
    yanivLimit: Number($('opt-yaniv').value),
    handSize: Number($('opt-hand').value),
    discards: $('opt-discards').value,
    jokers: $('opt-jokers').value,
    assaf: Number($('opt-assaf').value),
    end: $('opt-end').value,
    reset: $('opt-reset').value,
    aiStrength: Number($('opt-ai').value),
    fakeRecords: $('opt-fake').value,
  };
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
  if (state.settings.jokers !== 'off') {
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
  for (let i = 0; i < state.settings.handSize; i++) {
    for (const p of game.players) {
      p.hand.push(drawCard(game));
    }
  }
  game.discardPile.push(drawCard(game));
}

function createMatch(mode, room) {
  const stats = loadStats();
  const playerRating = ratingFromStats(stats);
  const strengthBias = (state.settings.aiStrength - 5) * 40;
  const opponents = [];
  const used = new Set([state.settings.playerName]);
  const pool = loadOpponentPool();

  for (let i = 1; i < state.settings.players; i++) {
    const opp = pickOpponent(pool, used, playerRating, room);
    used.add(opp.name);
    opponents.push(opp);
  }

  return {
    title: mode === 'ranked' ? room.title : 'Quick Match',
    playerRating,
    opponents,
  };
}

function createPlayers(match) {
  const players = [];
  players.push({ name: state.settings.playerName, isHuman: true, hand: [], score: 0, record: null, rating: match.playerRating });
  for (const opp of match.opponents) {
    players.push({ name: opp.name, isHuman: false, hand: [], score: 0, record: opp.record, rating: opp.rating });
  }
  return players;
}

function loadOpponentPool() {
  const raw = localStorage.getItem('yaniv.opponents');
  if (raw) return JSON.parse(raw);
  const pool = NAMES.map((name) => ({
    name,
    rating: randBetween(800, 2400),
    record: { wins: randBetween(10, 200), losses: randBetween(10, 200) },
  }));
  localStorage.setItem('yaniv.opponents', JSON.stringify(pool));
  return pool;
}

function saveOpponentPool(pool) {
  localStorage.setItem('yaniv.opponents', JSON.stringify(pool));
}

function pickOpponent(pool, used, playerRating, room) {
  let candidate = null;
  for (let i = 0; i < 40; i++) {
    const pick = pool[randBetween(0, pool.length - 1)];
    if (used.has(pick.name)) continue;
    if (room) {
      if (pick.rating < room.min || pick.rating > room.max) continue;
    } else {
      if (Math.abs(pick.rating - playerRating) > 400) continue;
    }
    candidate = pick;
    break;
  }
  if (!candidate) {
    candidate = pool.find((p) => !used.has(p.name)) || pool[0];
  }
  return candidate;
}

function decayOpponentRecords() {
  const pool = loadOpponentPool();
  for (let i = 0; i < pool.length; i += 25) {
    const p = pool[i];
    p.record.wins += randBetween(0, 2);
    p.record.losses += randBetween(0, 2);
  }
  saveOpponentPool(pool);
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function startGame(mode, room) {
  state.mode = mode;
  const match = createMatch(mode, room);
  state.game = {
    players: createPlayers(match),
    drawPile: makeDeck(),
    discardPile: [],
    turn: 0,
    round: 1,
    phase: 'discard',
    inRound: true,
    match,
  };
  deal(state.game);
  state.selected.clear();
  state.phase = 'player';
  renderGame();
  log(`Match found. Round ${state.game.round} starts.`);
}

function renderGame() {
  const game = state.game;
  if (!game) return;

  $('match-header').textContent = `Match: ${game.match.title} · Your Rating: ${game.match.playerRating} · Opponents: ${game.match.opponents.map((o) => o.name).join(', ')}`;

  const oppEl = $('opponents');
  oppEl.innerHTML = '';
  game.players.forEach((p, idx) => {
    if (p.isHuman) return;
    const div = document.createElement('div');
    div.className = 'opponent';
    const record = p.record ? ` · ${p.record.wins}-${p.record.losses}` : '';
    const rating = p.rating ? ` · Rating ${p.rating}` : '';
    div.textContent = `${p.name}${record}${rating} · Hand: ${p.hand.length} · Score: ${p.score}`;
    div.addEventListener('click', () => showProfile(p.name, p.record, p.rating));
    if (idx === game.turn && game.phase !== 'round-end') div.style.borderColor = 'var(--accent)';
    oppEl.appendChild(div);
  });

  const top = game.discardPile[game.discardPile.length - 1];
  renderCard($('discard-top'), top);
  $('draw-count').textContent = `${game.drawPile.length} cards`;

  const hand = $('player-hand');
  hand.innerHTML = '';
  game.players[0].hand.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'card';
    renderCard(div, c);
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
  if (suit === 'S') return '&spades;';
  if (suit === 'H') return '&hearts;';
  if (suit === 'D') return '&diams;';
  return '&clubs;';
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
  if (picks.length === 0) return log('Select cards to discard.');
  const cards = picks.map((p) => p.card);
  if (!isValidDiscard(cards)) return log('Invalid discard. Use sets or runs based on settings.');

  const hand = state.game.players[0].hand;
  const indexes = picks.map((p) => p.idx).sort((a,b) => b - a);
  indexes.forEach((i) => hand.splice(i, 1));
  cards.forEach((c) => state.game.discardPile.push(c));

  playSound('discard');
  state.selected.clear();
  state.game.phase = 'draw';
  log(`You discarded ${cards.length} card(s).`);
  renderGame();
}

function drawFromPile(which) {
  const game = state.game;
  if (game.turn !== 0 || game.phase !== 'draw') return;
  const card = which === 'discard'
    ? game.discardPile.pop()
    : drawCard(game);
  game.players[0].hand.push(card);
  playSound('draw');
  log(`You drew a card.`);
  endTurn();
}

function endTurn() {
  const game = state.game;
  game.phase = 'discard';
  game.turn = (game.turn + 1) % game.players.length;
  renderGame();
  if (game.turn !== 0) aiTurn();
  else log('Your turn.');
}

function aiTurn() {
  const game = state.game;
  const ai = game.players[game.turn];
  const total = handTotal(ai.hand);
  const willCall = total <= state.settings.yanivLimit && Math.random() < aiCallChance();
  if (willCall) {
    log(`${ai.name} calls Yaniv.`);
    resolveYaniv(game.turn);
    return;
  }

  const discard = aiChooseDiscard(ai.hand);
  discard.forEach((c) => {
    const idx = ai.hand.indexOf(c);
    if (idx >= 0) ai.hand.splice(idx, 1);
    game.discardPile.push(c);
  });
  log(`${ai.name} discards ${discard.length} card(s).`);

  const top = game.discardPile[game.discardPile.length - 1];
  const takeDiscard = shouldTakeDiscard(ai.hand, top);
  const drawn = takeDiscard ? game.discardPile.pop() : drawCard(game);
  ai.hand.push(drawn);
  log(`${ai.name} draws ${takeDiscard ? 'from discard' : 'a card'}.`);

  game.turn = (game.turn + 1) % game.players.length;
  renderGame();
  if (game.turn === 0) log('Your turn.');
  else setTimeout(aiTurn, 400);
}

function aiCallChance() {
  return 0.18 + state.settings.aiStrength * 0.065;
}

function aiChooseDiscard(hand) {
  const options = allDiscards(hand);
  if (options.length === 0) return [hand[0]];
  let best = options[0];
  let bestScore = -Infinity;
  for (const opt of options) {
    const remaining = hand.filter((c) => !opt.includes(c));
    const score = -handTotal(remaining) + opt.length * 0.4;
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  return best;
}

function shouldTakeDiscard(hand, top) {
  if (!top) return false;
  const current = handTotal(hand);
  const withTop = handTotal(hand.concat([top]));
  return withTop < current - 2;
}

function isValidDiscard(cards) {
  if (cards.length === 1) return true;
  if (isSet(cards)) return true;
  if (state.settings.discards === 'set-run' && isRun(cards)) return true;
  return false;
}

function isSet(cards) {
  const rank = cards[0].rank;
  return cards.every((c) => c.rank === rank);
}

function isRun(cards) {
  if (cards.length < 3) return false;
  const nonJokers = cards.filter((c) => c.rank !== 'Joker');
  if (nonJokers.length === 0) return state.settings.jokers === 'on-run';
  const suit = nonJokers[0].suit;
  if (!nonJokers.every((c) => c.suit === suit)) return false;
  const values = nonJokers.map(rankValue).sort((a,b) => a - b);
  for (let i = 1; i < values.length; i++) if (values[i] === values[i-1]) return false;

  const jokers = cards.length - nonJokers.length;
  if (jokers > 0 && state.settings.jokers !== 'on-run') return false;

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
  if (total > state.settings.yanivLimit) {
    return log(`Your total is ${total}. You can call Yaniv at ${state.settings.yanivLimit} or less.`);
  }
  playSound('yaniv');
  log('You call Yaniv.');
  resolveYaniv(0);
}

function resolveYaniv(callerIndex) {
  const game = state.game;
  const totals = game.players.map((p) => handTotal(p.hand));
  const callerTotal = totals[callerIndex];
  const assaf = totals.some((t, i) => i !== callerIndex && t <= callerTotal);

  for (let i = 0; i < game.players.length; i++) {
    if (i === callerIndex) {
      game.players[i].score += assaf ? callerTotal + state.settings.assaf : 0;
    } else {
      game.players[i].score += totals[i];
    }
  }

  const msg = assaf
    ? `Assaf! Caller gets +${state.settings.assaf}.`
    : 'Yaniv successful.';
  log(`${msg} Totals: ${totals.join(', ')}.`);

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
  if (state.settings.reset !== 'on') return;
  for (const p of state.game.players) {
    if (p.score === 100) p.score = 50;
    if (p.score === 200) p.score = 100;
  }
}

function checkGameEnd() {
  const game = state.game;
  if (state.settings.end === 'match') {
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
  const stats = loadStats();
  stats.games += 1;
  if (winner.isHuman) stats.wins += 1; else stats.losses += 1;
  saveStats(stats);
  renderGlobalStats();
  decayOpponentRecords();
  log(`Game over. Winner: ${winner.name}.`);
  alert(`Game over! Winner: ${winner.name}`);
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
  for (const group of byRank.values()) {
    if (group.length >= 2) options.push(group);
  }

  if (state.settings.discards === 'set-run') {
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

function renderRankings(mode = 'today') {
  const list = $('rankings-list');
  list.innerHTML = '';
  const stats = loadStats();
  const rating = ratingFromStats(stats);
  const pool = loadOpponentPool();
  const sorted = pool.slice().sort((a,b) => b.rating - a.rating);
  const top = sorted[0];

  const topRow = document.createElement('div');
  topRow.className = 'ranking-row';
  topRow.innerHTML = `<div class="rank">#1</div><div>${top.name}</div><div class="rating">${top.rating}</div><div class="record">${top.record.wins}-${top.record.losses}</div>`;
  list.appendChild(topRow);

  const yourRow = document.createElement('div');
  const yourRank = sorted.findIndex((p) => p.rating <= rating) + 1 || sorted.length + 1;
  yourRow.className = 'ranking-row';
  yourRow.innerHTML = `<div class="rank">#${yourRank}</div><div>${state.settings.playerName} (You)</div><div class="rating">${rating}</div><div class="record">${stats.wins}-${stats.losses}</div>`;
  list.appendChild(yourRow);

  $('tab-today').classList.toggle('active', mode === 'today');
  $('tab-all').classList.toggle('active', mode === 'all');
}

function renderRooms() {
  const rating = ratingFromStats(loadStats());
  const rooms = [
    { title: 'Bronze Room', min: 600, max: 1200, stake: 'Low' },
    { title: 'Silver Room', min: 1000, max: 1600, stake: 'Medium' },
    { title: 'Gold Room', min: 1400, max: 2000, stake: 'High' },
    { title: 'Platinum Room', min: 1800, max: 2400, stake: 'Elite' },
  ];

  const list = $('room-list');
  list.innerHTML = '';
  rooms.forEach((room) => {
    const div = document.createElement('div');
    div.className = 'room';
    div.innerHTML = `
      <div>
        <div class="room-title">${room.title}</div>
        <div class="room-meta">Rating ${room.min}-${room.max} · ${room.stake} Stakes</div>
      </div>
      <button class="primary">Join</button>
    `;
    div.querySelector('button').addEventListener('click', () => {
      startGame('ranked', room);
      showScreen('screen-game');
    });
    list.appendChild(div);
  });

  $('room-list').querySelectorAll('.room').forEach((el) => {
    const title = el.querySelector('.room-title').textContent;
    if (rating < 1200 && title.includes('Platinum')) el.style.opacity = '0.6';
  });
}

function showProfile(name, record, rating) {
  $('modal-title').textContent = name;
  $('modal-body').innerHTML = `
    <div>Rating: <strong>${rating || '-'}</strong></div>
    <div>Record: ${record ? `${record.wins}-${record.losses}` : '-'}</div>
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
  } catch (e) {
    // no-op
  }
}

function log(msg) {
  const el = $('log');
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] ${msg}\n` + el.textContent;
}

// Event wiring
$('btn-ranked').addEventListener('click', () => {
  renderRooms();
  showScreen('screen-rooms');
});
$('btn-quick').addEventListener('click', () => {
  startGame('quick', null);
  showScreen('screen-game');
});
$('btn-new').addEventListener('click', () => {
  if (state.game && !confirm('Start a new game? Current game will be lost.')) return;
  startGame('quick', null);
  showScreen('screen-game');
});
$('btn-rooms-back').addEventListener('click', () => showScreen('screen-home'));
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
  renderRankings('today');
  showScreen('screen-rankings');
});
$('btn-rankings-back').addEventListener('click', () => showScreen('screen-home'));
$('btn-install-back').addEventListener('click', () => showScreen('screen-home'));
$('tab-today').addEventListener('click', () => renderRankings('today'));
$('tab-all').addEventListener('click', () => renderRankings('all'));
$('btn-save').addEventListener('click', () => {
  readSettingsFromUI();
  saveSettings();
  renderGlobalStats();
  showScreen('screen-home');
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
  else log('Your turn.');
});
$('modal-close').addEventListener('click', hideModal);
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') hideModal(); });

// Initialize
loadSettings();
renderGlobalStats();
showScreen('screen-home');

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
