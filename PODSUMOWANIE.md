# betkowskiservice.pl – podsumowanie do dalszej pracy w Claude Code

Stan na **01.10.2026**. Ten dokument przekazuje pracę z Cowork do Claude Code.
Opisuje, co zrobiliśmy, gdzie to jest, jak edytować sklep i co zostało otwarte.
Wcześniejszy, szczegółowy opis katalogu Husqvarna (xEPC) jest w repo:
`xepc-koszyk/PODSUMOWANIE.md` i `xepc-koszyk/README.md`.

## 1. Sklep i sposób pracy

- Sklep: **https://www.betkowskiservice.pl**, czyli Comarch e-Sklep (dane z Comarch
  Optima). Sprzedaje maszyny ogrodnicze i leśne oraz części, głównie Husqvarny.
- Panel: **https://panel.comarchesklep.pl**. Aktywny szablon to **Liq_Id = 3**.
  Edytor plików szablonu: `/2026.6.1/LqTemplateFiles/Index/3`.
- **Publikuje zawsze właściciel** przyciskiem „Publikuj” w panelu. Nie publikuj
  sam (`/Liquid/UpdateLiquidTS`). Po zapisaniu plików poproś go o publikację.
  Zalogowany administrator widzi zapisane zmiany w sklepie od razu (podgląd), a klienci
  dopiero po publikacji.
- Właściciel pisze po polsku, krótko, często ze zrzutami ekranu (strzałki na
  elementach). Oczekuje, że zmiany zostaną wgrane i sprawdzone na żywej stronie,
  a na koniec dostanie krótkie podsumowanie po polsku.
- Repo: `BartlomiejWarzecha/testCloude`, gałąź `claude/busy-carson-41vcg0`,
  folder `xepc-koszyk/`. **6 commitów nie trafiło na GitHub**, bo sesja w Cowork
  nie miała dostępu do repo. Są w folderze `patche/` i wchodzą przez
  `git am patche/*.patch`. Pliki szablonu (`szablon/`) nie były dotąd
  w repo, warto je tam dodać, np. jako folder `szablon/`.

### Zasady (ustalone z właścicielem, obowiązują)
1. **Nie publikować** szablonu, tylko zapisywać pliki i prosić o „Publikuj”.
2. **Nie wpisywać haseł.** Gdy panel wyloguje, poproś właściciela o zalogowanie.
3. **Nie usuwać plików na stałe** (ani w /usr, ani w szablonie). Listę do
   usunięcia podaj właścicielowi.
4. W testach **nie wysyłać prawdziwych** `Cart/Add` ani `Contact/Send`
   (formularz kontaktowy/zapytanie). Przechwytuj te żądania albo zastępuj je atrapą.
5. **Nie używać wewnętrznego API katalogu Husqvarny** (`dc-apim-prod…`) na ich kluczu.
6. Właściciel sam przegląda sklep w przeglądarce. Testy rób w osobnych kartach.
   Nie ruszaj jego `localStorage` „bs-lista-zyczen” (lista życzeń), a jeśli test
   ją zmieni, przywróć ją.

## 2. Jak edytować szablon (sprawdzone)

Wszystko robimy z karty panelu (zalogowanej), przez `fetch`/jQuery w konsoli.
Gotowe funkcje są w **`narzedzia/panel-helpers.js`**: `__getCode(id)`,
`__save(id, key, code)`, `__sha`, `__drzewo()`, `__create`, `__usrUpload` i
`__eksport()`, który zapisuje wszystkie pliki szablonu do JSON.

- Odczyt: `GET /2026.6.1/LqTemplateFiles/GetTemplate?id=X&liqId=3`, pole
  `[name="templates[0].Code"]`.
- Zapis: `POST /2026.6.1/LqTemplateFiles/Edit` z `__RequestVerificationToken`,
  `templates[0].Id/Key/Lock=false/Code`, `liqId=3`, `mode`, `tplId`.
- Drzewo plików: `GET /2026.6.1/LqTemplateFiles/GetTreeData?liqId=3&mode=0`.
- **Weryfikacja zapisu:** przed zapisem policz SHA-256 lokalnie
  (`hashlib.sha256(s.strip().encode()).hexdigest()[:12]`) i w panelu
  (`__sha(code.trim())`). Po zapisie `__save` zwraca `same: true`. Duże zmiany
  rób jako dokładne zamiany tekstu na kodzie pobranym z panelu i sprawdzaj hash.
- **Pamięć podręczna (ważne):** `{{ lqTS }}` w sklepie stoi na „3.0”, więc pliki
  są cache’owane długo. **Po każdej zmianie pliku CSS/JS szablonu podbij przyrostek
  w `_layout.html`**, np. `?v={{ lqTS }}-20261007` → `-20261008`.
