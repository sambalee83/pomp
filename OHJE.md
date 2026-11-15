# Pomp! – vaihe 1: käyttöönotto ja testaus

Tässä vaiheessa on valmiina pelin moottori ja **testikenttä**: kamera, asennon tunnistus, kalibrointi,
liikkeiden tunnistus ja hahmo. Minipelit tulevat seuraavissa vaiheissa.

## 1. Pura paketti

- **Resurssienhallinta:** napsauta `pomp-vaihe1.zip` hiiren oikealla → **Pura kaikki** → valitse kansio.
- **PowerShell:** `Expand-Archive -Path "$HOME\Downloads\pomp-vaihe1.zip" -DestinationPath "$HOME\Documents"`

Saat kansion `pomp`, jossa on `index.html`, `main.js`, `config.js` ja kansio `engine`.

## 2. Julkaise GitHub Pagesiin (tarvitaan puhelinta varten)

Puhelimen selain sallii kameran vain https-osoitteessa, joten peli pitää julkaista. Tämä tehdään kerran.

1. Luo tili osoitteessa https://github.com/signup (sähköposti, salasana, käyttäjänimi).
2. Napsauta oikeasta yläkulmasta **+** → **New repository**.
3. Repository name: `pomp`. Valitse **Public**. Älä muuta muita asetuksia. Paina **Create repository**.
4. Avautuvalla sivulla napsauta linkkiä **uploading an existing file**.
5. Avaa purettu `pomp`-kansio Resurssienhallinnassa, valitse **kaikki sen sisältö** (Ctrl + A)
   ja raahaa selaimeen. Tärkeää: raahaa kansion sisältö, ei itse `pomp`-kansiota. Käytä Chromea tai Edgeä.
6. Paina alhaalta **Commit changes**.
7. Avaa **Settings** → vasemmalta **Pages** → kohdassa *Branch* valitse **main** ja **/ (root)** → **Save**.
8. Odota 1–2 minuuttia. Peli on osoitteessa `https://KÄYTTÄJÄNIMESI.github.io/pomp/`.

Kun tiedostoja myöhemmin muutetaan: repositorion etusivulla **Add file** → **Upload files**,
raahaa muuttuneet tiedostot ja paina **Commit changes**. Sivu päivittyy noin minuutissa.

## 3. Kokeile läppärillä ilman julkaisua (valinnainen)

Sivu pitää avata paikallisen palvelimen kautta. Pelkkä `index.html`-tiedoston kaksoisnapsautus ei toimi.

- **VS Code:** asenna laajennus *Live Server*, avaa `pomp`-kansio ja paina oikeasta alakulmasta **Go Live**.
- **PowerShell** (vaatii Pythonin): `cd $HOME\Documents\pomp` ja `python -m http.server 8000`,
  avaa sitten selaimessa `http://localhost:8000`.

**Kokeile ilman kameraa** -linkki aloitusruudussa käynnistää simulaattorin, jossa hahmoa ohjataan näppäimistöllä.
Sillä näet heti, miltä kaikki näyttää, ja myöhemmin minipelejä voi kokeilla hyppimättä.

## 4. Puhelin ja televisio

1. Kytke puhelin televisioon USB-C–HDMI-sovittimella ja laturiin.
2. Avaa pelin osoite. Samsungissa Chrome, iPhonessa Safari.
3. iPhonessa selaimen palkit saa pois näin: **Jaa** → **Lisää Koti-valikkoon**, ja avaa peli Koti-valikon kuvakkeesta.
4. Käännä puhelin vaakaan, aseta telineeseen noin lapsen vyötärön korkeudelle **takakamera lapseen päin**, 2–3 metrin päähän.
5. Paina **Käynnistä kamera** ja salli kameran käyttö. Ensimmäinen lataus kestää hetken.
6. Lapsi seisoo keskellä, kunnes palkki täyttyy. Sen jälkeen aukeaa testikenttä.

## 5. Mitä testataan

Paina **Mittarit**, niin näet kameran kuvan, tunnistetun luurangon ja luvut.

| Testi | Tavoite |
| --- | --- |
| Tunnistuksen nopeus (Mittarit: "tunnistus … fps") | vähintään 20 fps molemmilla puhelimilla |
| 10 hyppyä | vähintään 9 kasvattaa Hyppy-laskuria |
| 10 kyykkyä | vähintään 9 kasvattaa Kyykky-laskuria |
| 10 sivuaskelta | kaista vaihtuu oikeaan suuntaan, vasen on sininen ja oikea punainen |
| Juoksu paikallaan 10 s | Juoksu-valo palaa ja palkki kasvaa, Hyppy-laskuri ei kasva |
| Hypyt ilman juoksua | Juoksu-laskuri ei kasva |
| Käden huitaisu | "Viuh!" näkyy oikean käden kohdalla |
| Molemmat kädet ylös 2 s | tulee Tauko, sama uudelleen jatkaa |
| Poistu kuvasta | "Tule takaisin kuvaan" |
| Oikea käsi | hahmon punainen O-hanska liikkuu ruudun oikealla puolella |

Kirjaa ylös, mikä ei toiminut, ja Mittarit-näkymän luvut siltä hetkeltä (esim. "lantio +0.21 S hypyssä").
Niiden perusteella raja-arvot on helppo korjata.

## 6. Säätäminen itse

Kaikki raja-arvot ovat tiedostossa `config.js` selityksineen. Yleisimmät:

| Ongelma | Muuta |
| --- | --- |
| Hypyt eivät tunnistu | `hyppy.kynnys` pienemmäksi (0.30 → 0.22) |
| Vääriä hyppyjä | `hyppy.kynnys` suuremmaksi |
| Juoksu ei tunnistu | `juoksu.askelKynnys` pienemmäksi (0.22 → 0.15) |
| Kyykky vaatii liian syvän | `kyykky.kynnys` pienemmäksi (0.50 → 0.40) |
| Sivuaskel vaatii liian pitkän | `kaista.raja` pienemmäksi (0.80 → 0.60) |
| Hahmo tärisee | `pehmennys.minCutoff` pienemmäksi (1.2 → 0.8) |
| Hahmo tulee perässä | `pehmennys.beta` suuremmaksi tai `hahmo.seurantaNopeus` suuremmaksi |
| Puhelin hidastelee | `naytto.maxDpr` arvoon 1 ja `malli.maxFps` arvoon 20 |

Jos kuva ei tunnistu lainkaan iPhonella, paina oikean yläkulman **GPU**-painiketta: se vaihtaa laskentatavan.
