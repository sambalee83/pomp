// Hahmo: pyöreä keltainen otus, jonka nivelet seuraavat lapsen kehoa.
// Oikea käsi ja jalka ovat aina punaisia (O), vasen sinisiä (V).
import { LM } from './pose.js';

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class Avatar {
  constructor(cfg) {
    this.cfg = cfg;
    this.p = null;      // pisteet ruudulla
    this.off = null;    // pisteiden paikka suhteessa lantioon (näkymättömiä pisteitä varten)
    this.unit = 60;     // hartialeveys ruudulla = kaikkien paksuuksien mitta
    this.blinkIn = 2; this.blink = 0;
    this.mood = 0;      // 0 = tavallinen hymy, 1 = riemu
    this.vx = 0; this.vy = 0;
  }

  cheer(amount = 1) { this.mood = Math.max(this.mood, amount); }

  // targets: 33 pistettä ruudun koordinaateissa { x, y, v }, unit: hartialeveys ruudulla
  update(targets, unit, dt) {
    const vis = this.cfg.pehmennys.nakyvyysRaja;
    const hipT = mid(targets[LM.L_HIP], targets[LM.R_HIP]);
    if (!this.p) {
      this.p = targets.map((t) => ({ x: t.x, y: t.y }));
      this.off = targets.map((t) => ({ x: t.x - hipT.x, y: t.y - hipT.y }));
      this.unit = unit;
    }
    const a = 1 - Math.exp(-dt * this.cfg.hahmo.seurantaNopeus);
    const before = mid(this.p[LM.L_HIP], this.p[LM.R_HIP]);
    for (let i = 0; i < 33; i++) {
      const t = targets[i];
      let tx, ty;
      if (t.v >= vis) { tx = t.x; ty = t.y; this.off[i].x = t.x - hipT.x; this.off[i].y = t.y - hipT.y; }
      else { tx = hipT.x + this.off[i].x; ty = hipT.y + this.off[i].y; } // piilossa oleva osa kulkee vartalon mukana
      this.p[i].x += (tx - this.p[i].x) * a;
      this.p[i].y += (ty - this.p[i].y) * a;
    }
    this.unit += (unit - this.unit) * a;
    const after = mid(this.p[LM.L_HIP], this.p[LM.R_HIP]);
    if (dt > 0) { this.vx = (after.x - before.x) / dt / this.unit; this.vy = (after.y - before.y) / dt / this.unit; }

    this.mood = Math.max(0, this.mood - dt * 1.2);
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) { this.blink = 0.14; this.blinkIn = 2 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);
  }

  get hips() { return this.p ? mid(this.p[LM.L_HIP], this.p[LM.R_HIP]) : null; }
  get feetY() { return this.p ? Math.max(this.p[LM.L_ANKLE].y, this.p[LM.R_ANKLE].y) + this.unit * 0.3 : 0; }

  drawShadow(ctx, floorY) {
    if (!this.p) return;
    const u = this.unit, gap = clamp((floorY - this.feetY) / (2.5 * u), 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(20, 8, 50, ${0.38 - gap * 0.22})`;
    ctx.beginPath();
    ctx.ellipse(this.hips.x, floorY, u * (1.15 - gap * 0.5), u * (0.24 - gap * 0.1), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    if (!this.p) return;
    const P = this.p, u = this.unit, col = this.cfg.varit, line = col.aariviiva;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const limb = (ids, w, color) => {
      ctx.beginPath();
      ctx.moveTo(P[ids[0]].x, P[ids[0]].y);
      for (let i = 1; i < ids.length; i++) ctx.lineTo(P[ids[i]].x, P[ids[i]].y);
      ctx.strokeStyle = line; ctx.lineWidth = (w + 0.1) * u; ctx.stroke();
      ctx.strokeStyle = color; ctx.lineWidth = w * u; ctx.stroke();
    };
    const blob = (x, y, rx, ry, color, rot = 0) => {
      ctx.beginPath(); ctx.ellipse(x, y, rx * u, ry * u, rot, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = line; ctx.lineWidth = 0.05 * u; ctx.stroke();
    };
    const letter = (x, y, ch) => {
      ctx.fillStyle = '#fff'; ctx.font = `700 ${0.34 * u}px Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ch, x, y + 0.02 * u);
    };

    // Jalat ja kengät
    limb([LM.L_HIP, LM.L_KNEE, LM.L_ANKLE], 0.40, col.hahmoVarjo);
    limb([LM.R_HIP, LM.R_KNEE, LM.R_ANKLE], 0.40, col.hahmoVarjo);
    blob(P[LM.L_ANKLE].x - 0.08 * u, P[LM.L_ANKLE].y + 0.14 * u, 0.36, 0.21, col.vasen);
    blob(P[LM.R_ANKLE].x + 0.08 * u, P[LM.R_ANKLE].y + 0.14 * u, 0.36, 0.21, col.oikea);

    // Vartalo: paksu pyöristetty viiva nelikulmion ympäri tekee siitä pehmeän pavun
    const sl = P[LM.L_SHOULDER], sr = P[LM.R_SHOULDER], hl = P[LM.L_HIP], hr = P[LM.R_HIP];
    const torso = () => { ctx.beginPath(); ctx.moveTo(sl.x, sl.y); ctx.lineTo(sr.x, sr.y); ctx.lineTo(hr.x, hr.y); ctx.lineTo(hl.x, hl.y); ctx.closePath(); };
    torso(); ctx.strokeStyle = line; ctx.lineWidth = 0.66 * u; ctx.stroke();
    torso(); ctx.strokeStyle = col.hahmo; ctx.lineWidth = 0.56 * u; ctx.stroke(); ctx.fillStyle = col.hahmo; ctx.fill();
    const shm = mid(sl, sr), hpm = mid(hl, hr), belly = { x: shm.x * 0.4 + hpm.x * 0.6, y: shm.y * 0.4 + hpm.y * 0.6 };
    ctx.beginPath();
    ctx.ellipse(belly.x, belly.y, 0.36 * u, 0.44 * u, Math.atan2(hpm.y - shm.y, hpm.x - shm.x) - Math.PI / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFE9A8'; ctx.fill();

    // Kädet ja hanskat
    limb([LM.L_SHOULDER, LM.L_ELBOW, LM.L_WRIST], 0.32, col.hahmo);
    limb([LM.R_SHOULDER, LM.R_ELBOW, LM.R_WRIST], 0.32, col.hahmo);
    const ext = this.cfg.kadet.kammenJatke;
    const palm = (w, e) => ({ x: P[w].x + (P[w].x - P[e].x) * ext, y: P[w].y + (P[w].y - P[e].y) * ext });
    const pl = palm(LM.L_WRIST, LM.L_ELBOW), pr = palm(LM.R_WRIST, LM.R_ELBOW);
    blob(pl.x, pl.y, 0.29, 0.29, col.vasen); letter(pl.x, pl.y, 'V');
    blob(pr.x, pr.y, 0.29, 0.29, col.oikea); letter(pr.x, pr.y, 'O');

    // Pää
    const nose = P[LM.NOSE], el = P[LM.L_EAR], er = P[LM.R_EAR];
    const earW = Math.max(0.2 * u, Math.hypot(er.x - el.x, er.y - el.y));
    const tilt = clamp(Math.atan2(er.y - el.y, er.x - el.x), -0.5, 0.5);
    const look = clamp((nose.x - (el.x + er.x) / 2) / earW * 2, -1, 1); // katseen suunta pään kääntymisestä
    ctx.translate(nose.x, nose.y - 0.12 * u);
    ctx.rotate(tilt);
    ctx.scale(u, u);
    ctx.lineWidth = 0.05; ctx.strokeStyle = line;
    for (const sx of [-1, 1]) { // korvat
      ctx.beginPath(); ctx.arc(sx * 0.52, -0.54, 0.22, 0, Math.PI * 2); ctx.fillStyle = col.hahmo; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(sx * 0.52, -0.54, 0.11, 0, Math.PI * 2); ctx.fillStyle = col.hahmoVarjo; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 0.72, 0, Math.PI * 2); ctx.fillStyle = col.hahmo; ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255, 90, 120, 0.45)'; // posket
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 0.45 + look * 0.05, 0.2, 0.12, 0, Math.PI * 2); ctx.fill(); }
    const open = this.blink > 0 ? 0.12 : 1;
    for (const sx of [-1, 1]) { // silmät
      const ex = sx * 0.27 + look * 0.07, ey = -0.1;
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.15, 0.2 * open, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      if (open === 1) {
        const px = ex + look * 0.05 + clamp(this.vx * 0.02, -0.04, 0.04), py = ey + 0.02 + clamp(this.vy * 0.02, -0.05, 0.05);
        ctx.beginPath(); ctx.arc(px, py, 0.095, 0, Math.PI * 2); ctx.fillStyle = line; ctx.fill();
        ctx.beginPath(); ctx.arc(px + 0.03, py - 0.04, 0.03, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      }
    }
    const mx = look * 0.06, m = this.mood; // suu: hymy, joka aukeaa riemusta
    ctx.beginPath();
    if (m > 0.15) {
      ctx.ellipse(mx, 0.3, 0.2, 0.08 + 0.14 * m, 0, 0, Math.PI);
      ctx.closePath(); ctx.fillStyle = '#9B1B3B'; ctx.fill(); ctx.stroke();
    } else { ctx.arc(mx, 0.2, 0.2, Math.PI * 0.18, Math.PI * 0.82); ctx.lineWidth = 0.06; ctx.stroke(); }
    ctx.restore();
  }
}
