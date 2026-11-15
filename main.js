// Pomp! – vaihe 1: moottori ja testikenttä.
// Kulku: aloitusruutu -> kamera ja mallin lataus -> kalibrointi -> testikenttä.
import { CONFIG } from './config.js';
import { startCamera, keepAwake } from './engine/camera.js';
import { createPoseEngine, PoseTracker, LM } from './engine/pose.js';
import { Calibrator } from './engine/calibrate.js';
import { MotionDetector } from './engine/motion.js';
import { Avatar } from './engine/avatar.js';
import { Simulator, attachSimControls, SIM_HELP } from './engine/simulator.js';
import { drawDebug } from './engine/debug.js';

const $ = (id) => document.getElementById(id);
const video = $('cam'), canvas = $('stage'), ctx = canvas.getContext('2d');
const FONT = 'Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const C = { yo: '#1D1147', yoVaalea: '#3B2596', lattia: '#150B38', minttu: '#3DE0B0', kerma: '#FFF4D6', ...CONFIG.varit };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const params = new URLSearchParams(location.search);

// Piirtoalue: korkeus on aina 720 yksikköä, leveys venyy näytön muodon mukaan (16:9 -> 1280).
const view = { w: 1280, h: 720, scale: 1 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.naytto.maxDpr);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  view.scale = canvas.height / view.h;
  view.w = canvas.width / view.scale;
}
window.addEventListener('resize', resize);
resize();

// --- Tila ---
let mode = 'start';           // 'start' | 'loading' | 'calibrate' | 'lab'
let facing = CONFIG.kamera.oletus;
let engine = null, sim = null, pose = null;
let debug = params.has('debug'), paused = false, doneAt = 0;
const tracker = new PoseTracker(CONFIG);
const calib = new Calibrator(CONFIG);
const motion = new MotionDetector(CONFIG);
const avatar = new Avatar(CONFIG);
const stats = { fps: 60, poseFps: 0, inferMs: 0, delegate: '–' };
const flash = { jump: 0, squat: 0, step: 0 };
const trails = { left: [], right: [] };
let particles = [];
let lastFrame = performance.now(), lastDetect = 0, lastVideoTime = -1, detectErrors = 0;
let map = null; // viimeisin muunnos videon pikseleistä ruudulle (simulaattorin hiirtä varten)

// --- Käyttöliittymän apurit ---
function show(id, on) { $(id).hidden = !on; }
function message(text, extra = '', retry = false) {
  $('viestiTeksti').textContent = text; $('viestiLisa').textContent = extra;
  show('btnUudelleen', retry); show('viesti', true);
}
function enter(next) {
  mode = next;
  show('alku', mode === 'start');
  show('viesti', mode === 'loading');
  show('tyokalut', mode === 'calibrate' || mode === 'lab');
  show('simohje', !!sim && (mode === 'calibrate' || mode === 'lab'));
  $('btnKamera').hidden = !!sim; $('btnKiihdytys').hidden = !!sim;
}
function startCalibration() {
  calib.reset(); avatar.p = null; paused = false; doneAt = 0;
  enter('calibrate');
}

async function startWithCamera() {
  enter('loading');
  message('Käynnistetään kamera');
  try {
    if (matchMedia('(pointer: coarse)').matches) {
      // Puhelimella: koko näyttö ja vaakasuunta, jos selain sallii. Epäonnistuminen ei haittaa.
      try { await document.documentElement.requestFullscreen(); await screen.orientation.lock('landscape'); } catch (e) { /* ei tuettu */ }
    }
    await startCamera(video, CONFIG, facing);
    keepAwake();
    if (!engine) {
      message('Ladataan asennon tunnistusta', 'Ensimmäisellä kerralla tämä voi kestää puoli minuuttia.');
      engine = await createPoseEngine(CONFIG);
      stats.delegate = engine.delegate; $('btnKiihdytys').textContent = engine.delegate;
    }
    tracker.reset();
    startCalibration();
  } catch (err) {
    console.error(err);
    message(err.message || 'Käynnistys epäonnistui.', 'Tarkista verkkoyhteys ja kameran lupa.', true);
  }
}

function startSimulator() {
  sim = new Simulator();
  stats.delegate = 'simulaattori';
  $('simohje').textContent = SIM_HELP;
  attachSimControls(sim, canvas, (cx, cy) => {
    if (!map) return null;
    const r = canvas.getBoundingClientRect();
    return map.inv((cx - r.left) / r.width * view.w, (cy - r.top) / r.height * view.h);
  });
  tracker.reset();
  startCalibration();
}

