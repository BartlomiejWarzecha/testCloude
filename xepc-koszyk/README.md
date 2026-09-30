# Katalog Husqvarna (xEPC) → koszyk e-Sklepu

Klient klika „Dodaj do koszyka” w katalogu Husqvarny osadzonym na stronie
[husqvarna_katalog,37](https://www.betkowskiservice.pl/husqvarna_katalog,37).
Część trafia wtedy do koszyka Twojego sklepu.

## Co jest sprawdzone (30.09.2026)

- **Katalog może wysyłać wiadomości do Twojej strony.** Kod katalogu wysyła
  `postMessage` tylko na domenę z parametru `?domain=`. Pyta też serwer
  Husqvarny (`/api/check`), czy domena jest dopuszczona. Dla
  `https://www.betkowskiservice.pl` odpowiedź brzmi
  `{"isPostMessageAllowed":true,"isExplicitlyWhitelisted":false}`. Wiadomości
  działają więc teraz, ale tylko w „okresie przejściowym”. Katalog loguje wtedy
  ostrzeżenie: *„Domain … is not explicitly whitelisted yet. Please contact
  Husqvarna Group to get this domain whitelisted”*. **Poproś Husqvarna Polska o
  wpisanie domeny na listę**, bo po okresie przejściowym wiadomości przestaną
  działać.
- **Katalog wysyła wysokość swojej treści** (liczbę). Skrypt dopasowuje do niej
  wysokość iframe, więc znika stałe `height="1000px"` i podwójny pasek
  przewijania.
- **Dodawanie do koszyka.** Skrypt wysyła to samo zapytanie co przyciski sklepu
  (`layout0.min.js`): `$.post(null, {__action:"Cart/Add", __csrf, __parameters:[{productId, quantity}]})`.
- **ID towaru w e-Sklepie to NIE jest `Twr_TwrId` z Optimy.** Sklep ma własne
  ID (`Id`), a numer z Optimy pokazuje osobno jako `GIDNumber`:

  | Numer części | ID w e-Sklepie | GIDNumber (Optima) |
  |---|---|---|
  | 589300801 (koło Automower) | 48426 | 49120 |
  | 578443701 (brzeszczot 255-4) | 3411 | 3411 |

  Czasem te numery się pokrywają, czasem nie. Mapa z `Twr_TwrId` dodałaby więc
  do koszyka inny towar niż ten, który klient wybrał. Dlatego skrypt pyta o ID
  wyszukiwarkę sklepu, tę samą co w nagłówku strony (`Get/SearchAutocomplete`).
  Bierze tylko towar o **identycznym** Kodzie. Nie potrzeba eksportu z SQL,
  a nowe towary działają od razu po udostępnieniu w sklepie.

- **Wiadomość z katalogu** to tekst `addToCart:<numer części>$<ilość>`,
  np. `addToCart:529606802$1` (sprawdzone w konsoli na żywej stronie).
- **Atrybuty towaru.** Bez nich sklep odpowiada „Przed dodaniem do koszyka
  wybierz atrybuty towaru”. Skrypt wysyła to samo co przycisk na karcie
  produktu:

  | Część | Rodzaj atrybutów | Co idzie do `Cart/Add` |
  |---|---|---|
  | 529606802 (bateria) | wielowartościowe | `attributeId: ["2927"]` |
  | 578443701 (brzeszczot) | wielowartościowe | `attributeId: ["2183","1893","2187","2931"]` |
  | 589300801 (koło) | warianty („Modele Husqvarna:”) | `supplyId: "48426"` |

  Wartości `attributeId` pochodzą z wyników wyszukiwarki. `supplyId` pochodzi
  z karty produktu (`data-supplies`), pobieranej zwykłym `fetch`, bo z
  nagłówkiem `X-Requested-With` sklep zwraca pusty JSON. Jeśli towar ma kilka
  wariantów, skrypt nie zgaduje. Klient dostaje komunikat, żeby wybrał
  wariant na karcie produktu.

## Czego nie udało się potwierdzić

Format wiadomości „dodaj do koszyka” z katalogu. Kodu, który ją wysyła, nie ma
w plikach ładowanych na starcie katalogu. Skrypt szuka więc numeru części i
ilości po typowych nazwach pól (`partNumber`, `articleNo`, `sku`, `qty`,
`quantity`…), także w zagnieżdżonych obiektach. Jeśli katalog użyje innych
nazw, wystarczy zmiana w `wyciagnijPozycje`. Dlatego `debug: true` jest na
razie włączone.

## Wdrożenie

1. **Wgraj `xepc-koszyk.js` do `/usr/`** w sklepie (tam, gdzie leży już
   `modeleall26052026.json`).
2. **Na podstronie z katalogiem** zamień testowy `<script>` z `console.log('XEPC:'…)`
   na:
   ```html
   <script src="/usr/xepc-koszyk.js"></script>
   ```
3. **Test.** Otwórz katalog, włącz konsolę (F12), wejdź w schemat i kliknij
   „Dodaj do koszyka”. W konsoli pojawi się `[xepc-koszyk] wiadomość: …`.
   - Część jest w koszyku → gotowe. Ustaw `debug: false`.
   - Wiadomość jest, a koszyk pusty → skopiuj ją i wyślij mi, dopasuję
     odczyt.
   - Brak wiadomości po kliknięciu → katalog nie wysyła koszyka na tę domenę.
     Zapytaj Husqvarnę o włączenie tej funkcji razem z whitelistą.

Część, której wyszukiwarka nie znajdzie z identycznym Kodem, nie trafi do
koszyka. Klient zobaczy komunikat, że części nie ma w sklepie.

## Test lokalny

```
node xepc-koszyk/test/xepc-koszyk.test.js
```
