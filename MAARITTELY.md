# Pomp! – määrittely

Päivitetty 15.11.2026. Tämä tiedosto on projektin yksi totuus. Jos jokin koodissa on ristiriidassa tämän kanssa, tämä voittaa — tai kerro ristiriidasta.

## Tavoite ja käyttötilanne

Selaimessa toimiva liikuntapeli 6–8-vuotiaalle, jossa lapsi ohjaa peliä koko keholla kameran edessä (Nex Playground -tyyli). Peli koostuu neljästä minipelistä yhteisen moottorin päällä.

- **Laitteet**: ensisijaisesti Samsung S23 ja iPhone 17, myös läppäri.
- **Näyttö**: puhelin USB-C–HDMI-adapterilla televisioon.
- **Kamera**: puhelin 2–3 m päässä telineessä, takakamera kohti lasta.
- **Tila**: koko keho mahtuu kuvaan, lapsella tilaa hypätä ja astua sivulle.
- **Yksityisyys**: kuva käsitellään vain puhelimessa. Mitään ei tallenneta eikä lähetetä verkkoon.

## Lukitut päätökset

| Päätös | Perustelu |
| --- | --- |
| Minipelikokoelma yhteisen moottorin päällä | Kamera, tunnistus, kalibrointi ja valikot tehdään kerran. Yksi rikkinäinen peli ei kaada muita. |
| Kaikki neljä minipeliä: Juoksija, Hedelmäsamurai, Seinä tulee, Maalivahti | Toteutetaan vaiheittain. |
| Lapsi näkyy hahmona takaapäin (olan yli), joka matkii liikkeitä | Esteet tulevat kohti, joten kamera on lapsen oma näkökulma: astuminen oikealle siirtää hahmoa oikealle. Takaapäin myös peilausongelma katoaa ja "oikea" on aidosti oikealla. Kameran kuvaa ei näytetä pelin aikana. |
| Yksi tunnistusmalli (MediaPipe Pose Landmarker) | Antaa samasta laskennasta sekä kädet että jalat. Erillinen käsimalli tuplaisi puhelimen kuorman. |
| Juoksun tunnistus + valittava automaattinen eteneminen | Juoksu on vaikein tunnistaa luotettavasti. Automaattitila takaa, että Juoksija on pelattava. |
| Valikot käytetään eleillä | Puhelin on 3 m päässä, näyttöä ei voi koskettaa. |
| Elämät + jatkaminen siitä mihin jäätiin | Elämät tuovat jännitystä, mutta lapsen ei koskaan tarvitse aloittaa alusta. Kun elämät loppuvat, voi jatkaa samasta kohdasta. Ks. "Elämät ja jatkaminen". |
| three.js (3D) kaikissa peleissä + vapaat CC0-grafiikat, äänet koodilla | Esteet ja kohteet tulevat syvyydestä kohti katsojaa, mikä vaatii aidon perspektiivin. Näytönohjain hoitaa piirron, joten prosessori jää tunnistukselle. |
| Käyttöliittymä suomeksi, kuvakkeet ja numerot tekstin sijaan | Lapsi ei välttämättä lue sujuvasti. |

## Tekninen arkkitehtuuri

Peli on staattinen verkkosivu (HTML + JavaScript), joka julkaistaan ilmaiseen HTTPS-palveluun. Palvelinta, tietokantaa tai kirjautumista ei tarvita.

### Tiedostorakenne

Pienet erilliset tiedostot yhden ison sijaan: kun muutetaan yhtä minipeliä, luetaan ja kirjoitetaan vain sen tiedosto.

```
index.html          aloitussivu, lataa muut
config.js           KAIKKI säädettävät raja-arvot yhdessä paikassa
main.js             sovelluksen kulku
engine/camera.js    kamera, takakamera oletuksena, vaihto
engine/pose.js      MediaPipe, pisteiden pehmennys
engine/calibrate.js kalibrointi
engine/motion.js    hyppy, kyykky, sivuaskel, juoksu, kädet, eleet
engine/avatar.js    hahmo
engine/simulator.js näppäimistöllä ohjattava testipelaaja (?sim=1)
engine/debug.js     Mittarit-näkymä
engine/ui.js        elevalikko, tauko, ajastin, yhteenveto   (vaihe 2)
engine/audio.js     äänet Web Audiolla                       (vaihe 2)
engine/storage.js   ennätykset selaimen muistiin             (vaihe 2)
games/runner.js     Juoksija
games/fruit.js      Hedelmäsamurai
games/wall.js       Seinä tulee
games/goalie.js     Maalivahti
```

### Keskeiset tekniset valinnat

