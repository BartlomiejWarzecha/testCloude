// =============================================================================
// XEPC SCHEMAT  (xepc-schemat.js)
// Pokazuje oficjalny katalog Husqvarna (xEPC) na karcie produktu w sklepie.
//
// Dwa tryby, rozpoznawane po "Kod towaru" na karcie:
//  * PRODUKT (maszyna) – kod jest w "produkty" w pliku danych
//    (albo, jeśli włączony, CONFIG.maszynaPoKodzie – domyślnie wyłączony)
//    -> zakładka "Sprawdź części zamienne" ze wszystkimi schematami tej maszyny:
//       /pl/product/<MP>?article=<Kod towaru>
//  * CZĘŚĆ – każdy inny towar Husqvarna
//    -> schematy modeli z listy "modele" i słownika "nazwy", których nazwa pasuje
//       do tytułu lub atrybutu "Modele Husqvarna:", a gdy tam nic – do opisu produktu
//    -> oraz karta części Husqvarna: /pl/part/<Kod towaru>
//  * WYSZUKIWANIE – fraza o Husqvarnie (np. "LC 140P", "husqvarna")
//    -> panel nad wynikami: schematy pasujących modeli + katalog Husqvarna
//
// Katalog nie pozwala podlinkować konkretnego zespołu (np. "Chassis lower"):
// otwiera model, a klient wybiera zespół w katalogu.
// "Dodaj do koszyka" i wysokość ramki obsługuje xepc-koszyk.js,
// więc na karcie produktu muszą być oba skrypty:
//   <script src="/usr/xepc-koszyk.js"></script>
//   <script src="/usr/xepc-schemat.js"></script>
// =============================================================================

