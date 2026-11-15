// Asennon tunnistus: MediaPipen lataus, pisteiden pehmennys ja peilaus.

// Kehon pisteiden numerot (MediaPipe Pose, 33 pistettä). L = lapsen vasen, R = lapsen oikea.
export const LM = {
  NOSE: 0, L_EYE: 2, R_EYE: 5, L_EAR: 7, R_EAR: 8,
  L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14, L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28,
  L_TOE: 31, R_TOE: 32,
};

// Luurangon viivat debug-näkymää varten
export const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32], [7, 8],
];

// One Euro -suodin: hidas liike pehmennetään vahvasti (ei tärinää),
// nopea liike kevyesti (ei viivettä).
class OneEuro {
  constructor(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff; this.beta = beta; this.dCutoff = dCutoff;
    this.x = null; this.dx = 0;
  }
  static alpha(dt, cutoff) { return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt)); }
  reset() { this.x = null; this.dx = 0; }
  filter(x, dt) {
    if (this.x === null) { this.x = x; return x; }
    const dx = (x - this.x) / dt;
    this.dx += OneEuro.alpha(dt, this.dCutoff) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(dt, cutoff) * (x - this.x);
    return this.x;
  }
}

// Muuntaa mallin raakapisteet pelin käyttöön:
//  - peilaa vaakasuunnan, jotta lapsen oikea käsi on ruudulla oikealla
//  - pehmentää tärinän
//  - palauttaa pisteet videokuvan pikseleinä: { x, y, v } missä v = näkyvyys 0–1
export class PoseTracker {
  constructor(cfg) {
    const p = cfg.pehmennys;
    this.fx = []; this.fy = []; this.v = [];
    for (let i = 0; i < 33; i++) {
      this.fx.push(new OneEuro(p.minCutoff, p.beta, p.dCutoff));
      this.fy.push(new OneEuro(p.minCutoff, p.beta, p.dCutoff));
      this.v.push(0);
    }
    this.lastT = null;
  }
  reset() {
    for (let i = 0; i < 33; i++) { this.fx[i].reset(); this.fy[i].reset(); this.v[i] = 0; }
    this.lastT = null;
  }
  // landmarks: mallin 33 pistettä (x, y välillä 0–1) tai null jos ihmistä ei löytynyt
  update(landmarks, vw, vh, tMs) {
    if (!landmarks || landmarks.length < 33) return null;
    if (this.lastT !== null && tMs - this.lastT > 400) this.reset(); // pitkä tauko: aloita puhtaalta
    const dt = this.lastT === null ? 1 / 30 : Math.max(0.001, (tMs - this.lastT) / 1000);
    this.lastT = tMs;
    const pts = new Array(33);
    for (let i = 0; i < 33; i++) {
      const p = landmarks[i];
      const vis = p.visibility === undefined ? 1 : p.visibility;
      this.v[i] += 0.5 * (vis - this.v[i]);
      pts[i] = {
        x: this.fx[i].filter(1 - p.x, dt) * vw, // 1 - x = peilaus
        y: this.fy[i].filter(p.y, dt) * vh,
        v: this.v[i],
      };
    }
    return { t: tMs, vw, vh, pts };
  }
}

// Lataa MediaPipen ja tunnistusmallin. Palauttaa olion, jonka detect() antaa raakapisteet.
export async function createPoseEngine(cfg, delegate) {
  const m = cfg.malli;
  const vision = await import(m.kirjasto + '/vision_bundle.mjs');
  const fileset = await vision.FilesetResolver.forVisionTasks(m.kirjasto + '/wasm');
  const make = (d) => vision.PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: m.tiedostot[m.tyyppi], delegate: d },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: m.luottamus,
    minPosePresenceConfidence: m.luottamus,
    minTrackingConfidence: m.luottamus,
  });
  let used = delegate || m.kiihdytys;
  let landmarker;
  try {
    landmarker = await make(used);
  } catch (err) {
    if (used !== 'GPU') throw err;
    used = 'CPU'; // GPU ei käynnistynyt tällä laitteella
    landmarker = await make(used);
  }
  return {
    delegate: used,
    detect(video, tMs) {
      const r = landmarker.detectForVideo(video, tMs);
      return (r && r.landmarks && r.landmarks[0]) || null;
    },
    close() { try { landmarker.close(); } catch (e) { /* ei haittaa */ } },
  };
}