- **MediaPipe Tasks Vision**, kiinnitetty tarkkaan versioon jsDelivristä. Malli valitaan automaattisesti: Lite puhelimella, Full läppärillä. config.js:ssä valinnan voi pakottaa. GPU-kiihdytys päälle, automaattinen vaihto CPU:hun jos GPU kaatuu.
- **Kamera**: getUserMedia, 1280×720, takakamera oletuksena. Tunnistetut pisteet käännetään vaakasuunnassa, jotta lapsen oikea käsi on ruudulla oikealla. Tämä on oikein takaapäin kuvatulle hahmolle, älä poista sitä.
- **Pehmennys**: One Euro -suodin, jotta hahmo ei tärise.
- **Piirtäminen**: three.js. Peli piirtää 60 fps, tunnistus 15–30 fps, väliarvot interpoloidaan.
- **Näyttö ei sammu**: Wake Lock API + koko näytön tila.
- **Kaikki säätöarvot config.js:ssä** kommentoituna.
- **Debug-näkymä**: kameran kuva, luuranko ja mittarit raja-arvojen säätämiseen.

## Liikkeiden tunnistus

Kaikki raja-arvot suhteutetaan **hartialeveyteen (S)** pikseleinä. Näin tunnistus toimii samoin riippumatta etäisyydestä kameraan. Luvut ovat **lähtöarvoja**, jotka säädetään testaamalla.

| Liike | Tunnistus | Lähtöarvo |
| --- | --- | --- |
| Kalibrointi | Lapsi seisoo paikallaan, hartiat, lantio, polvet ja nilkat näkyvät. Tallennetaan lantion perustaso, keskikohta ja S. | 3 s vakaana |
| Hyppy | Lantio nousee perustason yläpuolelle ja molemmat nilkat nousevat samaan aikaan. | 0,30 · S |
| Kyykky | Lantio laskee perustason alapuolelle. | 0,50 · S, vähintään 200 ms |
| Sivuaskel / kaista | Lantion keskikohdan vaakasijainti. Hystereesi estää välkkymisen. | ± 0,80 · S |
| Juoksu paikallaan | Jalkojen korkeusero vuorottelee. Askeltahti määrää nopeuden. | 0,22 · S, vähintään 1,5 askelta/s |
| Käden piste | Ranteesta kyynärvarren suuntaan, jotta osumapiste on kämmenessä. | – |
| Keruu | Käden piste kohteen alueella, nopeutta ei vaadita. | säde 0,4 · S |
| Viipalointi | Käden piste kulkee kohteen läpi riittävällä nopeudella. | yli 2 · S / s |
| Valinta valikossa | Käsi painikkeen päällä, latausrengas täyttyy. | 1,5 s |
| Tauko | Molemmat ranteet pään yläpuolella. | 2 s |
| Pelaaja poissa | Hartiat tai lantio eivät näy. | 1 s → automaattinen tauko |

**Juoksun ja hypyn erottaminen** on tärkein kohta: hypyssä ja kyykyssä jalat liikkuvat yhdessä, joten korkeusero on nolla eikä vääriä askelia synny. Juoksussa jalat vuorottelevat.

**Lantion perustaso ja mittakaava seuraavat lasta hitaasti**, jos hän siirtyy lähemmäs tai kauemmas kesken pelin.

## Kamera ja näkyvyys

Pelin perusnäkymä on kolmas persoona hahmon takaa: esteet tulevat pakopisteestä kohti katsojaa. Tämä tekee liikkeestä aidon tuntuisen — sivusta kuvattuna sivuaskel näyttäisi pystyliikkeeltä eikä vastaisi sitä, mitä keho tekee.

**Kameran sijoittelu**: tavoite on, että hahmo näkyy kokonaan ruudun alaosassa, sen pää jää selvästi pakopisteen alapuolelle ja esteet ilmestyvät ruudun keskeltä. Este saapuu hahmon kohdalle vasta viimeisen puolen sekunnin aikana, kun päätös on jo tehty.

Lähtöarvot: kamera 2,5 m hahmon takana ja 2 m lattiasta, katse 12° alaspäin. Arvot ovat suuntaa antavia. Tällä sijoittelulla hahmo vie noin 35–40 % ruudun korkeudesta, eikä se mahdu kokonaan alimpaan kolmannekseen ilman että jalat rajautuvat pois. Kameran paikka, katsekulma ja kuvakulma (montako astetta kamera näkee) ovat config.js:ssä, ja lopulliset arvot säädetään 3D-testikentässä silmällä.

**Keinot, joilla hahmo ei peitä tulevaa:**

