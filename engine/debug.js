// Debug-näkymä: kameran kuva, luuranko ja mittarit raja-arvojen säätämistä varten.
import { BONES, LM } from './pose.js';

const FONT = '500 15px ui-monospace, Menlo, Consolas, monospace';

// d: { video, pose, motion (MotionDetector tai null), cfg, stats: { fps, poseFps, inferMs, delegate } }
export function drawDebug(ctx, view, d) {
  const { pose, motion, cfg } = d;
  const w = 480, vw = pose ? pose.vw : (d.video && d.video.videoWidth) || 1280, vh = pose ? pose.vh : (d.video && d.video.videoHeight) || 720;
  const h = w * vh / vw, x0 = 16, y0 = 16, k = w / vw;
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(10, 6, 30, 0.88)';
  ctx.fillRect(x0 - 6, y0 - 6, w + 12, h + 12);

  // Kameran kuva peilattuna
  if (d.video && d.video.videoWidth) {
    ctx.save(); ctx.translate(x0 + w, y0); ctx.scale(-1, 1);
    ctx.drawImage(d.video, 0, 0, w, h);
    ctx.restore();
  }
  ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
  ctx.translate(x0, y0); ctx.scale(k, k);
  const px = 1 / k; // yksi ruutupikseli videon mittakaavassa

  // Raja-arvot viivoina: perustaso, hyppy, kyykky ja kaistat
  if (motion && motion.cal) {
    const S = motion.S, by = motion.baseY, cx = motion.cal.centerX;
    const hline = (y, color, label) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2 * px; ctx.setLineDash([8 * px, 6 * px]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(vw, y); ctx.stroke();
      ctx.fillStyle = color; ctx.font = `${13 * px}px sans-serif`; ctx.fillText(label, 6 * px, y - 4 * px);
    };
    hline(by, '#ffffff', 'perustaso');
    hline(by - cfg.hyppy.kynnys * S, '#5CFF9D', 'hyppy');
    hline(by + cfg.kyykky.kynnys * S, '#FFB13D', 'kyykky');
    ctx.strokeStyle = '#C9A6FF';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sx * cfg.kaista.raja * S, 0); ctx.lineTo(cx + sx * cfg.kaista.raja * S, vh); ctx.stroke(); }
    ctx.setLineDash([]);
  }

  // Luuranko: vasen puoli sininen, oikea punainen
  if (pose) {
    const P = pose.pts, vis = cfg.pehmennys.nakyvyysRaja;
    ctx.lineWidth = 3 * px; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const [a, b] of BONES) {
      if (P[a].v < vis || P[b].v < vis) continue;
      ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke();
    }
    for (let i = 0; i < 33; i++) {
      if (i > 0 && i < 11 && i !== 7 && i !== 8) continue;
      ctx.globalAlpha = P[i].v < vis ? 0.25 : 1;
      ctx.fillStyle = i === 0 ? '#fff' : (i % 2 ? cfg.varit.vasen : cfg.varit.oikea);
      ctx.beginPath(); ctx.arc(P[i].x, P[i].y, 5 * px, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (motion && motion.cal) {
      for (const name of ['left', 'right']) {
        const hd = motion.state.hands[name];
        if (!hd.visible) continue;
        ctx.strokeStyle = hd.slashing ? '#fff' : (name === 'left' ? cfg.varit.vasen : cfg.varit.oikea);
        ctx.lineWidth = 3 * px; ctx.beginPath(); ctx.arc(hd.px, hd.py, 14 * px, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  ctx.restore();

  // Mittarit tekstinä
  const st = d.stats, lines = [
    `piirto ${st.fps.toFixed(0)} fps · tunnistus ${st.poseFps.toFixed(0)} fps · ${st.inferMs.toFixed(0)} ms · ${st.delegate}`,
  ];
  if (pose) lines.push(`kuva ${pose.vw}×${pose.vh}`);
  if (motion && motion.cal) {
    const s = motion.state, f = (n) => (n >= 0 ? '+' : '') + n.toFixed(2);
    lines.push(
      `S ${motion.S.toFixed(0)} px (kerroin ${motion.k.toFixed(2)})`,
      `lantio ${f(s.hipOffset)} S   hyppy≥${cfg.hyppy.kynnys}  kyykky≤-${cfg.kyykky.kynnys}`,
      `sivu ${f(s.laneOffset)} S   kaista ${['vasen', 'keski', 'oikea'][s.lane + 1]}`,
      `jalkaero ${f(motion.diff)} S   kynnys ${cfg.juoksu.askelKynnys}`,
      `tahti ${s.run.cadence.toFixed(1)} askelta/s   vauhti ${s.run.speed.toFixed(2)}`,
      `käsi V ${s.hands.left.speed.toFixed(1)} S/s   käsi O ${s.hands.right.speed.toFixed(1)} S/s`,
    );
  }
  ctx.save();
  ctx.font = FONT; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const ty = y0 + h + 14;
  ctx.fillStyle = 'rgba(10, 6, 30, 0.88)';
  ctx.fillRect(x0 - 6, ty - 6, w + 12, lines.length * 21 + 10);
  ctx.fillStyle = '#E9E2FF';
  lines.forEach((t, i) => ctx.fillText(t, x0 + 4, ty + i * 21));
  ctx.restore();
}
