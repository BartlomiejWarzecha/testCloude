// =============================================================================
// XEPC -> KOSZYK  (xepc-koszyk.js)
// Łączy osadzony katalog Husqvarna (xEPC, iframe) z koszykiem Comarch e-Sklep.
//
// Jak działa:
//  1. Katalog w iframe wysyła wiadomości do strony (window.postMessage).
//  2. Skrypt przyjmuje tylko wiadomości z domeny katalogu Husqvarna.
//  3. Liczba = wysokość treści katalogu -> dopasowujemy wysokość iframe.
//  4. Inne wiadomości -> szukamy w nich numeru części i ilości,
//     zamieniamy numer na ID towaru z mapy (/usr/husqvarna-mapa-czesci.json)
//     i dodajemy do koszyka tym samym wywołaniem, którego używa sklep (Cart/Add).
//
// Ładować na podstronie z katalogiem (husqvarna_katalog,37), PO skryptach sklepu:
//   <script src="/usr/xepc-koszyk.js"></script>
// =============================================================================

(function (global) {
    'use strict';

    var CONFIG = {
        xepcOrigin:   'https://xepc-prod.husqvarnagroup.com',
        mapaUrl:      '/usr/husqvarna-mapa-czesci.json',
        autoWysokosc: true,   // dopasuj wysokość iframe do treści katalogu
        maxIlosc:     99,
        debug:        true    // true -> każda wiadomość z katalogu w konsoli (F12)
    };

    function log() {
        if (!CONFIG.debug) return;
        console.log.apply(console, ['[xepc-koszyk]'].concat(Array.prototype.slice.call(arguments)));
    }

    // ── Numery części ────────────────────────────────────────────────────────
    // "589 30 08-01", "589300801", 589300801 -> "589300801"
    function normalizujKod(v) {
        if (v === null || v === undefined) return '';
        return String(v).toUpperCase().replace(/[\s.\-\/]/g, '');
    }

    // Numer Husqvarny: 6-12 znaków, same litery/cyfry, co najmniej 6 cyfr.
    function wygladaNaKod(v) {
        if (typeof v !== 'string' && typeof v !== 'number') return false;
        var k = normalizujKod(v);
        return /^[A-Z0-9]{6,12}$/.test(k) && (k.match(/\d/g) || []).length >= 6;
    }

    // ── Odczyt wiadomości z katalogu ─────────────────────────────────────────
    // Format wiadomości "dodaj do koszyka" nie jest publicznie opisany,
    // więc szukamy numeru i ilości po typowych nazwach pól, także w
    // zagnieżdżonych obiektach ({type, payload}, {items: [...]} itp.).
    // Najpierw pola jednoznaczne (partNumber, articleNo...), dopiero potem ogólne (id, code).
    var KLUCZE_KODU = [
        /^(part|article|product|item|spare)_?(no|nr|number|numer|code|kod)$|sku/i,
        /^(no|nr|number|numer|code|kod|id)$/i
    ];
    var KLUCZ_ILOSC = /^(qty|quantity|amount|count|ilosc|ilość)$/i;

    function wyciagnijPozycje(data, glebokosc) {
        glebokosc = glebokosc || 0;
        if (glebokosc > 5 || data === null || data === undefined) return [];

        if (typeof data === 'string') {
            if (/^\s*[\[{]/.test(data)) {
                try { return wyciagnijPozycje(JSON.parse(data), glebokosc + 1); } catch (e) { /* zwykły tekst */ }
            }
            return wygladaNaKod(data) ? [{ kod: normalizujKod(data), ilosc: 1 }] : [];
        }

        if (Array.isArray(data)) {
            return data.reduce(function (acc, el) {
                return acc.concat(wyciagnijPozycje(el, glebokosc + 1));
            }, []);
        }

        if (typeof data !== 'object') return [];

        var klucze = Object.keys(data), kod = null, ilosc = 1;
        KLUCZE_KODU.forEach(function (wzor) {
            klucze.forEach(function (k) {
                if (kod === null && wzor.test(k) && wygladaNaKod(data[k])) kod = normalizujKod(data[k]);
            });
        });
        klucze.forEach(function (k) {
            if (KLUCZ_ILOSC.test(k) && !isNaN(parseFloat(data[k]))) ilosc = parseFloat(data[k]);
        });
        if (kod !== null) return [{ kod: kod, ilosc: ilosc }];

        // Nic na tym poziomie -> szukaj głębiej.
        return Object.keys(data).reduce(function (acc, k) {
            var v = data[k];
            return (v && typeof v === 'object') || typeof v === 'string'
                ? acc.concat(wyciagnijPozycje(v, glebokosc + 1))
                : acc;
        }, []);
    }

    function poprawIlosc(v) {
        var n = Math.round(Number(v));
        if (!isFinite(n) || n < 1) return 1;
        return Math.min(n, CONFIG.maxIlosc);
    }

    // ── Mapa: numer części -> ID towaru w e-Sklepie ──────────────────────────
    // Plik z eksportu SQL (mapa-czesci.sql): [{"k":"589300801","id":48426}, ...]
    var promiseMapy = null;

    function ladujMape() {
        if (promiseMapy) return promiseMapy;
        promiseMapy = fetch(CONFIG.mapaUrl).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' @ ' + CONFIG.mapaUrl);
            return res.json();
        }).then(function (lista) {
            var m = new Map();
            (Array.isArray(lista) ? lista : []).forEach(function (w) {
                var k = normalizujKod(w.k);
                if (k && !m.has(k)) m.set(k, Number(w.id));
            });
            log('mapa części:', m.size, 'pozycji');
            return m;
        }).catch(function (e) {
            console.warn('[xepc-koszyk] mapa:', e.message);
            promiseMapy = null;   // spróbuj ponownie przy następnym kliknięciu
            return new Map();
        });
        return promiseMapy;
    }

    // ── Koszyk (to samo wywołanie co przycisk "Do koszyka" w sklepie) ───────
    function popup(tekst, typ) {
        if (global.app && typeof global.app.showTemporaryPopup === 'function') {
            global.app.showTemporaryPopup(tekst, typ || 'info', null, 4000);
        } else {
            global.alert(tekst);
        }
    }

    function dodajDoKoszyka(pozycje) {
        var parametry = pozycje.map(function (p) {
            return { productId: String(p.id), quantity: String(p.ilosc) };
        });
        return global.$.post(null, {
            __action:     'Cart/Add',
            __csrf:       global.__CSRF,
            __parameters: JSON.stringify(parametry),
            __collection: 'customer.Cart.Count|customer.Cart.Value|customer.Cart.CurrencyExt'
        }).then(function (odp) {
            if (!odp || !odp.action || !odp.action.Result) {
                var a = (odp && odp.action) || {};
                throw new Error([a.Message, a.Description].filter(Boolean).join(' ') || 'Cart/Add: Result=false');
            }
            var c = odp.collection || {};
            if (global.ui && typeof global.ui.updateProductsInCart === 'function') {
                global.ui.updateProductsInCart(
                    c['customer.Cart.Count'], c['customer.Cart.Value'], c['customer.Cart.CurrencyExt.Symbol']);
            }
            return odp;
        });
    }

    function obsluzPozycje(pozycje) {
        ladujMape().then(function (mapa) {
            var doDodania = [], brak = [];
            pozycje.forEach(function (p) {
                var id = mapa.get(p.kod);
                if (id) doDodania.push({ id: id, ilosc: poprawIlosc(p.ilosc), kod: p.kod });
                else brak.push(p.kod);
            });
            log('do koszyka:', doDodania, 'brak w sklepie:', brak);

            if (brak.length) {
                popup('Części ' + brak.join(', ') + ' nie ma w sklepie. Zapytaj nas o dostępność.', 'info');
            }
            if (!doDodania.length) return;

            dodajDoKoszyka(doDodania).then(function () {
                popup('Dodano do koszyka: ' + doDodania.map(function (p) { return p.kod; }).join(', '), 'success');
            }, function (e) {
                console.warn('[xepc-koszyk] koszyk:', e.message || e);
                popup('Nie udało się dodać części do koszyka. ' + (e.message || ''), 'info');
            });
        });
    }

    // ── Odbiór wiadomości z iframe ───────────────────────────────────────────
    function znajdzIframe(zrodlo) {
        var ramki = document.querySelectorAll('iframe[src^="' + CONFIG.xepcOrigin + '"]');
        for (var i = 0; i < ramki.length; i++) {
            if (ramki[i].contentWindow === zrodlo) return ramki[i];
        }
        return null;
    }

    function naWiadomosc(e) {
        if (e.origin !== CONFIG.xepcOrigin) return;
        log('wiadomość:', e.data);

        // Katalog wysyła wysokość swojej treści jako liczbę.
        if (typeof e.data === 'number') {
            var ramka = CONFIG.autoWysokosc && znajdzIframe(e.source);
            if (ramka && e.data > 200) ramka.style.height = Math.ceil(e.data) + 'px';
            return;
        }

        var pozycje = wyciagnijPozycje(e.data);
        if (pozycje.length) obsluzPozycje(pozycje);
    }

    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('message', naWiadomosc);
        ladujMape();   // pobierz mapę zawczasu, żeby pierwsze kliknięcie było szybkie
    }

    global.XepcKoszyk = {
        config:           CONFIG,
        normalizujKod:    normalizujKod,
        wyciagnijPozycje: wyciagnijPozycje,
        ladujMape:        ladujMape
    };

})(typeof window !== 'undefined' ? window : globalThis);
