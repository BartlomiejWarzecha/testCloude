# Podsumowanie prac: katalog Husqvarna (xEPC) w sklepie betkowskiservice.pl

Stan na 30.09–01.10.2026. Dokument do przekazania kolejnej sesji. Opisuje cel,
co jest zrobione i sprawdzone, jakie są ustalenia techniczne i co zostało otwarte.

## Cel

Sklep **https://www.betkowskiservice.pl** (Comarch e-Sklep, dane z Comarch
Optima, ok. 1 600 maszyn i tysiące części Husqvarna) ma:
1. przy osadzonym oficjalnym katalogu części Husqvarna (xEPC, iframe) działający
   przycisk „Dodaj do koszyka”, który dodaje część do koszyka **sklepu**;
2. schematy części (katalog Husqvarny) na kartach produktów: przy maszynach
   i przy częściach.

## Repozytorium i pliki

Repo `BartlomiejWarzecha/testCloude`, gałąź **`claude/busy-carson-41vcg0`**,
folder `xepc-koszyk/`:

| Plik | Rola | Na serwerze sklepu |
|---|---|---|
| `xepc-koszyk.js` | odbiera `postMessage` z katalogu, dopasowuje wysokość ramki, dodaje część do koszyka (`Cart/Add`) | `/usr/xepc-koszyk-2.js` |
| `xepc-schemat.js` | zakładki „Części zamienne” (maszyna) i „Schemat części” (część) na karcie produktu; panel wyszukiwania (wyłączony) | `/usr/xepc-schemat.js` |
| `xepc-schematy.json` | dane: `modele`, `produkty` (Kod towaru maszyny → `MP_…`), `nazwy` (391 modeli z husqvarna.com) | `/usr/xepc-schematy.json` |
| `test/*.test.js` | testy w Node: `node xepc-koszyk/test/xepc-koszyk.test.js`, `node xepc-koszyk/test/xepc-schemat.test.js` | – |
| `dane/kody-maszyn.txt` | 1 617 kodów maszyn od właściciela sklepu | – |
| `dane/husqvarna-com-artykul-mp.json`, `dane/husqvarna-com-crawl.py` | mapa numer artykułu → `MP_…` zebrana z publicznych stron husqvarna.com i crawler | – |
| `dane/maszyny-do-uzupelnienia.csv`, `dane/csv-do-json.html` | arkusz do ręcznego uzupełniania `MP_…` i lokalny konwerter do JSON | – |
| `README.md` | opis techniczny i wdrożenie | – |

**Uwaga przy wdrażaniu:** nazwy plików w `<script src>` na stronie muszą się
zgadzać z nazwami na serwerze. Awaria koszyka z 01.10 wynikała z tego, że strona
ładowała `/usr/xepc-koszyk.js`, którego nie było na serwerze (404). Po każdym
wgraniu warto pobrać plik z serwera i porównać z repo (`cmp` po usunięciu `\r`).

Strona katalogu: `https://www.betkowskiservice.pl/husqvarna_katalog,37`.
Iframe: `https://xepc-prod.husqvarnagroup.com/pl?domain=https://www.betkowskiservice.pl/`.

## Ustalenia techniczne (sprawdzone)

### Katalog xEPC
- Wysyła do strony `postMessage` tylko na domenę z `?domain=`. `POST /api/check`
  z `{domain}` zwraca dla sklepu `isPostMessageAllowed:true, isExplicitlyWhitelisted:false`,
  czyli działa w „okresie przejściowym”. **Trzeba poprosić Husqvarna Polska o
  wpisanie domeny na listę**, bo po okresie przejściowym przestanie działać.
- Wiadomości: **liczba** oznacza wysokość treści, a **tekst `addToCart:<numer>$<ilość>`**
  (np. `addToCart:529606802$1`) oznacza dodanie do koszyka. Sprawdzone w konsoli
  na żywej stronie.
- Adresy: model `/pl/product/<MP_…>?article=<numer artykułu>`, karta części
  `/pl/part/<numer części>`. **Nie da się otworzyć konkretnego zespołu
  schematu z adresu** ani wyszukać przez adres. Wyszukiwarka katalogu korzysta
  z wewnętrznego API `dc-apim-prod.husqvarnagroup.com` na kluczu Husqvarny.
- `/pl/product/<numer artykułu>` (bez `MP_…`) kończy się błędem serwera
  katalogu (test właściciela). `/pl/part/<numer maszyny>` również.
