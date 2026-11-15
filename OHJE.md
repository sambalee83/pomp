# Pomp! – käyttöönotto ja testaus

Peli on osoitteessa **https://sambalee83.github.io/pomp/**. Claude vie muutokset GitHubiin pyynnöstäsi, ja sivu päivittyy noin minuutissa. Aloitusruudun alareunan versionumerosta näet, onko puhelimessa uusin versio.

## 1. Kokeile läppärillä

- Avaa pelin osoite selaimessa. Läppärin kamera toimii suoraan.
- **Kokeile ilman kameraa** -linkki (tai osoitteen perään `?sim=1`) käynnistää simulaattorin, jossa hahmoa ohjataan näppäimistöllä. Sillä näet heti, miltä kaikki näyttää.

Ilman julkaisua sivun voi avata paikallisen palvelimen kautta (pelkkä `index.html`-tiedoston kaksoisnapsautus ei toimi):

- **VS Code:** asenna laajennus *Live Server*, avaa `pomp`-kansio ja paina oikeasta alakulmasta **Go Live**.
- **PowerShell** (vaatii Pythonin): `cd $HOME\Desktop\pomp` ja `python -m http.server 8000`, avaa sitten `http://localhost:8000`.

## 2. Puhelin ja televisio

1. Kytke puhelin televisioon USB-C–HDMI-sovittimella ja laturiin.
2. Avaa pelin osoite. Samsungissa Chrome, iPhonessa Safari.
3. iPhonessa selaimen palkit saa pois näin: **Jaa** → **Lisää Koti-valikkoon**, ja avaa peli Koti-valikon kuvakkeesta.
4. Käännä puhelin vaakaan ja aseta telineeseen noin lapsen vyötärön korkeudelle, **takakamera lapseen päin**, 2–3 metrin päähän.
5. Paina **Käynnistä kamera** ja salli kameran käyttö. Ensimmäinen lataus kestää hetken.
6. Lapsi seisoo keskellä, kunnes palkki täyttyy. Sen jälkeen aukeaa testikenttä.

## 3. Mitä testataan

Paina **Mittarit**, niin näet kameran kuvan, tunnistetun luurangon ja luvut.

| Testi | Tavoite |
| --- | --- |
| Nopeus (Mittarit: "tunnistus … fps") | vähintään 20 fps molemmilla puhelimilla, ja hahmo liikkuu sulavasti |
| 10 hyppyä | vähintään 9 kasvattaa Hyppy-laskuria |
| 10 kyykkyä | vähintään 9 kasvattaa Kyykky-laskuria |
| 10 sivuaskelta | hahmo vaihtaa kaistaa samaan suuntaan kuin lapsi |
| Juoksu paikallaan 10 s | juoksu tunnistuu, Hyppy-laskuri ei kasva |
| Hypyt ilman juoksua | Juoksu-laskuri ei kasva |
| Molemmat kädet ylös 2 s | tulee Tauko, sama uudelleen jatkaa |
| Poistu kuvasta | "Tule takaisin kuvaan" |
| Oikea käsi ylös | hahmon punainen hanska nousee ruudun oikealla puolella |

Kirjaa ylös, mikä ei toiminut, ja Mittarit-näkymän luvut siltä hetkeltä (esim. "lantio +0.21 S hypyssä"). Niiden perusteella raja-arvot on helppo korjata.

## 4. Säätäminen itse

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