- Backupy `_layout` są w `localStorage` panelu (`bs-backup-_layout-*`).
- **Pliki /usr** (np. `/usr/xepc-koszyk-4.js`): wgrywanie przez
  `POST /2026.6.1/api/userFiles/fileUpload/usr` (FormData `file`, nagłówek
  `RequestVerificationToken`). **Nie da się nadpisać istniejącego pliku**, więc
  nowa wersja dostaje nową nazwę (`-5`, `-7`…) i trzeba zmienić `<script src>` w `_layout.html`.

### Pliki szablonu, które zmienialiśmy (id w panelu)

| Plik | id | Co to | Kopia w paczce |
|---|---|---|---|
| `_layout.html` | 39945 | dołącza wszystkie nasze CSS/JS | – (pobierz z panelu) |
| `home-page.html` | 39715 | include banera wyszukiwarki części | – |
| `partials/home/home-parts-search.html` | 44852 | baner „wyszukiwarka części” na stronie głównej | ✔ |
| `css/custom.css` | 41256 | na końcu blok „MENU „KATEGORIE” NA TELEFONIE I TABLECIE (do 768 px) - 2026-10-01” | – |
| `css/product-attributes.css` | 43998 | zakładki karty produktu (pigułki), poprawki na telefonie | – |
| `js/ga4-events.js` | 44851 | główne śledzenie GA4 sklepu | ✔ |
| `js/mobile-filters.js` / `css/mobile-filters.css` | 44853 / 44854 | filtry list na telefonie (szuflada) | ✔ |
| `js/menu-kiosk.js` / `css/menu-kiosk.css` | 44855 / 44856 | menu „Kategorie” na telefonie w stylu kiosku | ✔ |
| `js/menu-kiosk-zdjecia.js` | 44857 | zdjęcia kategorii + lista producentów | ✔ |

Aktualne wpisy w `_layout.html`:
```html
<link rel="stylesheet" href="css/mobile-filters.css?v={{ lqTS }}-20261001">
<link rel="stylesheet" href="css/menu-kiosk.css?v={{ lqTS }}-20261006">
<script src="js/ga4-events.js?v={{ lqTS }}" defer></script>
<script src="js/mobile-filters.js?v={{ lqTS }}-20261001" defer></script>
<script src="js/menu-kiosk-zdjecia.js?v={{ lqTS }}-20261006" defer></script>
<script src="js/menu-kiosk.js?v={{ lqTS }}-20261007" defer></script>
<script src="/usr/xepc-lista-6.js?v={{ lqTS }}"></script>
<script src="/usr/xepc-koszyk-4.js?v={{ lqTS }}"></script>
<script src="/usr/xepc-schemat-4.js?v={{ lqTS }}"></script>
```
(plus `css/custom.css?v={{ lqTS }}-20261001`, `css/product-attributes.css?v={{ lqTS }}-20260930`)

`ga4-events.js` nie ma jeszcze przyrostka daty. Przy pierwszej zmianie dopisz
`-RRRRMMDD`. W szablonie są też starsze własne pliki z wcześniejszych sesji:
`part-search-core.js`, `part-search.js`, `part-search-dropdown.js`, `mobile-search.js/.css`,
`desktop-search.css`, `header-grid6.css`, `cart-country-switcher.js`, `custom.js`
i inne. Obsługują wyszukiwarkę części (producent / urządzenie / model) w nagłówku, na telefonie i w menu.

Sumy kontrolne (`sha256(strip)[:12]`) zgodne z panelem z 01.10: menu-kiosk.js
`3de05f9f5874`, menu-kiosk.css `7c0e701a2320`, menu-kiosk-zdjecia.js `b05903121d81`,
mobile-filters.js `73f4788ac34e`, mobile-filters.css `aed2f4707af3`, ga4-events.js
`d350069bb25c`, home-parts-search.html `9d6c6c205ad8`, xepc-koszyk-4 `cfc9460d7528`,
xepc-schemat-4 `80142a749699`, xepc-lista-6 `29d25572d688`.

## 3. Co jest zrobione

### Katalog Husqvarna (xEPC) – pliki /usr (kopie w `usr/`)
- **`xepc-koszyk-4.js`** – przycisk „Dodaj do koszyka” w osadzonym katalogu
  (`postMessage addToCart:<nr>$<ilość>` → wyszukanie produktu → `Cart/Add`).
  Części, których sklep nie ma, trafiają automatycznie na **Listę życzeń** z komunikatem.