- Varjo ja väril­liset kaistan reunat lattiassa: lapsi näkee sijaintinsa hahmoa katsomatta.
- Kamera nousee ylemmäs ja taaemmas, kun este lähestyy, ja laskeutuu lähemmäs rauhallisina hetkinä.
- Hahmon kädet muuttuvat puoliläpinäkyviksi, kun ne nousevat hartialinjan yläpuolelle.
- Kerättävät sijoitetaan sivuille ja hahmon korkeudelle, ei suoraan pään yläpuolelle.
- Reunavalo hahmon ympärillä, jotta se erottuu taustasta.

**Poikkeus: Seinä tulee.** Siinä lapsen pitää verrata omaa asentoaan aukkoon, joten kamera kääntyy hahmon eteen ja hahmo näytetään peilikuvana (kuten lapsi näkisi itsensä peilistä). Peli kertoo näkymänvaihdon selvästi.

**Hedelmäsamurai** on 3D kuten muutkin: hahmo takaapäin, hedelmät lentävät kaarina 3D-tilassa hahmon edessä ja osa tulee syvyydestä kohti. Kameran tarkka paikka säädetään vaiheessa 3.

## Minipelit

Jokainen minipeli on 60–90 s kierros, jonka lopussa näytetään pisteet ja liikuntayhteenveto. Vaikeus nousee kierroksen aikana.

### Elämät ja jatkaminen

- Kierroksen alussa on 3 elämää (config.js). Elämät näkyvät sydäminä ruudun yläreunassa.
- Virhe vie yhden elämän. Mikä on virhe, kerrotaan kunkin pelin kohdalla.
- Kun elämät loppuvat, peli pysähtyy ja kysyy elevalikolla: **Jatka** tai **Lopeta**.
- **Jatka**: peli jatkuu täsmälleen siitä mihin jäätiin. Elämät täyttyvät, pisteet ja jäljellä oleva aika säilyvät, combo nollautuu.
- **Lopeta**: siirrytään yhteenvetoon. Kierros päättyy yhteenvetoon myös normaalisti, kun aika loppuu.
- Yhteenveto on aina positiivinen. Jatkokertoja ei rangaista eikä korosteta.
- Jatkokertojen määrä on rajaton (config.js:ssä voi rajoittaa).

### Juoksija

Hahmo juoksee kolmikaistaista polkua eteenpäin, kuvattuna takaapäin.

- **Eteneminen**: juoksu paikallaan liikuttaa maailmaa, tahti määrää nopeuden. Asetuksista vaihtoehtona automaattinen eteneminen.
- **Esteet**: matala aita → hyppy, roikkuva palkki → kyykky, kivi kaistalla → sivuaskel.
- **Timantit** kerätään käsillä. Osa on korkealla, jolloin pitää kurottaa tai hypätä.
- **Lisävoimat** polulla: magneetti, kilpi, hidastus.
- **Törmäys** vie elämän: hahmo kompastuu hauskasti ja combo nollautuu.

### Hedelmäsamurai

- Viipaloi hedelmiä nopealla käden liikkeellä.
- **Pommit**: vievät elämän ja nollaavat combon.
- **Kultainen hedelmä** vaatii kaksi lyöntiä ristiin (molemmat kädet).
- Useampi hedelmä yhdellä vedolla antaa bonuksen.

### Seinä tulee

- Seinä lähestyy, ja siinä on hahmon muotoinen aukko.
- **Asennot**: kädet ylös, tähti, kyykky, yksi käsi sivulle, lentokone, flamingo.
- Hahmo hehkuu vihreänä, kun asento täsmää. Arviointi nivelten kulmien vertailuna.
- Tempo hidas alussa, nopeutuu. Ei vaadi nopeutta vaan hauskuutta.
- Jos asento ei täsmää seinän saapuessa, seinä työntää hahmon hauskasti taaksepäin ja vie elämän.

### Maalivahti

- Palloja lentää kohti maalia eri korkeuksille ja puolille.
- Torjunta käsillä tai jaloilla (nilkan piste).
- Matala pallo kyykystä, korkea pallo hypystä.
- Pallon tulosuunta näkyy etukäteen.
- Päästetty maali vie elämän.

## Yhteiset ominaisuudet

