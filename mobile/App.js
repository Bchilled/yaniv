import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  TextInput,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRESETS = {
  classic: { name: 'Classic Yaniv', desc: '5 cards · Yaniv at 7 · Runs allowed' },
  strict: { name: 'Strict Yaniv', desc: '5 cards · Yaniv at 5 · Sets only' },
  relaxed: { name: 'Relaxed Yaniv', desc: '5 cards · Yaniv at 7 · Sets only' },
};

const DEFAULT_SETTINGS = {
  players: 2,
  yanivLimit: 7,
  handSize: 5,
  discards: 'set-run',
  jokers: 'on',
  assaf: 30,
  end: 'elim',
  reset: 'off',
};

const NAMES = [
  'Ari Cohen', 'Lior Levi', 'Noa Mizrahi', 'Tal Peretz', 'Yael Bitan',
  'Maya Amar', 'Eli Ben-Ami', 'Nina Shalev', 'Oren Barak', 'Rina Katz',
  'Ziv Mor', 'Adi Dayan', 'Shai Zohar', 'Rafi Raz', 'Dana Ben-David',
  'Lana Halevy', 'Ilan Efrat', 'Gali Ofek', 'Hila Shahar', 'Yoni Oz'
];

const EMOJIS = ['⏳','😊','👋','😁','😠','😢','🏆'];

