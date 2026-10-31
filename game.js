/**
 * NEON SURGE – game.js
 * Complete game logic: lane-based endless dodge with power-ups,
 * achievements, leaderboard, social sharing, and all retention mechanics.
 */

'use strict';

/* ====================================================
   STATE MANAGEMENT & STORAGE
   ==================================================== */
const LS = {
  get: (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

const STATE = {
  highScore:      LS.get('ns_highScore', 0),
  totalGames:     LS.get('ns_totalGames', 0),
  streak:         LS.get('ns_streak', 0),
  lastPlayed:     LS.get('ns_lastPlayed', ''),
  theme:          LS.get('ns_theme', 'neon'),
  muted:          LS.get('ns_muted', false),
  unlockedThemes: LS.get('ns_unlockedThemes', ['neon', 'cyber']),
  localScores:    LS.get('ns_localScores', []),
  achievements:   LS.get('ns_achievements', {}),
  dailyChallenge: LS.get('ns_dailyChallenge', null),
  dailyDone:      LS.get('ns_dailyDone', false),
};

function saveState() {
  LS.set('ns_highScore',      STATE.highScore);
  LS.set('ns_totalGames',     STATE.totalGames);
  LS.set('ns_streak',         STATE.streak);
  LS.set('ns_lastPlayed',     STATE.lastPlayed);
  LS.set('ns_theme',          STATE.theme);
  LS.set('ns_muted',          STATE.muted);
  LS.set('ns_unlockedThemes', STATE.unlockedThemes);
  LS.set('ns_localScores',    STATE.localScores);
  LS.set('ns_achievements',   STATE.achievements);
  LS.set('ns_dailyChallenge', STATE.dailyChallenge);
  LS.set('ns_dailyDone',      STATE.dailyDone);
}

/* ====================================================
   ACHIEVEMENTS
   ==================================================== */
const ACHIEVEMENTS = [
  { id: 'first_run',    name: '🚀 First Surge',     desc: 'Play your first game',         check: (s,g) => g.totalGames >= 1 },
  { id: 'score_100',   name: '💯 Century',          desc: 'Score 100 points',             check: (s,g) => s >= 100 },
  { id: 'score_500',   name: '⚡ Surge Starter',    desc: 'Score 500 points',             check: (s,g) => s >= 500 },
  { id: 'score_1000',  name: '🔥 Kilowatt',         desc: 'Score 1000 points',            check: (s,g) => s >= 1000 },
  { id: 'score_2500',  name: '💫 Megawatt',         desc: 'Score 2500 points',            check: (s,g) => s >= 2500 },
  { id: 'score_5000',  name: '🌌 Gigasurge',        desc: 'Score 5000 points',            check: (s,g) => s >= 5000 },
  { id: 'combo_5',     name: '🎯 Combo Starter',    desc: 'Reach a 5x combo',             check: (s,g) => g.maxCombo >= 5 },
  { id: 'combo_15',    name: '🔥 Combo Master',     desc: 'Reach a 15x combo',            check: (s,g) => g.maxCombo >= 15 },
  { id: 'games_10',    name: '🎮 Dedicated',        desc: 'Play 10 games',                check: (s,g) => g.totalGames >= 10 },
  { id: 'games_50',    name: '👑 Addicted',         desc: 'Play 50 games',                check: (s,g) => g.totalGames >= 50 },
  { id: 'powerup_5',   name: '🛡️ Collector',       desc: 'Collect 5 power-ups in a game',check: (s,g) => g.powerupsCollected >= 5 },
  { id: 'streak_3',    name: '🔥 On Fire',          desc: '3-day streak',                 check: (s,g) => g.streak >= 3 },
];

function checkAchievements(score, gameData) {
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!STATE.achievements[ach.id] && ach.check(score, gameData)) {
      STATE.achievements[ach.id] = Date.now();
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}

/* ====================================================
   DAILY CHALLENGE
   ==================================================== */
const DAILY_CHALLENGES = [
  { desc: 'Score 500 points',   goal: 500,   type: 'score',  reward: '🏆' },
  { desc: 'Score 1000 points',  goal: 1000,  type: 'score',  reward: '🌟' },
  { desc: 'Reach a 10x combo',  goal: 10,    type: 'combo',  reward: '⚡' },
  { desc: 'Dodge 30 obstacles', goal: 30,    type: 'dodged', reward: '🛡️' },
  { desc: 'Score 2000 points',  goal: 2000,  type: 'score',  reward: '💎' },
  { desc: 'Collect 3 power-ups',goal: 3,     type: 'powerup',reward: '🎁' },
];

function setupDailyChallenge() {
  const today = new Date().toDateString();
  if (!STATE.dailyChallenge || STATE.dailyChallenge.date !== today) {
    const idx = Math.floor(Date.now() / 86400000) % DAILY_CHALLENGES.length;
    STATE.dailyChallenge = { ...DAILY_CHALLENGES[idx], date: today };
    STATE.dailyDone = false;
    saveState();
  }
}

/* ====================================================
   STREAK MANAGEMENT
   ==================================================== */
function updateStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (STATE.lastPlayed === today) { return; }
  if (STATE.lastPlayed === yesterday) { STATE.streak++; }
  else { STATE.streak = 1; }
  STATE.lastPlayed = today;
}

/* ====================================================
   AUDIO ENGINE
   ==================================================== */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.1, gain = 0.15, startTime = 0) {
  if (STATE.muted) return;
  try {
    const ctx = getAudioCtx();
    const t = ctx.currentTime + startTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t); osc.stop(t + duration);
  } catch {}
}

