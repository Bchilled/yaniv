/* Yaniv ranked match simulator */
const $ = (id) => document.getElementById(id);

const state = {
  settings: null,
  game: null,
  phase: 'idle',
  selected: new Set(),
};

let installPrompt = null;

const NAMES = [
  'Ariel', 'Lior', 'Noam', 'Tal', 'Yael', 'Maya', 'Eli', 'Nina', 'Oren', 'Rina',
  'Ziv', 'Adi', 'Shai', 'Rafi', 'Dana', 'Lana', 'Ilan', 'Gali', 'Hila', 'Yoni'
];

const DEFAULT_SETTINGS = {
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

function loadRating() {
  const raw = localStorage.getItem('yaniv.rating');
  return raw ? Number(raw) : 1400;
}

function saveRating(rating) {
  localStorage.setItem('yaniv.rating', String(rating));
}

function updatePlayerRating(won) {
  const current = loadRating();
  const delta = won ? randBetween(12, 28) : -randBetween(10, 22);
  const next = clamp(current + delta, 600, 2600);
  saveRating(next);
}

function showScreen(id) {
  ['screen-home', 'screen-settings', 'screen-game', 'screen-how', 'screen-rankings', 'screen-install'].forEach((sid) => {
    $(sid).classList.toggle('hidden', sid !== id);
  });
}

function renderGlobalStats() {
  const stats = loadStats();
  const rating = loadRating();
  $('global-stats').textContent = `Games: ${stats.games} · Wins: ${stats.wins} · Losses: ${stats.losses} · Rating: ${rating}`;
  renderProfile(stats, rating);
}

function renderProfile(stats, rating) {
  const card = $('profile-card');
  if (!card) return;
  const games = stats.games || 0;
  const winRate = games ? Math.round((stats.wins / games) * 100) : 0;
  card.innerHTML = `
    <div style="font-weight:700; margin-bottom:6px;">Your Profile</div>
    <div>Rating: <strong>${rating}</strong></div>
    <div>Record: ${stats.wins}-${stats.losses}</div>
    <div>Win Rate: ${winRate}%</div>
  `;
}

function applySettingsToUI() {
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

function createMatch() {
  const playerRating = loadRating();
  const strengthBias = (state.settings.aiStrength - 5) * 40;
  const opponents = [];
  const used = new Set(['You']);
  for (let i = 1; i < state.settings.players; i++) {
    let name = NAMES[Math.floor(Math.random() * NAMES.length)];
    while (used.has(name)) name = NAMES[Math.floor(Math.random() * NAMES.length)];
    used.add(name);
    const rating = clamp(Math.round(playerRating + randBetween(-120, 140) + strengthBias), 600, 2600);
    const record = state.settings.fakeRecords === 'on'
      ? { wins: randBetween(10, 160), losses: randBetween(10, 180) }
      : null;
    opponents.push({ name, rating, record });
  }
  return {
    title: `Queue ${randBetween(1200, 2400)}`,
    playerRating,
    opponents,
  };
}

function createPlayers(match) {
  const players = [];
  players.push({ name: 'You', isHuman: true, hand: [], score: 0, record: null, rating: match.playerRating });
  for (const opp of match.opponents) {
    players.push({ name: opp.name, isHuman: false, hand: [], score: 0, record: opp.record, rating: opp.rating });
  }
  return players;
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
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

  // Opponents
  const oppEl = $('opponents');
  oppEl.innerHTML = '';
  game.players.forEach((p, idx) => {
    if (p.isHuman) return;
    const div = document.createElement('div');
    div.className = 'opponent';
    const record = p.record ? ` · ${p.record.wins}-${p.record.losses}` : '';
    const rating = p.rating ? ` · Rating ${p.rating}` : '';
    div.textContent = `${p.name}${record}${rating} · Hand: ${p.hand.length} · Score: ${p.score}`;
    if (idx === game.turn && game.phase !== 'round-end') div.style.borderColor = 'var(--accent)';
    oppEl.appendChild(div);
  });

  // Center piles
  const top = game.discardPile[game.discardPile.length - 1];
  $('discard-top').textContent = top ? cardLabel(top) : '';
  $('draw-count').textContent = `${game.drawPile.length} cards`;

  // Player hand
  const hand = $('player-hand');
  hand.innerHTML = '';
  game.players[0].hand.forEach((c, idx) => {
    const div = document.createElement('div');
    div.className = 'card';
    div.textContent = cardLabel(c);
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

function cardLabel(card) {
  return card.rank === 'Joker' ? 'Joker' : `${card.rank}${card.suit}`;
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

  // Remove from hand
  const hand = state.game.players[0].hand;
  const indexes = picks.map((p) => p.idx).sort((a,b) => b - a);
  indexes.forEach((i) => hand.splice(i, 1));
  cards.forEach((c) => state.game.discardPile.push(c));

  state.selected.clear();
  state.game.phase = 'draw';
  log(`You discarded ${cards.map(cardLabel).join(', ')}.`);
  renderGame();
}

function drawFromPile(which) {
  const game = state.game;
  if (game.turn !== 0 || game.phase !== 'draw') return;
  const card = which === 'discard'
    ? game.discardPile.pop()
    : drawCard(game);
  game.players[0].hand.push(card);
  log(`You drew ${cardLabel(card)}.`);
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
  log(`${ai.name} discards ${discard.map(cardLabel).join(', ')}.`);

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
  return 0.18 + state.settings.aiStrength * 0.065; // 0.245 .. 0.83
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
  return withTop < current - 2; // take if it improves total meaningfully
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
  updatePlayerRating(winner.isHuman);
  renderGlobalStats();
  log(`Game over. Winner: ${winner.name}.`);
  alert(`Game over! Winner: ${winner.name}`);
  showScreen('screen-home');
}

function allDiscards(hand) {
  const options = [];
  for (const c of hand) options.push([c]);

  // sets
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
    // runs
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
  const base = loadRating();
  const rows = [];
  for (let i = 1; i <= 20; i++) {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const swing = mode === 'today' ? randBetween(-220, 320) : randBetween(-500, 700);
    const rating = clamp(base + swing, 600, 2600);
    const wins = mode === 'today' ? randBetween(2, 40) : randBetween(10, 260);
    const losses = mode === 'today' ? randBetween(2, 40) : randBetween(10, 260);
    rows.push({ rank: i, name, rating, wins, losses });
  }
  rows.sort((a,b) => b.rating - a.rating).forEach((r, idx) => r.rank = idx + 1);
  rows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'ranking-row';
    row.innerHTML = `<div class="rank">#${r.rank}</div><div>${r.name}</div><div class="rating">${r.rating}</div><div class="record">${r.wins}-${r.losses}</div>`;
    list.appendChild(row);
  });

  $('tab-today').classList.toggle('active', mode === 'today');
  $('tab-all').classList.toggle('active', mode === 'all');
}

function log(msg) {
  const el = $('log');
  const time = new Date().toLocaleTimeString();
  el.textContent = `[${time}] ${msg}\n` + el.textContent;
}

// Event wiring
$('btn-start').addEventListener('click', () => {
  startGame();
  showScreen('screen-game');
});
$('btn-new').addEventListener('click', () => {
  if (state.game && !confirm('Start a new game? Current game will be lost.')) return;
  startGame();
  showScreen('screen-game');
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