| Ominaisuus | Kuvaus |
| --- | --- |
| Aloitus | Iso "Aloita"-painike puhelimen näytöllä (kameralupa vaatii kosketuksen), sen jälkeen kaikki eleillä. |
| Kalibrointi | "Seiso merkin kohdalla" -näkymä. Ilmoittaa, jos lapsi on liian lähellä tai sivussa. |
| Elevalikko | Isot kuvakepainikkeet, valinta pitämällä kättä päällä 1,5 s. |
| Tauko | Molemmat kädet ylös 2 s, tai pelaaja poistuu kuvasta. |
| Laskuri ja ajastin | 3-2-1 ennen kierrosta, jäljellä oleva aika isona palkkina. |
| Elämät | Sydämet ruudun yläreunassa. Elämien loputtua Jatka/Lopeta-valinta, jatko samasta kohdasta. |
| Combo | Peräkkäiset osumat kasvattavat kerrointa (×2, ×3, ×5). |
| Lisävoimat | Magneetti, kilpi, hidastus. |
| Teemamaailmat | Metsä, avaruus, meri: sama peli, eri värit ja taustat. |
| Liikuntayhteenveto | Kierroksen lopussa: hyppyjä, askelia, kyykkyjä, liikeaika. |
| Ennätykset | Paras tulos per minipeli tallentuu puhelimen selaimeen. |
| Äänet | Osuma, viipalointi, keruu, combo, uusi ennätys. Web Audiolla koodissa. |
| Vanhempien asetukset | Kierroksen pituus, vaikeus, juoksu vs. automaattinen, äänet, kamera, debug-näkymä. Avataan kosketuksella, ei eleillä. |

## Visuaalinen ilme

Tavoite on näyttävä, "mehukas" peli, jossa jokainen osuma tuntuu palkitsevalta. Näyttävyys tulee efekteistä ja animaatiosta.

- **Tyyli**: kirkkaat värit, pyöreät muodot, hehku. Yhtenäinen väripaletti per teemamaailma.
- **Hahmo**: ilmeikäs, venymis- ja litistymisanimaatio hypyissä.
- **Efektit**: mehuroiskeet, kipinät timanteista, pienet ruudun täräh­dykset, pistemäärät lentävät osumakohdasta, konfetti ennätyksestä.
- **Syvyys**: aito 3D-perspektiivi, valaistus ja varjot. Kaukana olevat kohteet häivytetään sumuun, mikä myös keventää piirtoa.
- **Lisägrafiikka** vapaista CC0-paketeista (esim. Kenney).
- **Automaattinen laatutaso**: jos ruudunpäivitys putoaa, efektejä vähennetään automaattisesti.

## Oikea ja vasen

Peli opettaa oikean ja vasemman huomaamatta: ohjeet viittaavat aina lapsen omaan oikeaan ja vasempaan, ja vihjeet vähenevät taidon kasvaessa.

- **Pysyvät värit**: oikea = punainen, vasen = sininen, kaikissa peleissä. Hahmon hanskat ja kengät näillä väreillä.
- **Puhutut ohjeet**: "Oikea käsi!", "Astu vasemmalle!" selaimen suomenkielisellä puhesynteesillä. Varalla iso teksti + nuoli.
- **Vihjeiden väheneminen**: helpolla tasolla väri + sana + nuoli, normaalilla väri + sana, vaikealla pelkkä sana. Näin lapsi oppii sanan, ei vain väriä.

| Minipeli | Oikea–vasen-mekaniikka |
| --- | --- |
| Hedelmäsamurai | Osa hedelmistä on merkitty: vain oikealla tai vain vasemmalla kädellä saa lisäpisteet. |
| Juoksija | Kaistanvaihdot puhutaan ennen estettä. Timantit oikean tai vasemman puolen kokoelmina. |
| Seinä tulee | Asennot nimetään: "Nosta oikea käsi", "Seiso vasemmalla jalalla". |
| Maalivahti | "Torju vasemmalla jalalla" -bonuspallot. |

**Yhteenvedossa** näytetään oikean ja vasemman osumat erikseen ja "Oikea–vasen-mestari" -merkki.

## Toteutusvaiheet

Jokainen vaihe aloitetaan erikseen ja pysähdytään sen jälkeen.