const SFX = {
  move:   () => playTone(300, 'square', 0.07, 0.08),
  dodge:  () => { playTone(440, 'sine', 0.08, 0.1); playTone(660, 'sine', 0.06, 0.08, 0.04); },
  hit:    () => { playTone(150, 'sawtooth', 0.3, 0.2); playTone(100, 'square', 0.2, 0.15, 0.1); },
  powerup:() => { [523,659,784,1047].forEach((f,i) => playTone(f,'sine',0.15,0.12,i*0.08)); },
  combo:  (n) => playTone(220 + n * 30, 'sine', 0.1, 0.12),
  milestone: () => { [523,659,784,1047,1319].forEach((f,i) => playTone(f,'sine',0.2,0.15,i*0.07)); },
  menuClick: () => playTone(440, 'sine', 0.08, 0.08),
};

let bgMusicInterval = null;
function startBGMusic() {
  if (STATE.muted || bgMusicInterval) return;
  const notes = [110,110,138,165,138,110,82,110];
  let i = 0;
  bgMusicInterval = setInterval(() => {
    if (!STATE.muted) playTone(notes[i % notes.length], 'square', 0.18, 0.05);
    i++;
  }, 450);
}
function stopBGMusic() {
  if (bgMusicInterval) { clearInterval(bgMusicInterval); bgMusicInterval = null; }
}

/* ====================================================
   BACKGROUND PARTICLE CANVAS
   ==================================================== */
const bgCanvas = document.getElementById('bgCanvas');
const bgCtx = bgCanvas.getContext('2d');
let bgParticles = [];

function resizeBgCanvas() {
  bgCanvas.width = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}

function initBgParticles() {
  bgParticles = [];
  const n = Math.floor((window.innerWidth * window.innerHeight) / 8000);
  for (let i = 0; i < n; i++) {
    bgParticles.push({
      x: Math.random() * bgCanvas.width,
      y: Math.random() * bgCanvas.height,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.01,
    });
  }
}

function animateBg() {
  bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
  const style = getComputedStyle(document.body);
  const accent = style.getPropertyValue('--c-accent').trim() || '#7c3aed';
  for (const p of bgParticles) {
    p.x += p.vx; p.y += p.vy; p.a += p.da;
    if (p.x < 0) p.x = bgCanvas.width;
    if (p.x > bgCanvas.width) p.x = 0;
    if (p.y < 0) p.y = bgCanvas.height;
    if (p.y > bgCanvas.height) p.y = 0;
    if (p.a < 0) p.da = Math.abs(p.da);
    if (p.a > 1) p.da = -Math.abs(p.da);
    bgCtx.beginPath();
    bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    bgCtx.fillStyle = `rgba(167,139,250,${p.a * 0.5})`;
    bgCtx.fill();
  }
  requestAnimationFrame(animateBg);
}

/* ====================================================
   SCREEN MANAGER
   ==================================================== */
let currentScreen = null;
function showScreen(id) {
  if (currentScreen) currentScreen.classList.remove('active');
  const el = document.getElementById(id);
  el.classList.add('active');
  currentScreen = el;
}

/* ====================================================
   TOAST
   ==================================================== */
let toastEl = null;
let toastTimeout = null;
function showToast(msg, duration = 2500) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastEl.classList.remove('show'), duration);
}

/* ====================================================
   FLOATING SCORE
   ==================================================== */