- **`xepc-schemat-4.js`** – zakładki na karcie produktu: „Sprawdź części zamienne”
  (maszyna) i „Zobacz na schemacie” (część). Wyglądają na klikalne (ikona, opis).
  Ramka z intro ma 3 punkty ✓ oraz punkt o liście życzeń z linkiem „Zobacz listę życzeń”.
- **`xepc-lista-6.js`** – **Lista życzeń**: ikona obok wyszukiwarki (komputer),
  pozycja „Lista” w dolnym menu (telefon). Panel z ilościami, linkiem do karty
  części w katalogu i formularzem „Wyślij zapytanie”: e-mail, imię, telefon,
  uwagi, kopia. Wysyła przez `Contact/Send` (POST `/kontakt,12`, `department=1`).
  Dane trzyma w `localStorage` „bs-lista-zyczen”.
- Dane: `xepc-schematy.json` (231 maszyn z `MP_…`).
- Szczegóły techniczne, ograniczenia i otwarte sprawy katalogu: `xepc-koszyk/PODSUMOWANIE.md`.

### Strona główna
- Baner „wyszukiwarka części” (`home-parts-search.html`) przenosi
  wyszukiwarkę części z nagłówka do banera. Bez linku „Napisz do nas”.

### Karta produktu
- `product-attributes.css`: zakładki jako pigułki, czytelne na telefonie.

### Filtry list na telefonie (`mobile-filters.js/.css`)
- Szuflada filtrów na pełny ekran, tylko na telefonie. Pasek „Filtry (n)” +
  „Sortuj”, pływający przycisk filtrów, akordeony, wyszukiwanie w długich listach,
  cena od/do, „Wyczyść”, „Pokaż wyniki” (klika sklepowe „Zastosuj”), przywracanie
  stanu po zamknięciu, klikalne pigułki aktywnych filtrów.
- Comarch: `.product-list__filters.searchFilters-js`. Kliknięcie `.filter` na
  telefonie tylko zaznacza checkbox, a `.productsList__filters--setValues`
  stosuje filtry (AJAX + pushState). Dodatkowe opcje są w ukrytym `div.redundant`.
  Cena to suwak jQuery UI z ukrytymi polami `.productsList__priceSlider__minPrice-js` / `maxPrice-js`.

### Menu „Kategorie” na telefonie – kiosk (`menu-kiosk.js/.css`, `menu-kiosk-zdjecia.js`)
- Zamiast listy jest układ jak w kiosku: po lewej pionowy pasek kategorii, po prawej
  kafelki 2–3 kolumny. Kafelek z podkategoriami otwiera 3. poziom („‹ Wstecz”),
  każdy poziom ma „Zobacz wszystkie”. Dane bierze z ukrytego menu sklepu
  (`nav.mainCategories`), więc nazwy i linki są zawsze aktualne. Działa z
  przełącznikiem Produkty / Części (`.mobileCategorySwitcher__btn`).
- **Zdjęcia produktów zamiast ikon** (`KIOSK_ZDJECIA`: id kategorii → id zdjęcia,
  `/img/medium/<id>`). Najpierw Husqvarna: w Produktach najdroższy z 50
  najczęściej oglądanych, w Częściach najczęściej kupowana część. Wyjątki:
  Malowanie linii → robot FJDynamics RLM01, Trawa i Nawożenie → worki z nasionami trawy (42375).
- **Pasek „Producent:”** nad kioskiem: „Wszyscy”, 6 największych marek dla danej
  grupy i lista „Więcej…”. Po wyborze producenta:
  - kategorie bez jego produktów znikają;
  - zdjęcia doczytują się na żywo dla tej marki;
  - linki prowadzą do `/producent=<slug>/<ścieżka kategorii>`;
  - wybór jest zapamiętany w `sessionStorage` (`bs-kiosk-producent`, dane w `bs-kiosk-producent-dane`).
  Lista producentów (`KIOSK_PRODUCENCI`) jest statyczna, stan z 01.10.
- Usunięte: liczniki „5 ›” na kafelkach, przyciski „Produkty Husqvarna” /
  „Części Husqvarna” nad przełącznikiem (tylko ≤768 px; na komputerze zostały).
- Starsze poprawki menu na telefonie są w `custom.css` (blok z 2026-10-01).

### GA4 (G-YDK0H1QXXT)
`js/ga4-events.js` (nagłówek pliku opisuje całość):
- **E-commerce:** powtórka zdarzeń, które szablon wywołuje przed `gtag('config')`:
  view_item, view_item_list, view_cart, begin_checkout, purchase (raz na transakcję).