(function (global) {
    'use strict';

    var CONFIG = {
        xepcBase:         'https://xepc-prod.husqvarnagroup.com/pl',
        domena:           'https://www.betkowskiservice.pl/',   // parametr ?domain= (koszyk z katalogu)
        daneUrl:          '/usr/xepc-schematy.json',
        marka:            /husqvarna|hqv|automower/i,           // tryb CZĘŚĆ tylko dla takich nazw
        pokazKarteCzesci: true,         // "Karta części" jako dodatkowy przycisk obok schematów
        kartaCzesciBezSchematu: false,  // true = zakładka z samą kartą części, gdy brak schematu
        nazwaZakladki:      'Sprawdź części zamienne',   // maszyna
        nazwaZakladkiCzesc: 'Zobacz na schemacie',       // część
        // druga linijka pod nazwą zakładki (tylko na telefonie)
        opisZakladki:       'Oryginalny katalog Husqvarna – część dodasz prosto do koszyka',
        opisZakladkiCzesc:  'Sprawdź, do jakich modeli pasuje i gdzie jest montowana',
        // Tryb automatyczny: maszyna po samym Kodzie towaru, bez wpisu w "produkty".
        // WYŁĄCZONY: katalog nie przyjmuje numeru artykułu zamiast MP_…
        // (test 01.10.2026: /pl/product/970488401 -> błąd serwera katalogu
        // .../productinformation/v1/products/970488401). Włączać tylko, jeśli
        // Husqvarna to zmieni, np.: /^9[67]\d{7}$/
        maszynaPoKodzie:  null,
        // Numery maszyn Husqvarna (900…, 901…, 953…, 967…, 970… itd.). Części to zwykle 5…
        // Takie kody nigdy nie dostają sekcji "część" (karta części dla maszyny = błąd).
        wzorMaszyny:      /^9\d{8}$/,
        maxModeliWyszukiwania: 6,   // ile przycisków modeli (część / wyszukiwanie)
        panelWyszukiwania: false,   // panel nad wynikami wyszukiwania/kategorii – WYŁĄCZONY
        czekajNaOpisMs:   4000,     // ile czekać na doczytanie opisu produktu
        wysokosc:         900,   // px, zanim katalog poda swoją wysokość
        ga4:              true,  // zdarzenia Google Analytics 4 (zakładka katalogu)
        debug:            true
    };

    function log() {
        if (!CONFIG.debug) return;
        console.log.apply(console, ['[xepc-schemat]'].concat(Array.prototype.slice.call(arguments)));
    }

    // ── Google Analytics 4 ───────────────────────────────────────────────────
    //   catalog_tab_shown    – karta produktu ma zakładkę z katalogiem (raz na stronę)
    //   catalog_open         – klient otworzył katalog (pierwsze otwarcie zakładki)
    //   catalog_model_select – klient przełączył schemat innego modelu
    // Parametry: catalog_mode (maszyna / czesc), part_number (Kod towaru),
    // catalog_models (ile schematów), match_source (kod_towaru / tytuł / opis),
    // catalog_view (etykieta przycisku), open_type (zakladka / link / automatycznie).
    // Wysyłka przez js/ga4-events.js (window.ga4Wyslij), bez niego przez gtag.
    function ga4(nazwa, parametry) {
        if (!CONFIG.ga4) return;
        try {
            if (typeof global.ga4Wyslij === 'function') { global.ga4Wyslij(nazwa, parametry); return; }
            if (typeof global.gtag !== 'function') return;
            global.__ga4Wlasne = true;
            try { global.gtag('event', nazwa, parametry); } finally { global.__ga4Wlasne = false; }
        } catch (e) {
            log('ga4:', e);
        }
    }

    function kontekstGa4(karta, wynik) {
        return {
            catalog_mode:   wynik.tryb === 'produkt' ? 'maszyna' : 'czesc',
            part_number:    normalizujKod(karta.kod),
            catalog_models: wynik.widoki.filter(function (w) { return !/^Karta części/.test(w.etykieta); }).length,
            match_source:   wynik.tryb === 'produkt' ? 'kod_towaru' : (wynik.zrodlo || '')
        };
    }

    function z(obiekt, dodatki) {
        var w = {}, k;
        for (k in obiekt) if (Object.prototype.hasOwnProperty.call(obiekt, k)) w[k] = obiekt[k];
        for (k in dodatki) if (Object.prototype.hasOwnProperty.call(dodatki, k)) w[k] = dodatki[k];
        return w;
    }

    function normalizujKod(v) {
        return v === null || v === undefined ? '' : String(v).toUpperCase().replace(/[\s.\-\/]/g, '');
    }

    function escRegExp(s) {
        return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // "430X" pasuje do "Husqvarna 430X 440", ale nie do "430XH".
    function zawieraToken(tekst, token) {
        return new RegExp('(^|[^A-Z0-9])' + escRegExp(token) + '($|[^A-Z0-9])', 'i').test(tekst);
    }

    // ── Adresy katalogu ──────────────────────────────────────────────────────
    function urlProduktu(mp, article) {
        return CONFIG.xepcBase + '/product/' + encodeURIComponent(mp) +
            '?' + (article ? 'article=' + encodeURIComponent(article) + '&' : '') +
            'domain=' + encodeURIComponent(CONFIG.domena);
    }

    function urlCzesci(kod) {
        return CONFIG.xepcBase + '/part/' + encodeURIComponent(kod) +
            '?domain=' + encodeURIComponent(CONFIG.domena);
    }

    // ── Co pokazać dla danej karty ───────────────────────────────────────────
    // Zwraca listę widoków [{etykieta, url}] – pierwszy otwiera się od razu.
    function dopasujModele(tekst, modele) {
        return (modele || []).filter(function (m) {
            if (!m || !m.mp) return false;
            if (m.kontekst && !new RegExp(m.kontekst, 'i').test(tekst)) return false;
            return (m.szukaj || [m.nazwa]).some(function (t) { return t && zawieraToken(tekst, t); });
        });
    }

    function zbudujWidoki(karta, dane) {
        dane = dane || {};
        var kod = normalizujKod(karta.kod);
        var produkty = dane.produkty || {};
        var maszyna = produkty[kod];
        // Odmiany w sklepie ("967674001_OT1", "967244501 10 METROW", "967298201M")
        // korzystają z wpisu numeru bazowego (pierwsze 9 cyfr).
        var bazowy = (/^\d{9}/.exec(kod) || [kod])[0];
        if (maszyna === undefined && bazowy !== kod) maszyna = produkty[bazowy];
        if (typeof maszyna === 'string') maszyna = { mp: maszyna };

        // Bez wpisu w "produkty": maszyna rozpoznana po samym Kodzie towaru
        // (numer artykułu Husqvarny, np. 970541201) -> /pl/product/<Kod towaru>.
        if (!maszyna && CONFIG.maszynaPoKodzie && CONFIG.maszynaPoKodzie.test(kod) &&
            CONFIG.marka.test(karta.nazwa || '')) {
            maszyna = { mp: kod, article: null, nazwa: karta.nazwa };
        }

        if (maszyna && maszyna.mp) {
            // U maszyn "Kod towaru" to numer artykułu Husqvarny (np. LC253S = 970541501).
            var article = maszyna.article === null ? null : (maszyna.article || bazowy);
            return {
                tryb: 'produkt',
                widoki: [{ etykieta: 'Schematy: ' + (maszyna.nazwa || karta.nazwa), url: urlProduktu(maszyna.mp, article) }]
            };
        }

        // Maszyna bez MP_… (pusty wpis albo numer 9xxxxxxxx) -> nic. Nie pokazujemy jej
        // jako części: /pl/part/<numer maszyny> kończy się błędem katalogu.
        var jestMaszyna = Object.prototype.hasOwnProperty.call(produkty, kod) ||
            Object.prototype.hasOwnProperty.call(produkty, bazowy) || CONFIG.wzorMaszyny.test(bazowy);
        if (!kod || jestMaszyna || !CONFIG.marka.test(karta.nazwa || '')) return { tryb: null, widoki: [] };

        // Modele z listy "modele" + ze słownika "nazwy" (husqvarna.com), np. "LC 353VE".
        // Kolejność: 1) tytuł + atrybuty karty, 2) opis produktu – tylko gdy 1) nic nie dał.
        function modeleZ(tekst) {
            var wynik = [], byly = {};
            dopasujModele(tekst, dane.modele).concat(modeleZeSlownika(tekst, dane.nazwy, true)).forEach(function (m) {
                if (!byly[m.mp]) { byly[m.mp] = true; wynik.push(m); }
            });
            return wynik;
        }
        var zrodlo = 'tytuł';
        var modele = modeleZ([karta.nazwa, karta.modele].join(' '));
        if (!modele.length && karta.opis) { modele = modeleZ(karta.opis); zrodlo = 'opis'; }
        var widoki = modele.slice(0, CONFIG.maxModeliWyszukiwania).map(function (m) {
            return { etykieta: 'Schemat: ' + m.nazwa, url: urlProduktu(m.mp, m.article) };
        });
        // Bez schematu nie pokazujemy samej karty części (klient szuka schematu, nie drugiej karty).
        if (!widoki.length && !CONFIG.kartaCzesciBezSchematu) return { tryb: null, widoki: [] };
        if (CONFIG.pokazKarteCzesci) {
            widoki.push({ etykieta: 'Karta części ' + kod, url: urlCzesci(kod) });
        }
        return { tryb: 'czesc', widoki: widoki, zrodlo: modele.length ? zrodlo : null };
    }

    // ── Odczyt karty produktu (Comarch e-Sklep) ──────────────────────────────
    function tekstZ(sel) {
        var el = document.querySelector(sel);
        return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    }

    function czytajKarte() {
        return {
            kod:    tekstZ('.code-value .value'),
            nazwa:  tekstZ('.js-product-details__name') || tekstZ('h1'),
            modele: tekstZ('.productDetails-attributes'),   // m.in. "Modele Husqvarna: ..."
            opis:   tekstZ('.productDetails-content--descriptionText') || tekstZ('.product-mobile-description')
        };
    }

    // Opis bywa doczytywany po załadowaniu strony – czekamy na niego do CONFIG.czekajNaOpisMs.
    function czekajNaOpis(karta) {
        return new Promise(function (gotowe) {
            if (karta.opis || !global.MutationObserver) return gotowe(karta);
            var koniec = setTimeout(zakoncz, CONFIG.czekajNaOpisMs);
            var obs = new global.MutationObserver(function () {
                var opis = tekstZ('.productDetails-content--descriptionText') || tekstZ('.product-mobile-description');
                if (opis) { karta.opis = opis; zakoncz(); }
            });
            obs.observe(document.body, { childList: true, subtree: true, characterData: true });
            function zakoncz() { clearTimeout(koniec); obs.disconnect(); gotowe(karta); }
        });
    }

    // ── Wstawienie na kartę ──────────────────────────────────────────────────
    // Zakładka obok Opis / Identyfikatory / Opinie:
    //  * PRODUKT -> "Sprawdź części zamienne", CZĘŚĆ -> "Zobacz na schemacie"
    //    (ikona, wyróżniony kolor; na telefonie druga linijka z opisem).
    // Sekcja nad zakładkami tylko awaryjnie, gdy strona nie ma zakładek.
    function wstawStyle() {
        if (document.getElementById('xepc-schemat-css')) return;
        var st = document.createElement('style');
        st.id = 'xepc-schemat-css';
        st.textContent =
            '.xepc-schemat{margin:24px 0;padding:0 16px}' +
            '.xepc-schemat h2{font-size:20px;margin:0 0 6px}' +
            '.xepc-schemat p,.xepc-zakladka p{margin:0 0 12px;font-size:14px}' +
            '.xepc-schemat__tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}' +
            '.xepc-schemat__tab{border:1px solid #ccc;background:#fff;border-radius:4px;padding:6px 12px;cursor:pointer;font:inherit}' +
            '.xepc-schemat__tab[aria-selected="true"]{background:#273a60;border-color:#273a60;color:#fff}' +
            '.xepc-schemat iframe,.xepc-zakladka iframe{width:100%;border:1px solid #ddd;border-radius:4px;display:block}' +
            // wprowadzenie nad katalogiem
            '.xepc-intro{margin:0 0 16px;padding:16px 18px;border:1px solid #f2c4c4;border-left:4px solid #e20000;border-radius:8px;background:#fff8f8}' +
            '.xepc-schemat .xepc-intro__tytul,.xepc-zakladka .xepc-intro__tytul{margin:0 0 8px;font-size:18px;font-weight:700;line-height:1.3;color:#1a1a1a}' +
            '.xepc-intro__lista{margin:0;padding:0;list-style:none}' +
            '.xepc-intro__lista li{position:relative;margin:4px 0;padding-left:24px;font-size:14px;line-height:1.4;color:#333}' +
            '.xepc-intro__lista li:before{content:"\\2713";position:absolute;left:0;top:0;font-weight:700;color:#e20000}' +
            '.xepc-intro__lista li.xepc-intro__zyczenia{margin-top:8px;padding-top:8px;border-top:1px dashed #f2c4c4}' +
            '.xepc-intro__lista li.xepc-intro__zyczenia:before{content:"+";top:8px;font-size:16px;line-height:1.1}' +
            '.xepc-intro__link{color:#e20000;font-weight:700;text-decoration:underline;white-space:nowrap}' +
            '.xepc-schemat .xepc-etykieta,.xepc-zakladka .xepc-etykieta{margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#555}' +
            '.xepc-schemat__tab:hover{border-color:#273a60}' +
            // zakładka katalogu - wyróżniona, żeby było widać, że to przycisk
            '.xepc-tab__ikona{width:18px;height:18px;flex:0 0 auto;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
            '.xepc-tab__tekst{display:inline-flex;flex-direction:column}' +
            '.xepc-tab__opis{display:none}' +
            '@media (min-width:769px){' +
              '.productDetails-detailsButtons .xepc-tab:not(.activeButton){background:#fff1f1;border-color:#f2a5a5 !important;color:#c40000}' +
              '.productDetails-detailsButtons .xepc-tab:not(.activeButton):hover{background:#ffe3e3;border-color:#e20000 !important;color:#a00000}' +
              '.productDetails-detailsButtons .xepc-tab.activeButton,.productDetails-detailsButtons .xepc-tab.activeButton:hover{background:#e20000;border-color:#e20000 !important;color:#fff;box-shadow:0 2px 6px rgba(226,0,0,.35)}' +
            '}' +
            '@media (max-width:768px){' +
              '.productDetails-detailsButtons .productDetails-detailsButtons--button.xepc-tab{box-sizing:border-box;display:flex;align-items:center;gap:12px;height:auto;min-height:60px;' +
                'line-height:1.3;white-space:normal;padding:12px 48px 12px 12px;background:#fff6f6;border-left:4px solid #e20000;color:#c40000;font-weight:700}' +
              '.xepc-tab .xepc-tab__ikona{position:static;width:24px;height:24px;transform:none;fill:none;stroke:#e20000}' +
              '.xepc-tab__opis{display:block;margin-top:3px;font-size:12px;font-weight:400;letter-spacing:0;text-transform:none;color:#555}' +
            '}';
        document.head.appendChild(st);
    }

    // Napis na przycisku modelu: bez "Schemat: " (nad przyciskami jest "Pasuje do:").
    // Etykieta z "Schemat: " zostaje w danych (GA4: catalog_view).
    function tekstPrzycisku(w) {
        if (/^Karta części/.test(w.etykieta)) return 'Karta części w katalogu';
        return w.etykieta.replace(/^Schematy?: /, '');
    }

    // Tytuł i trzy krótkie korzyści nad katalogiem.
    function zbudujWstep(karta, wynik) {
        var box = document.createElement('div');
        box.className = 'xepc-intro';
        var tytul = document.createElement('h3');
        tytul.className = 'xepc-intro__tytul';
        var punkty;
        if (wynik.tryb === 'produkt') {
            tytul.textContent = 'Części zamienne: ' + wynik.widoki[0].etykieta.replace(/^Schematy?: /, '');
            punkty = ['Oryginalny katalog Husqvarna z rysunkami wszystkich zespołów',
                      'Wybierz zespół i znajdź potrzebną część na schemacie',
                      '„Dodaj do koszyka” przy części dodaje ją od razu do koszyka w naszym sklepie'];
        } else {
            tytul.textContent = 'Gdzie pasuje ta część? Zobacz ją na schemacie';
            punkty = ['Wybierz model poniżej, a w katalogu – zespół',
                      'Na rysunku szukaj numeru ' + normalizujKod(karta.kod),
                      '„Dodaj do koszyka” przy części dodaje ją od razu do koszyka w naszym sklepie'];
        }
        box.appendChild(tytul);
        var ul = document.createElement('ul');
        ul.className = 'xepc-intro__lista';
        punkty.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
        // Lista życzeń (xepc-lista-*.js): części, których nie ma w sklepie
        if (global.ListaZyczen && typeof global.ListaZyczen.otworz === 'function') {
            var li = document.createElement('li');
            li.className = 'xepc-intro__zyczenia';
            li.appendChild(document.createTextNode('Części nie ma w naszym sklepie? Trafi na Twoją listę życzeń – ' +
                'wyślij nam zapytanie, a sprawdzimy, czy możemy ją sprowadzić. '));
            var a = document.createElement('a');
            a.href = '#lista-zyczen';
            a.className = 'xepc-intro__link';
            a.textContent = 'Zobacz listę życzeń';
            a.addEventListener('click', function (e) { e.preventDefault(); global.ListaZyczen.otworz(); });
            li.appendChild(a);
            ul.appendChild(li);
        }
        box.appendChild(ul);
        return box;
    }

    // Wstęp + (przyciski modeli) + iframe. Iframe ładuje się dopiero po zaladuj().
    function zbudujZawartosc(karta, wynik) {
        var el = document.createElement('div');
        el.appendChild(zbudujWstep(karta, wynik));

        var ramka = document.createElement('iframe');
        ramka.title = 'Katalog części Husqvarna';
        ramka.style.height = CONFIG.wysokosc + 'px';
        var aktualny = wynik.widoki[0].url;
        var aktualnaEtykieta = wynik.widoki[0].etykieta;
        var ctx = kontekstGa4(karta, wynik);

        if (wynik.widoki.length > 1) {
            var etykieta = document.createElement('p');
            etykieta.className = 'xepc-etykieta';
            etykieta.textContent = wynik.tryb === 'produkt' ? 'Schematy:' : 'Pasuje do:';
            el.appendChild(etykieta);
            var tabs = document.createElement('div');
            tabs.className = 'xepc-schemat__tabs';
            tabs.setAttribute('role', 'tablist');
            wynik.widoki.forEach(function (w, i) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'xepc-schemat__tab';
                b.setAttribute('role', 'tab');
                b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
                b.textContent = tekstPrzycisku(w);
                b.addEventListener('click', function () {
                    Array.prototype.forEach.call(tabs.children, function (x) { x.setAttribute('aria-selected', 'false'); });
                    b.setAttribute('aria-selected', 'true');
                    ramka.style.height = CONFIG.wysokosc + 'px';
                    if (aktualny !== w.url) ga4('catalog_model_select', z(ctx, { catalog_view: w.etykieta }));
                    aktualny = w.url;
                    aktualnaEtykieta = w.etykieta;
                    ramka.src = w.url;
                });
                tabs.appendChild(b);
            });
            el.appendChild(tabs);
        }
        el.appendChild(ramka);

        return {
            el: el,
            // sposob: zakladka / link / automatycznie (tylko do GA4)
            zaladuj: function (sposob) {
                if (ramka.getAttribute('src')) return;
                ramka.src = aktualny;
                ga4('catalog_open', z(ctx, { catalog_view: aktualnaEtykieta, open_type: typeof sposob === 'string' ? sposob : 'zakladka' }));
            }
        };
    }

    function wstawSekcje(karta, wynik) {
        var sekcja = document.createElement('section');
        sekcja.className = 'xepc-schemat';

        var zaw = zbudujZawartosc(karta, wynik);
        sekcja.appendChild(zaw.el);

        var cel = document.querySelector('.productDetails-section--innerCenter');
        if (cel && cel.parentNode) cel.parentNode.insertBefore(sekcja, cel);
        else (document.querySelector('.productDetails-wrapper') || document.body).appendChild(sekcja);
        zaw.zaladuj('automatycznie');
    }

    // Ikona na zakładce: klucz (maszyna) / lupa (część). Rysowana kreską (stroke).
    function ikona(tryb) {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('class', 'xepc-tab__ikona');
        var ksztalty = tryb === 'produkt'
            ? [['path', { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z' }]]
            : [['circle', { cx: '11', cy: '11', r: '7' }], ['path', { d: 'M21 21l-4.35-4.35' }]];
        ksztalty.forEach(function (k) {
            var e = document.createElementNS(NS, k[0]);
            Object.keys(k[1]).forEach(function (a) { e.setAttribute(a, k[1][a]); });
            svg.appendChild(e);
        });
        return svg;
    }

    // Zakładka w stylu sklepu: sklep przełącza zakładki po klasie
    // .productDetails-detailsButtons--button i data-content (delegacja w layout2.min.js),
    // więc wystarczy dodać przycisk i panel o tym samym data-content.
    function wstawZakladke(karta, wynik) {
        var przyciski = document.querySelector('.productDetails-detailsButtons');
        var wzorPrzycisku = przyciski && przyciski.querySelector('.productDetails-detailsButtons--button');
        var wzorPanelu = document.querySelector('.productDetails-content[data-content]');
        if (!wzorPrzycisku || !wzorPanelu) return wstawSekcje(karta, wynik);

        var ID = 'xepc-czesci';
        var NAZWA = wynik.tryb === 'produkt' ? CONFIG.nazwaZakladki : CONFIG.nazwaZakladkiCzesc;

        var OPIS = wynik.tryb === 'produkt' ? CONFIG.opisZakladki : CONFIG.opisZakladkiCzesc;

        var przycisk = document.createElement('div');
        przycisk.setAttribute('role', 'button');
        przycisk.setAttribute('tabindex', '0');
        przycisk.className = 'productDetails-detailsButtons--button xepc-tab';
        przycisk.setAttribute('data-content', ID);
        przycisk.setAttribute('title', OPIS);
        przycisk.appendChild(ikona(wynik.tryb));
        var tekst = document.createElement('span');
        tekst.className = 'xepc-tab__tekst';
        var nazwa = document.createElement('span');
        nazwa.className = 'xepc-tab__nazwa';
        nazwa.textContent = NAZWA;
        var opis = document.createElement('span');
        opis.className = 'xepc-tab__opis';
        opis.textContent = OPIS;
        tekst.appendChild(nazwa);
        tekst.appendChild(opis);
        przycisk.appendChild(tekst);
        var strzalka = wzorPrzycisku.querySelector('svg');
        if (strzalka) przycisk.appendChild(strzalka.cloneNode(true));

        var panel = document.createElement('div');
        panel.className = 'productDetails-content productDetails-content--xepc xepc-zakladka hidden';
        panel.setAttribute('data-content', ID);
        var naglowek = wzorPanelu.querySelector('.productDetails-content--header');   // nagłówek + "zamknij" na telefonie
        if (naglowek) {
            naglowek = naglowek.cloneNode(true);
            var tytul = naglowek.querySelector('span');
            if (tytul) tytul.textContent = NAZWA;
            panel.appendChild(naglowek);
        }
        var tresc = document.createElement('div');
        tresc.className = 'productDetails-content--text';
        var zaw = zbudujZawartosc(karta, wynik);
        tresc.appendChild(zaw.el);
        panel.appendChild(tresc);

        // Po "Opis towaru", żeby zakładka była druga.
        var po = przyciski.querySelector('[data-content="description"]') || wzorPrzycisku;
        po.parentNode.insertBefore(przycisk, po.nextSibling);
        var panele = document.querySelectorAll('.productDetails-content[data-content]');
        var ostatni = panele[panele.length - 1];
        ostatni.parentNode.insertBefore(panel, ostatni.nextSibling);

        // Katalog ładujemy dopiero przy pierwszym otwarciu zakładki.
        var sposob = 'zakladka';
        przycisk.addEventListener('click', function () { zaw.zaladuj(sposob); sposob = 'zakladka'; });
        przycisk.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); przycisk.click(); }
        });
        if (/[#&]czesci\b/.test(global.location.hash)) { sposob = 'link'; przycisk.click(); }
    }

    // ── Strona wyników wyszukiwania ──────────────────────────────────────────
    // Panel nad listą produktów, gdy fraza dotyczy Husqvarny:
    //  * modele z frazy ("LC 140P" -> słownik "nazwy" z husqvarna.com)
    //  * maszyny z wyników, które mają MP_… w "produkty"
    //  * zawsze: strona startowa katalogu (klient wyszuka model sam, np. "LC140")
    function frazaWyszukiwania() {
        try {
            var p = new global.URLSearchParams(global.location.search);
            return (p.get('search') || p.get('seaAtc') || '').trim();
        } catch (e) { return ''; }
    }

    function kluczNazwy(s) {
        return String(s || '').toUpperCase().replace(/HUSQVARNA/g, '').replace(/[^A-Z0-9]/g, '');
    }

    // Modele ze słownika "nazwy" we frazie/tytule: "kosiarka lc 140p" -> "LC140P"
    // (łączymy do 3 sąsiednich słów). bezpieczne=true (tytuły części): tylko klucze
    // z literą i cyfrą, bo same liczby ("550", "305") mylą modele różnych maszyn.
    function modeleZeSlownika(tekst, nazwy, bezpieczne) {
        var wynik = [];
        if (!nazwy) return wynik;
        var tokeny = String(tekst || '').split(/[\s,;\/()]+/).filter(Boolean);
        for (var i = 0; i < tokeny.length; i++) {
            for (var j = Math.min(tokeny.length, i + 3); j > i; j--) {
                var k = kluczNazwy(tokeny.slice(i, j).join(''));
                if (k.length < 3 || !nazwy[k]) continue;
                if (bezpieczne && (k.length < 4 || !/[A-Z]/.test(k) || !/\d/.test(k))) continue;
                if (wynik.indexOf(nazwy[k]) < 0) wynik.push(nazwy[k]);
            }
        }
        return wynik;
    }

    function dopasujWyszukiwanie(fraza, wyniki, dane, sciezka) {
        dane = dane || {};
        wyniki = wyniki || [];
        var nazwy = dane.nazwy || {}, produkty = dane.produkty || {};
        var modele = [], byly = {};
        function dodaj(m) { if (m && m.mp && !byly[m.mp]) { byly[m.mp] = true; modele.push(m); } }

        modeleZeSlownika(fraza, nazwy, false).forEach(dodaj);
        var nazwaPoMp = {};
        Object.keys(nazwy).forEach(function (k) { nazwaPoMp[nazwy[k].mp] = nazwy[k].nazwa; });
        wyniki.forEach(function (pr) {
            var kod = normalizujKod(pr.Code);
            var baz = (/^\d{9}/.exec(kod) || [kod])[0];
            var v = produkty[kod];
            if (v === undefined && baz !== kod) v = produkty[baz];
            if (typeof v === 'string') v = { mp: v };
            if (v && v.mp) {
                var nazwa = v.nazwa || nazwaPoMp[v.mp] || String(pr.NameNoHtml || '').replace(/^.*?husqvarna\s+/i, '') || baz;
                dodaj({ nazwa: nazwa, mp: v.mp, article: v.article || baz });
            }
        });

        var husq = CONFIG.marka.test(fraza || '') || /producent=husqvarna/i.test(sciezka || '') ||
            modele.length > 0 ||
            wyniki.filter(function (pr) { return CONFIG.marka.test(pr.NameNoHtml || ''); }).length * 2 > wyniki.length && wyniki.length > 0;
        if (!husq) return { widoki: [] };

        var widoki = modele.slice(0, CONFIG.maxModeliWyszukiwania).map(function (m) {
            return { etykieta: 'Schemat: ' + m.nazwa, url: urlProduktu(m.mp, m.article || null) };
        });
        widoki.push({ etykieta: 'Katalog części Husqvarna', url: CONFIG.xepcBase + '?domain=' + encodeURIComponent(CONFIG.domena) });
        return { widoki: widoki };
    }

    function wstawPanelWyszukiwania(fraza, wynik) {
        var lista = document.querySelector('.product-list-js');
        if (!lista || document.querySelector('.xepc-wyszukiwanie')) return;

        var sekcja = document.createElement('section');
        sekcja.className = 'xepc-schemat xepc-wyszukiwanie';
        var h = document.createElement('h2');
        h.textContent = 'Schematy części Husqvarna';
        sekcja.appendChild(h);
        var info = document.createElement('p');
        info.textContent = wynik.widoki.length > 1
            ? 'Otwórz schemat modelu i dodaj części do koszyka prosto z katalogu.'
            : 'Nie znalazłeś części dla „' + fraza + '”? Wyszukaj model w oficjalnym katalogu Husqvarna i dodaj część do koszyka prosto z katalogu.';
        sekcja.appendChild(info);

        var ramka = document.createElement('iframe');
        ramka.title = 'Katalog części Husqvarna';
        ramka.style.height = CONFIG.wysokosc + 'px';
        ramka.style.display = 'none';

        var tabs = document.createElement('div');
        tabs.className = 'xepc-schemat__tabs';
        wynik.widoki.forEach(function (w) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'xepc-schemat__tab';
            b.setAttribute('aria-selected', 'false');
            b.textContent = w.etykieta;
            b.addEventListener('click', function () {
                var otwarty = b.getAttribute('aria-selected') === 'true';
                Array.prototype.forEach.call(tabs.children, function (x) { x.setAttribute('aria-selected', 'false'); });
                if (otwarty) { ramka.style.display = 'none'; return; }   // drugie kliknięcie zwija
                b.setAttribute('aria-selected', 'true');
                ramka.style.display = 'block';
                ramka.style.height = CONFIG.wysokosc + 'px';
                if (ramka.getAttribute('src') !== w.url) ramka.src = w.url;
            });
            tabs.appendChild(b);
        });
        sekcja.appendChild(tabs);
        sekcja.appendChild(ramka);
        lista.insertBefore(sekcja, lista.firstChild);
    }

    function startWyszukiwanie(fraza) {
        Promise.all([
            ladujDane(),
            Promise.resolve(global.$ && global.$.get(global.location.href, { __collection: 'products.Products' }))
                .then(function (odp) {
                    var c = odp && odp.collection;
                    return Array.isArray(c) ? c : (c && (c['products.Products'] || c.Products)) || [];
                }, function () { return []; })
        ]).then(function (w) {
            var wynik = dopasujWyszukiwanie(fraza, w[1], w[0], global.location.pathname);
            log('wyszukiwanie', fraza, wynik);
            if (!wynik.widoki.length) return;
            wstawStyle();
            wstawPanelWyszukiwania(fraza, wynik);
        });
    }

    function ladujDane() {
        return global.fetch(CONFIG.daneUrl, { credentials: 'same-origin' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' @ ' + CONFIG.daneUrl);
            return res.json();
        }).catch(function (e) {
            console.warn('[xepc-schemat] dane:', e.message);
            return {};
        });
    }

    function start() {
        var karta = czytajKarte();
        if (!karta.kod) {
            var fraza = frazaWyszukiwania();
            if (CONFIG.panelWyszukiwania && fraza && document.querySelector('.product-list-js')) startWyszukiwanie(fraza);
            return;
        }

        Promise.all([ladujDane(), czekajNaOpis(karta)]).then(function (w) {
            var dane = w[0];
            var wynik = zbudujWidoki(karta, dane);
            log(karta, wynik);
            if (!wynik.widoki.length) return;
            wstawStyle();
            ga4('catalog_tab_shown', kontekstGa4(karta, wynik));
            wstawZakladke(karta, wynik);   // bez zakładek na stronie -> sekcja (wstawSekcje)
        });
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }

    global.XepcSchemat = {
        config:        CONFIG,
        zbudujWidoki:  zbudujWidoki,
        dopasujModele: dopasujModele,
        urlProduktu:   urlProduktu,
        urlCzesci:     urlCzesci,
        dopasujWyszukiwanie: dopasujWyszukiwanie,
        kontekstGa4:   kontekstGa4
    };

})(typeof window !== 'undefined' ? window : globalThis);