function showScoreFloat(x, y, text) {
  const el = document.createElement('div');
  el.className = 'score-float';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/* ====================================================
   GAME CANVAS ENGINE
   ==================================================== */
const gameCanvas = document.getElementById('gameCanvas');
const ctx = gameCanvas.getContext('2d');

// Game dimensions
let W, H;
const LANE_COUNT = 3;
let LANE_W, LANE_CENTERS;
let PLAYER_W, PLAYER_H;

function resizeGameCanvas() {
  const scr = document.getElementById('gameScreen');
  W = scr.offsetWidth || window.innerWidth;
  H = scr.offsetHeight || window.innerHeight;
  gameCanvas.width  = W;
  gameCanvas.height = H;

  LANE_W = W / LANE_COUNT;
  LANE_CENTERS = [LANE_W * 0.5, LANE_W * 1.5, LANE_W * 2.5];
  PLAYER_W = Math.min(LANE_W * 0.45, 55);
  PLAYER_H = PLAYER_W * 1.2;
}

/* ====================================================
   GAME VARIABLES
   ==================================================== */
let GAME_STATE = 'idle'; // idle | countdown | playing | paused | over
let score = 0;
let hiScore = 0;
let distance = 0;
let obstaclesDodged = 0;
let powerupsCollected = 0;
let comboCount = 0;
let maxCombo = 0;
let newAchievements = [];
let shieldActive = false;
let shieldTimer = 0;
let slowActive = false;
let slowTimer = 0;

// Player
let playerLane = 1;   // 0 1 2
let playerX = 0;
let playerTargetX = 0;
let playerY = 0;
let playerAnim = 0;   // tilt angle
let playerGlow = 0;   // pulse
let playerTrail = [];

// Speed
let gameSpeed = 0;
const BASE_SPEED = 4;
const MAX_SPEED  = 22;
const SPEED_RAMP = 0.003;

// Obstacles
let obstacles = [];
let obstacleTimer = 0;
let obstacleInterval = 80; // frames between spawns
const OBS_MIN_INTERVAL = 28;

// Power-ups
let powerups = [];
let powerupTimer = 0;
let powerupInterval = 280;

// Road lines (visual)
let roadLines = [];
const ROAD_LINE_COUNT = 12;

// Particles (hit fx, trail)
let particles = [];

// RAF handle
let rafId = null;
let lastTime = 0;
let frameCount = 0;

// Score multiplier zones
let scoreFlashTimer = 0;
let comboDecayTimer = 0;
const COMBO_DECAY = 180; // frames without dodge resets combo

/* ====================================================
   INIT GAME
   ==================================================== */
function initGame() {
  resizeGameCanvas();
  score = 0;
  distance = 0;
  obstaclesDodged = 0;
  powerupsCollected = 0;
  comboCount = 0;
  maxCombo = 0;
  newAchievements = [];
  shieldActive = false; shieldTimer = 0;
  slowActive   = false; slowTimer   = 0;
  playerLane   = 1;
  playerX      = LANE_CENTERS[1];
  playerTargetX= LANE_CENTERS[1];
  playerY      = H * 0.78;
  playerTrail  = [];
  playerAnim   = 0;
  playerGlow   = 0;
  gameSpeed    = BASE_SPEED;
  obstacles    = [];
  powerups     = [];
  obstacleTimer= 0;
  obstacleInterval = 80;
  powerupTimer  = 0;
  powerupInterval = 280;
  particles    = [];
  frameCount   = 0;
  comboDecayTimer = 0;

  // Road lines init
  roadLines = [];
  for (let i = 0; i < ROAD_LINE_COUNT; i++) {
    roadLines.push({ y: (H / ROAD_LINE_COUNT) * i, lane: Math.floor(Math.random() * (LANE_COUNT - 1)) });
  }

  hiScore = STATE.highScore;
  updateHUD();
}

/* ====================================================
   OBSTACLE & POWER-UP FACTORIES
   ==================================================== */
const OBS_TYPES = [
  { id: 'wall',     color: '#f43f5e', w: 0.85, h: 36, points: 10, glow: '#f43f5e' },
  { id: 'spike',    color: '#f97316', w: 0.55, h: 44, points: 15, glow: '#f97316' },
  { id: 'laser',    color: '#ec4899', w: 0.95, h: 14, points: 20, glow: '#ec4899' },
  { id: 'barrier',  color: '#8b5cf6', w: 0.70, h: 52, points: 12, glow: '#8b5cf6' },
];

const PU_TYPES = [
  { id: 'shield',   color: '#06b6d4', icon: '🛡️', label: 'SHIELD',    duration: 300 },
  { id: 'slow',     color: '#f59e0b', icon: '⏱️', label: 'SLOW-MO',   duration: 240 },
  { id: 'x2',       color: '#10b981', icon: '✕2',  label: '2X SCORE',  duration: 200 },
  { id: 'magnet',   color: '#a78bfa', icon: '🧲',  label: 'MAGNET',    duration: 180 },
];

let x2Active = false, x2Timer = 0;
let magnetActive = false, magnetTimer = 0;

function spawnObstacle() {
  // Random pattern: single, double, or triple lane blocks
  const patterns = [
    () => {
      // Single lane blocked
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
      return [{ lane, type }];
    },
    () => {
      // Two lanes blocked (must leave one free)
      const freeLane = Math.floor(Math.random() * LANE_COUNT);
      const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
      return [0,1,2].filter(l => l !== freeLane).map(lane => ({ lane, type }));
    },
    () => {
      // Staggered (two obstacles at different y)
      const lane1 = Math.floor(Math.random() * LANE_COUNT);
      let lane2;
      do { lane2 = Math.floor(Math.random() * LANE_COUNT); } while (lane2 === lane1);
      const type = OBS_TYPES[Math.floor(Math.random() * OBS_TYPES.length)];
      return [
        { lane: lane1, type, yOffset: 0 },
        { lane: lane2, type, yOffset: -120 }
      ];
    }
  ];

  // Weight patterns by difficulty
  const patternWeights = gameSpeed < 10 ? [7,2,1] : gameSpeed < 16 ? [5,3,2] : [4,4,2];
  const totalWeight = patternWeights.reduce((a,b) => a+b, 0);
  let r = Math.random() * totalWeight;
  let pIdx = 0;
  for (let i = 0; i < patternWeights.length; i++) { if (r < patternWeights[i]) { pIdx = i; break; } r -= patternWeights[i]; }

  const obsList = patterns[pIdx]();
  for (const o of obsList) {
    const ot = o.type;
    obstacles.push({
      x:      LANE_CENTERS[o.lane] - (LANE_W * ot.w) / 2,
      y:      -60 + (o.yOffset || 0),
      w:      LANE_W * ot.w,
      h:      ot.h,
      lane:   o.lane,
      color:  ot.color,
      glow:   ot.glow,
      points: ot.points,
      type:   ot.id,
      dodged: false,
      pulse:  0,
    });
  }
}

function spawnPowerup() {
  const lane = Math.floor(Math.random() * LANE_COUNT);
  const type = PU_TYPES[Math.floor(Math.random() * PU_TYPES.length)];
  powerups.push({
    x:      LANE_CENTERS[lane],
    y:      -40,
    lane,
    color:  type.color,
    icon:   type.icon,
    label:  type.label,
    id:     type.id,
    dur:    type.duration,
    r:      22,
    pulse:  0,
    rot:    0,
  });
}

/* ====================================================
   UPDATE GAME
   ==================================================== */
function update(dt) {
  if (GAME_STATE !== 'playing') return;
  frameCount++;

  // Speed ramp
  gameSpeed = Math.min(MAX_SPEED, BASE_SPEED + frameCount * SPEED_RAMP * (slowActive ? 0.3 : 1));
  const spd = slowActive ? gameSpeed * 0.45 : gameSpeed;

  // Score
  distance += spd;
  const rawScore = Math.floor(distance / 20) * (x2Active ? 2 : 1);
  if (rawScore > score) {
    const diff = rawScore - score;
    score = rawScore;
    if (score > hiScore) hiScore = score;
  }

  // Timers
  if (shieldActive) { shieldTimer--; if (shieldTimer <= 0) { shieldActive = false; document.getElementById('shieldIndicator').style.display = 'none'; } }
  if (slowActive)   { slowTimer--;   if (slowTimer <= 0)   { slowActive = false;   document.getElementById('slowIndicator').style.display = 'none'; } }
  if (x2Active)     { x2Timer--;     if (x2Timer <= 0)     x2Active = false; }
  if (magnetActive) { magnetTimer--; if (magnetTimer <= 0) magnetActive = false; }

  // Combo decay
  comboDecayTimer++;
  if (comboDecayTimer > COMBO_DECAY && comboCount > 0) {
    comboCount = 0;
    updateComboDisplay();
  }

  // Score flash
  if (scoreFlashTimer > 0) scoreFlashTimer--;

  // Player smooth move
  playerX += (playerTargetX - playerX) * 0.2;
  playerAnim *= 0.85;
  playerGlow = (playerGlow + 0.08) % (Math.PI * 2);

  // Trail
  playerTrail.unshift({ x: playerX, y: playerY, a: 1 });
  if (playerTrail.length > 14) playerTrail.pop();
  playerTrail.forEach(t => t.a -= 0.07);

  // Road lines
  for (const l of roadLines) {
    l.y += spd * 0.6;
    if (l.y > H) { l.y = -40; l.lane = Math.floor(Math.random() * (LANE_COUNT - 1)); }
  }

  // Spawn obstacles
  obstacleTimer++;
  if (obstacleTimer >= obstacleInterval) {
    spawnObstacle();
    obstacleTimer = 0;
    obstacleInterval = Math.max(OBS_MIN_INTERVAL, 80 - frameCount * 0.08);
  }

  // Spawn power-ups
  powerupTimer++;
  if (powerupTimer >= powerupInterval) {
    spawnPowerup();
    powerupTimer = 0;
    powerupInterval = Math.max(180, 280 - frameCount * 0.05);
  }

  // Update obstacles
  const PLAYER_CX = playerX;
  const PLAYER_CY = playerY - PLAYER_H * 0.3;
  const HIT_W = PLAYER_W * 0.55;
  const HIT_H = PLAYER_H * 0.55;

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.y += spd;
    o.pulse = (o.pulse + 0.1) % (Math.PI * 2);

    // Check dodge (passed player)
    if (!o.dodged && o.y > playerY + PLAYER_H) {
      o.dodged = true;
      obstaclesDodged++;
      comboCount++;
      comboDecayTimer = 0;
      if (comboCount > maxCombo) maxCombo = comboCount;
      const pts = o.points * (comboCount >= 5 ? Math.floor(comboCount / 5) + 1 : 1) * (x2Active ? 2 : 1);
      score += pts;
      if (score > hiScore) hiScore = score;
      SFX.dodge();
      if (comboCount % 5 === 0) SFX.combo(comboCount);
      updateComboDisplay();
    }

    // Remove off-screen
    if (o.y > H + 80) { obstacles.splice(i, 1); continue; }

    // Collision check
    const ox1 = o.x, ox2 = o.x + o.w, oy1 = o.y, oy2 = o.y + o.h;
    const px1 = PLAYER_CX - HIT_W, px2 = PLAYER_CX + HIT_W;
    const py1 = PLAYER_CY - HIT_H, py2 = PLAYER_CY + HIT_H;
    if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2) {
      if (shieldActive) {
        shieldActive = false;
        shieldTimer  = 0;
        document.getElementById('shieldIndicator').style.display = 'none';
        spawnHitParticles(PLAYER_CX, PLAYER_CY, '#06b6d4');
        obstacles.splice(i, 1);
        showToast('🛡️ Shield absorbed the hit!');
      } else {
        triggerGameOver();
        return;
      }
    }
  }

  // Update power-ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += spd * 0.85;
    p.pulse = (p.pulse + 0.08) % (Math.PI * 2);
    p.rot += 0.03;

    // Magnet effect
    if (magnetActive) {
      const dx = PLAYER_CX - p.x, dy = PLAYER_CY - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 150) { p.x += dx * 0.08; p.y += dy * 0.08; }
    }

    if (p.y > H + 60) { powerups.splice(i, 1); continue; }

    // Collect
    const dist = Math.sqrt((PLAYER_CX - p.x)**2 + (PLAYER_CY - p.y)**2);
    if (dist < p.r + PLAYER_W * 0.6) {
      applyPowerup(p);
      spawnHitParticles(p.x, p.y, p.color);
      powerups.splice(i, 1);
      powerupsCollected++;
      SFX.powerup();
      showToast(`${p.icon} ${p.label} activated!`);
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.15; // gravity
    p.life -= p.decay;
    if (p.life <= 0) { particles.splice(i, 1); }
  }

  updateHUD();
}

