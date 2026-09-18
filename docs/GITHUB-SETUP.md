# GitHub-projektin perustaminen

Suositeltu nimi: **companion-module-disguise-layer-editor**. Aloita yksityisenä (Private); voit päättää julkisuudesta myöhemmin. Repositoriota ei ole luotu eikä mitään ole lähetetty GitHubiin tämän ohjeen tekemisen yhteydessä.

## 1. Käytä siivottua lähdekoodipakettia

Helpoin tapa on purkaa `disguise-layer-editor-0.1.beta-source.zip` uuteen tyhjään kansioon. Siinä on vain jaettava lähdekoodi ja dokumentaatio. Avaa PowerShell tässä kansiossa.

Nykyinen kehityskansio käy myös, mutta siellä on yksityistä testiaineistoa. `.gitignore` rajaa pois `.tools/`, testimediat, projektivarmuuskopiot, paikalliset pikakuvakkeet, riippuvuudet ja julkaisuarkistot. Älä käytä `git add -f` tai lataa koko kehityskansiota verkkoselaimella.

Tuotteen nimi on Disguise Layer Editor; aiempi logo ei sisälly jakeluun. `localhost` ja `127.0.0.1` ovat yleisiä oman koneen oletusosoitteita. Testien suuret numerot ovat keinotekoisia tarkkuustestien tunnisteita.

## 2. Valitse julkinen tekijänimi ja yksityinen sähköpostiasetus

Git-commit tallentaa tekijänimen ja sähköpostiosoitteen. GitHubin **Settings → Emails** -sivulta saat oman `noreply`-osoitteesi. Kopioi täsmälleen GitHubin näyttämä osoite; älä käytä henkilökohtaista sähköpostia, jos et halua sitä commit-historiaan.

Korvaa seuraavien komentojen esimerkkitekstit omilla valinnoillasi. Asetukset koskevat vain tätä repositoriota:

```powershell
git init -b main
git config user.name "PUBLIC_AUTHOR_NAME"
git config user.email "YOUR_GITHUB_NOREPLY_ADDRESS"
git config --get user.name
git config --get user.email
```

Jos käytät alkuperäistä kehityskansiota, siinä on jo Git-repositorio: jätä `git init` väliin. Haaran nimi korjataan seuraavassa vaiheessa. Noreply piilottaa sähköpostin, mutta GitHub-tilisi nimi ja yhteys projektiin voivat edelleen näkyä.

[GitHub: commit-sähköpostin määrittäminen](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).

## 3. Tee ensimmäinen paikallinen commit

```powershell
git status --short
git add .
git diff --cached --stat
git diff --cached --name-only
```

Tarkista tiedostoluettelo ennen seuraavaa komentoa. Siinä ei saa olla `.d3`-projekteja, testimedioita, `.env`-tiedostoja, `.tools/`-kansiota tai konekohtaisia raportteja. Ensimmäinen commit sisältää lähdekoodin, testit, build-skriptit, ohjeet ja dokumentaation.

```powershell
git commit -m "Initial anonymized alpha source"
git branch -M main
```

Nykyisessä kehitysrepositoriossa ei ollut siivoushetkellä yhtään committia, joten vanhoja henkilötietoja sisältävää commit-historiaa ei tarvitse siirtää.

## 4. Luo tyhjä GitHub-repositorio ja lähetä koodi

1. Kirjaudu GitHubiin ja valitse **New repository**.
2. Valitse omistajaksi oma tilisi tai organisaatiosi.
3. Anna nimeksi `companion-module-disguise-layer-editor` ja valitse **Private**.
4. Älä lisää GitHubissa READMEä, lisenssiä tai `.gitignore`a: ne ovat jo mukana.
5. Valitse **Create repository** ja kopioi HTTPS-osoite.

Korvaa `OWNER` omistajalla tai käytä suoraan kopioimaasi osoitetta:

```powershell
git remote add origin https://github.com/OWNER/companion-module-disguise-layer-editor.git
git remote -v
git push -u origin main
```

Hyväksy Gitin kirjautumisikkuna. Älä sijoita salasanaa tai käyttöoikeustunnusta remote-osoitteeseen tai lähdekoodiin. Jos `origin` on jo olemassa, tarkista sen osoite ennen sen muuttamista.

[GitHub: paikallisen koodin lisääminen](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

## 5. Kutsu kehittäjät ja sovi työtapa

Henkilökohtaisessa repositoriossa: **Settings → Collaborators → Add people**. Lisää muiden GitHub-käyttäjänimet. Organisaatiossa käyttöoikeuksia hallitaan sen omilla tiimi- ja repositorioasetuksilla.

Kirjaa viat ja toiveet **Issues**-kohtaan. Tee muutos omassa haarassa ja avaa **Pull request**, jotta toinen kehittäjä voi tarkistaa sen ennen yhdistämistä `main`-haaraan. Tarkemmat työohjeet: [CONTRIBUTING.md](../CONTRIBUTING.md).

[GitHub: kehittäjien kutsuminen](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository).

## 6. Julkaise moduuli ja sivu

1. Aja `1 - Asenna ymparisto.cmd` ensimmäisellä kerralla.
2. Aja `5 - Tee julkaisupaketti.cmd`. Se testaa ja rakentaa paketin.
3. GitHubissa avaa **Releases → Draft a new release**.
4. Luo teknistä versiota vastaava tagi, nyt `v0.1.0-beta.1`. Otsikko voi olla `0.1.beta`.
5. Merkitse julkaisu **pre-release**-julkaisuksi.
6. Liitä vähintään `disguise-layer-editor-0.1.beta-companion.zip`; voit liittää myös lähdekoodiarkiston ja `SHA256SUMS.txt`-tiedoston. Tiedostot ovat `releases/0.1.beta/`-kansiossa.
7. Kerro tunnetut rajaukset ja linkitä testiraportti. Julkaise vasta, kun sisältö on tarkistettu.

Companion-zip sisältää moduulin ja importoitavan sivun. Niitä ei tarvitse asentaa lähdekoodista. Älä korvaa vanhan tagin sisältöä: seuraavalle muutokselle tehdään uusi tekninen versionumero ja tagi.

[GitHub: julkaisujen tekeminen](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

## 7. Jatkokehitys tässä työtilassa

Pidä paikallinen työtila samassa repositoriossa. Kerro tehtävässä Issue-numero tai muutostoive. Muutokset voidaan tehdä omalle haaralle, testata ja valmistella pull requestiksi. GitHub-julkaisu ja live-Designer-testit ovat erillisiä vaiheita: offline-testit eivät tarvitse Designeria, eikä niitä ajamalla muuteta projektiasi.

Tässä valmistelussa ei lisätty GitHub Actions -automaatiota. Testit ja paketointi ajetaan yllä olevilla skripteillä; CI voidaan lisätä myöhemmin ilman live-Designer-yhteyttä.
