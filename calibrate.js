// Kalibrointi: lapsi seisoo hetken paikallaan, ja peli mittaa hänen kokonsa ja paikkansa kuvassa.
import { LM } from './pose.js';

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[s.length >> 1]; };

// Tilakoodit, joista käyttöliittymä tekee ohjetekstin:
// 'none' ei ketään kuvassa · 'feet' jalat eivät näy · 'near' liian lähellä · 'far' liian kaukana
// 'left' / 'right' siirry lapsen vasemmalle / oikealle · 'still' pysy paikallaan · 'hold' hyvä, odota · 'done' valmis
export class Calibrator {
  constructor(cfg) { this.cfg = cfg; this.reset(); }

  reset() {
    this.progress = 0; this.status = 'none'; this.result = null;
    this.anchor = null; this.samples = []; this.lastT = null;
  }

  update(pose, tMs) {
    const c = this.cfg.kalibrointi, vis = this.cfg.pehmennys.nakyvyysRaja;
    const dt = this.lastT === null ? 0 : Math.min(200, tMs - this.lastT);
    this.lastT = tMs;
    if (this.status === 'done') return this.status;

    const fail = (code) => { this.progress = 0; this.anchor = null; this.samples = []; return (this.status = code); };
    if (!pose) return fail('none');
    const P = pose.pts, ok = (i) => P[i].v >= vis;
    if (!(ok(LM.L_SHOULDER) && ok(LM.R_SHOULDER) && ok(LM.L_HIP) && ok(LM.R_HIP))) return fail('none');
    if (!(ok(LM.L_KNEE) && ok(LM.R_KNEE) && ok(LM.L_ANKLE) && ok(LM.R_ANKLE))) return fail('feet');

    const sh = mid(P[LM.L_SHOULDER], P[LM.R_SHOULDER]);
    const hip = mid(P[LM.L_HIP], P[LM.R_HIP]);
    const ankle = mid(P[LM.L_ANKLE], P[LM.R_ANKLE]);
    const S = dist(P[LM.L_SHOULDER], P[LM.R_SHOULDER]);
    const bodyH = ankle.y - P[LM.NOSE].y;
    const size = bodyH / pose.vh;

    if (ankle.y > pose.vh * 0.98 || size > c.maxKoko || P[LM.NOSE].y < pose.vh * 0.08) return fail('near');
    if (size < c.minKoko) return fail('far');
    const off = hip.x / pose.vw - 0.5;
    // Kuva on peilattu: jos lapsi näkyy ruudun vasemmassa laidassa, hänen pitää siirtyä omalle oikealleen.
    if (off < -c.keskiAlue) return fail('right');
    if (off > c.keskiAlue) return fail('left');

    if (!this.anchor) this.anchor = hip;
    if (dist(hip, this.anchor) > c.vakausRaja * S) { fail('still'); this.anchor = hip; return this.status; }

    this.samples.push({
      S, T: dist(sh, hip), hipY: hip.y, centerX: hip.x, bodyH,
      kneeL: P[LM.L_KNEE].y - P[LM.L_HIP].y, kneeR: P[LM.R_KNEE].y - P[LM.R_HIP].y,
      ankleL: P[LM.L_ANKLE].y - P[LM.L_HIP].y, ankleR: P[LM.R_ANKLE].y - P[LM.R_HIP].y,
    });
    this.progress = Math.min(1, this.progress + dt / c.kestoMs);
    this.status = 'hold';

    if (this.progress >= 1 && this.samples.length >= 5) {
      const m = (k) => median(this.samples.map((s) => s[k]));
      this.result = {
        S: m('S'),             // hartialeveys pikseleinä = pelin mittatikku
        T: m('T'),             // vartalon pituus (hartiat–lantio)
        hipY: m('hipY'),       // lantion korkeus seistessä
        centerX: m('centerX'), // seisomapaikan keskikohta
        bodyH: m('bodyH'),     // nenästä nilkkoihin
        kneeL: m('kneeL'), kneeR: m('kneeR'),     // polven etäisyys lantiosta alaspäin
        ankleL: m('ankleL'), ankleR: m('ankleR'), // nilkan etäisyys lantiosta alaspäin
        vw: pose.vw, vh: pose.vh,
      };
      this.status = 'done';
    }
    return this.status;
  }
}
