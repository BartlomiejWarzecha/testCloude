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
        nazwaZakladki:    'Części zamienne',
        // Tryb automatyczny: maszyna po samym Kodzie towaru, bez wpisu w "produkty".
        // WYŁĄCZONY: katalog nie przyjmuje numeru artykułu zamiast MP_…
        // (test 01.10.2026: /pl/product/970488401 -> błąd serwera katalogu
        // .../productinformation/v1/products/970488401). Włączać tylko, jeśli
        // Husqvarna to zmieni, np.: /^9[67]\d{7}$/
        maszynaPoKodzie:  null,
        // Numery maszyn Husqvarna (900…, 901…, 953…, 967…, 970… itd.). Części to zwykle 5…
        // Takie kody nigdy nie dostają sekcji "część" (karta części dla maszyny = błąd).
        wzorMaszyny:      /^9\d{8}$/,
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

    // ── Wstawienie na kartę ──────────────────────────────────────────────────
    //  * PRODUKT -> zakładka "Części zamienne" obok Opis / Identyfikatory / Opinie
    //  * CZĘŚĆ   -> sekcja nad zakładkami
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

        var ID = 'xepc-czesci', NAZWA = CONFIG.nazwaZakladki;

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
            if (wynik.tryb === 'produkt') wstawZakladke(karta, wynik);
            else wstawSekcje(karta, wynik);
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
