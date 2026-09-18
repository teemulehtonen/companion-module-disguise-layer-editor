# Disguise Layer Editor — 0.1.beta

> **EXPERIMENTAL BETA — NO WARRANTY.** Provided as-is under the MIT License, subject to applicable law. Validate independently and back up projects before use. No promised support or fitness for live production. See [DISCLAIMER.md](DISCLAIMER.md), [SECURITY.md](SECURITY.md) and [known limitations](KNOWN-LIMITATIONS.md).

Disguise Designerin layerien, parametrien, keyframejen ja resurssien ohjaus Bitfocus Companionilla ja Stream Deck +:lla.

**Paketin tekninen versio:** `0.1.0-beta.1` (SemVer). **Testattu:** Designer 32.4.17, Companion 5.0.5, Windows ja Node.js 22.22.0. Tämä on beta-julkaisu; [tunnetut rajoitukset](KNOWN-LIMITATIONS.md) kuuluvat julkaisuun.

## Asennus

1. Ota Designerin HTTP/Python-rajapinta käyttöön. Companion-koneen on päästävä Designerin HTTP-porttiin.
2. Companion → **Modules → Import module package** → `disguise-layer-control-0.1.0-beta.1.tgz`.
3. Lisää **Disguise Layer Editor** -yhteys tai vaihda nykyisen yhteyden versioksi **0.1.0-beta.1**. Aseta Designerin osoite ja portti. Samalla koneella osoite on `127.0.0.1`; portin oletus on `80`.
4. Companion → **Import / Export** → tuo `D3-Stream-Deck-Plus.companionconfig`. Valitse kohdesivu ja linkitä nykyiseen yhteyteen. Sivu on suunniteltu sivulle 2. Tuonti korvaa kohdesivun; vie talteen sivu, jonka haluat säilyttää.
5. Kohdista Stream Deck + valitulle sivulle. HTTP + SYNC kertoo toimivasta tilapalautteesta.

Sivun tuonti asentaa koko sivun. Presets-valikosta voi lisätä yksittäisiä ohjaimia. Pelkkä moduuliversion vaihto ei vaadi sivun uudelleentuontia.

## Säätäminen

| Rulla | Kierto | Painallus |
| --- | --- | --- |
| LAYER | Valitsee ajan kohdalla olevan layerin | Ei toimintoa normaalitilassa |
| PARAMETER | Valitsee parametrin | COARSE → FINE → ULTRA |
| VALUE | Muuttaa valittua keyframea tai vakioarvoa heti | Lisää keyframen playheadin kohdalle |
| TIME | Siirtää playheadia, SELECT KEY -tilassa keyframea | Vaihtaa aika-askelta myös SELECT KEY -tilassa |

Oletusparametri on Brightness, sen puuttuessa Volume ja muuten Designerin ensimmäinen saatavilla oleva parametri. Liukulukujen askeleet ovat 0,1 / 0,01 / 0,001. Kokonaisluvut ja nimetyt valinnat vaihtuvat kokonaisin askelin. Parametrin omia rajoja noudatetaan.

VALUE-kierto ei lisää avaimia. Ilman erillistä valintaa muokataan playheadin kohdalla tai sitä edeltävää avainta; ennen ensimmäistä avainta muokataan ensimmäistä. Sequencing pois päältä tarkoittaa yhden vakioavaimen muokkausta. Näyttö näyttää Designerin nykyisen lasketun arvon myös keyframejen välissä.

**SELECT KEY** valitsee lähimmän layerin sisäisen avaimen ja siirtää playheadin siihen. Tasatilanteessa valitaan seuraava. Layer ja parametri lukittuvat; TIME, VALUE ja TYPE toimivat edelleen. Keyframen siirto pysähtyy layerin nykyisiin IN/OUT-rajoihin. TIME-painallus vaihtaa aika-askelta säilyttäen lukituksen. SELECT KEY uudelleen vapauttaa lukituksen. **TYPE** vaihtaa HOLD / LINEAR / SMOOTH. **DEFAULT** palauttaa vakioarvon ilman uuden keyframen luomista. **DELETE KEY** poistaa lyhyellä painalluksella valitun avaimen mutta ei viimeistä. Pidä nappia pohjassa vähintään sekunti ja vapauta: **DELETE ALL KEYS** listaa layerin animoidut arvo- ja resource-parametrit. Valitse yksi parametri PARAMETER-rullaa pyörittämällä. **DELETE** avaa **ARE YOU SURE?** -vahvistuksen ja näyttää parametrin nimen. Vahvistuksen **DELETE** poistaa vain tämän parametrin animaation ja säilyttää nykyisen arvon tai resurssiviitteen vakiona. **DELETE ALL + DEFAULT** poistaa myös layerin ulkopuoliset avaimet ja palauttaa parametrin alkuperäisen oletusarvon tai resurssin. Myös tämä toiminto vahvistetaan. **CANCEL** palaa valintaan; BACK poistuu.

Absoluuttiset aikanäytöt käyttävät Designerin omaa TC-markerien muunnosta. Playhead, IN, OUT, POSITION ja keyframejen ajat näkyvät samassa TC-ajassa kuin Designerissä. Kestot ja K−/K+-etäisyydet pysyvät kestoina ilman offsetia.

