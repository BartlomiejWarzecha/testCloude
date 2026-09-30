// =============================================================================
// XEPC SCHEMAT  (xepc-schemat.js)
// Pokazuje oficjalny katalog Husqvarna (xEPC) na karcie produktu w sklepie.
//
// Dwa tryby, rozpoznawane po "Kod towaru" na karcie:
//  * PRODUKT (maszyna) – kod jest w "produkty" w pliku danych
//    -> wszystkie schematy tej maszyny: /pl/product/<MP>?article=<article>
//  * CZĘŚĆ – każdy inny towar Husqvarna
//    -> schematy modeli z listy "modele", których nazwa pasuje do tytułu
//       lub atrybutu "Modele Husqvarna:" (np. bateria 430X 440 450X 550)
//    -> oraz karta części Husqvarna: /pl/part/<Kod towaru>
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
        pokazKarteCzesci: true,
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
        var maszyna = (dane.produkty || {})[kod];

        if (maszyna && maszyna.mp) {
            return {
                tryb: 'produkt',
                widoki: [{ etykieta: 'Schematy: ' + (maszyna.nazwa || karta.nazwa), url: urlProduktu(maszyna.mp, maszyna.article) }]
            };
        }

        if (!kod || !CONFIG.marka.test(karta.nazwa || '')) return { tryb: null, widoki: [] };

        var tekst = [karta.nazwa, karta.modele].join(' ');
        var widoki = dopasujModele(tekst, dane.modele).map(function (m) {
            return { etykieta: 'Schemat: ' + m.nazwa, url: urlProduktu(m.mp, m.article) };
        });
        if (CONFIG.pokazKarteCzesci) {
            widoki.push({ etykieta: 'Karta części ' + kod, url: urlCzesci(kod) });
        }
        return { tryb: 'czesc', widoki: widoki };
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
            modele: tekstZ('.productDetails-attributes')   // m.in. "Modele Husqvarna: ..."
        };
    }

    // ── Wstawienie sekcji ────────────────────────────────────────────────────
    function wstawStyle() {
        if (document.getElementById('xepc-schemat-css')) return;
        var st = document.createElement('style');
        st.id = 'xepc-schemat-css';
        st.textContent =
            '.xepc-schemat{margin:24px 0;padding:0 16px}' +
            '.xepc-schemat h2{font-size:20px;margin:0 0 6px}' +
            '.xepc-schemat p{margin:0 0 12px;font-size:14px}' +
            '.xepc-schemat__tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}' +
            '.xepc-schemat__tab{border:1px solid #ccc;background:#fff;border-radius:4px;padding:6px 12px;cursor:pointer;font:inherit}' +
            '.xepc-schemat__tab[aria-selected="true"]{background:#273a60;border-color:#273a60;color:#fff}' +
            '.xepc-schemat iframe{width:100%;border:1px solid #ddd;border-radius:4px;display:block}';
        document.head.appendChild(st);
    }

    function wstawSekcje(karta, wynik) {
        var sekcja = document.createElement('section');
        sekcja.className = 'xepc-schemat';

        var h = document.createElement('h2');
        h.textContent = wynik.tryb === 'produkt' ? 'Schematy części – katalog Husqvarna' : 'Schemat części w katalogu Husqvarna';
        sekcja.appendChild(h);

        var info = document.createElement('p');
        info.textContent = wynik.tryb === 'produkt'
            ? 'Wybierz zespół w katalogu. „Dodaj do koszyka” przy części dodaje ją do koszyka w naszym sklepie.'
            : 'Wybierz zespół w katalogu i znajdź numer ' + normalizujKod(karta.kod) +
              '. „Dodaj do koszyka” przy części dodaje ją do koszyka w naszym sklepie.';
        sekcja.appendChild(info);

        var ramka = document.createElement('iframe');
        ramka.title = 'Katalog części Husqvarna';
        ramka.loading = 'lazy';
        ramka.style.height = CONFIG.wysokosc + 'px';

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
                    ramka.src = w.url;
                });
                tabs.appendChild(b);
            });
            sekcja.appendChild(tabs);
        }

        ramka.src = wynik.widoki[0].url;
        sekcja.appendChild(ramka);

        var cel = document.querySelector('.productDetails-section--innerCenter');
        if (cel && cel.parentNode) cel.parentNode.insertBefore(sekcja, cel);
        else (document.querySelector('.productDetails-wrapper') || document.body).appendChild(sekcja);
    }

    function start() {
        var karta = czytajKarte();
        if (!karta.kod) return;   // to nie jest karta produktu

        global.fetch(CONFIG.daneUrl, { credentials: 'same-origin' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' @ ' + CONFIG.daneUrl);
            return res.json();
        }).catch(function (e) {
            console.warn('[xepc-schemat] dane:', e.message);
            return {};
        }).then(function (dane) {
            var wynik = zbudujWidoki(karta, dane);
            log(karta, wynik);
            if (!wynik.widoki.length) return;
            wstawStyle();
            wstawSekcje(karta, wynik);
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
        urlCzesci:     urlCzesci
    };

})(typeof window !== 'undefined' ? window : globalThis);
