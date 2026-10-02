// =============================================================================
// LINK DO KOSZYKA  (koszyk-link.js)
// 1. Strona koszyka: przycisk „Kopiuj link do koszyka” kopiuje do schowka link
//    z produktami i ilościami.
// 2. Otwarcie linku: produkty trafiają do koszyka osoby, która go otworzyła
//    (dopisują się do tego, co już ma), potem otwiera się koszyk.
//
// Link zawiera tylko kody towarów (jak w Optimie) i ilości – bez cen i danych klienta:
//   https://www.betkowskiservice.pl/zamowienie,4#koszyk=970541501:1,529606802:2
// Taki link można też napisać ręcznie z kodów towarów. Opcjonalnie wariant:
//   kod:ilość:w<supplyId>, np. 589300801:1:w48426
// Ceny są zawsze aktualne w chwili otwarcia linku (link nie zapamiętuje cen).
//
// Ładować w szablonie całego sklepu:
//   <script src="/usr/koszyk-link.js"></script>
// =============================================================================

(function () {
    'use strict';

    var STRONA_KOSZYKA = '/zamowienie,4';
    var PARAMETR = 'koszyk';
    var MAX_POZYCJI = 60;
    var MAX_ILOSC = 9999;
    var KLUCZ_ZROBIONE = 'bs-koszyk-link-dodany';

    var NAPIS = 'Kopiuj link do koszyka';
    var CSS =
        '.koszyk-link{display:block;width:100%;margin:12px 0;padding:10px 14px;border:1px solid #22355c;border-radius:8px;' +
            'background:#fff;color:#22355c;font-family:Poppins,sans-serif;font-size:14px;font-weight:600;cursor:pointer}' +
        '.koszyk-link:hover{background:#eef2f8}.koszyk-link[disabled]{opacity:.6;cursor:default}';

    function log() { try { console.info.apply(console, ['[koszyk-link]'].concat([].slice.call(arguments))); } catch (e) {} }
    function produktow(n) {
        var d = n % 10, s = n % 100;
        return n + (n === 1 ? ' produkt' : (d >= 2 && d <= 4 && (s < 12 || s > 14)) ? ' produkty' : ' produktów');
    }
    function kodNorm(v) { return String(v == null ? '' : v).toUpperCase().replace(/[\s.\-\/]/g, ''); }
    function naKoszyku() { return /(^|\/)zamowienie,4/.test(location.pathname); }
    function popup(tekst, typ, czas) {
        if (window.app && typeof window.app.showTemporaryPopup === 'function') window.app.showTemporaryPopup(tekst, typ || 'info', null, czas || 4000);
        else alert(tekst.replace(/<br>/g, '\n'));
    }
    function jsonSklepu(url) {
        return fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' } })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }

    // ── Link: zapis i odczyt ─────────────────────────────────────────────────
    function zbudujLink(pozycje) {
        var czesci = pozycje.map(function (p) {
            return encodeURIComponent(p.kod) + ':' + p.ilosc + (p.wariant ? ':w' + p.wariant : '');
        });
        return location.origin + STRONA_KOSZYKA + '#' + PARAMETR + '=' + czesci.join(',');
    }
    function pozycjeZLinku() {
        var m = location.hash.match(new RegExp('[#&]' + PARAMETR + '=([^&]+)'));
        if (!m) return null;
        var wynik = [];
        m[1].split(',').slice(0, MAX_POZYCJI).forEach(function (cz) {
            var p = cz.split(':');
            var kod = '';
            try { kod = decodeURIComponent(p[0] || '').trim(); } catch (e) { return; }
            var ilosc = parseFloat(String(p[1] || '1').replace(',', '.'));
            if (!kod || !(ilosc > 0)) return;
            var w = (p[2] || '').match(/^w(\d+)$/);
            wynik.push({ kod: kod, ilosc: Math.min(ilosc, MAX_ILOSC), wariant: w ? w[1] : null });
        });
        return { surowy: m[1], pozycje: wynik };
    }

    // ── 1. Strona koszyka: pozycje i przycisk ────────────────────────────────
    // Pozycje z danych koszyka sklepu (?__collection=cart); gdy brak kodu towaru –
    // kod (sku) z karty produktu.
    function pozycjeKoszyka() {
        return jsonSklepu(location.pathname + '?__collection=cart').then(function (r) {
            var c = (r && r.collection) || {};
            var lista = c.Products || [];
            return Promise.all(lista.map(function (p) {
                var pr = p.Product || p;
                var ilosc = Number(p.Quantity != null ? p.Quantity : (p.BasicUnitQuantity != null ? p.BasicUnitQuantity : 1));
                var wariant = p.SupplyId || (p.Supply && p.Supply.Id) || null;
                var kod = pr.Code || p.Code;
                var poz = { kod: kod, ilosc: ilosc > 0 ? ilosc : 1, wariant: wariant > 0 ? String(wariant) : null, nazwa: pr.NameNoHtml || p.NameNoHtml || '' };
                if (kod) return poz;
                var url = pr.Url || p.Url;
                if (!url) return null;
                return kodZKarty('/' + String(url).replace(/^\/+/, '')).then(function (k) { poz.kod = k; return k ? poz : null; });
            }));
        }).then(function (lista) { return lista.filter(Boolean); });
    }
    function kodZKarty(url) {
        return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
            var m = String(html).match(/"sku"\s*:\s*"([^"]+)"/);
            return m ? m[1] : null;
        }).catch(function () { return null; });
    }

    function przyciskKoszyka() {
        if (document.querySelector('.koszyk-link')) return;
        var cel = document.querySelector('.cart__summary-js, .summaryDetailsContainer-js, .summaryDetails, .summaryCart');
        var kont = document.querySelector('main .cartOuterContainer');
        if (!cel && !kont) return;
        // pusty koszyk – bez przycisku
        if (!document.querySelector('.js-product, .cart__list-item--products')) return;

        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'koszyk-link';
        b.textContent = NAPIS;
        // na końcu podsumowania (pod przyciskiem zamówienia), a bez niego – pod koszykiem
        (cel || kont).appendChild(b);

        b.addEventListener('click', function () {
            b.disabled = true;
            pozycjeKoszyka().then(function (pozycje) {
                if (!pozycje.length) throw new Error('brak pozycji');
                var link = zbudujLink(pozycje);
                return kopiuj(link).then(function () {
                    napis(b, 'Skopiowano ✓');
                    if (typeof window.ga4Wyslij === 'function') try { window.ga4Wyslij('cart_link_copy', { items: pozycje.length }); } catch (e) {}
                }, function () {
                    // schowek zablokowany – link do ręcznego skopiowania
                    window.prompt('Skopiuj link do koszyka:', link);
                    napis(b, NAPIS);
                });
            }).catch(function (e) {
                log('błąd', e);
                napis(b, 'Nie udało się – spróbuj ponownie');
            });
        });
    }
    function napis(b, t) {
        b.disabled = false;
        b.textContent = t;
        clearTimeout(b.__t);
        if (t !== NAPIS) b.__t = setTimeout(function () { b.textContent = NAPIS; }, 2500);
    }
    function kopiuj(tekst) {
        if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(tekst);
        return new Promise(function (ok, nie) {
            var t = document.createElement('textarea');
            t.value = tekst;
            t.style.cssText = 'position:fixed;top:-1000px;opacity:0';
            document.body.appendChild(t);
            t.select();
            var udane = false;
            try { udane = document.execCommand('copy'); } catch (e) {}
            t.remove();
            if (udane) ok(); else nie();
        });
    }

    // ── 2. Otwarcie linku: produkty do koszyka ───────────────────────────────
    // Wyszukiwarka sklepu (?search=, znajduje też towary bez zdjęcia), tylko identyczny kod.
    // Atrybuty jak przy przycisku „Do koszyka”: pierwsza wartość każdego atrybutu
    // wielowartościowego; wariant z karty produktu, gdy jest jeden (kilka – klient wybiera sam).
    function znajdz(kod) {
        return jsonSklepu('/produkty,2?search=' + encodeURIComponent(kod) + '&__collection=products.Products').then(function (r) {
            var c = r && r.collection;
            var lista = Array.isArray(c) ? c : (c && (c['products.Products'] || c.Products)) || [];
            var pr = lista.filter(function (x) { return kodNorm(x.Code) === kodNorm(kod); })[0];
            if (!pr) return null;
            var al = pr.AttributesList || {};
            return {
                id: String(pr.Id), nazwa: pr.NameNoHtml || kod,
                url: pr.Url ? '/' + String(pr.Url).replace(/^\/+/, '') : null,
                attributeId: (al.AttributesPolyvalent || []).map(function (a) {
                    var v = a.Values && a.Values[0];
                    return v && v.ValueId > 0 ? String(v.ValueId) : null;
                }).filter(Boolean),
                warianty: !!(al.Attributes && al.Attributes.length)
            };
        }).catch(function () { return null; });
    }
    function wariantyZKarty(url) {
        // zwykły fetch (bez X-Requested-With) – z tym nagłówkiem sklep zwraca pusty JSON
        return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.text(); }).then(function (html) {
            var m = /id="supplyId"[^>]*?data-supplies="([^"]*)"/.exec(String(html));
            if (!m) return [];
            var t = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            var ids = [];
            (function przejdz(w) {
                (w.Supplies || []).forEach(function (x) { if (x.SupplyId !== undefined) ids.push(String(x.SupplyId)); else przejdz(x); });
            })(JSON.parse(t));
            return ids;
        }).catch(function () { return []; });
    }
    function parametr(poz, pr) {
        var p = { productId: pr.id, quantity: String(poz.ilosc) };
        if (pr.attributeId.length) p.attributeId = pr.attributeId;
        if (pr.supplyId) p.supplyId = pr.supplyId;
        return p;
    }
    function cartAdd(parametry) {
        return window.$.post(null, {
            __action: 'Cart/Add',
            __csrf: window.__CSRF,
            __parameters: JSON.stringify(parametry),
            __collection: 'customer.Cart.Count|customer.Cart.Value|customer.Cart.CurrencyExt'
        }).then(function (odp) {
            if (!odp || !odp.action || !odp.action.Result) {
                var a = (odp && odp.action) || {};
                throw new Error([a.Message, a.Description].filter(Boolean).join(' ') || 'Cart/Add: Result=false');
            }
            return odp;
        });
    }

    function dodajZLinku(dane) {
        var pozycje = dane.pozycje;
        // ten sam link w tej karcie dodajemy tylko raz (np. odświeżenie strony)
        try {
            if (sessionStorage.getItem(KLUCZ_ZROBIONE) === dane.surowy) {
                usunZAdresu();
                popup('Produkty z tego linku są już w koszyku.', 'info', 3500);
                return;
            }
        } catch (e) {}
        if (!pozycje.length) { usunZAdresu(); return; }
        if (!window.$ || !window.__CSRF) { log('brak jQuery/__CSRF – nie dodaję'); return; }
        popup('Dodaję do koszyka produkty z linku (' + pozycje.length + ')…', 'info', 3000);

        Promise.all(pozycje.map(function (poz) {
            return znajdz(poz.kod).then(function (pr) {
                if (!pr) return { poz: poz, brak: true };
                if (poz.wariant) { pr.supplyId = poz.wariant; return { poz: poz, pr: pr }; }
                if (!pr.warianty || !pr.url) return { poz: poz, pr: pr };
                return wariantyZKarty(pr.url).then(function (ids) {
                    if (ids.length === 1) pr.supplyId = ids[0];
                    else if (ids.length > 1) return { poz: poz, pr: pr, doWyboru: true };
                    return { poz: poz, pr: pr };
                });
            });
        })).then(function (wyniki) {
            var doDodania = wyniki.filter(function (w) { return w.pr && !w.doWyboru; });
            var brak = wyniki.filter(function (w) { return w.brak; }).map(function (w) { return w.poz.kod; });
            var wybor = wyniki.filter(function (w) { return w.doWyboru; });
            var nieudane = [];
            // najpierw wszystko naraz; gdy sklep odrzuci – po jednej pozycji
            var dodaj = doDodania.length ? cartAdd(doDodania.map(function (w) { return parametr(w.poz, w.pr); }))
                .then(function () { return doDodania; }, function (e) {
                    log('dodawanie razem nieudane, po kolei:', e.message);
                    var ok = [];
                    return doDodania.reduce(function (pr, w) {
                        return pr.then(function () {
                            return cartAdd([parametr(w.poz, w.pr)]).then(function () { ok.push(w); }, function (e2) {
                                nieudane.push(w.pr.nazwa + (e2.message ? ' (' + e2.message + ')' : ''));
                            });
                        });
                    }, Promise.resolve()).then(function () { return ok; });
                }) : Promise.resolve([]);
            return dodaj.then(function (ok) {
                try { sessionStorage.setItem(KLUCZ_ZROBIONE, dane.surowy); } catch (e) {}
                var tekst = [];
                if (ok.length) tekst.push('Dodano do koszyka: ' + produktow(ok.length) + '.');
                if (brak.length) tekst.push('Nie ma w sklepie: ' + brak.join(', ') + '.');
                if (wybor.length) tekst.push('Wybierz wariant na karcie produktu: ' + wybor.map(function (w) { return w.pr.nazwa; }).join(', ') + '.');
                if (nieudane.length) tekst.push('Nie udało się dodać: ' + nieudane.join(', ') + '.');
                popup(tekst.join('<br>') || 'Brak produktów do dodania.', ok.length ? 'success' : 'info', 4500);
                if (typeof window.ga4Wyslij === 'function') try { window.ga4Wyslij('cart_link_open', { items: pozycje.length, added: ok.length }); } catch (e) {}
                usunZAdresu();
                // koszyk pokazuje nowe produkty po wczytaniu strony
                setTimeout(function () {
                    if (naKoszyku()) location.reload();
                    else if (ok.length) location.assign(STRONA_KOSZYKA);
                }, wybor.length || brak.length || nieudane.length ? 5000 : 2000);
            });
        });
    }
    function usunZAdresu() {
        try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function start() {
        var dane = pozycjeZLinku();
        if (dane) { dodajZLinku(dane); return; }
        if (!naKoszyku()) return;
        var st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        przyciskKoszyka();
        // koszyk sklep przebudowuje po zmianach (ilość, dostawa) – przycisk wraca
        if (window.MutationObserver) {
            var t = null;
            new MutationObserver(function () {
                clearTimeout(t);
                t = setTimeout(przyciskKoszyka, 300);
            }).observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
        }
    }

    // po pełnym wczytaniu: potrzebne jQuery, __CSRF i app.showTemporaryPopup sklepu
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
    // link otwarty na już wczytanej stronie (zmiana tylko #)
    window.addEventListener('hashchange', function () { var d = pozycjeZLinku(); if (d) dodajZLinku(d); });
})();
