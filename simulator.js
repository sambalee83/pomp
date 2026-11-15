// Simulaattori: keinotekoinen "lapsi", jota ohjataan näppäimistöllä ja hiirellä.
// Tuottaa samanlaisia pisteitä kuin kamera + MediaPipe, joten koko peliä voi kokeilla
// ja kehittää ilman kameraa ja hyppimistä. Käynnistyy aloitusruudun Simulaattori-linkistä.

const TAU = Math.PI * 2;
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);

export class Simulator {
  constructor(vw = 1280, vh = 720) {
    this.vw = vw; this.vh = vh;
    this.S = 105;          // hartialeveys pikseleinä
    this.noise = 0.8;      // tärinä pikseleinä, jäljittelee kameran epätarkkuutta
    this.cadence = 3.2;    // juoksun tahti, askelta/s
    this.input = { lane: 0, squat: false, run: false, handsUp: false, hidden: false, right: null, left: null };
    this.x = 0; this.squat = 0; this.jumpT = -1; this.phase = 0; this.up = 0;
  }

  jump() { if (this.jumpT < 0) this.jumpT = 0; }

  step(dt) {
    const i = this.input;
    this.x += (i.lane * 1.3 * this.S - this.x) * ease(dt, 8);
    this.squat += ((i.squat ? 1 : 0) - this.squat) * ease(dt, 12);
    this.up += ((i.handsUp ? 1 : 0) - this.up) * ease(dt, 10);
    if (this.jumpT >= 0) { this.jumpT += dt; if (this.jumpT >= 0.5) this.jumpT = -1; }
    if (i.run) this.phase += dt * Math.PI * this.cadence; else this.phase = 0;
  }

