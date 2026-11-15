// Liikkeiden tunnistus. Ottaa pehmennetyn asennon ja kertoo, mitä lapsi tekee.
// Minipelit lukevat tilan (state) ja tapahtumat (takeEvents), eivät koskaan raakapisteitä.
import { LM } from './pose.js';

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (dt, tau) => 1 - Math.exp(-dt / tau);

function newHand() {
  return { visible: false, px: 0, py: 0, x: 0, y: 0, vx: 0, vy: 0, speed: 0, slashing: false, raised: false };
}

export class MotionDetector {
  constructor(cfg) {
    this.cfg = cfg;
    this.cal = null;
    this.events = [];
    this.state = {
      present: false,
      hipOffset: 0,          // lantion korkeus perustasosta, S (+ = ylös)
      jump: { active: false, height: 0 },
      squat: { active: false },
      lane: 0,               // -1 = vasen, 0 = keski, 1 = oikea (lapsen oma vasen ja oikea)
      laneOffset: 0,         // siirtymä keskeltä, S
      run: { active: false, cadence: 0, speed: 0 },  // cadence = askelta/s, speed = 0–1
      hands: { left: newHand(), right: newHand() },   // x, y = kehoyksiköissä (S), px, py = videon pikseleinä
      pauseProgress: 0,      // 0–1, molemmat kädet ylhäällä
      counters: { jumps: 0, squats: 0, steps: 0 },
    };
  }

  setCalibration(cal) {
    this.cal = cal;
    this.baseY = cal.hipY; // lantion perustaso, päivittyy hitaasti
    this.k = 1;            // mittakaavakerroin, jos lapsi siirtyy lähemmäs tai kauemmas
    this.lastT = null; this.prevOff = null; this.vel = 0; this.stuckMs = 0; this.stuckRef = null; this.rebasing = false; this.lostMs = 0;
    this.jumpStartT = 0; this.jumpEndT = -1e9; this.jumpPeak = 0; this.squatMs = 0;
    this.diff = 0; this.lastSide = 0; this.stepTimes = [];
    this.pauseMs = 0; this.pauseFired = false;
    this.prevPalm = { left: null, right: null };
    const s = this.state;
    s.present = false; s.lane = 0; s.jump.active = false; s.squat.active = false;
    s.run.active = false; s.run.cadence = 0; s.run.speed = 0;
    s.counters.jumps = 0; s.counters.squats = 0; s.counters.steps = 0;
    this.events = [];
  }

  get S() { return this.cal.S * this.k; }

  // Videon pikselit -> kehoyksiköt: origo kalibroidussa lantiossa, 1 yksikkö = hartialeveys, y kasvaa alaspäin
  toBody(p) { return { x: (p.x - this.cal.centerX) / this.S, y: (p.y - this.baseY) / this.S }; }

  takeEvents() { const e = this.events; this.events = []; return e; }
  emit(type, data) { this.events.push(Object.assign({ type }, data)); }

