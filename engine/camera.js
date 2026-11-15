// Kamera: käynnistys, pysäytys ja näytön pitäminen hereillä.

export function stopCamera(video) {
  const s = video.srcObject;
  if (s) s.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}

// facing: 'environment' (takakamera) tai 'user' (etukamera).
// Läppärillä on vain yksi kamera, ja selain valitsee sen automaattisesti.
export async function startCamera(video, cfg, facing) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error(window.isSecureContext
      ? 'Tämä selain ei tue kameraa.'
      : 'Kamera toimii vain https-osoitteessa tai osoitteessa localhost.');
  }
  stopCamera(video);
  const k = cfg.kamera;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facing },
        width: { ideal: k.leveys }, height: { ideal: k.korkeus }, frameRate: { ideal: k.fps },
      },
    });
  } catch (err) {
    if (err.name === 'NotAllowedError') throw new Error('Kameran käyttöä ei sallittu. Salli kamera selaimen asetuksista ja lataa sivu uudelleen.');
    if (err.name === 'NotFoundError') throw new Error('Kameraa ei löytynyt tästä laitteesta.');
    if (err.name === 'NotReadableError') throw new Error('Kamera on toisen ohjelman käytössä. Sulje muut kameraa käyttävät ohjelmat.');
    throw err;
  }
  video.srcObject = stream;
  await video.play();
  // Odota, että ensimmäinen kuva on saatu ja kuvan koko tiedetään
  for (let i = 0; i < 100 && !video.videoWidth; i++) await new Promise((r) => setTimeout(r, 50));
  if (!video.videoWidth) throw new Error('Kamera käynnistyi, mutta kuvaa ei tullut.');
  return stream;
}

// Estää näyttöä sammumasta pelin aikana. Lupa pitää pyytää uudelleen, kun sivulle palataan.
let wakeLock = null;
export async function keepAwake() {
  if (!('wakeLock' in navigator)) return false;
  const request = async () => {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
  };
  await request();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') request();
  });
  return !!wakeLock;
}