**PREV / NEXT** käyttävät valitun parametrin avaimia ja pysähtyvät ensimmäisen/viimeisen jälkeen IN-kohtaan tai OUT − 1 frame -kohtaan. Ajan ulkopuolelle jäävä layer poistuu valinnasta myös silloin, kun se on korostettuna Designerissä; jos aktiivisia layereitä ei ole, valinta tyhjenee. **PLAY SECTION / STOP** käynnistää toiston osion loppuun tai pysäyttää sen; toiston aikana napissa näkyy aikakoodi. Vihreä piste PARAMETER-otsikossa kertoo useista sekvensoiduista avaimista.

## Layerin ajoitus

**LAYER EDIT** avaa rullat **IN / POSITION / OUT / FIT**. IN ja OUT ovat absoluuttisia aikoja. POSITION näyttää keskiajan ja siirtää layeria, avaimia sekä playheadia samalla toteutuneella aikaerolla. FIT näyttää keston ja sovittaa loppupisteen sisällön kestoon; staattisella sisällöllä kestoa ei välttämättä ole.

Kolmen ensimmäisen rullan painallus vaihtaa askelta: frame / 1 s / 2 s / 5 s / 10 s / 1 min. Rajat pysyvät trackissa ja vähimmäiskesto on yksi frame. LAYER EDIT -napilla palataan parametreihin. FPS luetaan Designerista; aikakoodi on `hh:mm:ss:fr`.

## Resurssit

**RESOURCES** avaa rullat **SOURCE / FOLDER / RESOURCES / BACK**. SOURCE valitsee kentän (Video, Bitmap, Palette, Mapping, Output jne.). FOLDER selaa kenttätyypin kansioita. Library on mediakirjasto, Project projektin resurssit ja Internal sisäiset resurssit.

RESOURCES-rulla selaa ja sivuttaa kahdeksan thumbnailin näkymän. Painallus vahvistaa valinnan ja palaa parametreihin. BACK peruuttaa esikatselun. Thumbnailin painallus valitsee resurssin ja jättää selaimen auki. Pelkkä selaus ei kirjoita Designerille. Kuvattomissa resursseissa näkyy tyyppi. Valinta vaihtaa resurssiviitteen; se ei lisää keyframea eikä muokkaa resurssin sisäisiä asetuksia.

## Kääntäminen omalla koneella

Pura lähdekoodipaketti kirjoitettavaan kansioon.

1. **1 - Asenna ymparisto.cmd** asentaa paikallisen Node.js:n ja lukitut riippuvuudet. Ensiasennus tarvitsee verkon. Node-latauksen SHA-256 tarkistetaan.
2. **2 - Kaanna moduuli.cmd** ajaa testit ja rakentaa moduulin sekä sivun.
3. **3 - Aja testit.cmd** ajaa offline-testit ilman Designer-muutoksia.
4. **5 - Tee julkaisupaketti.cmd** tekee jakelun kansioon `releases/0.1.beta`.

Jos Node.js 22.22.0 on jo käytössä: `npm ci`, `npm test`, `npm run package`. Muotoilu: `npm run format:check` ja `npm run format`. Julkaisu: `npm run release`. Olemassa olevan paikallisen jakelun voi korvata komennolla `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release.ps1 -Force`.

Jakelussa on moduuli, sivu, lähdekoodi, lisenssit, ohjeet ja SHA-256-summat. Kehityskokeita, projektitietoja, testimedioita tai Node-asennusta ei jaeta.

## Laatu ja rajaukset

Track 1:n uusimmassa testissä 154 erillistä testitapausta läpäistiin, mukaan lukien 112 resurssivalintaa. Katso [testiraportti](docs/TRACK-1-TESTS.md). Automaattinen tilaseuranta käyttää peräkkäisiä HTTP-kyselyjä; Designer 32.4.17:n virheilevät LiveUpdate-tilaukset on poistettu tuotantokäytöstä. Designerin thumbnail-järjestelmän erillinen poikkeus on dokumentoitu rajauksissa.

Alpha perustuu Track 5:n käytännön testiin sekä 76 layer-tyypin API-kartoitukseen: 1 003 parametrikirjoitusta, 998 keyframe-testiä ja 122 valintalistatestiä. Tämä ei varmista kaikkia ulkoisia laitteita tai sisältökohtaisia yhdistelmiä.

Vapaat tekstikentät ja Companionista Designerin hiirivalinnan ohjaaminen eivät ole tuettuja. Designerin layer-valinta seuraa Companioniin, mutta hiirellä avatun parametrin automaattinen tunnistus puuttuu. Katso [rajaukset](KNOWN-LIMITATIONS.md) ja [koodin rakenne sekä ratkaisujen perustelut](docs/ARCHITECTURE.md).

Koodi on MIT-lisensoitu. Moduulipaketti sisältää riippuvuuksien lisenssitiedot. Kyseessä on Disguise Layer Editorin moduuli, ei Disguisen tai Bitfocusin virallinen tuote.
DELETE ALL -valikon DEFAULT ALL PARAMETERS palauttaa valitun layerin kaikkien tuettujen arvo-, valintalista- ja resurssiparametrien oletukset sekä poistaa animaatiot myös IN/OUT-rajojen ulkopuolelta. Vahvistuksessa näkyy layerin nimi; CANCEL peruuttaa. Vakioarvon DEFAULT-napin pitkä painallus avaa saman valikon. Tekstikentät ja resurssien sisäiset asetukset eivät kuulu palautukseen.
