// =============================================================================
// XEPC SCHEMAT  (xepc-schemat.js)
// Pokazuje oficjalny katalog Husqvarna (xEPC) na karcie produktu w sklepie.
//
// Dwa tryby, rozpoznawane po "Kod towaru" na karcie:
//  * PRODUKT (maszyna) – kod jest w "produkty" w pliku danych
//    (albo, jeśli włączony, CONFIG.maszynaPoKodzie – domyślnie wyłączony)
//    -> zakładka "Części zamienne" ze wszystkimi schematami tej maszyny:
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
        nazwaZakladki:      'Części zamienne',   // maszyna
        nazwaZakladkiCzesc: 'Schemat części',    // część
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
        debug:            true
    };

    function log() {
        if (!CONFIG.debug) return;
        console.log.apply(console, ['[xepc-schemat]'].concat(Array.prototype.slice.call(arguments)));
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
    //  * PRODUKT -> "Części zamienne", CZĘŚĆ -> "Schemat części".
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
            '.xepc-schemat iframe,.xepc-zakladka iframe{width:100%;border:1px solid #ddd;border-radius:4px;display:block}';
        document.head.appendChild(st);
    }

    // Opis + (przyciski modeli) + iframe. Iframe ładuje się dopiero po zaladuj().
    function zbudujZawartosc(karta, wynik) {
        var el = document.createElement('div');

        var info = document.createElement('p');
        info.textContent = wynik.tryb === 'produkt'
            ? 'Oficjalny katalog części Husqvarna dla tego modelu. Wybierz zespół, a „Dodaj do koszyka” przy części doda ją do koszyka w naszym sklepie.'
            : 'Wybierz zespół w katalogu i znajdź numer ' + normalizujKod(karta.kod) +
              '. „Dodaj do koszyka” przy części dodaje ją do koszyka w naszym sklepie.';
        el.appendChild(info);

        var ramka = document.createElement('iframe');
        ramka.title = 'Katalog części Husqvarna';
        ramka.style.height = CONFIG.wysokosc + 'px';
        var aktualny = wynik.widoki[0].url;

        if (wynik.widoki.length > 1) {
            var tabs = document.createElement('div');
            tabs.className = 'xepc-schemat__tabs';
            tabs.setAttribute('role', 'tablist');
            wynik.widoki.forEach(function (w, i) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'xepc-schemat__tab';
                b.setAttribute('role', 'tab');
                b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
                b.textContent = w.etykieta;
                b.addEventListener('click', function () {
                    Array.prototype.forEach.call(tabs.children, function (x) { x.setAttribute('aria-selected', 'false'); });
                    b.setAttribute('aria-selected', 'true');
                    ramka.style.height = CONFIG.wysokosc + 'px';
                    aktualny = w.url;
                    ramka.src = w.url;
                });
                tabs.appendChild(b);
            });
            el.appendChild(tabs);
        }
        el.appendChild(ramka);

        return {
            el: el,
            zaladuj: function () { if (!ramka.getAttribute('src')) ramka.src = aktualny; }
        };
    }

    function wstawSekcje(karta, wynik) {
        var sekcja = document.createElement('section');
        sekcja.className = 'xepc-schemat';
        var h = document.createElement('h2');
        h.textContent = 'Schemat części w katalogu Husqvarna';
        sekcja.appendChild(h);

        var z = zbudujZawartosc(karta, wynik);
        sekcja.appendChild(z.el);

        var cel = document.querySelector('.productDetails-section--innerCenter');
        if (cel && cel.parentNode) cel.parentNode.insertBefore(sekcja, cel);
        else (document.querySelector('.productDetails-wrapper') || document.body).appendChild(sekcja);
        z.zaladuj();
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

        var przycisk = document.createElement('div');
        przycisk.setAttribute('role', 'button');
        przycisk.setAttribute('tabindex', '0');
        przycisk.className = 'productDetails-detailsButtons--button';
        przycisk.setAttribute('data-content', ID);
        przycisk.appendChild(document.createTextNode(NAZWA));
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
        var z = zbudujZawartosc(karta, wynik);
        tresc.appendChild(z.el);
        panel.appendChild(tresc);

        // Po "Opis towaru", żeby zakładka była druga.
        var po = przyciski.querySelector('[data-content="description"]') || wzorPrzycisku;
        po.parentNode.insertBefore(przycisk, po.nextSibling);
        var panele = document.querySelectorAll('.productDetails-content[data-content]');
        var ostatni = panele[panele.length - 1];
        ostatni.parentNode.insertBefore(panel, ostatni.nextSibling);

        // Katalog ładujemy dopiero przy pierwszym otwarciu zakładki.
        przycisk.addEventListener('click', z.zaladuj);
        przycisk.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); przycisk.click(); }
        });
        if (/[#&]czesci\b/.test(global.location.hash)) przycisk.click();
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
        dopasujWyszukiwanie: dopasujWyszukiwanie
    };

})(typeof window !== 'undefined' ? window : globalThis);