| Vaihe | Sisältö | Valmis kun |
| --- | --- | --- |
| 1. Moottori | Kamera, MediaPipe, pehmennys, kalibrointi, liikkeiden tunnistus, debug-näkymä, config.js | Hyppy, kyykky ja sivuaskel tunnistuvat 9/10 yrityksestä. Juoksu ei sekoitu hyppyyn. |
| 1b. 3D-testikenttä | three.js, 3D-hahmo takaapäin, kamera ja kaistat lattiassa, mallin automaattinen valinta (Lite/Full) | Toimii S23:lla ja iPhone 17:llä HDMI:n kautta: tunnistus vähintään 20 fps ja piirto sujuva samaan aikaan. Hahmo matkii lasta viiveettä. |
| 2. Käyttöliittymä | Aloitus, elevalikko, tauko, ajastin, elämät ja jatkaminen, combo, äänet, puhutut ohjeet, visuaalinen tyyli ja efektit, yhteenveto, ennätykset, asetukset | Valikossa liikutaan pelkällä kädellä 3 m päästä. |
| 3. Hedelmäsamurai | Peli, pommit, kultainen hedelmä | Lapsi pelaa kierroksen läpi ilman aikuisen apua. |
| 4. Seinä tulee | Peli, asentojen vertailu, 6 asentoa | Jokainen asento tunnistuu, kun lapsi tekee sen oikein. |
| 5. Juoksija | Polku, kaistat, esteet, timantit, juoksu- ja automaattitila | Juoksutahti näkyy nopeutena viiveettä. Automaattitila toimii ilman juoksua. |
| 6. Maalivahti ja viimeistely | Maalivahti, teemamaailmat, lisävoimat | Kaikki neljä peliä valikosta pelattavissa. |

Vaiheen 1b jälkeen pidetään testisessio lapsen kanssa ja säädetään config.js:n arvot ennen pelien rakentamista.

### Tilanne 15.11.2026

Vaihe 1 (tunnistus) on toteutettu, ja sen tarkkuus testataan puhelimilla yhdessä vaiheen 1b kanssa. Väliaikainen testikenttä on tehty 2D:nä ennen 3D-päätöstä, ja se korvataan kokonaan vaiheessa 1b. 2D-versiota ei kehitetä eikä testata enää.

- **Säilyy sellaisenaan**: camera.js, pose.js, calibrate.js, motion.js, simulator.js, debug.js, config.js. Nämä tuottavat numeroita, eivät grafiikkaa. (debug.js piirtää Mittarit-näkymän päällyskerroksena, ja se saa jäädä.)
- **Kirjoitetaan uusiksi**: avatar.js (3D-hahmo takaapäin) ja main.js:n testikenttä.
- **Poistetaan**: 2D-hahmoon liittyvät config.js:n arvot, kun niitä ei enää käytetä.

Minipelien rajapinta: pelit lukevat `motion.state` (hyppy, kyykky, kaista, juoksun vauhti, kädet kehoyksiköissä) ja `motion.takeEvents()` (jump, land, squat, squatEnd, lane, step, pauseGesture, lost, found). Raakapisteisiin ei kosketa.

## Rajaukset ja riskit

**Ei tässä versiossa**: kaksinpeli, verkkoennätykset, käyttäjätilit, hahmon valinta, kameran kuvan tallennus tai lähettäminen.

| Riski | Vaikutus | Varasuunnitelma |
| --- | --- | --- |
| Juoksun tunnistus epäluotettava | Juoksija ei tunnu reilulta | Automaattinen eteneminen oletukseksi |
| Puhelin kuumenee tai hidastuu | Peli nykäisee | Lite-malli, tunnistus 15 fps, kevyempi grafiikka |
| 3D-piirto ja tunnistus yhdessä liian raskas | Tunnistus hidastuu | Mitataan heti vaiheessa 1b. Pienempi piirtotarkkuus, vähemmän varjoja ja efektejä |
| Huono valaistus tai kirjava tausta | Pisteet hyppivät | Kalibrointi varoittaa |
| Huoneen tila liian pieni | Koko keho ei mahdu kuvaan | Kalibrointi kertoo, astu kauemmas |
| iOS Safari -erot | Ominaisuus ei toimi iPhonella | Testataan iPhonella jo vaiheessa 1 |

## Julkaisu

GitHub Pages (julkinen repo). Projektikansio on kytketty GitHubiin, ja Claude vie muutokset sinne vain luvalla. Sivu päivittyy noin minuutissa. Läppärillä voi pelata myös paikallisella palvelimella, puhelin vaatii HTTPS:n.

## Ohjeet toteuttavalle mallille

- Tee **vain pyydetty vaihe**, pysähdy sen jälkeen ja odota lupaa jatkaa.
- Sami ei ole kehittäjä: selitä jokainen tekninen päätös ja sen syy lyhyesti suomeksi selkokielellä.
- Keskustele suomeksi, tiiviisti. Pelin tekstit suomeksi.
- Windows-tiedosto-operaatioihin anna aina sekä graafinen että PowerShell-vaihtoehto.
- Pidä kaikki säädettävät arvot config.js:ssä kommentoituna.
- Kiinnitä ulkoiset kirjastot tarkkaan versioon.
- Kerro selvästi, jos jokin määrittelyn kohta osoittautuu liian monimutkaiseksi, ja ehdota yksinkertaisempaa.
- Muutoksissa kirjoita vain muuttuneet tiedostot, ei koko projektia uudelleen.