- `MP_…` używane przez katalog to `sku` ze **stron produktów (typ `Machine`)
  na husqvarna.com**, np. LC353VE 970541701 → `MP_125562490` (test właściciela:
  działa). `sku` ze stron wsparcia (`ProductSupport`, np. `MP_134205389`)
  **nie działa**.

### Comarch e-Sklep
- Dodanie do koszyka: `$.post(null, {__action:'Cart/Add', __csrf:__CSRF,
  __parameters: JSON.stringify([{productId, quantity, attributeId:[...], supplyId}]),
  __collection:'customer.Cart.Count|customer.Cart.Value|customer.Cart.CurrencyExt'})`.
  Odpowiedź: `action.Result`, `action.Message`. Licznik odświeża
  `ui.updateProductsInCart(count, value, symbol)`, a komunikaty pokazuje
  `app.showTemporaryPopup(tekst, typ, null, ms)`.
- **ID produktu w e-Sklepie ≠ `Twr_TwrId` z Optimy** (`GIDNumber`), np.
  589300801: Id 48426, GIDNumber 49120. Skrypt szuka ID wyszukiwarką sklepu:
  `GET <strona>?__action=Get/SearchAutocomplete&search=<kod>` → `action.Redirect302`,
  potem `GET <Redirect302>&__collection=products.Products` → lista z `Id`, `Code`,
  `AttributesList`, `Url`. Bierze tylko towar o identycznym `Code`.
- Atrybuty są wymagane, inaczej sklep odpowiada „Przed dodaniem do koszyka
  wybierz atrybuty towaru”:
  - `AttributesPolyvalent` → `attributeId`: pierwsza wartość każdego atrybutu.
    Na 163 częściach zgodne z przyciskiem na karcie.
  - `Attributes` (warianty, np. „Modele Husqvarna:”) → `supplyId` z
    `#supplyId[data-supplies]` na karcie produktu, gdy wariant jest jeden.
    Brak `data-supplies` oznacza, że nie ma wyboru wariantu (puste atrybuty
    „Wyprzedaż”/„KonradTMP”). Kartę trzeba pobierać **zwykłym `fetch`**, bo
    z nagłówkiem `X-Requested-With` sklep zwraca pusty JSON.
- Zakładki karty produktu: przyciski `.productDetails-detailsButtons--button[data-content]`
  i panele `.productDetails-content[data-content]`. Obsługa jest delegowana
  (`layout2.min.js`), więc dodanie własnej pary działa bez zmian w sklepie.
  „Kod towaru”: `.code-value .value`. Tytuł: `.js-product-details__name`.
  Atrybuty: `.productDetails-attributes`. Opis:
  `.productDetails-content--descriptionText`.
- Na kartach jest błąd sklepu `Cannot read properties of undefined (reading 'split')`
  w `layout2.min.js` (`changeValues`). Występuje też bez naszych skryptów i nie
  blokuje koszyka.

## Jak działa obecna wersja

**`xepc-koszyk.js`:** przyjmuje wiadomości tylko z `https://xepc-prod.husqvarnagroup.com`.
Liczba zmienia wysokość ramki. `addToCart:` (albo obiekty/JSON z polami typu
`partNumber`, `qty`) prowadzi przez wyszukiwarkę sklepu do produktu i jego
atrybutów, a potem do `Cart/Add`. Komunikaty idą w kolejce, jeden po drugim.
`debug: true` wypisuje w konsoli `[xepc-koszyk] wiadomość: …`.

**`xepc-schemat.js`:**
- **Maszyna:** „Kod towaru” (albo numer bazowy, pierwsze 9 cyfr, dla odmian
  `_OT1` i ` 10 METROW`) jest w `produkty` z `MP_…`. Wtedy pojawia się
  zakładka **„Części zamienne”** z katalogiem modelu, ładowanym po kliknięciu.
  Maszyna bez `MP_…` albo z kodem `9xxxxxxxx` nie dostaje niczego.
