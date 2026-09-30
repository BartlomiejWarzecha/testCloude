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
- **ID towaru = `Twr_TwrId`.** Karta 589300801 ma `productId = 48426`. Sprawdź to
  pierwszym zapytaniem w `mapa-czesci.sql`.

## Czego nie udało się potwierdzić

Format wiadomości „dodaj do koszyka” z katalogu. Kodu, który ją wysyła, nie ma
w plikach ładowanych na starcie katalogu. Skrypt szuka więc numeru części i
ilości po typowych nazwach pól (`partNumber`, `articleNo`, `sku`, `qty`,
`quantity`…), także w zagnieżdżonych obiektach. Jeśli katalog użyje innych
nazw, wystarczy zmiana w `wyciagnijPozycje`. Dlatego `debug: true` jest na
razie włączone.

## Wdrożenie

1. **Mapa części.** Uruchom `mapa-czesci.sql` na bazie firmy Optimy. Wynik
   zapytania 2 (jedna komórka `MapaJson`) zapisz jako
   `husqvarna-mapa-czesci.json`.
2. **Wgraj do `/usr/`** w sklepie (tam, gdzie leży już
   `modeleall26052026.json`): `husqvarna-mapa-czesci.json` i `xepc-koszyk.js`.
3. **Na podstronie z katalogiem** zamień testowy `<script>` z `console.log('XEPC:'…)`
   na:
   ```html
   <script src="/usr/xepc-koszyk.js"></script>
   ```
4. **Test.** Otwórz katalog, włącz konsolę (F12), wejdź w schemat i kliknij
   „Dodaj do koszyka”. W konsoli pojawi się `[xepc-koszyk] wiadomość: …`.
   - Część jest w koszyku → gotowe. Ustaw `debug: false`.
   - Wiadomość jest, a koszyk pusty → skopiuj ją i wyślij mi, dopasuję
     odczyt.
   - Brak wiadomości po kliknięciu → katalog nie wysyła koszyka na tę domenę.
     Zapytaj Husqvarnę o włączenie tej funkcji razem z whitelistą.

Mapę trzeba odświeżać po dodaniu nowych towarów (ponowny eksport z punktu 1).
Części spoza mapy nie trafią do koszyka. Klient zobaczy komunikat, że części
nie ma w sklepie.

## Test lokalny

```
node xepc-koszyk/test/xepc-koszyk.test.js
```
