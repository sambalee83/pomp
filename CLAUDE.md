# Pomp! – ohje Claudelle

Lue ensin **MAARITTELY.md**. Se on projektin ainoa totuus: jos koodi tai tämä tiedosto on ristiriidassa sen kanssa, määrittely voittaa, tai kerro ristiriidasta. Tähän on koottu vain tiivistelmä ja työtapa.

## Peli lyhyesti

Selaimessa toimiva liikuntapeli 6–8-vuotiaalle. Lapsi ohjaa peliä koko keholla puhelimen kameran edessä (2–3 m päässä), ja kuva näkyy televisiossa HDMI-sovittimen kautta. Neljä minipeliä yhteisen moottorin päällä: Juoksija, Hedelmäsamurai, Seinä tulee ja Maalivahti. Pelissä on elämät, mutta niiden loputtua voi jatkaa siitä mihin jäätiin, eikä kenenkään tarvitse aloittaa alusta. Lisäksi peli opettaa oikean ja vasemman (oikea = punainen, vasen = sininen).

Laitteet: Samsung S23, iPhone 17 ja läppäri. Kamerakuva käsitellään vain puhelimessa, eikä mitään tallenneta tai lähetetä.

## Lukitut päätökset

Näitä ei muuteta kysymättä. Perustelut löytyvät MAARITTELY.md:stä.

- **Peli on 3D (three.js).** 2D-ratkaisuja ei käytetä eikä ehdoteta. Vapaat CC0-grafiikat, äänet koodilla (Web Audio).
- **Kamera hahmon takana olan yli**: esteet tulevat pakopisteestä kohti katsojaa. Lapsen oikea on ruudulla oikealla, joten peilausta ei tarvita. Poikkeus on *Seinä tulee*: siinä kamera kääntyy hahmon eteen. Katso osio "Kamera ja näkyvyys".
- **Kameran kuvaa ei näytetä pelin aikana**, vain Mittarit-näkymässä.
- **Yksi tunnistusmalli**: MediaPipe Pose Landmarker, kiinnitetty tarkkaan versioon.
- **Valikot käytetään eleillä**. Vain aloitus ja vanhempien asetukset avataan kosketuksella.
- **Ajastetut kierrokset ja elämät.** Kun elämät loppuvat, voi valita Jatka, jolloin peli jatkuu samasta kohdasta, ja pisteet säilyvät. Katso osio "Elämät ja jatkaminen".
- **Käyttöliittymä suomeksi**, kuvakkeita ja numeroita tekstin sijaan.
- **Staattinen sivu GitHub Pagesissa**: ei palvelinta, tietokantaa eikä kirjautumista.

## Koodin rakenne

Pieniä erillisiä tiedostoja, jotta yhden asian muuttaminen koskee vain yhtä tiedostoa. Tiedostorakenne on kuvattu MAARITTELY.md:ssä.

- `config.js`: kaikki säätöarvot ja versionumero.
- `main.js`: sovelluksen kulku ja testikenttä.
- `engine/`: moottori (kamera, tunnistus, kalibrointi, liikkeet, hahmo, simulaattori, Mittarit).
- `games/`: minipelit, tulevat myöhemmissä vaiheissa.
- `tyyli/`: vanha 2D-tyyliesittely, ei osa peliä.

**Tilanne 15.11.2026:** Vaiheen 1 tunnistus on toteutettu (testataan puhelimilla vaiheessa 1b), mutta sen väliaikainen testikenttä on 2D:tä. Seuraavana on vaihe 1b (3D-testikenttä ja suorituskykytesti puhelimilla).
- **Säilyvät**: `camera.js`, `pose.js`, `calibrate.js`, `motion.js`, `simulator.js`, `debug.js` ja `config.js`. Ne tuottavat numeroita, eivät grafiikkaa.
- **Kirjoitetaan uusiksi 3D:ksi**: `avatar.js` (hahmo takaapäin) ja `main.js`:n testikenttä.

**Rajapinta peleille:** pelit lukevat vain `motion.state`-tilaa ja `motion.takeEvents()`-tapahtumia. Raakapisteisiin ei kosketa. Liikkeiden raja-arvot suhteutetaan hartialeveyteen (S).

Testaus ilman kameraa: `?sim=1` (näppäimistöllä ohjattava testipelaaja).

## Työtapa

- **Vaihe kerrallaan.** Tee vain pyydetty vaihe tai tehtävä, pysähdy sen jälkeen ja odota lupaa jatkaa. Älä aloita uutta vaihetta oma-aloitteisesti. Vaiheet on lueteltu MAARITTELY.md:n osiossa "Toteutusvaiheet".
- **Sami ei ole kehittäjä.** Selitä jokainen tekninen päätös ja sen syy lyhyesti suomeksi selkokielellä. Ole silti tiivis äläkä toista perusasioita joka kerta.
- **Kaikki säätöarvot kuuluvat `config.js`:ään** kommentoituina: raja-arvot, ajat, nopeudet, kameran sijoittelu ja värit. Muualla koodissa ei saa olla "taikalukuja", joita joutuisi säätämään.
- **Nosta `CONFIG.versio`**, kun muutat pelin koodia. Versio näkyy aloitusruudussa, joten siitä näkee, onko puhelimessa uusin versio.
- **GitHubiin vain luvalla.** Tee muutokset paikallisesti ja kysy ennen kuin viet ne GitHubiin (Pages päivittyy siitä).
- **Kirjoita vain muuttuneet tiedostot**, älä koko projektia uudelleen.
- **Kiinnitä ulkoiset kirjastot tarkkaan versioon.**
- **Kerro, jos jokin osoittautuu liian monimutkaiseksi**, ja ehdota yksinkertaisempaa ratkaisua.
- **Windows-tiedostotoimiin** anna sekä graafinen että PowerShell-ohje.
- **Laatutavoite**: kaupallisen pelin taso (ei AAA), selkeä ja siisti. Vain tarpeelliset elementit, mutta ne hyvin tehtyinä.