  update(pose, tMs) {
    const cfg = this.cfg, s = this.state, cal = this.cal;
    if (!cal) return s;
    const dtMs = this.lastT === null ? 33 : clamp(tMs - this.lastT, 1, 250);
    const dt = dtMs / 1000;
    this.lastT = tMs;
    const vis = cfg.pehmennys.nakyvyysRaja;
    const P = pose ? pose.pts : null;
    const ok = (i) => P[i].v >= vis;

    // --- Onko pelaaja kuvassa? ---
    const seen = !!P && ok(LM.L_SHOULDER) && ok(LM.R_SHOULDER) && ok(LM.L_HIP) && ok(LM.R_HIP);
    if (!seen) {
      this.lostMs += dtMs;
      if (s.present && this.lostMs >= cfg.lasnaolo.poissaMs) {
        s.present = false; s.jump.active = false; s.squat.active = false;
        s.run.active = false; s.run.cadence = 0; s.run.speed = 0;
        s.hands.left.visible = false; s.hands.right.visible = false;
        s.pauseProgress = 0; this.pauseMs = 0; this.prevOff = null;
        this.emit('lost');
      }
      return s;
    }
    this.lostMs = 0;
    if (!s.present) { s.present = true; this.prevOff = null; this.emit('found'); }

    const hip = mid(P[LM.L_HIP], P[LM.R_HIP]);
    const sh = mid(P[LM.L_SHOULDER], P[LM.R_SHOULDER]);
    const S = this.S;

    // --- Lantion korkeus ja pystynopeus ---
    const off = (this.baseY - hip.y) / S;
    if (this.prevOff !== null) this.vel += 0.5 * ((off - this.prevOff) / dt - this.vel);
    this.prevOff = off;
    s.hipOffset = off;

    // Nilkkojen nousu lattiatasosta (S). null = nilkka ei näy.
    const rise = (ankleI, rel) => ok(ankleI) ? (this.baseY + rel * this.k - P[ankleI].y) / S : null;
    const riseL = rise(LM.L_ANKLE, cal.ankleL), riseR = rise(LM.R_ANKLE, cal.ankleR);

    // --- Hyppy ---
    const h = cfg.hyppy;
    if (!s.jump.active) {
      const anklesUp = !h.vaadiNilkat || riseL === null || riseR === null
        || (riseL >= h.nilkkaNousu && riseR >= h.nilkkaNousu);
      if (off >= h.kynnys && anklesUp && !s.squat.active && tMs - this.jumpEndT >= h.taukoMs) {
        s.jump.active = true; this.jumpStartT = tMs; this.jumpPeak = off;
        s.counters.jumps++;
        this.emit('jump');
      }
    } else {
      this.jumpPeak = Math.max(this.jumpPeak, off);
      if (off < h.paluu) {
        s.jump.active = false; this.jumpEndT = tMs;
        this.emit('land', { height: this.jumpPeak });
      } else if (tMs - this.jumpStartT > h.maxKestoMs) {
        // Ei ollut hyppy: lapsi on siirtynyt ja perustaso oli väärä. Korjataan heti.
        this.baseY = hip.y; s.jump.active = false; this.jumpEndT = tMs; this.prevOff = 0;
      }
    }
    s.jump.height = s.jump.active ? Math.max(0, off) : 0;

    // --- Kyykky ---
    const q = cfg.kyykky;
    if (!s.squat.active) {
      const landingGuard = tMs - this.jumpEndT < h.laskeutumisSuojaMs;
      if (-off >= q.kynnys && !s.jump.active && !landingGuard) {
        this.squatMs += dtMs;
        if (this.squatMs >= q.minKestoMs) {
          s.squat.active = true; s.counters.squats++;
          this.emit('squat');
        }
      } else this.squatMs = 0;
    } else if (-off < q.paluu) {
      s.squat.active = false; this.squatMs = 0;
      this.emit('squatEnd');
    }

    // --- Perustason ja mittakaavan hidas seuranta ---
    const b = cfg.perustaso;
    if (!s.jump.active && !s.squat.active) {
      if (Math.abs(off) < b.lepoAlue) {
        this.baseY += (hip.y - this.baseY) * ease(dt, b.hidasTau);
        this.stuckMs = 0; this.stuckRef = null;
        if (b.mukautuvaMittakaava) {
          const target = clamp(dist(sh, hip) / cal.T, 0.6, 1.6);
          this.k += (target - this.k) * ease(dt, b.hidasTau);
        }
      } else {
        // Lantio on jäänyt rajojen väliin. Jos se pysyy siinä paikallaan, lapsi on siirtynyt:
        // perustaso korjataan nopeasti uuteen kohtaan.
        if (this.stuckRef === null || Math.abs(off - this.stuckRef) > b.jumiAlue) { this.stuckRef = off; this.stuckMs = 0; }
        else this.stuckMs += dtMs;
        if (this.stuckMs > b.jumiMs) this.rebasing = true;
      }
      if (this.rebasing) {
        this.baseY += (hip.y - this.baseY) * ease(dt, b.nopeaTau);
        if (Math.abs(off) < b.lepoAlue) { this.rebasing = false; this.stuckRef = null; }
      }
    } else { this.stuckMs = 0; this.stuckRef = null; this.rebasing = false; }

    // --- Kaista (sivuaskel) ---
    const kc = cfg.kaista, lo = (hip.x - cal.centerX) / S, exit = kc.raja - kc.hystereesi;
    s.laneOffset = lo;
    let lane = s.lane;
    if (lane === 0) { if (lo <= -kc.raja) lane = -1; else if (lo >= kc.raja) lane = 1; }
    else if (lane === -1) { if (lo >= kc.raja) lane = 1; else if (lo > -exit) lane = 0; }
    else { if (lo <= -kc.raja) lane = -1; else if (lo < exit) lane = 0; }
    if (lane !== s.lane) { const from = s.lane; s.lane = lane; this.emit('lane', { lane, from }); }

    // --- Juoksu paikallaan ---
    // Mitataan, kumpi jalka on ylempänä suhteessa lantioon. Juoksussa jalat vuorottelevat,
    // hypyssä ja kyykyssä molemmat liikkuvat yhdessä -> ero pysyy nollassa -> ei vääriä askelia.
    const j = cfg.juoksu;
    const lift = (ankleI, kneeI, hipI, ankleRel, kneeRel) => {
      if (ok(ankleI)) return (ankleRel * this.k - (P[ankleI].y - P[hipI].y)) / S;
      if (ok(kneeI)) return (kneeRel * this.k - (P[kneeI].y - P[hipI].y)) / S * j.polviKerroin;
      return null;
    };
    const liftL = lift(LM.L_ANKLE, LM.L_KNEE, LM.L_HIP, cal.ankleL, cal.kneeL);
    const liftR = lift(LM.R_ANKLE, LM.R_KNEE, LM.R_HIP, cal.ankleR, cal.kneeR);
    if (liftL !== null && liftR !== null && !s.jump.active) {
      this.diff += 0.6 * ((liftL - liftR) - this.diff);
      let side = 0;
      if (this.diff > j.askelKynnys && this.lastSide !== 1) side = 1;
      else if (this.diff < -j.askelKynnys && this.lastSide !== -1) side = -1;
      if (side) {
        this.lastSide = side;
        this.stepTimes.push(tMs);
        s.counters.steps++;
        this.emit('step', { side: side === 1 ? 'vasen' : 'oikea' });
      }
    } else if (s.jump.active) this.diff = 0;
    while (this.stepTimes.length && tMs - this.stepTimes[0] > j.ikkunaMs) this.stepTimes.shift();
    const n = this.stepTimes.length;
    const lastStep = n ? this.stepTimes[n - 1] : -1e9;
    // Hypyn aikana askelia ei voi tulla, joten hyppy ei saa katkaista juoksua
    const idle = tMs - Math.max(lastStep, s.jump.active ? tMs : this.jumpEndT);
    let cadence = 0;
    if (n >= 3 && idle <= j.pysahdysMs) cadence = (n - 1) / ((lastStep - this.stepTimes[0]) / 1000);
    if (idle > j.pysahdysMs) this.lastSide = 0;
    s.run.cadence = cadence;
    s.run.active = cadence >= j.minTahti;
    const target = s.run.active
      ? j.minNopeus + (1 - j.minNopeus) * clamp((cadence - j.minTahti) / (j.maxTahti - j.minTahti), 0, 1)
      : 0;
    s.run.speed += (target - s.run.speed) * ease(dt, j.nopeusTau);
    if (s.run.speed < 0.01) s.run.speed = 0;

    // --- Kädet ---
    const kd = cfg.kadet;
    const hand = (name, wristI, elbowI) => {
      const hd = s.hands[name];
      if (!ok(wristI)) { hd.visible = false; hd.slashing = false; hd.raised = false; hd.speed = 0; this.prevPalm[name] = null; return; }
      const w = P[wristI], e = P[elbowI];
      const ext = ok(elbowI) ? kd.kammenJatke : 0;
      const palm = { x: w.x + (w.x - e.x) * ext, y: w.y + (w.y - e.y) * ext };
      const prev = this.prevPalm[name];
      if (prev) {
        hd.vx += 0.6 * ((palm.x - prev.x) / dt / S - hd.vx);
        hd.vy += 0.6 * ((palm.y - prev.y) / dt / S - hd.vy);
      } else { hd.vx = 0; hd.vy = 0; }
      this.prevPalm[name] = palm;
      hd.visible = true; hd.px = palm.x; hd.py = palm.y;
      const bp = this.toBody(palm); hd.x = bp.x; hd.y = bp.y;
      hd.speed = Math.hypot(hd.vx, hd.vy);
      hd.slashing = hd.speed >= kd.viiltoNopeus;
      hd.raised = w.y < P[LM.NOSE].y - kd.ylhaallaRaja * S;
    };
    hand('left', LM.L_WRIST, LM.L_ELBOW);
    hand('right', LM.R_WRIST, LM.R_ELBOW);

    // --- Taukoele: molemmat kädet ylhäällä ---
    if (s.hands.left.raised && s.hands.right.raised) {
      this.pauseMs += dtMs;
      if (this.pauseMs >= cfg.eleet.taukoMs && !this.pauseFired) { this.pauseFired = true; this.emit('pauseGesture'); }
    } else { this.pauseMs = 0; this.pauseFired = false; }
    s.pauseProgress = clamp(this.pauseMs / cfg.eleet.taukoMs, 0, 1);

    return s;
  }
}