const STORAGE_KEYS = {
  accounts: 'yaniv.accounts',
  current: 'yaniv.account.current',
};

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [accounts, setAccounts] = useState([]);
  const [account, setAccount] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [stats, setStats] = useState({ wins: 0, losses: 0, games: 0 });
  const [sessionRules, setSessionRules] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectText, setConnectText] = useState('Connecting to match...');

  const [loginName, setLoginName] = useState('');
  const [loginEmail, setLoginEmail] = useState('');

  const [showEmojiWheel, setShowEmojiWheel] = useState(false);
  const [logLines, setLogLines] = useState([]);

  const [game, setGame] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const gameIdRef = useRef(0);

  useEffect(() => {
    (async () => {
      const rawAccounts = await AsyncStorage.getItem(STORAGE_KEYS.accounts);
      const parsed = rawAccounts ? JSON.parse(rawAccounts) : [];
      const currentId = await AsyncStorage.getItem(STORAGE_KEYS.current);
      const current = parsed.find((a) => a.id === currentId) || null;
      setAccounts(parsed);
      if (current) {
        setAccount(current);
        setSettings({ ...DEFAULT_SETTINGS, ...current.settings });
        setStats(current.stats || { wins: 0, losses: 0, games: 0 });
        setScreen('home');
      } else {
        setScreen('login');
      }
    })();
  }, []);

  const rating = useMemo(() => {
    const base = 1000;
    const value = base + stats.wins * 12 - stats.losses * 8;
    return Math.max(600, Math.min(2600, value));
  }, [stats]);

  const rules = sessionRules || settings;

  function persist(accountNext, accountsNext) {
    AsyncStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accountsNext));
    if (accountNext) AsyncStorage.setItem(STORAGE_KEYS.current, accountNext.id);
  }

  function createAccount() {
    if (!loginName.trim()) return;
    const id = `acc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const newAccount = {
      id,
      name: loginName.trim(),
      email: loginEmail.trim(),
      settings: { ...DEFAULT_SETTINGS },
      stats: { wins: 0, losses: 0, games: 0 },
    };
    const nextAccounts = [...accounts, newAccount];
    setAccounts(nextAccounts);
    setAccount(newAccount);
    setSettings(newAccount.settings);
    setStats(newAccount.stats);
    persist(newAccount, nextAccounts);
    setScreen('home');
  }

  function signIn() {
    const name = loginName.trim().toLowerCase();
    const email = loginEmail.trim().toLowerCase();
    const match = accounts.find((a) =>
      (email && a.email && a.email.toLowerCase() === email) ||
      (!email && a.name.toLowerCase() === name)
    );
    if (!match) return;
    setAccount(match);
    setSettings({ ...DEFAULT_SETTINGS, ...match.settings });
    setStats(match.stats || { wins: 0, losses: 0, games: 0 });
    persist(match, accounts);
    setScreen('home');
  }

  function saveAccount(nextSettings, nextStats) {
    if (!account) return;
    const updated = { ...account, settings: nextSettings, stats: nextStats };
    const nextAccounts = accounts.map((a) => (a.id === account.id ? updated : a));
    setAccount(updated);
    setAccounts(nextAccounts);
    persist(updated, nextAccounts);
  }

  function log(msg) {
    setLogLines((prev) => [msg, ...prev].slice(0, 6));
  }

  function makeDeck() {
    const suits = ['S', 'H', 'D', 'C'];
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const deck = [];
    for (const s of suits) {
      for (let i = 0; i < ranks.length; i++) {
        deck.push({ rank: ranks[i], suit: s, value: i === 0 ? 1 : i >= 10 ? 10 : i + 1 });
      }
    }
    if (rules.jokers !== 'off') {
      deck.push({ rank: 'Joker', suit: '*', value: 0 });
      deck.push({ rank: 'Joker', suit: '*', value: 0 });
    }
    return shuffle(deck);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function drawCard(stateGame) {
    if (stateGame.drawPile.length === 0) {
      const top = stateGame.discardPile.pop();
      stateGame.drawPile = shuffle(stateGame.discardPile);
      stateGame.discardPile = [top];
    }
    return stateGame.drawPile.pop();
  }

  function deal(stateGame) {
    for (let i = 0; i < rules.handSize; i++) {
      stateGame.players.forEach((p) => p.hand.push(drawCard(stateGame)));
    }
    stateGame.discardPile.push(drawCard(stateGame));
  }

  function startMatch() {
    const used = new Set([account.name]);
    const oppName = NAMES.find((n) => !used.has(n)) || 'Opponent';
    const oppRating = Math.max(600, Math.min(2600, rating + randBetween(-200, 220)));

    const stateGame = {
      players: [
        { name: account.name, isHuman: true, hand: [], score: 0, rating },
        { name: oppName, isHuman: false, hand: [], score: 0, rating: oppRating },
      ],
      drawPile: makeDeck(),
      discardPile: [],
      turn: 0,
      phase: 'discard',
      round: 1,
    };
    deal(stateGame);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelected(new Set());
    setGame(stateGame);
    log('Round starts. Your turn.');
  }

  function startQuick(presetKey, jokersOn) {
    const preset = PRESETS[presetKey];
    setSessionRules({
      ...settings,
      players: 2,
      yanivLimit: presetKey === 'strict' ? 5 : 7,
      discards: presetKey === 'classic' ? 'set-run' : 'set',
      jokers: jokersOn ? 'on' : 'off',
    });
    setConnecting(true);
    setConnectText('Connecting to match...');
    setTimeout(() => {
      if (Math.random() < 0.01) {
        const nextStats = { ...stats, wins: stats.wins + 1, games: stats.games + 1 };
        setStats(nextStats);
        saveAccount(settings, nextStats);
        setConnecting(false);
        setScreen('home');
        return;
      }
      setConnecting(false);
      startMatch();
      setScreen('game');
    }, 1200 + Math.random() * 1200);
  }

  function cardLabel(card) {
    if (card.rank === 'Joker') return '★';
    return `${card.rank}${suitSymbol(card.suit)}`;
  }

  function suitSymbol(s) {
    if (s === 'S') return '♠';
    if (s === 'H') return '♥';
    if (s === 'D') return '♦';
    return '♣';
  }

  function handTotal(hand) {
    return hand.reduce((sum, c) => sum + c.value, 0);
  }

  function toggleSelect(idx) {
    if (!game || game.turn !== 0 || game.phase !== 'discard') return;
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelected(next);
  }

  function isSet(cards) {
    const r = cards[0].rank;
    return cards.every((c) => c.rank === r);
  }

  function isRun(cards) {
    if (cards.length < 3) return false;
    const nonJ = cards.filter((c) => c.rank !== 'Joker');
    if (nonJ.length === 0) return false;
    const suit = nonJ[0].suit;
    if (!nonJ.every((c) => c.suit === suit)) return false;
    const values = nonJ.map(rankValue).sort((a,b) => a - b);
    for (let i = 1; i < values.length; i++) if (values[i] === values[i-1]) return false;
    return true;
  }

  function rankValue(card) {
    if (card.rank === 'A') return 1;
    if (card.rank === 'J') return 11;
    if (card.rank === 'Q') return 12;
    if (card.rank === 'K') return 13;
    if (card.rank === 'Joker') return 0;
    return Number(card.rank);
  }

  function isValidDiscard(cards) {
    if (cards.length === 1) return true;
    if (isSet(cards)) return true;
    if (rules.discards === 'set-run' && isRun(cards)) return true;
    return false;
  }

  function discardSelected() {
    if (!game) return;
    const picks = Array.from(selected).map((i) => ({ i, c: game.players[0].hand[i] }));
    if (picks.length === 0) return;
    const cards = picks.map((p) => p.c);
    if (!isValidDiscard(cards)) return;

    const hand = [...game.players[0].hand];
    picks.map((p) => p.i).sort((a,b) => b - a).forEach((i) => hand.splice(i, 1));
    const discardPile = [...game.discardPile, ...cards];

    const nextGame = { ...game, players: [...game.players], discardPile, phase: 'draw' };
    nextGame.players[0] = { ...nextGame.players[0], hand };
    setGame(nextGame);
    setSelected(new Set());
    log(`You discarded ${cards.length} card(s).`);
  }

  function drawFrom(which) {
    if (!game) return;
    if (game.turn !== 0 || game.phase !== 'draw') return;
    const nextGame = { ...game, players: [...game.players], discardPile: [...game.discardPile], drawPile: [...game.drawPile] };
    const card = which === 'discard' ? nextGame.discardPile.pop() : drawCard(nextGame);
    nextGame.players[0] = { ...nextGame.players[0], hand: [...nextGame.players[0].hand, card] };
    nextGame.phase = 'discard';
    nextGame.turn = 1;
    setGame(nextGame);
    log('You drew a card.');
    setTimeout(() => aiTurn(nextGame), 700 + Math.random() * 600);
  }

  function aiTurn(stateGame) {
    const g = { ...stateGame, players: [...stateGame.players], discardPile: [...stateGame.discardPile], drawPile: [...stateGame.drawPile] };
    const ai = g.players[1];
    const total = handTotal(ai.hand);
    if (total <= rules.yanivLimit && Math.random() < 0.65) {
      resolveYaniv(g, 1);
      return;
    }
    const discard = [ai.hand[0]];
    const hand = ai.hand.slice(1);
    g.discardPile.push(...discard);
    g.players[1] = { ...ai, hand };
    log(`${ai.name} discarded cards.`);
    setTimeout(() => {
      const drawn = drawCard(g);
      g.players[1] = { ...g.players[1], hand: [...g.players[1].hand, drawn] };
      g.turn = 0;
      g.phase = 'discard';
      setGame(g);
      log('Your turn.');
    }, 700 + Math.random() * 800);
  }

  function callYaniv() {
    if (!game) return;
    const total = handTotal(game.players[0].hand);
    if (total > rules.yanivLimit) return;
    resolveYaniv({ ...game, players: [...game.players] }, 0);
  }

  function resolveYaniv(g, callerIndex) {
    const totals = g.players.map((p) => handTotal(p.hand));
    const callerTotal = totals[callerIndex];
    const assaf = totals.some((t, i) => i !== callerIndex && t <= callerTotal);
    g.players = g.players.map((p, i) => {
      if (i === callerIndex) return { ...p, score: p.score + (assaf ? callerTotal + rules.assaf : 0) };
      return { ...p, score: p.score + totals[i] };
    });
    const winner = g.players.reduce((a, b) => (a.score < b.score ? a : b));
    const nextStats = { ...stats, games: stats.games + 1, wins: stats.wins + (winner.isHuman ? 1 : 0), losses: stats.losses + (winner.isHuman ? 0 : 1) };
    setStats(nextStats);
    saveAccount(settings, nextStats);
    setGame(null);
    setScreen('home');
  }

  const isLoading = screen === 'loading';

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={['#7dd3fc', '#e0f2fe', '#fde68a']} style={{ flex: 1 }}>
        {isLoading ? null : (
          <View style={styles.container}>
            {screen === 'login' && (
              <View style={styles.card}>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.muted}>Create a player profile to continue.</Text>
                <TextInput style={styles.input} placeholder="Username" value={loginName} onChangeText={setLoginName} />
                <TextInput style={styles.input} placeholder="Email (optional)" value={loginEmail} onChangeText={setLoginEmail} />
                <View style={styles.row}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={createAccount}><Text style={styles.btnText}>Create Account</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={signIn}><Text style={styles.btnTextDark}>Sign In</Text></TouchableOpacity>
                </View>
                <Text style={styles.small}>4.8 ★ · 1.2M players</Text>
              </View>
            )}

            {screen === 'home' && (
              <ScrollView contentContainerStyle={{ gap: 12 }}>
                <View style={styles.card}>
                  <Text style={styles.title}>Play Yaniv</Text>
                  <Text style={styles.muted}>Discard, draw, and call Yaniv at 7 or less.</Text>
                  <View style={styles.profile}>
                    <Text style={styles.profileName}>{account?.name}</Text>
                    <Text>Rating: {rating}</Text>
                    <Text>Record: {stats.wins}-{stats.losses}</Text>
                  </View>
                  <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('quick')}><Text style={styles.btnText}>Play Quick Match</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => setScreen('settings')}><Text style={styles.btnTextDark}>Settings</Text></TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {screen === 'quick' && (
              <View style={styles.card}>
                <Text style={styles.title}>Quick Match</Text>
                <Text style={styles.muted}>Choose a common Yaniv ruleset.</Text>
                <View style={styles.row}>
                  <Text style={styles.muted}>Jokers</Text>
                  <TouchableOpacity onPress={() => setSettings({ ...settings, jokers: settings.jokers === 'on' ? 'off' : 'on' })}>
                    <Text style={styles.btnTextDark}>{settings.jokers === 'on' ? 'On' : 'Off'}</Text>
                  </TouchableOpacity>
                </View>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <View key={key} style={styles.presetRow}>
                    <View>
                      <Text style={styles.presetTitle}>{p.name}</Text>
                      <Text style={styles.muted}>{p.desc} · Jokers: {settings.jokers === 'on' ? 'On' : 'Off'}</Text>
                    </View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={() => startQuick(key, settings.jokers === 'on')}>
                      <Text style={styles.btnText}>Select</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setScreen('home')}><Text style={styles.btnTextDark}>Back</Text></TouchableOpacity>
              </View>
            )}

            {screen === 'game' && game && (
              <View style={styles.card}>
                <Text style={styles.muted}>Opponent: {game.players[1].name} · Rating {game.players[1].rating}</Text>
                <View style={styles.piles}>
                  <View style={styles.pileBox}><Text style={styles.muted}>Discard</Text><Text style={styles.cardText}>{game.discardPile.length ? cardLabel(game.discardPile[game.discardPile.length-1]) : ''}</Text></View>
                  <View style={styles.pileBox}><Text style={styles.muted}>Draw</Text><Text style={styles.cardText}>{game.drawPile.length}</Text></View>
                </View>
                <View style={styles.handRow}>
                  {game.players[0].hand.map((c, idx) => (
                    <TouchableOpacity key={idx} style={[styles.card, selected.has(idx) && styles.cardSelected]} onPress={() => toggleSelect(idx)}>
                      <Text>{cardLabel(c)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.primaryBtn} onPress={discardSelected}><Text style={styles.btnText}>Discard</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => drawFrom('draw')}><Text style={styles.btnTextDark}>Draw</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => drawFrom('discard')}><Text style={styles.btnTextDark}>Take Discard</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.dangerBtn} onPress={callYaniv}><Text style={styles.btnText}>Yaniv</Text></TouchableOpacity>
                </View>
                <View style={styles.logBox}>
                  {logLines.map((l, i) => (<Text key={i} style={styles.logText}>{l}</Text>))}
                </View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.bigEmoji} onPress={() => setShowEmojiWheel(true)}><Text style={styles.emojiText}>😊</Text></TouchableOpacity>
                </View>
              </View>
            )}

            {screen === 'settings' && (
              <View style={styles.card}>
                <Text style={styles.title}>Settings</Text>
                <Text style={styles.muted}>Rules apply to Quick Match presets.</Text>
                <TouchableOpacity style={styles.ghostBtn} onPress={() => setScreen('home')}><Text style={styles.btnTextDark}>Back</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <Modal visible={connecting} transparent>
          <View style={styles.overlay}>
            <View style={styles.overlayCard}><Text style={styles.title}>{connectText}</Text></View>
          </View>
        </Modal>

        <Modal visible={showEmojiWheel} transparent>
          <View style={styles.overlay}>
            <View style={styles.emojiWheel}>
              {EMOJIS.map((e) => (
                <TouchableOpacity key={e} style={styles.emojiBtn} onPress={() => { setShowEmojiWheel(false); log(`You sent ${e}`); }}>
                  <Text style={styles.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setShowEmojiWheel(false)}><Text style={styles.btnTextDark}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  card: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '700' },
  muted: { color: '#475569' },
  input: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 10, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  primaryBtn: { backgroundColor: '#00b4d8', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  ghostBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cbd5e1', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  dangerBtn: { backgroundColor: '#ef233c', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnTextDark: { color: '#0b1020', fontWeight: '700' },
  small: { fontSize: 12, color: '#64748b' },
  profile: { backgroundColor: '#f8fafc', padding: 10, borderRadius: 12 },
  profileName: { fontWeight: '700' },
  presetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingVertical: 6 },
  presetTitle: { fontWeight: '700' },
  piles: { flexDirection: 'column', gap: 10, alignItems: 'center' },
  pileBox: { width: 120, height: 140, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cardText: { fontSize: 20, fontWeight: '700' },
  handRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  card: { width: 56, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cardSelected: { borderColor: '#00b4d8', transform: [{ translateY: -6 }] },
  logBox: { minHeight: 70, backgroundColor: '#f8fafc', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  logText: { fontSize: 12, color: '#475569' },
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.4)', alignItems: 'center', justifyContent: 'center' },
  overlayCard: { backgroundColor: '#fff', padding: 18, borderRadius: 14 },
  bigEmoji: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 8 },
  emojiText: { fontSize: 22 },
  emojiWheel: { backgroundColor: '#fff', padding: 16, borderRadius: 14, gap: 10 },
  emojiBtn: { padding: 6, alignItems: 'center' },
});