- **Wyszukiwanie:**
  - `search` (ogólna i części: komputer, telefon, menu), `search_no_results`;
  - `part_search_field`, `search_suggestion_click`.
- **Koszyk i listy:**
  - `add_to_cart` / `add_to_wishlist` z `add_source` i `item_list_name`;
  - `select_item`, `list_sort`, `list_filter_open`, `list_filter`, `list_pagination`.
- **Nawigacja i inne:**
  - `menu_interaction`, `category_click`;
  - `contact_click` (telefon, e-mail, WhatsApp, Messenger), `share`;
  - `language_change`, `scroll_depth`, `page_not_found`.
- Podgląd: `?ga4debug=1`, potem GA4 > DebugView. Funkcja globalna `window.ga4Wyslij(nazwa, parametry)`.

Pozostałe pliki:
- **Katalog:** `add_to_cart` (`add_source: katalog_husqvarna`), `catalog_part_unavailable`
  (parametr `wishlist`), `catalog_variant_required`, `catalog_cart_error`,
  `catalog_tab_shown`, `catalog_open`, `catalog_model_select`.
- **Lista życzeń:** `wishlist_open`, `generate_lead` (`lead_source: lista_zyczen`).
- **Filtry:** `filters_open`, `filters_apply`.
- **Kiosk:** `menu_kiosk_click`, `menu_kiosk_open`, `menu_kiosk_producer`.

**Do zrobienia w GA4 przez właściciela:** w Administracja > Definicje
niestandardowe zarejestrować parametry. Lista:
- add_source, page_type, search_type, search_source, results_count;
- part_manufacturer, part_device, part_model, part_field, part_number;
- select_source, sort_by, filter_value, filter_group, active_filters;
- menu_action, menu_label, menu_level, menu_item, menu_group, producer;
- category_name, click_source, contact_method, catalog_view, open_type;
- wishlist, lead_source, items_count, percent_scrolled, event_source.

## 4. Wiedza o Comarch e-Sklep (przyda się dalej)

- **Dane JSON z dowolnej strony listy:**
  `$.get('<adres kategorii>?sort=N', {__collection:'products'})` →
  `collection.Products` (50 na stronę), `TotalItems`, `PageCount`, `FilteringOptions`.
  - `products.TotalItems` – samo zliczenie (lekkie zapytanie).
  - `products.Products` – sama lista.
  - Produkt ma m.in.: `Id`, `Code`, `Name`, `Price`, `ImageId`
    (`/img/medium/<ImageId>`, webp 700×700, ok. 19 KB; `-1` = brak), `Manufacturer{Name,Url}`,
    `Brand`, `DefaultGroup`, `Url`.
- **Sortowanie (`sort`):** 1 nazwa A–Z, 2 Z–A, 3 cena rosnąco, 4 cena malejąco,
  9 najczęściej kupowane, 10 najczęściej oglądane.
- **Filtr producenta w adresie:** `/producent=<slug>/produkty/...,2,<id>` (slug
  z `Manufacturer.Url`, np. `briggs-stratton`, `smg-sportplatzmaschinenbau-gmbh`).
  `FilteringOptions.Filters` (Field `PRODUCERID`) zawiera liczby produktów każdej marki.
  `FilteringOptions.Groups[0].Nodes` zawiera podkategorie z liczbą produktów (`Count`) po filtrze.
- Adresy: kategoria `…,2,<id>`, produkt `…,3,<grupa>,<id>`.
- **Koszyk:** `$.post(null, {__action:'Cart/Add', __csrf:__CSRF, __parameters: JSON.stringify([{productId, quantity, attributeId:[…], supplyId}]), …})`.
  Szczegóły w README katalogu.
- **Formularz kontaktowy:** FormData POST na `/kontakt,12` z `__csrf`,
  `__action=Contact/Send`, `department` (1 = Sklep), `email`, `phoneNo`,
  `subject`, `message`, `copy`.
- **Menu na telefonie:** `.headerSection__mainMenu` (fixed, przewijane) >
  `.headerSection__categories__mobile`. W środku są:
  - przełącznik `.mobileCategorySwitcher__btn[data-group-target=gotowe|czesci]`;
  - `#psm-wrapper` (wyszukiwarka części);
  - `nav.mainCategories` > `.categoriesWrapper-js[data-group]`.
  Menu otwiera `.bottomMenu .showBottomMenuSection-js`.
- Na kartach produktów jest błąd sklepu `Cannot read properties of undefined (reading 'split')`
  w `layout2.min.js`. Występuje też bez naszych skryptów.

## 5. Testowanie

