// =============================================================================
// XEPC -> KOSZYK  (xepc-koszyk.js)
// Łączy osadzony katalog Husqvarna (xEPC, iframe) z koszykiem Comarch e-Sklep.
//
// Jak działa:
//  1. Katalog w iframe wysyła wiadomości do strony (window.postMessage).
//  2. Skrypt przyjmuje tylko wiadomości z domeny katalogu Husqvarna.
//  3. Liczba = wysokość treści katalogu -> dopasowujemy wysokość iframe.
//  4. Inne wiadomości -> szukamy w nich numeru części i ilości,
//     wyszukiwarką sklepu zamieniamy numer na ID towaru w e-Sklepie
//     i dodajemy do koszyka tym samym wywołaniem, którego używa sklep (Cart/Add).
//
// Ładować na podstronie z katalogiem (husqvarna_katalog,37), PO skryptach sklepu:
//   <script src="/usr/xepc-koszyk.js"></script>
// =============================================================================

(function (global) {
    'use strict';

    var CONFIG = {
        xepcOrigin:   'https://xepc-prod.husqvarnagroup.com',
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
    // Katalog wysyła tekst "addToCart:<numer>$<ilość>". Na wypadek zmiany
    // formatu rozpoznajemy też typowe nazwy pól w obiektach/JSON
    // ({partNumber, qty}, {type, payload}, {items: [...]} itp.).
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
            // Format xEPC (sprawdzony 30.09.2026): "addToCart:547208801$1" = numer$ilość
            var xepc = /addToCart:([^$\s]+)\$(\d+(?:[.,]\d+)?)/gi, m, wynik = [];
            while ((m = xepc.exec(data)) !== null) {
                if (wygladaNaKod(m[1])) wynik.push({ kod: normalizujKod(m[1]), ilosc: parseFloat(m[2].replace(',', '.')) });
            }
            if (wynik.length) return wynik;

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

    // ── Numer części -> ID towaru w e-Sklepie ────────────────────────────────
    // ID w e-Sklepie to NIE jest Twr_TwrId z Optimy (to jest GIDNumber):
    //   589300801: e-Sklep Id 48426, GIDNumber 49120
    //   578443701: e-Sklep Id 3411,  GIDNumber 3411
    // Dlatego pytamy wyszukiwarkę sklepu (ta sama co w nagłówku) i bierzemy
    // tylko towar o identycznym Kodzie. Towar niewidoczny w sklepie = brak.
    //
    // Atrybuty: bez nich Cart/Add odpowiada "Przed dodaniem do koszyka wybierz
    // atrybuty towaru". Wysyłamy to samo co przycisk na karcie produktu:
    //  * atrybuty wielowartościowe (AttributesPolyvalent, np. KATEGORIA SPRZEDAŻY)
    //    -> attributeId: domyślna (pierwsza) wartość każdego atrybutu,
    //       np. bateria 529606802 -> [2927], brzeszczot 578443701 -> [2183,1893,2187,2931]
    //  * warianty (Attributes, np. "Modele Husqvarna:" przy kole 589300801)
    //    -> supplyId z data-supplies na karcie produktu, tylko gdy wariant jest jeden.
    var cacheProduktow = new Map();   // kod -> Promise<produkt | null>

    function listaProduktow(odp) {
        var c = odp && odp.collection;
        if (Array.isArray(c)) return c;
        if (c && Array.isArray(c['products.Products'])) return c['products.Products'];
        if (c && Array.isArray(c.Products)) return c.Products;
        return [];
    }

    function atrybutyWielowartosciowe(pr) {
        var lista = (pr.AttributesList && pr.AttributesList.AttributesPolyvalent) || [];
        return lista.map(function (a) {
            var v = a.Values && a.Values[0];
            return v && v.ValueId > 0 ? String(v.ValueId) : null;
        }).filter(Boolean);
    }

    function maWarianty(pr) {
        var a = pr.AttributesList && pr.AttributesList.Attributes;
        return !!(a && a.length);
    }

    function dekodujHtml(t) {
        return t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }

    // Warianty z karty produktu: <input id="supplyId" data-supplies="{...}">
    // Zwykły fetch, nie $.get: z nagłówkiem X-Requested-With (dodaje go jQuery)
    // sklep zwraca pusty JSON zamiast strony.
    function wariantyZeStrony(url) {
        return global.fetch(url, { credentials: 'same-origin' }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' @ ' + url);
            return res.text();
        }).then(function (html) {
            var m = /id="supplyId"[^>]*?data-supplies="([^"]*)"/.exec(String(html));
            if (!m) return [];
            var ids = [];
            (function przejdz(w) {
                (w.Supplies || []).forEach(function (x) {
                    if (x.SupplyId !== undefined) ids.push(String(x.SupplyId));
                    else przejdz(x);
                });
            })(JSON.parse(dekodujHtml(m[1])));
            return ids;
        });
    }

    function znajdzProdukt(kod) {
        if (cacheProduktow.has(kod)) return cacheProduktow.get(kod);
        var p = Promise.resolve(global.$.get(global.location.pathname, {
            __action: 'Get/SearchAutocomplete',
            search:   kod
        })).then(function (odp) {
            var url = odp && odp.action && odp.action.Result && odp.action.Redirect302;
            if (!url) return null;
            return global.$.get(url, { __collection: 'products.Products' });
        }).then(function (odp) {
            var pr = listaProduktow(odp).filter(function (x) {
                return normalizujKod(x.Code) === kod;
            })[0];
            if (!pr) return null;

            var produkt = {
                id:          Number(pr.Id),
                nazwa:       pr.NameNoHtml || kod,
                url:         pr.Url ? '/' + String(pr.Url).replace(/^\/+/, '') : null,
                attributeId: atrybutyWielowartosciowe(pr),
                supplyId:    null,
                doWyboru:    false   // kilka wariantów -> klient wybiera na karcie produktu
            };
            if (!maWarianty(pr) || !produkt.url) return produkt;

            return wariantyZeStrony(produkt.url).then(function (ids) {
                if (ids.length === 1) produkt.supplyId = ids[0];
                else produkt.doWyboru = true;
                return produkt;
            });
        }).then(function (produkt) {
            log('szukaj', kod, '->', produkt || 'brak');
            return produkt;
        }).catch(function (e) {
            console.warn('[xepc-koszyk] wyszukiwanie ' + kod + ':', (e && (e.statusText || e.message)) || e);
            cacheProduktow.delete(kod);   // błąd sieci -> spróbuj ponownie przy następnym kliknięciu
            return null;
        });
        cacheProduktow.set(kod, p);
        return p;
    }

    function znajdzIdProduktu(kod) {
        return znajdzProdukt(kod).then(function (p) { return p ? p.id : null; });
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
            var par = { productId: String(p.id), quantity: String(p.ilosc) };
            if (p.supplyId) par.supplyId = p.supplyId;
            if (p.attributeId && p.attributeId.length) par.attributeId = p.attributeId;
            return par;
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
        Promise.all(pozycje.map(function (p) { return znajdzProdukt(p.kod); })).then(function (produkty) {
            var doDodania = [], brak = [], doWyboru = [];
            pozycje.forEach(function (p, i) {
                var pr = produkty[i];
                if (!pr) brak.push(p.kod);
                else if (pr.doWyboru) doWyboru.push(pr);
                else doDodania.push({
                    id: pr.id, ilosc: poprawIlosc(p.ilosc), kod: p.kod,
                    attributeId: pr.attributeId, supplyId: pr.supplyId
                });
            });
            log('do koszyka:', doDodania, 'brak w sklepie:', brak, 'do wyboru wariantu:', doWyboru);

            if (brak.length) {
                popup('Części ' + brak.join(', ') + ' nie ma w sklepie. Zapytaj nas o dostępność.', 'info');
            }
            if (doWyboru.length) {
                popup('Wybierz wariant na karcie produktu: ' +
                    doWyboru.map(function (p) { return p.nazwa; }).join(', '), 'info');
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
    }

    global.XepcKoszyk = {
        config:           CONFIG,
        normalizujKod:    normalizujKod,
        wyciagnijPozycje: wyciagnijPozycje,
        znajdzIdProduktu: znajdzIdProduktu,
        znajdzProdukt:    znajdzProdukt
    };

})(typeof window !== 'undefined' ? window : globalThis);