function applyPowerup(p) {
  switch (p.id) {
    case 'shield': shieldActive = true; shieldTimer  = p.dur; document.getElementById('shieldIndicator').style.display = 'flex'; break;
    case 'slow':   slowActive   = true; slowTimer    = p.dur; document.getElementById('slowIndicator').style.display   = 'flex'; break;
    case 'x2':     x2Active     = true; x2Timer      = p.dur; break;
    case 'magnet': magnetActive = true; magnetTimer  = p.dur; break;
  }
}

function spawnHitParticles(cx, cy, color) {
  const n = 18;
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      r: 2 + Math.random() * 3,
      color,
      life: 1,
      decay: 0.04 + Math.random() * 0.03,
    });
  }
}

/* ====================================================
   RENDER
   ==================================================== */
function render() {
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, getCSS('--c-bg'));
  bgGrad.addColorStop(1, getCSS('--c-track'));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Lane separator glow lines
  for (let i = 1; i < LANE_COUNT; i++) {
    const x = LANE_W * i;
    const grd = ctx.createLinearGradient(x, 0, x, H);
    grd.addColorStop(0,   'rgba(124,58,237,0)');
    grd.addColorStop(0.3, 'rgba(124,58,237,0.25)');
    grd.addColorStop(0.7, 'rgba(124,58,237,0.25)');
    grd.addColorStop(1,   'rgba(124,58,237,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(x - 1, 0, 2, H);
  }

  // Speed lines (road markings)
  ctx.strokeStyle = 'rgba(124,58,237,0.18)';
  ctx.lineWidth = 2;
  ctx.setLineDash([24, 20]);
  for (const l of roadLines) {
    const x = LANE_W * (l.lane + 1);
    ctx.beginPath();
    ctx.moveTo(x, l.y); ctx.lineTo(x, l.y + 30);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Perspective grid lines from bottom (vanishing point effect)
  const vp = { x: W / 2, y: H * 0.5 };
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = getCSS('--c-accent');
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const bx = (W / 8) * i;
    ctx.beginPath(); ctx.moveTo(vp.x, vp.y); ctx.lineTo(bx, H); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Particles
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player trail
  for (let i = playerTrail.length - 1; i >= 0; i--) {
    const t = playerTrail[i];
    if (t.a <= 0) continue;
    ctx.globalAlpha = t.a * 0.4;
    const tSize = PLAYER_W * (1 - i / playerTrail.length) * 0.7;
    ctx.fillStyle = getCSS('--c-player');
    ctx.shadowColor = getCSS('--c-player');
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(t.x, t.y - PLAYER_H * 0.3, tSize * 0.5, tSize * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // Obstacles
  for (const o of obstacles) {
    const pulseMag = Math.sin(o.pulse) * 4;
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 18 + pulseMag * 2;
    ctx.fillStyle = o.color;

    if (o.type === 'spike') {
      // Draw spiky shape
      drawSpike(o.x, o.y, o.w, o.h);
    } else if (o.type === 'laser') {
      // Draw laser beam
      ctx.globalAlpha = 0.7 + Math.sin(o.pulse) * 0.3;
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillRect(o.x + o.w*0.1, o.y + 2, o.w * 0.8, o.h * 0.3);
    } else {
      // Standard rounded rect
      roundRect(ctx, o.x, o.y, o.w, o.h, 8);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      roundRect(ctx, o.x + 3, o.y + 3, o.w - 6, 6, 4);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = o.color;
  }

  // Power-ups
  for (const p of powerups) {
    const ps = Math.sin(p.pulse) * 3;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);

    // Outer glow ring
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 20 + ps * 2;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + Math.sin(p.pulse) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 6 + ps, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Inner circle
    ctx.fillStyle = p.color + '33';
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // Icon
    ctx.font = `${p.r * 1.1}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, p.x, p.y);
  }

  // Player
  drawPlayer();
}

function drawSpike(x, y, w, h) {
  const count = 5;
  const tw = w / count;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let i = 0; i < count; i++) {
    ctx.lineTo(x + tw * i + tw / 2, y);
    ctx.lineTo(x + tw * (i + 1), y + h);
  }
  ctx.closePath();
  ctx.fill();
}

function drawPlayer() {
  const cx = playerX;
  const cy = playerY - PLAYER_H * 0.3;
  const pw = PLAYER_W;
  const ph = PLAYER_H;
  const tilt = playerAnim;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Glow
  const glowPulse = Math.sin(playerGlow) * 5;
  ctx.shadowColor = getCSS('--c-player');
  ctx.shadowBlur = 20 + glowPulse;

  // Shield ring
  if (shieldActive) {
    const t = Date.now() / 600;
    ctx.strokeStyle = getCSS('--c-shield');
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, pw * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Body (stylized ship shape)
  const bodyGrad = ctx.createLinearGradient(-pw/2, -ph/2, pw/2, ph/2);
  bodyGrad.addColorStop(0, getCSS('--c-accent2'));
  bodyGrad.addColorStop(1, getCSS('--c-player'));
  ctx.fillStyle = bodyGrad;

  ctx.beginPath();
  ctx.moveTo(0, -ph * 0.55);          // nose
  ctx.lineTo(pw * 0.45, ph * 0.35);   // right wing
  ctx.lineTo(pw * 0.15, ph * 0.15);   // right body indent
  ctx.lineTo(0, ph * 0.45);           // bottom center
  ctx.lineTo(-pw * 0.15, ph * 0.15);  // left body indent
  ctx.lineTo(-pw * 0.45, ph * 0.35);  // left wing
  ctx.closePath();
  ctx.fill();

  // Engine glow at bottom
  const engGrad = ctx.createRadialGradient(0, ph*0.4, 0, 0, ph*0.4, pw*0.4);
  engGrad.addColorStop(0, getCSS('--c-accent2') + 'cc');
  engGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = engGrad;
  ctx.beginPath();
  ctx.ellipse(0, ph * 0.4, pw * 0.22, ph * 0.25 + glowPulse * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cockpit highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -ph * 0.15, pw * 0.12, ph * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function getCSS(prop) {
  return getComputedStyle(document.body).getPropertyValue(prop).trim();
}

/* ====================================================
   GAME LOOP
   ==================================================== */
function gameLoop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  update(dt);
  render();
  if (GAME_STATE === 'playing') rafId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  lastTime = performance.now();
  GAME_STATE = 'playing';
  rafId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
}

/* ====================================================
   GAME OVER
   ==================================================== */
function triggerGameOver() {
  GAME_STATE = 'over';
  stopGameLoop();
  stopBGMusic();
  SFX.hit();

  // Screen shake
  document.getElementById('gameScreen').classList.add('shaking');
  setTimeout(() => document.getElementById('gameScreen').classList.remove('shaking'), 400);

  // Update stats
  const isNewBest = score > STATE.highScore;
  if (isNewBest) STATE.highScore = score;
  STATE.totalGames++;
  updateStreak();

  // Daily challenge check
  let dailyCompleted = false;
  if (STATE.dailyChallenge && !STATE.dailyDone) {
    const dc = STATE.dailyChallenge;
    let val = 0;
    if (dc.type === 'score')   val = score;
    if (dc.type === 'combo')   val = maxCombo;
    if (dc.type === 'dodged')  val = obstaclesDodged;
    if (dc.type === 'powerup') val = powerupsCollected;
    if (val >= dc.goal) { dailyCompleted = true; STATE.dailyDone = true; }
  }

  // Check theme unlocks
  if (score >= 1000 && !STATE.unlockedThemes.includes('flame')) {
    STATE.unlockedThemes.push('flame');
    showToast('🔥 Flame theme unlocked!', 3000);
  }
  if (score >= 2500 && !STATE.unlockedThemes.includes('void')) {
    STATE.unlockedThemes.push('void');
    showToast('🌌 Void theme unlocked!', 3000);
  }

  // Achievements
  const gameData = { totalGames: STATE.totalGames, maxCombo, powerupsCollected, streak: STATE.streak };
  newAchievements = checkAchievements(score, gameData);

  // Save leaderboard
  STATE.localScores.push({ score, date: new Date().toLocaleDateString(), name: 'You' });
  STATE.localScores.sort((a,b) => b.score - a.score);
  if (STATE.localScores.length > 20) STATE.localScores = STATE.localScores.slice(0, 20);

  saveState();

  // Render game-over screen
  setTimeout(() => showGameOverScreen(isNewBest, dailyCompleted), 600);
}

function getScoreBadge(s) {
  if (s >= 5000) return '🌌 LEGENDARY';
  if (s >= 2500) return '💎 ELITE';
  if (s >= 1000) return '🔥 EXPERT';
  if (s >= 500)  return '⚡ SKILLED';
  if (s >= 100)  return '🚀 RISING';
  return '🎮 SURVIVOR';
}

function getGoTitle(s) {
  if (s >= 2500) return ['LEGENDARY!', "You're unstoppable! 🌌"];
  if (s >= 1000) return ['INCREDIBLE!', "You're on fire! 🔥"];
  if (s >= 500)  return ['GREAT RUN!', 'Keep pushing! ⚡'];
  if (s >= 100)  return ['NICE TRY!', "You're getting there! 💪"];
  return ['GAME OVER', 'Practice makes perfect!'];
}

function showGameOverScreen(isNewBest, dailyCompleted) {
  const [title, sub] = getGoTitle(score);
  document.getElementById('goTitle').textContent = title;
  document.getElementById('goSubtitle').textContent = sub;
  document.getElementById('goScore').textContent   = score;
  document.getElementById('goDistance').textContent = Math.floor(distance / 10) + 'm';
  document.getElementById('goObstacles').textContent = obstaclesDodged;
  document.getElementById('goMaxCombo').textContent  = maxCombo + 'x';
  document.getElementById('scBadge').textContent = getScoreBadge(score);

  const recEl = document.getElementById('scRecord');
  recEl.style.display = isNewBest ? 'block' : 'none';
  if (isNewBest) SFX.milestone();

  document.getElementById('scDaily').style.display = dailyCompleted ? 'block' : 'none';

  // Achievements chips
  const achEl = document.getElementById('goAchievements');
  achEl.innerHTML = '';
  for (const a of newAchievements) {
    const chip = document.createElement('div');
    chip.className = 'ach-chip';
    chip.innerHTML = `${a.name}`;
    chip.style.animationDelay = `${newAchievements.indexOf(a) * 0.12}s`;
    achEl.appendChild(chip);
  }

  // Share preview
  document.getElementById('spScore').textContent = score;

  showScreen('gameOverScreen');
}

/* ====================================================
   COUNTDOWN
   ==================================================== */
function startCountdown(callback) {
  showScreen('countdownScreen');
  let n = 3;
  const el = document.getElementById('countdownNum');
  el.textContent = n;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'countAnim 0.8s ease-in-out';

  const tick = setInterval(() => {
    n--;
    if (n > 0) {
      el.textContent = n;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'countAnim 0.8s ease-in-out';
      playTone(440, 'sine', 0.12, 0.15);
    } else {
      el.textContent = 'GO!';
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = 'countAnim 0.8s ease-in-out';
      playTone(880, 'sine', 0.2, 0.2);
      clearInterval(tick);
      setTimeout(callback, 700);
    }
  }, 850);
  playTone(440, 'sine', 0.12, 0.15);
}

/* ====================================================
   HUD UPDATE
   ==================================================== */
function updateHUD() {
  document.getElementById('hudScore').textContent = score;
  document.getElementById('hudBest').textContent  = hiScore;
  document.getElementById('pauseScore').textContent = score;
}

function updateComboDisplay() {
  const el = document.getElementById('comboDisplay');
  if (comboCount >= 3) {
    el.textContent = `${comboCount}x COMBO`;
    el.style.color = comboCount >= 10 ? '#f59e0b' : comboCount >= 5 ? '#10b981' : '#a78bfa';
  } else {
    el.textContent = '';
  }
}

/* ====================================================
   CONTROLS
   ==================================================== */
function moveLeft() {
  if (playerLane > 0) {
    playerLane--;
    playerTargetX = LANE_CENTERS[playerLane];
    playerAnim = -0.18;
    SFX.move();
  }
}
function moveRight() {
  if (playerLane < LANE_COUNT - 1) {
    playerLane++;
    playerTargetX = LANE_CENTERS[playerLane];
    playerAnim = 0.18;
    SFX.move();
  }
}

// Keyboard
document.addEventListener('keydown', (e) => {
  if (GAME_STATE === 'playing') {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')  { e.preventDefault(); moveLeft(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); moveRight(); }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P')     { togglePause(); }
  } else if (GAME_STATE === 'paused') {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P')     { togglePause(); }
  }
});

// Touch / Swipe
let touchStartX = 0, touchStartY = 0;
document.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (GAME_STATE !== 'playing') return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
    if (dx > 0) moveRight(); else moveLeft();
  }
}, { passive: true });

// Mobile buttons
document.getElementById('leftBtn').addEventListener('touchstart',  (e) => { e.preventDefault(); if (GAME_STATE === 'playing') moveLeft(); });
document.getElementById('rightBtn').addEventListener('touchstart', (e) => { e.preventDefault(); if (GAME_STATE === 'playing') moveRight(); });
document.getElementById('leftBtn').addEventListener('mousedown',  () => { if (GAME_STATE === 'playing') moveLeft(); });
document.getElementById('rightBtn').addEventListener('mousedown', () => { if (GAME_STATE === 'playing') moveRight(); });

/* ====================================================
   PAUSE / RESUME
   ==================================================== */
function togglePause() {
  if (GAME_STATE === 'playing') {
    GAME_STATE = 'paused';
    stopGameLoop();
    stopBGMusic();
    document.getElementById('pauseScore').textContent = score;
    showScreen('pauseScreen');
  } else if (GAME_STATE === 'paused') {
    GAME_STATE = 'playing';
    showScreen('gameScreen');
    startBGMusic();
    lastTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }
}

document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('restartFromPauseBtn').addEventListener('click', () => {
  stopGameLoop();
  stopBGMusic();
  launchGame();
});
document.getElementById('quitBtn').addEventListener('click', () => {
  stopGameLoop();
  stopBGMusic();
  GAME_STATE = 'idle';
  updateStartScreen();
  showScreen('startScreen');
});

/* ====================================================
   THEME MANAGER
   ==================================================== */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  STATE.theme = theme;
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
  saveState();
}

function updateThemeButtons() {
  document.querySelectorAll('.theme-btn').forEach(b => {
    const th = b.dataset.theme;
    const unlocked = STATE.unlockedThemes.includes(th);
    b.classList.toggle('locked', !unlocked);
    b.classList.toggle('active', th === STATE.theme);
  });
}

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    if (!STATE.unlockedThemes.includes(theme)) {
      const req = theme === 'flame' ? 1000 : 2500;
      showToast(`🔒 Reach ${req} points to unlock!`);
      return;
    }
    SFX.menuClick();
    applyTheme(theme);
  });
});

/* ====================================================
   LEADERBOARD
   ==================================================== */
let currentTab = 'local';

function renderLeaderboard() {
  const list = document.getElementById('lbList');
  list.innerHTML = '';
  document.getElementById('lbYourBest').textContent = STATE.highScore;

  const scores = currentTab === 'local' ? STATE.localScores : getGlobalScores();
  const medals = ['🥇','🥈','🥉'];

  scores.slice(0, 10).forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = `lb-item${i < 3 ? ' top' + (i+1) : ''}`;
    item.style.animationDelay = `${i * 0.05}s`;
    item.innerHTML = `
      <span class="lb-rank">${i < 3 ? medals[i] : (i+1)}</span>
      <span class="lb-name">${entry.name || 'Anonymous'}</span>
      <span class="lb-score">${entry.score}</span>
    `;
    list.appendChild(item);
  });

  if (scores.length === 0) {
    list.innerHTML = `<div style="text-align:center;color:var(--c-text-dim);padding:40px;font-size:14px">
      No scores yet.<br/>Play to set a record!
    </div>`;
  }
}

function getGlobalScores() {
  // Simulated global leaderboard (since no backend)
  const names = ['SurgeKing', 'NeonRider', 'VoidMaster', 'LaserDodge', 'ComboGod', 'SpeedRun', 'PixelAce', 'EliteX'];
  const scores = [8420, 6850, 5210, 4980, 4200, 3750, 2840, 1960];
  const your = STATE.highScore;
  const entries = names.map((n, i) => ({ name: n, score: scores[i] }));
  if (your > 0) entries.push({ name: 'You ⭐', score: your });
  return entries.sort((a, b) => b.score - a.score);
}

document.getElementById('leaderboardBtn').addEventListener('click', () => {
  SFX.menuClick();
  currentTab = 'local';
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'local'));
  renderLeaderboard();
  showScreen('leaderboardScreen');
});

document.getElementById('lbCloseBtn').addEventListener('click', () => {
  SFX.menuClick();
  showScreen('startScreen');
});

document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentTab = tab.dataset.tab;
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.toggle('active', t === tab));
    renderLeaderboard();
  });
});

/* ====================================================
   SHARE
   ==================================================== */
function getShareText() {
  return `⚡ NEON SURGE\nScore: ${score}\nBadge: ${getScoreBadge(score)}\nCan you beat me? 🔥\n#NeonSurge`;
}

document.getElementById('shareBtn').addEventListener('click', () => {
  SFX.menuClick();
  document.getElementById('shareModal').style.display = 'flex';
  document.getElementById('spScore').textContent = score;

  // Check native share
  if (navigator.share) {
    document.getElementById('shareNative').style.display = 'flex';
  }
});

document.getElementById('shareNative').addEventListener('click', () => {
  navigator.share({ title: 'NEON SURGE', text: getShareText() }).catch(() => {});
});

document.getElementById('copyLinkBtn').addEventListener('click', () => {
  const text = getShareText();
  navigator.clipboard?.writeText(text).then(() => showToast('📋 Score copied!')).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    showToast('📋 Score copied!');
  });
});

document.getElementById('shareTwitterBtn').addEventListener('click', () => {
  const text = encodeURIComponent(getShareText());
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
});

document.getElementById('shareWhatsappBtn').addEventListener('click', () => {
  const text = encodeURIComponent(getShareText());
  window.open(`https://wa.me/?text=${text}`, '_blank');
});

document.getElementById('shareModalClose').addEventListener('click', () => {
  document.getElementById('shareModal').style.display = 'none';
});

document.getElementById('challengeBtn').addEventListener('click', () => {
  const text = encodeURIComponent(`🎮 I scored ${score} on NEON SURGE! Can you beat me?\n⚡ Challenge accepted? ${getShareText()}`);
  if (navigator.share) {
    navigator.share({ title: 'NEON SURGE Challenge', text: `I scored ${score}! Can you beat me? 🔥` });
  } else {
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }
});

/* ====================================================
   START SCREEN LOGIC
   ==================================================== */
function updateStartScreen() {
  document.getElementById('startBest').textContent   = STATE.highScore;
  document.getElementById('startStreak').textContent = STATE.streak + '🔥';
  document.getElementById('startGames').textContent  = STATE.totalGames;
  document.getElementById('lbYourBest').textContent  = STATE.highScore;

  // Daily challenge
  setupDailyChallenge();
  const dc = STATE.dailyChallenge;
  document.getElementById('dailyChallengeDesc').textContent = STATE.dailyDone ? `✅ ${dc.desc} – Completed!` : dc.desc;
  document.getElementById('dailyReward').textContent = dc.reward;

  updateThemeButtons();
}

function launchGame() {
  initGame();
  showScreen('gameScreen');
  // Render one frame before countdown so canvas is ready
  render();
  startCountdown(() => {
    showScreen('gameScreen');
    startBGMusic();
    startGameLoop();
  });
}

document.getElementById('startBtn').addEventListener('click', () => {
  SFX.menuClick();
  launchGame();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  SFX.menuClick();
  launchGame();
});

document.getElementById('goHomeBtn').addEventListener('click', () => {
  SFX.menuClick();
  GAME_STATE = 'idle';
  updateStartScreen();
  showScreen('startScreen');
});

/* ====================================================
   MUTE
   ==================================================== */
const muteBtn = document.getElementById('muteBtn');
function updateMuteBtn() {
  muteBtn.textContent = STATE.muted ? '🔇' : '🔊';
}
muteBtn.addEventListener('click', () => {
  STATE.muted = !STATE.muted;
  saveState();
  updateMuteBtn();
  if (!STATE.muted && GAME_STATE === 'playing') startBGMusic();
  if (STATE.muted) stopBGMusic();
});

/* ====================================================
   WINDOW RESIZE
   ==================================================== */
window.addEventListener('resize', () => {
  resizeBgCanvas();
  initBgParticles();
  if (GAME_STATE === 'playing' || GAME_STATE === 'paused') {
    resizeGameCanvas();
    // Reposition player
    playerTargetX = LANE_CENTERS[playerLane];
    playerX = playerTargetX;
    playerY = H * 0.78;
  }
});

/* ====================================================
   INIT APP
   ==================================================== */
function initApp() {
  resizeBgCanvas();
  initBgParticles();
  animateBg();
  applyTheme(STATE.theme);
  updateStartScreen();
  updateMuteBtn();
  showScreen('startScreen');

  // Resume AudioContext on first user interaction
  document.addEventListener('click', () => { try { getAudioCtx().resume(); } catch {} }, { once: true });
  document.addEventListener('touchstart', () => { try { getAudioCtx().resume(); } catch {} }, { once: true });
}

initApp();