- Najlepiej w osobnej karcie przeglądarki z emulacją telefonu (375×812).
- Nowy kod można sprawdzić przed zapisem w szablonie. Wgraj go do /usr pod
  nazwą testową, usuń z DOM stary element (np. `.kiosk`) i dołącz skrypt
  `<script src="/usr/<test>.js">` w otwartej karcie sklepu.
- Pliki testowe w /usr zostają, więc zapisz ich nazwy do listy „do usunięcia”.
- Żądania `Cart/Add` i `Contact/Send` przechwytuj albo zastępuj atrapą.

## 6. Stan publikacji

Wszystko z punktu 3 jest **zapisane w szablonie**. Po ostatnich zmianach
(kiosk z producentem, zdjęcia) **czeka na „Publikuj”** właściciela. Przed
zakończeniem kolejnych zmian przypomnij o publikacji.

## 7. Otwarte zadania

1. **Rozszerzenie GA4 (zaczęte, wybór właściciela 01.10)**. Właściciel zaznaczył
   obszary, a do tego dopisał „oraz kategorie na mobile”:
   - **Koszyk i zamówienie:** remove_from_cart (sprawdzić, czy sklep już wysyła),
     zmiana ilości, kupon rabatowy (sukces/błąd), wybór dostawy i płatności
     (`add_shipping_info` z `shipping_tier`, `add_payment_info` z `payment_type`),
     błędy formularza zamówienia.
   - **Karta produktu:** zakładki (opis, specyfikacja, części), galeria zdjęć,
     wybór wariantu, zmiana ilości, „zapytaj o produkt”, „powiadom o dostępności”,
     wyświetlenie produktu niedostępnego.
   - **Konta i formularze:** `login`, `sign_up`, newsletter, wysłanie formularza
     kontaktowego (`generate_lead`), błędy walidacji.
   - **Linki i pliki:** linki wychodzące, pobrania PDF/instrukcji, ikony nagłówka
     (koszyk, ulubione, konto), mapa, social media.
   - **Kategorie na telefonie (kiosk):** wybór kategorii w lewym pasku, „Wstecz”,
     wyświetlenie kiosku, pusty wynik po wyborze producenta, ścieżka kategorii
     w parametrach, czas do kliknięcia.
   - Zacznij od sprawdzenia, co sklep już wysyła: `dataLayer` na karcie produktu,
     w koszyku i na kolejnych krokach zamówienia. Nie dubluj zdarzeń. Nowe zdarzenia
     dopisz do `ga4-events.js` (jeden nasłuch kliknięć w fazie capture, funkcja
     `wyslij`), a zdarzenia kiosku do `menu-kiosk.js` (funkcja `ga4`). Nowe parametry
     dopisz do listy do rejestracji w GA4.
2. **Porządki w /usr** (do usunięcia przez właściciela, nieużywane):
   - `xepc-lista-1…5.js`, `xepc-koszyk-2/3.js`;
   - `xepc-schemat.js`, `xepc-schemat-2/3.js`;
   - `kiosk-producent-test-1.js`.
3. **Lista producentów i zdjęć kiosku** jest statyczna (01.10). Gdy przybędzie
   kategorii lub marek, wygeneruj `menu-kiosk-zdjecia.js` ponownie. Metoda jest
   opisana w nagłówku pliku i w p. 4: crawl kategorii z menu, `sort=10/9`, filtr `producent=husqvarna`.
4. Ewentualnie: robot FJD jako zdjęcie całej kategorii „Golf / Sport” (teraz widełki do murawy).
5. Sprawy katalogu Husqvarna (z `xepc-koszyk/PODSUMOWANIE.md`):
   - mail do Husqvarna Polska o wpisanie domeny na listę xEPC;
   - więcej `MP_…` dla maszyn;
   - `debug: false` w koszyku katalogu po ustabilizowaniu.

## 8. Zawartość paczki

```
PODSUMOWANIE.md            ten plik
narzedzia/panel-helpers.js funkcje do konsoli panelu (odczyt/zapis/eksport szablonu, upload /usr)
szablon/js/                ga4-events.js, menu-kiosk.js, menu-kiosk-zdjecia.js, mobile-filters.js
szablon/css/               menu-kiosk.css, mobile-filters.css
szablon/partials/home/     home-parts-search.html
usr/                       xepc-koszyk-4.js, xepc-schemat-4.js, xepc-lista-6.js, xepc-schematy.json
patche/                    6 commitów z repo (git am patche/*.patch na gałęzi claude/busy-carson-41vcg0)
```
Pozostałe pliki szablonu (`_layout.html`, `custom.css`, `product-attributes.css`,
`home-page.html` i reszta) pobierzesz z panelu: `__eksport()` z `panel-helpers.js`.