- **Część:** nazwa zawiera Husqvarna/HQV/Automower. Skrypt szuka modeli
  najpierw w **tytule i atrybutach**, a gdy nic nie znajdzie, w **opisie**
  (czeka do 4 s na doczytanie). Źródła: lista `modele` (ręczna) i słownik
  `nazwy`, dopasowywany przez łączenie 1–3 sąsiednich słów bez spacji i
  znaków. W częściach liczą się tylko klucze z literą i cyfrą, min. 4 znaki.
  Wynik to zakładka **„Schemat części”** z przyciskami „Schemat: <model>”
  (max 6) i „Karta części”. Bez schematu nie ma zakładki
  (`kartaCzesciBezSchematu: false`).
- **Wyszukiwanie/kategoria:** panel nad wynikami istnieje, ale jest
  **wyłączony** (`panelWyszukiwania: false`) na prośbę właściciela.
- `maszynaPoKodzie: null`, bo tryb „maszyna po samym kodzie” nie działa (patrz wyżej).

**Dane:** `produkty` ma 1 560 numerów maszyn, z czego **231 z `MP_…`**
(z husqvarna.com). Reszta jest pusta, bo to starsze modele spoza polskiej
strony. 4 numery pominięto, bo miały po 2 `MP_…`. Wyniki na 220 częściach:
49 ze schematem z tytułu, 52 z opisu, 63 bez modelu.

## Sprawdzone end-to-end

Na żywej karcie baterii 529606802 w Playwright (strony pobierane przez Node,
`Cart/Add` przechwycone i niewysłane): zakładka „Schemat części” → katalog
(karta „BATTERY”) → klik „Dodaj do koszyka” → `Cart/Add` z
`[{"productId":"44993","quantity":"1","attributeId":["2927"]}]`.
Przycisk sklepu też działa.

## Ograniczenia i zasady ustalone w tej pracy

- **Nie korzystać z wewnętrznego API xEPC (`dc-apim-prod…`) na kluczu Husqvarny**
  bez zgody Husqvarny. Źródła `MP_…`: publiczne strony husqvarna.com
  (robots.txt pozwala), ręczne kopiowanie z adresu katalogu albo lista od Husqvarny.
- **Nie wysyłać `Cart/Add` do żywego sklepu w testach.** Przechwytywać
  żądanie (Playwright `route.fulfill`).
- Nie kopiować grafik schematów na serwer sklepu bez zgody producenta.
  Pokazujemy oficjalny katalog w ramce.
- Chromium w chmurowym środowisku nie ufa certyfikatowi proxy. Obejście:
  Playwright `page.route` + Node `fetch` (z `NODE_USE_ENV_PROXY=1`) +
  `route.fulfill`. W środowisku lokalnym (desktop) nie powinno to być potrzebne.

## Otwarte sprawy / propozycje dalszych kroków

1. **Mail do Husqvarna Polska:** wpisanie domeny na listę (`isExplicitlyWhitelisted`),
   lista „numer artykułu → MP” dla ok. 1 325 maszyn bez `MP_…` albo dostęp do
   API katalogu. Właściciel jeszcze o to nie prosił. Szkic maila można przygotować.
2. **Więcej `MP_…`:** przeszukać strony produktów (`Machine`) husqvarna.com
   w innych krajach (sitemapy `sitemap-hbd-<kraj>-….xml`, np. de, cz, se)
   crawlerem z `dane/`. Tylko typ `Machine`.
3. **Ręczne przypisania części do modeli** dla wybranych części
   (np. `"501879706": "MP_…"`), z pierwszeństwem przed dopasowaniem po
   tekście. Zaproponowane, jeszcze nie zrobione.
4. Po stabilnym działaniu ustawić `debug: false` w `xepc-koszyk.js` i usunąć
   ze strony katalogu napis „Niestety funkcja dodaj do koszyka nie działa…”.
5. Nagłówek sklepu: przyciski „Produkty Husqvarna” / „Części Husqvarna”.
   Wersja z `<style>` i `@media (max-width:768px)` (flex tylko na telefonie)
   została przekazana w rozmowie, a nie jest w repo.
6. Otwarte kwestie z wcześniejszych rozmów: niezgodność numeru na karcie koła
   (589300801 w tytule, 589300802 w opisie), błąd sklepu `split` do zgłoszenia
   w Comarch.

## Styl pracy z właścicielem

Właściciel pisze po polsku, krótko i często ze zrzutami ekranu. Oczekuje
gotowych plików do pobrania, które wgrywa ręcznie do `/usr/`, i testów na
żywej stronie. Zmiany commitowane i pushowane na gałąź
`claude/busy-carson-41vcg0`. PR nie był zakładany.