$('btnAloita').onclick = startWithCamera;
$('btnUudelleen').onclick = startWithCamera;
$('btnSim').onclick = startSimulator;
$('btnKalibroi').onclick = startCalibration;
$('btnDebug').onclick = () => { debug = !debug; $('btnDebug').setAttribute('aria-pressed', String(debug)); };
$('btnDebug').setAttribute('aria-pressed', String(debug));
$('btnKamera').onclick = async () => {
  facing = facing === 'environment' ? 'user' : 'environment';
  await startWithCamera();
};
$('btnKiihdytys').onclick = async () => {
  if (!engine) return;
  const next = engine.delegate === 'GPU' ? 'CPU' : 'GPU';
  enter('loading'); message('Vaihdetaan laskentatapaa: ' + next);
  try { engine.close(); engine = await createPoseEngine(CONFIG, next); }
  catch (err) { message('Vaihto epäonnistui: ' + err.message, '', true); engine = null; return; }
  stats.delegate = engine.delegate; $('btnKiihdytys').textContent = engine.delegate;
  startCalibration();
};

// --- Piirtoapurit ---
function text(str, x, y, size, color, align = 'center', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function background(floorY) {
  const g = ctx.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, C.yo); g.addColorStop(1, C.yoVaalea);
  ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, floorY);
  const spot = ctx.createRadialGradient(view.w / 2, floorY, 20, view.w / 2, floorY, 520);
  spot.addColorStop(0, 'rgba(150, 110, 255, 0.55)'); spot.addColorStop(1, 'rgba(150, 110, 255, 0)');
  ctx.fillStyle = spot; ctx.fillRect(0, 0, view.w, floorY);
  ctx.fillStyle = C.lattia; ctx.fillRect(0, floorY, view.w, view.h - floorY);
  ctx.fillStyle = C.minttu; ctx.fillRect(0, floorY - 3, view.w, 6);
}

// --- Kalibrointinäkymä ---
const HINTS = {
  none: 'Tule kameran eteen', feet: 'Jalat eivät näy. Astu kauemmas.', near: 'Astu kauemmas', far: 'Tule lähemmäs',
  left: 'Siirry vasemmalle', right: 'Siirry oikealle', still: 'Seiso paikallaan', hold: 'Hyvä! Pysy paikallaan', done: 'Valmista!',
};
function drawCalibration(dt) {
  const vw = pose ? pose.vw : 1280, vh = pose ? pose.vh : 720;
  // Kameran kuva-ala sovitetaan ruudun alaosaan, jotta ohjeteksti mahtuu yläreunaan pään päälle
  const s = Math.min(view.w / vw, (view.h - 150) / vh), ox = (view.w - vw * s) / 2, oy = view.h - vh * s;
  const floorY = oy + vh * 0.9 * s + 6;
  background(floorY);
  map = { inv: (x, y) => ({ x: (x - ox) / s, y: (y - oy) / s }) };

  // Seisomapaikka: katkoviivahahmo keskellä
  const feet = oy + vh * 0.9 * s, hgt = vh * 0.52 * s, cx = view.w / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.5)'; ctx.lineWidth = 5; ctx.setLineDash([14, 12]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, feet - hgt + hgt * 0.1, hgt * 0.1, 0, Math.PI * 2); ctx.stroke();
  rrect(cx - hgt * 0.13, feet - hgt * 0.78, hgt * 0.26, hgt * 0.78, hgt * 0.12); ctx.stroke();
  ctx.restore();

  if (pose) {
    const P = pose.pts;
    const unit = Math.hypot(P[LM.L_SHOULDER].x - P[LM.R_SHOULDER].x, P[LM.L_SHOULDER].y - P[LM.R_SHOULDER].y) * s || 60;
    avatar.update(P.map((p) => ({ x: ox + p.x * s, y: oy + p.y * s, v: p.v })), unit, dt);
    avatar.draw(ctx);
  }

  const st = calib.status;
  const tone = st === 'left' ? C.vasen : st === 'right' ? C.oikea : (st === 'hold' || st === 'done') ? C.minttu : C.kerma;
  ctx.save();
  ctx.fillStyle = 'rgba(21, 11, 56, 0.72)'; rrect(view.w / 2 - 330, 28, 660, 112, 56); ctx.fill();
  ctx.restore();
  const arrow = st === 'left' ? '←  ' : '';
  const arrowR = st === 'right' ? '  →' : '';
  text(arrow + HINTS[st] + arrowR, view.w / 2, 70, 40, tone, 'center', 700);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'; rrect(view.w / 2 - 250, 104, 500, 16, 8); ctx.fill();
  if (calib.progress > 0) { ctx.fillStyle = C.minttu; rrect(view.w / 2 - 250, 104, Math.max(16, 500 * calib.progress), 16, 8); ctx.fill(); }
}

