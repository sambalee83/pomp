// Pomp! – kaikki säädettävät arvot ovat tässä tiedostossa.
// Muuta lukua, tallenna ja lataa sivu uudelleen. Muuhun koodiin ei tarvitse koskea.
//
// "S" = lapsen hartialeveys kuvassa. Lähes kaikki rajat ovat S:n kerrannaisia,
// joten ne toimivat samalla tavalla riippumatta siitä, kuinka kaukana kamerasta lapsi seisoo.
// Esimerkki: hyppy.kynnys 0.30 = lantion pitää nousta 30 % hartialeveydestä (noin 8–9 cm).

export const CONFIG = {
  versio: '0.1.0 (vaihe 1: moottori)',

  kamera: {
    oletus: 'environment', // 'environment' = takakamera, 'user' = etukamera
    leveys: 1280,
    korkeus: 720,
    fps: 30,
  },

  malli: {
    // MediaPipe-kirjasto, kiinnitetty tarkkaan versioon
    kirjasto: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14',
    tyyppi: 'lite', // 'lite' = nopea (puhelin), 'full' = tarkempi (läppäri)
    tiedostot: {
      lite: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      full: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
    },
    kiihdytys: 'GPU', // 'GPU' tai 'CPU'. Jos GPU ei käynnisty, peli vaihtaa itse CPU:hun.
    maxFps: 30,       // kuinka monta kertaa sekunnissa asento tunnistetaan (pienempi = kevyempi)
    luottamus: 0.5,   // 0–1, kuinka varma mallin pitää olla että kuvassa on ihminen
  },

  naytto: {
    maxDpr: 2, // piirtotarkkuuden katto. Laske 1:een, jos puhelin hidastelee.
  },

  // Pisteiden pehmennys (One Euro -suodin): poistaa tärinän, mutta päästää nopeat liikkeet läpi.
  pehmennys: {
    minCutoff: 1.2,    // pienempi = rauhallisempi hahmo paikallaan, mutta hieman enemmän viivettä
    beta: 10,          // suurempi = nopeat liikkeet seuraavat tarkemmin
    dCutoff: 1.0,
    nakyvyysRaja: 0.5, // tätä epävarmemmat pisteet jätetään huomiotta
  },

  kalibrointi: {
    kestoMs: 3000,     // kuinka kauan pitää seistä paikallaan
    vakausRaja: 0.18,  // sallittu huojunta, S:n kerrannaisena
    minKoko: 0.30,     // lapsen korkeus (nenä–nilkat) vähintään 30 % kuvan korkeudesta, muuten "tule lähemmäs"
    maxKoko: 0.72,     // ...ja enintään 72 %, muuten "astu kauemmas" (hypylle ja käsille jää tilaa)
    keskiAlue: 0.15,   // kuinka kaukana kuvan keskeltä saa seistä (osuus kuvan leveydestä)
  },

  // Lantion perustason hidas seuranta: korjaa sen, että lapsi siirtyy vähitellen lähemmäs tai kauemmas.
  perustaso: {
    lepoAlue: 0.2,          // tämän sisällä (S) lantio tulkitaan "seisoo normaalisti"
    hidasTau: 2.5,          // s, kuinka nopeasti perustaso seuraa seisovaa lasta
    jumiMs: 1200,           // jos lantio jää rajojen väliin näin pitkäksi aikaa paikalleen, perustaso korjataan
    jumiAlue: 0.15,         // S, tämän sisällä pysyvä lantio = paikallaan
    nopeaTau: 0.3,          // s, korjauksen nopeus
    mukautuvaMittakaava: true, // S päivittyy vartalon pituuden mukaan, jos lapsi siirtyy lähemmäs tai kauemmas
  },

  hyppy: {
    kynnys: 0.30,         // lantion nousu perustasosta (S). Pienennä, jos hypyt eivät tunnistu.
    paluu: 0.12,          // tämän alle palattua hyppy on ohi
    vaadiNilkat: true,    // vaaditaanko että myös nilkat nousevat (estää vääriä hyppyjä)
    nilkkaNousu: 0.10,    // kuinka paljon nilkkojen pitää nousta (S)
    maxKestoMs: 1200,     // jos "hyppy" kestää pidempään, se ei ollut hyppy vaan perustaso oli väärä
    taukoMs: 150,         // lyhin aika kahden hypyn välillä
    laskeutumisSuojaMs: 400, // laskeutumisen niiaus ei saa näkyä kyykkynä
    // Hahmon hypyn liioittelu: vaikuttaa vain siihen, miltä hahmo näyttää, ei hypyn tunnistukseen.
    liioittelu: 3,        // hahmon hypyn korkeus = oikea nousu x tämä. 1 = ei liioittelua. Kokeile 2–5.
    pohjaNousu: 0.6,      // hahmo nousee aina vähintään näin paljon (S), kun hyppy tunnistetaan. 0 = pois.
    nousuTau: 0.06,       // s, kuinka nopeasti hahmo ponnahtaa ylös (pienempi = napakampi)
    laskuTau: 0.22,       // s, kuinka pehmeästi hahmo laskeutuu takaisin
  },

  kyykky: {
    kynnys: 0.50,   // lantion lasku perustasosta (S)
    paluu: 0.30,
    minKestoMs: 200,
  },

  kaista: {
    raja: 0.80,       // sivuaskel: lantion siirtymä keskeltä (S)
    hystereesi: 0.30, // takaisin keskelle palataan vasta, kun siirtymä on alle raja - hystereesi
  },

  juoksu: {
    askelKynnys: 0.22,  // jalkojen korkeusero (S), joka lasketaan askeleeksi. Pienennä, jos juoksu ei tunnistu.
    polviKerroin: 1.6,  // jos nilkat eivät näy, käytetään polvia ja kerrotaan tällä
    ikkunaMs: 1500,     // askeltahti lasketaan näin pitkältä ajalta
    pysahdysMs: 600,    // jos askelta ei tule tässä ajassa, juoksu on loppunut
    minTahti: 1.5,      // askelta/s, tästä alkaen "juoksee"
    maxTahti: 4.0,      // askelta/s, täysi vauhti
    minNopeus: 0.35,    // vauhti (0–1) heti kun juoksu alkaa
    nopeusTau: 0.25,    // s, vauhdin pehmennys
  },

  kadet: {
    kammenJatke: 0.35,  // käden osumapiste = ranne + tämä osuus kyynärvarresta eteenpäin (kämmenen keskelle)
    viiltoNopeus: 2.0,  // S/s, tätä nopeampi liike on viipalointi
    ylhaallaRaja: 0.30, // ranne näin paljon (S) nenän yläpuolella = käsi ylhäällä
  },

  eleet: {
    taukoMs: 2000, // molemmat kädet ylhäällä näin kauan = tauko
  },

  lasnaolo: {
    poissaMs: 1000, // jos hartiat tai lantio eivät näy näin kauan, pelaaja on poissa
  },

  hahmo: {
    seurantaNopeus: 28, // suurempi = hahmo seuraa lasta tiukemmin, pienempi = pehmeämmin
  },

  // Oikea ja vasen: samat värit joka paikassa
  varit: {
    oikea: '#FF4057',
    vasen: '#2D8CFF',
    hahmo: '#FFC93C',
    hahmoVarjo: '#F0A81E',
    aariviiva: '#3A2156',
  },
};
