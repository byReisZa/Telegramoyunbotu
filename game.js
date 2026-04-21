// ===== FIREBASE CONFIG =====
const firebaseConfig = {
  apiKey: "AIzaSyDj2Ht94NvI7tOd2aK5EQjCzMS0OPxbSkc",
  authDomain: "telegramapp-b0bce.firebaseapp.com",
  projectId: "telegramapp-b0bce",
  storageBucket: "telegramapp-b0bce.firebasestorage.app",
  messagingSenderId: "707008927852",
  appId: "1:707008927852:web:ed6bca0a6ca3c2bcd06049",
  measurementId: "G-KGZ45KGMBM"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== STATE =====
let currentUser = null;
let userData = { username: 'Oyuncu', points: 0, cubeColor: '#00f5d4' };
const CUBE_COLORS = [
  '#00f5d4','#f72585','#7209b7','#3a86ff','#ffbe0b',
  '#fb5607','#8338ec','#06d6a0','#ef233c','#ffffff',
  '#ff6b6b','#48cae4','#52b788','#e9c46a','#264653'
];

// ===== AUTH STATE =====
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    await loadUserData();
    updateMenuUI();
    showScreen('screen-menu');
    buildStars();
  } else {
    showScreen('screen-auth');
  }
});

async function loadUserData() {
  const doc = await db.collection('users').doc(currentUser.uid).get();
  if (doc.exists) {
    userData = { ...userData, ...doc.data() };
  } else {
    await db.collection('users').doc(currentUser.uid).set(userData);
  }
}

async function saveUserData() {
  if (!currentUser) return;
  await db.collection('users').doc(currentUser.uid).set(userData, { merge: true });
}

// ===== AUTH FUNCTIONS =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => {
    b.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('tab-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('tab-register').classList.toggle('hidden', tab !== 'register');
}

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('auth-error');
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    err.textContent = '';
  } catch(e) {
    err.textContent = getAuthError(e.code);
  }
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const err = document.getElementById('auth-error');
  if (!username) { err.textContent = 'Kullanıcı adı gerekli!'; return; }
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    userData.username = username;
    await db.collection('users').doc(cred.user.uid).set(userData);
    err.textContent = '';
  } catch(e) {
    err.textContent = getAuthError(e.code);
  }
}

async function doLogout() {
  await auth.signOut();
  showScreen('screen-auth');
}

function getAuthError(code) {
  const map = {
    'auth/invalid-email': 'Geçersiz e-posta.',
    'auth/user-not-found': 'Kullanıcı bulunamadı.',
    'auth/wrong-password': 'Yanlış şifre.',
    'auth/email-already-in-use': 'Bu e-posta zaten kullanımda.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  };
  return map[code] || 'Hata oluştu: ' + code;
}

// ===== SCREEN NAVIGATION =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = '';
  });
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'flex';
    target.classList.add('active');
  }
  if (id === 'screen-menu') updateMenuUI();
  if (id === 'screen-finance') loadFinanceScreen();
  if (id === 'screen-settings') loadSettingsScreen();
  if (id === 'screen-character') loadCharacterScreen();
}

// ===== UI UPDATES =====
function updateMenuUI() {
  const el = document.getElementById('menu-username');
  if (el) el.textContent = '@' + userData.username;
  const pts = document.getElementById('menu-points');
  if (pts) pts.textContent = userData.points + ' 🪙';
  applyColorToAll(userData.cubeColor);
}

function applyColorToAll(color) {
  document.documentElement.style.setProperty('--cube-color', color);
  document.querySelectorAll('.menu-cube, .preview-cube, .cube-face').forEach(el => {
    el.style.background = color;
    el.style.boxShadow = `0 0 40px ${color}, inset 0 0 20px rgba(0,0,0,0.15)`;
  });
}