// --- Testikenttä ---
function drawLab(dt) {
  const s = motion.state, cal = motion.cal, floorY = 572;
  const scale = 400 / (cal.bodyH / cal.S + 0.9);                    // ruutupikseliä per hartialeveys
  const legs = (cal.ankleL + cal.ankleR) / 2 / cal.S;
  const ax = view.w / 2, ay = floorY - (legs + 0.36) * scale;       // lantion paikka ruudulla seistessä
  const S = motion.S;
  const toScreen = (p) => ({ x: ax + (p.x - cal.centerX) / S * scale, y: ay + (p.y - motion.baseY) / S * scale });
  map = { inv: (x, y) => ({ x: cal.centerX + (x - ax) / scale * S, y: motion.baseY + (y - ay) / scale * S }) };

  background(floorY);

  // Kaistat lattiassa: vasen sininen, oikea punainen
  const lw = (CONFIG.kaista.raja - CONFIG.kaista.hystereesi / 2) * 2 * scale;
  const lanes = [['vasen', C.vasen], ['keski', C.kerma], ['oikea', C.oikea]];
  lanes.forEach(([name, color], i) => {
    const on = s.lane === i - 1, x = ax + (i - 1) * lw - lw / 2 + 5;
    ctx.globalAlpha = on ? 1 : 0.28; ctx.fillStyle = color;
    rrect(x, floorY + 14, lw - 10, 28, 14); ctx.fill();
    ctx.globalAlpha = on ? 1 : 0.6;
    text(name, x + (lw - 10) / 2, floorY + 64, 24, color);
    ctx.globalAlpha = 1;
  });

  if (pose && s.present) {
    avatar.update(pose.pts.map((p) => { const q = toScreen(p); q.v = p.v; return q; }), scale, dt);
  }
  avatar.drawShadow(ctx, floorY);

  // Käsien vanat nopeassa liikkeessä
  for (const name of ['left', 'right']) {
    const hd = s.hands[name], tr = trails[name], color = name === 'left' ? C.vasen : C.oikea;
    if (hd.visible && s.present && hd.speed > CONFIG.kadet.viiltoNopeus * 0.6) {
      const q = toScreen({ x: hd.px, y: hd.py }); tr.push({ x: q.x, y: q.y, life: 1, hot: hd.slashing });
    }
    for (const t of tr) t.life -= dt * 4;
    while (tr.length && tr[0].life <= 0) tr.shift();
    ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      if (Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y) > 200) continue;
      ctx.strokeStyle = tr[i].hot ? '#fff' : color; ctx.globalAlpha = tr[i].life * 0.8; ctx.lineWidth = 4 + tr[i].life * 18;
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  avatar.draw(ctx);

  // Hypyn tähdet
  particles = particles.filter((p) => (p.life -= dt * 1.6) > 0);
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt;
    ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Taukoeleen rengas pään päällä
  if (s.pauseProgress > 0 && avatar.p) {
    const n = avatar.p[LM.NOSE];
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(n.x, n.y - scale * 1.6, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.minttu;
    ctx.beginPath(); ctx.arc(n.x, n.y - scale * 1.6, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.pauseProgress); ctx.stroke();
  }

  // Mittarit oikeassa laidassa
  const px = view.w - 300, pw = 268;
  const lamp = (y, label, value, on, color) => {
    ctx.fillStyle = on ? color : 'rgba(255, 255, 255, 0.12)'; rrect(px, y, pw, 62, 31); ctx.fill();
    text(label, px + 26, y + 32, 28, on ? CONFIG.varit.aariviiva : C.kerma, 'left');
    text(String(value), px + pw - 26, y + 32, 30, on ? CONFIG.varit.aariviiva : C.kerma, 'right', 700);
  };
  for (const k in flash) flash[k] = Math.max(0, flash[k] - dt * 3);
  lamp(84, 'Hyppy', s.counters.jumps, s.jump.active || flash.jump > 0, C.minttu);
  lamp(156, 'Kyykky', s.counters.squats, s.squat.active || flash.squat > 0, C.minttu);
  lamp(228, 'Juoksu', s.counters.steps, s.run.active, C.minttu);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; rrect(px, 298, pw, 12, 6); ctx.fill();
  if (s.run.speed > 0) { ctx.fillStyle = C.hahmo; rrect(px, 298, Math.max(12, pw * s.run.speed), 12, 6); ctx.fill(); }
  const meter = (y, label, hd, color) => {
    const full = CONFIG.kadet.viiltoNopeus * 2, f = clamp(hd.speed / full, 0, 1);
    text(label, px + 4, y, 24, hd.visible ? color : 'rgba(255,255,255,0.35)', 'left');
    if (hd.slashing) text('Viuh!', px + pw - 4, y, 26, '#fff', 'right', 700);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; rrect(px, y + 20, pw, 14, 7); ctx.fill();
    if (f > 0.02) { ctx.fillStyle = hd.slashing ? '#fff' : color; rrect(px, y + 20, Math.max(14, pw * f), 14, 7); ctx.fill(); }
    ctx.fillStyle = C.kerma; ctx.fillRect(px + pw / 2 - 1, y + 16, 3, 22); // viipaloinnin raja
  };
  meter(352, 'Vasen käsi', s.hands.left, C.vasen);
  meter(418, 'Oikea käsi', s.hands.right, C.oikea);

  if (!s.present) banner('Tule takaisin kuvaan');
  else if (paused) banner('Tauko', 'Nosta molemmat kädet ylös, niin jatketaan');
  else text('Hyppää, kyykisty, astu sivulle, juokse paikallaan ja huitaise käsillä', view.w / 2, view.h - 44, 20, 'rgba(255, 244, 214, 0.7)', 'center', 500);
}
function banner(title, sub) {
  ctx.fillStyle = 'rgba(21, 11, 56, 0.78)'; ctx.fillRect(0, 0, view.w, view.h);
  text(title, view.w / 2, view.h / 2 - (sub ? 24 : 0), 76, C.hahmo, 'center', 700);
  if (sub) text(sub, view.w / 2, view.h / 2 + 44, 28, C.kerma, 'center', 500);
}

function handleEvents() {
  for (const e of motion.takeEvents()) {
    if (e.type === 'pauseGesture') { paused = !paused; continue; }
    if (paused) continue;
    if (e.type === 'jump') {
      flash.jump = 1; avatar.cheer();
      const h = avatar.hips;
      if (h) for (let i = 0; i < 14; i++) {
        const a = Math.PI + Math.random() * Math.PI;
        particles.push({ x: h.x, y: avatar.feetY, vx: Math.cos(a) * (120 + Math.random() * 260), vy: Math.sin(a) * (200 + Math.random() * 300), life: 1, size: 5 + Math.random() * 7, color: [C.hahmo, C.minttu, '#fff'][i % 3] });
      }
    } else if (e.type === 'squat') flash.squat = 1;
    else if (e.type === 'step') flash.step = 1;
  }
}

// --- Pääsilmukka ---
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (dt > 0) stats.fps += 0.05 * (1 / dt - stats.fps);

  // 1. Uusi asento kamerasta tai simulaattorista
  if (mode === 'calibrate' || mode === 'lab') {
    let raw, got = false, vw = 0, vh = 0;
    const due = now - lastDetect >= 1000 / CONFIG.malli.maxFps - 2;
    if (sim) {
      sim.step(dt);
      if (due) { raw = sim.landmarks(); vw = sim.vw; vh = sim.vh; got = true; }
    } else if (engine && due && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const t0 = performance.now();
      try { raw = engine.detect(video, now); detectErrors = 0; }
      catch (err) {
        console.error(err); raw = null;
        // Jos GPU-laskenta kaatuu toistuvasti tällä laitteella, vaihdetaan itse CPU:hun
        if (++detectErrors === 3 && engine.delegate === 'GPU') $('btnKiihdytys').onclick();
      }
      stats.inferMs += 0.1 * (performance.now() - t0 - stats.inferMs);
      vw = video.videoWidth; vh = video.videoHeight; got = true;
    }
    if (got) {
      if (lastDetect) stats.poseFps += 0.1 * (1000 / (now - lastDetect) - stats.poseFps);
      lastDetect = now;
      pose = tracker.update(raw, vw, vh, now);
      if (mode === 'calibrate') {
        if (calib.update(pose, now) === 'done' && !doneAt) { doneAt = now; motion.setCalibration(calib.result); }
      } else {
        motion.update(pose, now);
        handleEvents();
      }
    }
    if (mode === 'calibrate' && doneAt && now - doneAt > 700) { doneAt = 0; avatar.p = null; enter('lab'); }
  }

  // 2. Piirto
  ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
  if (mode === 'calibrate') drawCalibration(dt);
  else if (mode === 'lab') drawLab(dt);
  else { ctx.fillStyle = C.yo; ctx.fillRect(0, 0, view.w, view.h); }
  if (debug && (mode === 'calibrate' || mode === 'lab')) {
    drawDebug(ctx, view, { video: sim ? null : video, pose, motion: mode === 'lab' ? motion : null, cfg: CONFIG, stats });
  }
}

// Testausta ja vianetsintää varten selaimen konsolista
window.pomp = { CONFIG, motion, calib, avatar, get sim() { return sim; }, get mode() { return mode; } };

enter('start');
if (params.has('sim')) startSimulator();
requestAnimationFrame(frame);