  // Palauttaa 33 pistettä mallin muodossa (x, y välillä 0–1, peilaamaton) tai null jos pelaaja on piilossa
  landmarks() {
    if (this.input.hidden) return null;
    const S = this.S, i = this.input;
    const cx = this.vw / 2 + this.x, ground = this.vh * 0.9;
    const air = this.jumpT >= 0 ? 4 * (this.jumpT / 0.5) * (1 - this.jumpT / 0.5) : 0;
    const jy = -0.75 * S * air, sq = 0.8 * S * this.squat;
    const liftL = i.run ? Math.max(0, Math.sin(this.phase)) : 0;
    const liftR = i.run ? Math.max(0, -Math.sin(this.phase)) : 0;
    const bob = i.run ? -0.03 * S : 0;

    // Rakennetaan ruudun (peilatuissa) koordinaateissa: lapsen vasen puoli on ruudun vasemmalla.
    const p = {};
    const hipY = ground - 2.3 * S + jy + sq + bob, shY = hipY - 1.5 * S, noseY = shY - 0.75 * S;
    const side = (sx, lift) => {
      const hip = { x: cx + sx * 0.3 * S, y: hipY };
      const knee = { x: cx + sx * (0.3 + 0.35 * this.squat) * S, y: ground - 1.15 * S + jy - lift * 0.3 * S - air * 0.1 * S };
      const ankle = { x: cx + sx * 0.32 * S, y: ground + jy - lift * 0.6 * S - air * 0.15 * S };
      const sh = { x: cx + sx * 0.5 * S, y: shY };
      return { hip, knee, ankle, sh };
    };
    const L = side(-1, liftL), R = side(1, liftR);

    // Käsi: kohde on joko hiiri, kädet ylös tai rennosti sivulla (juostessa heiluu)
    const arm = (sx, sh, mouse, swing) => {
      let t = mouse || {
        x: sh.x + sx * (0.25 + 0.05 * this.up) * S,
        y: sh.y + (1.5 - 3.2 * this.up) * S + swing * 0.35 * S,
      };
      const a = 0.85 * S, b = 0.8 * S;
      let dx = t.x - sh.x, dy = t.y - sh.y, d = Math.hypot(dx, dy) || 1;
      const dd = Math.min(d, a + b - 1);
      dx /= d; dy /= d;
      const along = (a * a - b * b + dd * dd) / (2 * dd), hgt = Math.sqrt(Math.max(0, a * a - along * along));
      const elbow = { x: sh.x + dx * along + dy * hgt * sx, y: sh.y + dy * along - dx * hgt * sx }; // kyynärpää ulospäin
      const wrist = { x: sh.x + dx * dd, y: sh.y + dy * dd };
      return { elbow, wrist };
    };
    const aL = arm(-1, L.sh, i.left, liftR - liftL), aR = arm(1, R.sh, i.right, liftL - liftR);

    const nose = { x: cx, y: noseY };
    const set = (idx, q) => { p[idx] = q; };
    set(0, nose);
    for (const [idx, sx, dx, dy] of [[1, -1, .08, -.1], [2, -1, .12, -.1], [3, -1, .16, -.1], [4, 1, .08, -.1], [5, 1, .12, -.1], [6, 1, .16, -.1], [7, -1, .3, -.05], [8, 1, .3, -.05], [9, -1, .08, .15], [10, 1, .08, .15]]) {
      set(idx, { x: nose.x + sx * dx * S, y: nose.y + dy * S });
    }
    set(11, L.sh); set(12, R.sh); set(13, aL.elbow); set(14, aR.elbow); set(15, aL.wrist); set(16, aR.wrist);
    const finger = (w, e) => ({ x: w.x + (w.x - e.x) * 0.2, y: w.y + (w.y - e.y) * 0.2 });
    for (const idx of [17, 19, 21]) set(idx, finger(aL.wrist, aL.elbow));
    for (const idx of [18, 20, 22]) set(idx, finger(aR.wrist, aR.elbow));
    set(23, L.hip); set(24, R.hip); set(25, L.knee); set(26, R.knee); set(27, L.ankle); set(28, R.ankle);
    set(29, { x: L.ankle.x, y: L.ankle.y + 0.08 * S }); set(30, { x: R.ankle.x, y: R.ankle.y + 0.08 * S });
    set(31, { x: L.ankle.x - 0.25 * S, y: L.ankle.y + 0.1 * S }); set(32, { x: R.ankle.x + 0.25 * S, y: R.ankle.y + 0.1 * S });

    const out = new Array(33);
    for (let k = 0; k < 33; k++) {
      const q = p[k];
      const nx = q.x + (Math.random() - 0.5) * 2 * this.noise, ny = q.y + (Math.random() - 0.5) * 2 * this.noise;
      out[k] = { x: 1 - nx / this.vw, y: ny / this.vh, z: 0, visibility: 0.95 }; // 1 - x: kamera näkee peilaamattoman kuvan
    }
    return out;
  }
}

// Näppäimet: nuoli ylös / välilyönti = hyppy, nuoli alas = kyykky (pidä pohjassa),
// nuolet sivuille = kaista, R = juoksu päälle/pois, P = kädet ylös (pidä), H = pois kuvasta,
// hiiri = oikea käsi, Shift + hiiri = vasen käsi, Esc = kädet alas.
// toVideo(clientX, clientY) muuntaa hiiren paikan videon pikseleiksi.
export function attachSimControls(sim, target, toVideo) {
  const i = sim.input;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowUp': case 'Space': sim.jump(); break;
      case 'ArrowDown': i.squat = true; break;
      case 'ArrowLeft': i.lane = Math.max(-1, i.lane - 1); break;
      case 'ArrowRight': i.lane = Math.min(1, i.lane + 1); break;
      case 'KeyR': i.run = !i.run; break;
      case 'KeyP': i.handsUp = true; break;
      case 'KeyH': i.hidden = !i.hidden; break;
      case 'Escape': i.left = null; i.right = null; break;
      default: return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown') i.squat = false;
    if (e.code === 'KeyP') i.handsUp = false;
  });
  target.addEventListener('mousemove', (e) => {
    const v = toVideo(e.clientX, e.clientY);
    if (!v) return;
    if (e.shiftKey) i.left = v; else i.right = v;
  });
}

export const SIM_HELP = '↑ hyppy · ↓ kyykky · ← → sivuaskel · R juoksu · P kädet ylös · H pois kuvasta · hiiri = oikea käsi · Shift + hiiri = vasen käsi · Esc kädet alas';