// ===== STAR BACKGROUND =====
function buildStars() {
  const container = document.getElementById('stars');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('div');
    s.className = 'star-dot';
    const size = Math.random() * 2 + 1;
    s.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      animation-duration:${2 + Math.random()*4}s;
      animation-delay:${Math.random()*4}s;
    `;
    container.appendChild(s);
  }
}

// ===== EYE FOLLOW MOUSE =====
document.addEventListener('mousemove', e => {
  document.querySelectorAll('.pupil').forEach(pupil => {
    const eye = pupil.parentElement;
    const rect = eye.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 6;
    const x = (dx / Math.max(dist,1)) * Math.min(dist, maxDist);
    const y = (dy / Math.max(dist,1)) * Math.min(dist, maxDist);
    pupil.style.transform = `translate(${x}px, ${y}px)`;
  });
});

// ===== SETTINGS =====
function loadSettingsScreen() {
  const u = document.getElementById('settings-username');
  if (u) u.value = userData.username;
  const dark = document.getElementById('dark-toggle');
  if (dark) dark.checked = document.body.classList.contains('dark');
}

async function saveUsername() {
  const val = document.getElementById('settings-username').value.trim();
  if (!val) return;
  userData.username = val;
  await saveUserData();
  updateMenuUI();
  alert('Kullanıcı adı güncellendi!');
}

function toggleDark(el) {
  document.body.classList.toggle('dark', el.checked);
  document.body.classList.toggle('light', !el.checked);
}

// ===== CHARACTER =====
function loadCharacterScreen() {
  const grid = document.getElementById('color-grid');
  if (!grid) return;
  grid.innerHTML = '';
  CUBE_COLORS.forEach(color => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch' + (color === userData.cubeColor ? ' selected' : '');
    sw.style.background = color;
    sw.onclick = () => selectColor(color);
    grid.appendChild(sw);
  });
  const pc = document.getElementById('preview-cube');
  if (pc) {
    pc.style.background = userData.cubeColor;
    pc.style.boxShadow = `0 0 50px ${userData.cubeColor}`;
  }
}

async function selectColor(color) {
  userData.cubeColor = color;
  await saveUserData();
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.classList.toggle('selected', sw.style.background === color ||
      rgbToHex(sw.style.background) === color.toLowerCase());
  });
  const pc = document.getElementById('preview-cube');
  if (pc) { pc.style.background = color; pc.style.boxShadow = `0 0 50px ${color}`; }
  applyColorToAll(color);
}

function rgbToHex(rgb) {
  const r = rgb.match(/\d+/g);
  if (!r) return '';
  return '#' + r.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

// ===== FINANCE =====
async function loadFinanceScreen() {
  const doc = await db.collection('users').doc(currentUser.uid).get();
  if (doc.exists) userData = { ...userData, ...doc.data() };
  document.getElementById('fin-points').textContent = userData.points + ' 🪙';
  document.getElementById('fin-tl').textContent = '≈ ' + (userData.points * 0.0001).toFixed(4) + ' TL';

  const snap = await db.collection('withdrawals')
    .where('uid', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  const container = document.getElementById('withdraw-items');
  if (snap.empty) {
    container.innerHTML = '<p style="color:var(--text2);font-size:0.85rem">Henüz talep yok.</p>';
    return;
  }
  container.innerHTML = '';
  snap.forEach(d => {
    const w = d.data();
    const div = document.createElement('div');
    div.className = 'withdraw-item';
    const statusClass = w.status === 'pending' ? 'w-pending' : w.status === 'done' ? 'w-done' : 'w-denied';
    const statusText = w.status === 'pending' ? '⏳ Beklemede' : w.status === 'done' ? '✅ Onaylandı' : '❌ Reddedildi';
    div.innerHTML = `<span>${w.amount} puan → ${(w.amount * 0.0001).toFixed(4)} TL</span><span class="${statusClass}">${statusText}</span>`;
    container.appendChild(div);
  });
}

async function requestWithdraw() {
  const amount = parseInt(document.getElementById('withdraw-amount').value);
  const iban = document.getElementById('withdraw-iban').value.trim();
  const msg = document.getElementById('fin-msg');

  if (!amount || amount < 10000) { msg.textContent = 'Minimum 10.000 puan ile çekim yapabilirsiniz.'; return; }
  if (!iban) { msg.textContent = 'IBAN veya Papara no giriniz.'; return; }
  if (userData.points < amount) { msg.textContent = 'Yetersiz puan!'; return; }

  try {
    await db.collection('withdrawals').add({
      uid: currentUser.uid,
      username: userData.username,
      amount,
      iban,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    userData.points -= amount;
    await saveUserData();
    updateMenuUI();
    msg.style.color = 'var(--accent)';
    msg.textContent = '✅ Çekim talebi gönderildi! İnceleme 1-3 iş günü sürer.';
    document.getElementById('withdraw-amount').value = '';
    document.getElementById('withdraw-iban').value = '';
    loadFinanceScreen();
  } catch(e) {
    msg.textContent = 'Hata: ' + e.message;
  }
}

// ===== GAME ENGINE =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameRunning = false;
let animFrame = null;
let gameState = {};

function initGameState() {
  const W = canvas.width;
  const H = canvas.height;
  return {
    W, H,
    score: 0,          // platforms passed
    points: 0,         // earned this session
    level: 1,
    speed: 2,
    platforms: [],
    particles: [],
    player: {
      x: W * 0.25,
      y: H * 0.5,
      w: 38, h: 38,
      vy: 0,
      vx: 0,
      jumpsLeft: 2,
      maxJumps: 2,
      onGround: false,
      color: userData.cubeColor,
      eyeX: 0, eyeY: 0,
      blinkTimer: 0,
      squish: 1,
    },
    camera: { y: 0 },
    targetCameraY: 0,
    jumpQueue: 0,
    lastClickTime: 0,
    doubleClickDelay: 280,
    pendingJumps: 0,
    groundY: H - 60,
    highestY: H * 0.5,
    passed: 0,
  };
}

function startGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gameState = initGameState();
  gameRunning = true;
  document.getElementById('game-over-panel').classList.add('hidden');

  // Generate initial platforms
  generatePlatforms();

  // Input
  canvas.onclick = null;
  canvas.ondblclick = null;
  canvas.removeEventListener('pointerdown', handlePointer);
  canvas.addEventListener('pointerdown', handlePointer);

  if (animFrame) cancelAnimationFrame(animFrame);
  gameLoop();
}

function stopGame() {
  gameRunning = false;
  if (animFrame) cancelAnimationFrame(animFrame);
  canvas.removeEventListener('pointerdown', handlePointer);
}

function restartGame() {
  startGame();
}

let lastPointerTime = 0;
let pointerClickCount = 0;
let pointerTimer = null;

function handlePointer(e) {
  e.preventDefault();
  const now = Date.now();
  pointerClickCount++;
  clearTimeout(pointerTimer);
  pointerTimer = setTimeout(() => {
    const jumps = Math.min(pointerClickCount, 2);
    doJump(jumps);
    pointerClickCount = 0;
  }, 220);
}

function doJump(count) {
  const p = gameState.player;
  if (count === 2 && p.maxJumps >= 2) {
    // Double jump: reset and do two
    p.jumpsLeft = 2;
    p.vy = -14;
    p.squish = 0.6;
    setTimeout(() => {
      if (!gameRunning) return;
      p.vy = -13;
      p.squish = 0.6;
    }, 180);
    spawnParticles(p.x + p.w/2, p.y + p.h, p.color, 10);
  } else if (p.jumpsLeft > 0) {
    p.vy = -14;
    p.jumpsLeft--;
    p.squish = 0.6;
    spawnParticles(p.x + p.w/2, p.y + p.h, p.color, 6);
  }
}

function generatePlatforms() {
  const gs = gameState;
  const W = gs.W, H = gs.H;
  gs.platforms = [];

  // Ground platform
  gs.platforms.push({ x: 0, y: gs.groundY, w: W, h: 20, color: '#334455', type: 'ground' });

  // First safe platform above
  gs.platforms.push({ x: W * 0.1, y: gs.groundY - 140, w: 180, h: 18, color: platformColor(0), type: 'normal', id: 1 });

  let lastY = gs.groundY - 140;
  for (let i = 2; i <= 80; i++) {
    const gap = 110 + Math.random() * 60 + Math.min(i * 2, 60);
    const y = lastY - gap;
    const w = Math.max(60, 180 - i * 1.5 + Math.random() * 60);
    const x = 40 + Math.random() * (W - w - 80);
    gs.platforms.push({
      x, y, w, h: 18,
      color: platformColor(i),
      type: i % 12 === 0 ? 'moving' : 'normal',
      id: i,
      dir: 1, speed: 1 + Math.random() * 1.5,
      minX: 20, maxX: W - w - 20,
    });
    lastY = y;
  }
}

function platformColor(i) {
  const colors = ['#1e3a5f','#1a4a2e','#3a1a4a','#4a2a1a','#1a3a4a'];
  return colors[i % colors.length];
}

function spawnParticles(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    gameState.particles.push({
      x, y,
      vx: (Math.random()-0.5)*5,
      vy: -Math.random()*4-1,
      r: Math.random()*4+2,
      color,
      life: 1,
    });
  }
}

function gameLoop() {
  if (!gameRunning) return;
  update();
  render();
  animFrame = requestAnimationFrame(gameLoop);
}

function update() {
  const gs = gameState;
  const p = gs.player;
  const W = gs.W, H = gs.H;
  const gravity = 0.55;

  // Speed increases with level
  gs.speed = 2 + gs.level * 0.4;
  gs.level = 1 + Math.floor(gs.score / 10);

  // Move all platforms down (scrolling)
  const scrollSpeed = gs.speed * 0.5;
  gs.platforms.forEach(pl => {
    pl.y += scrollSpeed;
    // Moving platforms
    if (pl.type === 'moving') {
      pl.x += pl.dir * pl.speed;
      if (pl.x < pl.minX || pl.x > pl.maxX) pl.dir *= -1;
    }
  });

  // Player physics
  p.vy += gravity;
  p.y += p.vy;
  p.y += scrollSpeed; // scroll player down with world

  // Check platform collision (only when falling)
  p.onGround = false;
  if (p.vy >= 0) {
    gs.platforms.forEach(pl => {
      if (
        p.x + p.w > pl.x + 4 &&
        p.x < pl.x + pl.w - 4 &&
        p.y + p.h >= pl.y &&
        p.y + p.h <= pl.y + pl.h + p.vy + 2
      ) {
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.jumpsLeft = p.maxJumps;
        // Count platform pass
        if (pl.id && !pl.passed) {
          pl.passed = true;
          gs.score++;
          gs.points += 20; // 20 pts per platform
          if (gs.score % 50 === 0) gs.points += 500; // bonus every 50
          updateHUD();
          spawnParticles(p.x + p.w/2, p.y, userData.cubeColor, 8);
        }
      }
    });
  }

  // Squish recovery
  p.squish = Math.min(1, p.squish + 0.05);

  // Eye tracking (look at nearest platform above)
  const above = gs.platforms.filter(pl => pl.y < p.y).sort((a,b) => b.y - a.y)[0];
  if (above) {
    const tx = (above.x + above.w/2) - (p.x + p.w/2);
    const ty = above.y - p.y;
    const d = Math.sqrt(tx*tx+ty*ty);
    p.eyeX += ((tx/d) * 5 - p.eyeX) * 0.15;
    p.eyeY += ((ty/d) * 5 - p.eyeY) * 0.15;
  }

  // Blink
  p.blinkTimer++;
  if (p.blinkTimer > 180 + Math.random()*120) p.blinkTimer = -8;

  // Remove off-screen platforms at bottom, add new at top
  gs.platforms = gs.platforms.filter(pl => pl.y < H + 50);
  while (gs.platforms.length < 30) {
    const top = gs.platforms.reduce((a,b) => a.y < b.y ? a : b);
    const gap = 110 + Math.random() * 70 + Math.min(gs.score * 2, 80);
    const w = Math.max(55, 180 - gs.score * 0.5 + Math.random() * 50);
    const x = 40 + Math.random() * (W - w - 80);
    const id = (top.id || 0) + 1;
    gs.platforms.push({
      x, y: top.y - gap, w, h: 18,
      color: platformColor(id),
      type: id % 10 === 0 ? 'moving' : 'normal',
      id, dir: 1, speed: 1 + Math.random() * gs.level * 0.5,
      minX: 20, maxX: W - w - 20,
    });
  }

  // Particles
  gs.particles.forEach(pt => {
    pt.x += pt.vx;
    pt.y += pt.vy;
    pt.vy += 0.15;
    pt.life -= 0.04;
  });
  gs.particles = gs.particles.filter(pt => pt.life > 0);

  // Death: fell below screen
  if (p.y > H + 100) {
    triggerGameOver();
  }

  // Horizontal bounds
  if (p.x < 0) p.x = 0;
  if (p.x + p.w > W) p.x = W - p.w;
}

function updateHUD() {
  const gs = gameState;
  document.getElementById('hud-platform').textContent = 'Platform: ' + gs.score;
  document.getElementById('hud-points').textContent = '🪙 ' + gs.points;
  document.getElementById('hud-level').textContent = 'Lvl ' + gs.level;
}

function render() {
  const gs = gameState;
  const p = gs.player;
  const W = gs.W, H = gs.H;
  const isDark = document.body.classList.contains('dark');

  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  if (isDark) {
    grad.addColorStop(0, '#070712');
    grad.addColorStop(1, '#0d1225');
  } else {
    grad.addColorStop(0, '#c8d8ff');
    grad.addColorStop(1, '#e8f0ff');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Background grid
  ctx.strokeStyle = isDark ? 'rgba(0,245,212,0.04)' : 'rgba(0,0,100,0.05)';
  ctx.lineWidth = 1;
  const gridSize = 60;
  for (let x = 0; x < W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke();
  }
  for (let y = 0; y < H; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }

  // Platforms
  gs.platforms.forEach(pl => {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(pl.x + 4, pl.y + 6, pl.w, pl.h, 6);
    ctx.fill();

    // Platform body
    const pgr = ctx.createLinearGradient(pl.x, pl.y, pl.x, pl.y + pl.h);
    pgr.addColorStop(0, lighten(pl.color, 20));
    pgr.addColorStop(1, pl.color);
    ctx.fillStyle = pgr;
    ctx.beginPath();
    ctx.roundRect(pl.x, pl.y, pl.w, pl.h, 6);
    ctx.fill();

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(pl.x + 2, pl.y, pl.w - 4, 4, 3);
    ctx.fill();

    // Moving indicator
    if (pl.type === 'moving') {
      ctx.fillStyle = 'rgba(255,200,0,0.6)';
      ctx.beginPath();
      ctx.arc(pl.x + pl.w/2, pl.y - 8, 3, 0, Math.PI*2);
      ctx.fill();
    }
  });

  // Particles
  gs.particles.forEach(pt => {
    ctx.globalAlpha = pt.life;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Player cube
  drawPlayer(p);
}

function drawPlayer(p) {
  const cx = p.x + p.w/2;
  const cy = p.y + p.h/2;
  const hw = p.w/2 * (1/p.squish);
  const hh = p.h/2 * p.squish;

  ctx.save();
  ctx.translate(cx, cy);

  // Glow
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 20;

  // Cube body
  const gr = ctx.createLinearGradient(-hw, -hh, hw, hh);
  gr.addColorStop(0, lighten(p.color, 30));
  gr.addColorStop(1, p.color);
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.roundRect(-hw, -hh, hw*2, hh*2, 7);
  ctx.fill();

  // Top highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.roundRect(-hw+3, -hh+3, hw*2-6, hh*0.4, 4);
  ctx.fill();

  // Eye whites
  const eyeR = hw * 0.55;
  const eyeX = p.eyeX;
  const eyeY = p.eyeY;

  const blinking = p.blinkTimer < 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, eyeR, 0, Math.PI*2);
  ctx.fill();

  if (blinking) {
    // Blink: draw closed eye line
    ctx.fillStyle = p.color;
    ctx.fillRect(-eyeR, -eyeR*0.3, eyeR*2, eyeR*0.6);
  } else {
    // Pupil
    ctx.fillStyle = '#111';
    const px = Math.max(-eyeR*0.35, Math.min(eyeR*0.35, eyeX));
    const py = Math.max(-eyeR*0.35, Math.min(eyeR*0.35, eyeY));
    ctx.beginPath();
    ctx.arc(px, py, eyeR * 0.45, 0, Math.PI*2);
    ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - eyeR*0.12, py - eyeR*0.12, eyeR*0.15, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

function lighten(hex, amount) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xFF) + amount);
  const b = Math.min(255, (num & 0xFF) + amount);
  return `rgb(${r},${g},${b})`;
}

async function triggerGameOver() {
  gameRunning = false;
  cancelAnimationFrame(animFrame);

  const gs = gameState;
  document.getElementById('go-score').textContent =
    gs.score + ' Platform | ' + gs.points + ' Puan';
  document.getElementById('game-over-panel').classList.remove('hidden');

  // Save points to Firestore
  if (currentUser && gs.points > 0) {
    userData.points = (userData.points || 0) + gs.points;
    await saveUserData();
    updateMenuUI();
  }
}

// Canvas roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    if (w < 2*r) r = w/2;
    if (h < 2*r) r = h/2;
    this.moveTo(x+r, y);
    this.arcTo(x+w, y, x+w, y+h, r);
    this.arcTo(x+w, y+h, x, y+h, r);
    this.arcTo(x, y+h, x, y, r);
    this.arcTo(x, y, x+w, y, r);
    this.closePath();
    return this;
  };
}

// Resize canvas on window resize
window.addEventListener('resize', () => {
  if (gameRunning) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.W = canvas.width;
    gameState.H = canvas.height;
    gameState.groundY = canvas.height - 60;
  }
});
