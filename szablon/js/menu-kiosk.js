// =============================================================================
// MENU KATEGORII JAK KIOSK (js/menu-kiosk.js) - 2026-10-01
// Menu „Kategorie” na telefonie (do 768 px) w układzie znanym z kiosków
// samoobsługowych: po lewej pionowy pasek kategorii ze zdjęciami, po prawej duże
// kafelki podkategorii. Kafelek z dalszymi podkategoriami otwiera kolejny ekran
// („‹ Wstecz”), każdy poziom ma przycisk „Zobacz wszystkie”.
// Nad kioskiem pasek „Producent”: po wyborze producenta zostają tylko kategorie,
// w których ma produkty, zdjęcia podmieniają się na jego produkty, a linki
// prowadzą do listy przefiltrowanej po producencie (/producent=<nazwa>/...).
// Dane bierzemy z menu sklepu (nav.mainCategories w .headerSection__categories__mobile),
// które zostaje w kodzie strony (ukryte) - linki i nazwy są zawsze aktualne.
// Zdjęcia kategorii i lista producentów: js/menu-kiosk-zdjecia.js. Wygląd: css/menu-kiosk.css.
// =============================================================================
(function () {
    'use strict';

    var MQ = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
    var KLUCZ = 'bs-kiosk-wybrana';
    var KLUCZ_PROD = 'bs-kiosk-producent';
    var KLUCZ_PAMIEC = 'bs-kiosk-producent-dane';
    var kiosk, pasek, szyna, scena, dane = null, wybrana = {}, grupaAktywna = 'gotowe';
    var producent = null;          // { n: nazwa, s: adres (slug) } albo null = wszyscy
    var wersja = 0;                // rośnie przy każdym przerysowaniu - stare odpowiedzi są pomijane
    var pamiec = {}, oczekujace = {}, kolejka = [], aktywne = 0;

    function naTelefonie() { return MQ ? MQ.matches : window.innerWidth <= 768; }
    function el(tag, klasa, tekst) {
        var e = document.createElement(tag);
        if (klasa) e.className = klasa;
        if (tekst !== undefined) e.textContent = tekst;
        return e;
    }
    function tekst(e) { return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : ''; }

    // „DO KOSIAREK” -> „Do kosiarek” (napisy wersalikami są trudne do czytania na kafelkach)
    function ladnie(t) {
        if (t && t === t.toUpperCase() && /[A-ZĄĆĘŁŃÓŚŹŻ]{3}/.test(t)) {
            t = t.toLowerCase();
            return t.charAt(0).toUpperCase() + t.slice(1);
        }
        return t;
    }
    // „Produkty Koszenie” -> „Koszenie” (grupę pokazuje przełącznik Produkty / Części)
    function krotko(t) { return t.replace(/^(Produkty|Części)\s+/i, '').replace(/^do\s/, 'Do '); }
    function sciezka(href) {
        try { return new URL(href, location.href).pathname.replace(/,.*$/, '').replace(/\/+$/, ''); } catch (e) { return ''; }
    }
    function katId(href) { return (String(href || '').match(/,2,(\d+)/) || [])[1] || ''; }
    // zdjęcie produktu dla kategorii (js/menu-kiosk-zdjecia.js), inaczej ikona z menu sklepu
    function zdjecie(href) {
        var id = katId(href);
        var v = id && window.KIOSK_ZDJECIA ? window.KIOSK_ZDJECIA[id] : null;
        if (!v) return '';
        return typeof v === 'number' ? '/img/medium/' + v : String(v);
    }
    function ga4(nazwa, p) { try { if (typeof window.ga4Wyslij === 'function') window.ga4Wyslij(nazwa, p); } catch (e) {} }

    // ── Producent ────────────────────────────────────────────────────────────
    function sciezkaBezProducenta(href) {
        try { return new URL(href, location.origin + '/').pathname.replace(/^\/producent=[^/]+/, ''); } catch (e) { return '/' + String(href || '').replace(/^\/+/, ''); }
    }
    // link kategorii przefiltrowany po wybranym producencie
    function link(href) {
        if (!producent) return href;
        return '/producent=' + producent.s + sciezkaBezProducenta(href);
    }
    function listaProducentow(grupa) { return ((window.KIOSK_PRODUCENCI || {})[grupa]) || []; }
    function znajdzProducenta(s) {
        var w = null;
        ['gotowe', 'czesci'].forEach(function (g) { listaProducentow(g).forEach(function (p) { if (!w && p[1] === s) w = { n: p[0], s: p[1] }; }); });
        return w;
    }

    function zapiszPamiec() { try { sessionStorage.setItem(KLUCZ_PAMIEC, JSON.stringify(pamiec)); } catch (e) {} }
    function wczytajPamiec() { try { pamiec = JSON.parse(sessionStorage.getItem(KLUCZ_PAMIEC) || '{}') || {}; } catch (e) { pamiec = {}; } }

    // najwyżej 4 zapytania naraz
    function wKolejce(fn) {
        return new Promise(function (ok, nie) {
            kolejka.push(function () {
                aktywne++;
                fn().then(function (w) { aktywne--; dalej(); ok(w); }, function (b) { aktywne--; dalej(); nie(b); });
            });
            dalej();
        });
    }
    function dalej() { while (aktywne < 4 && kolejka.length) kolejka.shift()(); }

    function pobierzJson(url) {
        if (window.jQuery) {
            return new Promise(function (ok, nie) {
                window.jQuery.ajax({ url: url, data: { __collection: 'products' }, dataType: 'json' }).then(ok, nie);
            });
        }
        return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '__collection=products', {
            credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        }).then(function (r) { return r.json(); });
    }

    // liczba produktów producenta w kategorii, zdjęcie i liczby w podkategoriach
    // Produkty: najdroższy z 50 najczęściej oglądanych (maszyna, nie akcesorium),
    // Części: najczęściej kupowana.
    function daneProducenta(href, grupa) {
        var s = producent.s, klucz = s + '|' + katId(href);
        if (pamiec[klucz]) return Promise.resolve(pamiec[klucz]);
        if (oczekujace[klucz]) return oczekujace[klucz];
        var url = '/producent=' + s + sciezkaBezProducenta(href) + '?sort=' + (grupa === 'czesci' ? 9 : 10);
        oczekujace[klucz] = wKolejce(function () { return pobierzJson(url); }).then(function (r) {
            var c = (r && r.collection) || {};
            var lista = (c.Products || []).filter(function (p) { return p.ImageId > 0; });
            var p = null;
            if (lista.length) p = grupa === 'czesci' ? lista[0] : lista.reduce(function (a, b) { return (b.Price || 0) > (a.Price || 0) ? b : a; });
            var wezly = {};
            ((c.FilteringOptions && c.FilteringOptions.Groups) || []).forEach(function (g) {
                (g.Nodes || []).forEach(function (n) {
                    var id = (String((n.Group && n.Group.Id) || '').match(/(\d+)$/) || [])[1];
                    if (id) wezly[id] = n.Count || 0;
                });
            });
            var w = { n: c.TotalItems || 0, img: p ? '/img/medium/' + p.ImageId : '', w: wezly };
            pamiec[klucz] = w;
            delete oczekujace[klucz];
            zapiszPamiec();
            return w;
        }, function () { delete oczekujace[klucz]; return null; });
        return oczekujace[klucz];
    }
    // czy podkategoria ma produkty producenta (wg liczb z kategorii nadrzędnej)
    function maProdukty(nadrzedna, href) {
        if (!nadrzedna) return true;
        var w = nadrzedna.w || {};
        if (!Object.keys(w).length) return nadrzedna.n > 0;
        return (w[katId(href)] || 0) > 0;
    }

    function rysujProducentow() {
        pasek.textContent = '';
        var lista = listaProducentow(grupaAktywna);
        if (!lista.length) { pasek.hidden = true; return; }
        pasek.hidden = false;
        pasek.appendChild(el('span', 'kiosk-prod__etyk', 'Producent:'));

        function chip(nazwa, p) {
            var b = el('button', 'kiosk-prod__chip', nazwa);
            b.type = 'button';
            var wyb = p ? (producent && producent.s === p.s) : !producent;
            b.setAttribute('aria-pressed', wyb ? 'true' : 'false');
            b.addEventListener('click', function () { wybierzProducenta(p); });
            pasek.appendChild(b);
            return b;
        }
        chip('Wszyscy', null);
        var NA_WIERZCHU = 6;
        var gora = lista.slice(0, NA_WIERZCHU);
        if (producent && !gora.some(function (p) { return p[1] === producent.s; })) chip(producent.n, producent);
        gora.forEach(function (p) { chip(p[0], { n: p[0], s: p[1] }); });

        var reszta = lista.slice(NA_WIERZCHU);
        if (reszta.length) {
            var sel = el('select', 'kiosk-prod__chip kiosk-prod__wiecej');
            sel.setAttribute('aria-label', 'Więcej producentów');
            var o0 = el('option', null, 'Więcej…');
            o0.value = '';
            sel.appendChild(o0);
            reszta.forEach(function (p) {
                var o = el('option', null, p[0]);
                o.value = p[1];
                sel.appendChild(o);
            });
            sel.addEventListener('change', function () {
                var p = znajdzProducenta(sel.value);
                if (p) wybierzProducenta(p);
            });
            pasek.appendChild(sel);
        }
        // wybrany producent ma być widoczny (przewijamy tylko pasek, nie całe menu)
        var akt = pasek.querySelector('[aria-pressed="true"]');
        if (akt && producent) {
            var ra = akt.getBoundingClientRect(), rp = pasek.getBoundingClientRect();
            if (ra.right > rp.right - 8) pasek.scrollLeft += ra.right - rp.right + 48;
        }
    }

    function wybierzProducenta(p) {
        producent = p || null;
        try { sessionStorage.setItem(KLUCZ_PROD, producent ? JSON.stringify(producent) : ''); } catch (e) {}
        ga4('menu_kiosk_producer', { producer: producent ? producent.n : 'wszyscy', menu_group: grupaAktywna });
        rysujProducentow();
        rysujSzyne();
        dopasujWysokosc();
    }

    // ── Dane z menu sklepu ───────────────────────────────────────────────────
    function czytajDane(nav) {
        var wynik = [];
        [].forEach.call(nav.querySelectorAll('.mainCategories__categories-wrapper'), function (w) {
            var a = w.querySelector('.mainCategories__category a.category-link');
            if (!a) return;
            var ikona = w.querySelector('.category-menu-icon');
            var kat = {
                grupa: w.getAttribute('data-group') || 'gotowe',
                nazwa: tekst(w.querySelector('.category-link__label')) || tekst(a),
                href: a.getAttribute('href'),
                ikona: zdjecie(a.getAttribute('href')) || (ikona ? (ikona.currentSrc || ikona.src) : ''),
                kolejnosc: parseInt(getComputedStyle(w).order, 10) || 0,
                pod: []
            };
            [].forEach.call(w.querySelectorAll('.subCategories__category-block'), function (b) {
                var pa = b.querySelector('.subCategories__undercategory a');
                if (!pa) return;
                var img = b.querySelector('.undercategory-menu-icon');
                var p = { nazwa: ladnie(tekst(pa)), href: pa.getAttribute('href'), dzieci: [] };
                p.ikona = zdjecie(p.href) || (img ? (img.getAttribute('src') || '') : '');
                [].forEach.call(b.querySelectorAll('.subCategories__underundercategory a'), function (da) {
                    var dh = da.getAttribute('href');
                    p.dzieci.push({ nazwa: ladnie(tekst(da)), href: dh, ikona: zdjecie(dh) });
                });
                kat.pod.push(p);
            });
            wynik.push(kat);
        });
        wynik.sort(function (x, y) { return x.kolejnosc - y.kolejnosc; });
        return wynik;
    }

    // ── Rysowanie ────────────────────────────────────────────────────────────
    function kategorieGrupy() {
        return dane.filter(function (k) { return k.grupa === grupaAktywna; });
    }

    function ustawZdjecie(img, src) {
        if (!img || !src) return;
        if (img.getAttribute('src') !== src) img.src = src;
    }

    function rysujSzyne() {
        var moja = ++wersja;
        szyna.textContent = '';
        var lista = kategorieGrupy();
        if (!lista.length) return;
        var aktualna = wybrana[grupaAktywna];
        if (!lista.some(function (k) { return k.href === aktualna; })) aktualna = domyslna(lista);
        wybrana[grupaAktywna] = aktualna;
        var przyciski = [];
        lista.forEach(function (k) {
            var b = el('button', 'kiosk-szyna__poz');
            b.type = 'button';
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-selected', k.href === aktualna ? 'true' : 'false');
            var img = el('img');
            img.alt = '';
            img.loading = 'lazy';
            if (k.ikona) img.src = k.ikona;
            else img.hidden = true;
            b.appendChild(img);
            b.appendChild(el('span', null, krotko(k.nazwa)));
            b.addEventListener('click', function () { wybierz(k, b, true); });
            szyna.appendChild(b);
            przyciski.push({ k: k, b: b, img: img });
        });

        function wybierz(k, b, animuj) {
            wybrana[grupaAktywna] = k.href;
            try { sessionStorage.setItem(KLUCZ, JSON.stringify(wybrana)); } catch (e) {}
            [].forEach.call(szyna.children, function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
            rysujPoziom2(k, animuj);
        }

        rysujPoziom2(lista.filter(function (k) { return k.href === aktualna; })[0], false);
        var sel = szyna.querySelector('[aria-selected="true"]');
        if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });

        if (!producent) return;
        // tryb producenta: chowamy kategorie bez jego produktów i podmieniamy zdjęcia
        var zostalo = przyciski.length;
        przyciski.forEach(function (x) {
            x.b.classList.add('kiosk-laduje');
            daneProducenta(x.k.href, x.k.grupa).then(function (w) {
                if (moja !== wersja) return;
                x.b.classList.remove('kiosk-laduje');
                if (w && !w.n) {
                    x.b.hidden = true;
                    if (x.b.getAttribute('aria-selected') === 'true') {
                        var nast = przyciski.filter(function (y) { return !y.b.hidden && !(pamiec[producent.s + '|' + katId(y.k.href)] && !pamiec[producent.s + '|' + katId(y.k.href)].n); })[0];
                        if (nast) wybierz(nast.k, nast.b, false);
                    }
                } else if (w && w.img) {
                    x.img.hidden = false;
                    ustawZdjecie(x.img, w.img);
                }
                if (--zostalo === 0 && !przyciski.some(function (y) { return !y.b.hidden; })) {
                    var e = ekran();
                    e.appendChild(el('p', 'kiosk-pusto', 'Brak produktów marki ' + producent.n + ' w tej grupie. Wybierz innego producenta lub „Wszyscy”.'));
                    pokaz(e, null);
                }
            });
        });
    }

    // kategoria bieżącej strony, ostatnio wybrana albo pierwsza
    function domyslna(lista) {
        var tu = location.pathname.replace(/,.*$/, '').replace(/^\/producent=[^/]+/, '');
        var pasuje = lista.filter(function (k) {
            var s = sciezka(k.href);
            return s && (tu === s || tu.indexOf(s + '/') === 0);
        })[0];
        return (pasuje || lista[0]).href;
    }

    function naglowek(tytul, wszystkieHref, wszystkieTekst, wstecz) {
        var h = el('div', 'kiosk-glowa');
        if (wstecz) {
            var w = el('button', 'kiosk-wstecz', '‹ Wstecz');
            w.type = 'button';
            w.addEventListener('click', wstecz);
            h.appendChild(w);
        }
        h.appendChild(el('h3', 'kiosk-glowa__tytul', tytul));
        var a = el('a', 'kiosk-wszystkie', wszystkieTekst);
        a.href = link(wszystkieHref);
        a.addEventListener('click', function () { ga4('menu_kiosk_click', { menu_level: wstecz ? 2 : 1, menu_item: tytul + ' (wszystkie)', producer: producent ? producent.n : '' }); });
        h.appendChild(a);
        if (producent) h.appendChild(el('span', 'kiosk-glowa__marka', producent.n));
        return h;
    }

    function kafelek(p, poziom, onClick) {
        var a = el(onClick ? 'button' : 'a', 'kiosk-kafel' + (p.ikona || producent ? '' : ' kiosk-kafel--tekst'));
        if (onClick) { a.type = 'button'; a.addEventListener('click', onClick); }
        else {
            a.href = link(p.href);
            a.addEventListener('click', function () { ga4('menu_kiosk_click', { menu_level: poziom, menu_item: p.nazwa, producer: producent ? producent.n : '' }); });
        }
        var f = el('span', 'kiosk-kafel__foto');
        var img = el('img');
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = function () { f.classList.add('kiosk-kafel__foto--brak'); };
        img.onload = function () { f.classList.remove('kiosk-kafel__foto--brak'); };
        if (p.ikona) img.src = p.ikona;
        else f.classList.add('kiosk-kafel__foto--brak');
        f.appendChild(img);
        a.appendChild(f);
        a.appendChild(el('span', 'kiosk-kafel__nazwa', p.nazwa));
        a._img = img;
        a._foto = f;
        return a;
    }

    // tryb producenta: ukryj kafelki bez jego produktów, podmień zdjęcia
    function kafelkiProducenta(nadrzednyHref, grupa, kafelki, ekranEl, moja) {
        if (!producent) return;
        kafelki.forEach(function (x) { x.a.classList.add('kiosk-laduje'); });
        daneProducenta(nadrzednyHref, grupa).then(function (nad) {
            if (moja !== wersja) return;
            var widoczne = 0;
            kafelki.forEach(function (x) {
                if (nad && !maProdukty(nad, x.p.href)) { x.a.classList.remove('kiosk-laduje'); x.a.hidden = true; return; }
                widoczne++;
                daneProducenta(x.p.href, grupa).then(function (w) {
                    if (moja !== wersja) return;
                    x.a.classList.remove('kiosk-laduje');
                    if (w && !w.n) { x.a.hidden = true; return; }
                    if (w && w.img) {
                        x.a.classList.remove('kiosk-kafel--tekst');
                        ustawZdjecie(x.a._img, w.img);
                    } else if (!x.p.ikona) {
                        x.a.classList.add('kiosk-kafel--tekst');
                    }
                });
            });
            if (!widoczne) {
                ekranEl.appendChild(el('p', 'kiosk-pusto', 'Brak produktów marki ' + producent.n + ' w tej kategorii.'));
            }
        });
    }

    function ekran(klasa) {
        var e = el('div', 'kiosk-ekran ' + (klasa || ''));
        return e;
    }

    function pokaz(nowy, kierunek) {
        var stary = scena.querySelector('.kiosk-ekran');
        scena.appendChild(nowy);
        if (stary) {
            if (kierunek) {
                nowy.classList.add('kiosk-wjazd-' + kierunek);
                void nowy.offsetWidth;
                nowy.classList.remove('kiosk-wjazd-' + kierunek);
            }
            stary.remove();
        }
        scena.scrollTop = 0;
    }

    function rysujPoziom2(k, animuj) {
        if (!k) return;
        var moja = wersja;
        var e = ekran();
        e.appendChild(naglowek(krotko(k.nazwa), k.href, 'Zobacz wszystkie ›'));
        var siatka = el('div', 'kiosk-siatka');
        var kafelki = [];
        k.pod.forEach(function (p) {
            var a = kafelek(p, 2, p.dzieci.length ? function () { rysujPoziom3(k, p); } : null);
            siatka.appendChild(a);
            kafelki.push({ p: p, a: a });
        });
        e.appendChild(siatka);
        pokaz(e, animuj ? 'gora' : null);
        kafelkiProducenta(k.href, k.grupa, kafelki, e, moja);
    }

    function rysujPoziom3(k, p) {
        var moja = wersja;
        var e = ekran();
        e.appendChild(naglowek(p.nazwa, p.href, 'Wszystkie ›', function () { rysujPoziom2(k, false); }));
        var zFoto = producent || p.dzieci.some(function (d) { return d.ikona; });
        var siatka = el('div', 'kiosk-siatka' + (zFoto ? '' : ' kiosk-siatka--tekst'));
        var kafelki = [];
        p.dzieci.forEach(function (d) {
            var a = kafelek(d, 3, null);
            siatka.appendChild(a);
            kafelki.push({ p: d, a: a });
        });
        e.appendChild(siatka);
        pokaz(e, 'prawo');
        kafelkiProducenta(p.href, k.grupa, kafelki, e, moja);
        ga4('menu_kiosk_open', { menu_item: p.nazwa });
    }

    // ── Wysokość: kiosk wypełnia ekran menu do dolnej krawędzi ───────────────
    function dopasujWysokosc() {
        if (!kiosk || !kiosk.offsetParent) return;
        var panel = kiosk.closest('.headerSection__mainMenu');
        var dol = panel ? panel.getBoundingClientRect().bottom : window.innerHeight;
        var menuDolne = document.querySelector('.bottomMenu');
        if (menuDolne && menuDolne.offsetParent) dol = Math.min(dol, menuDolne.getBoundingClientRect().top);
        var gora = kiosk.getBoundingClientRect().top + (panel ? panel.scrollTop : 0) - (panel ? panel.getBoundingClientRect().top : 0);
        var h = Math.round(dol - (panel ? panel.getBoundingClientRect().top : 0) - gora - 8);
        kiosk.style.height = Math.max(380, h) + 'px';
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function grupaZPrzelacznika() {
        var b = document.querySelector('.headerSection__categories__mobile .mobileCategorySwitcher__btn.is-active');
        return (b && b.getAttribute('data-group-target')) || 'gotowe';
    }

    function startowyProducent() {
        try {
            var z = sessionStorage.getItem(KLUCZ_PROD);
            if (z) return JSON.parse(z);
            if (z === '') return null;
        } catch (e) {}
        // strona przefiltrowana po producencie (/producent=husqvarna/...) - zaczynamy od niego
        var m = location.pathname.match(/^\/producent=([^/]+)/);
        return m ? znajdzProducenta(decodeURIComponent(m[1])) : null;
    }

    function zbuduj() {
        if (!naTelefonie()) return;
        var mob = document.querySelector('.headerSection__categories__mobile');
        var nav = mob && mob.querySelector('nav.mainCategories');
        if (!nav || !nav.querySelector('.mainCategories__categories-wrapper')) return;
        if (kiosk && mob.contains(kiosk)) { grupaAktywna = grupaZPrzelacznika(); rysujProducentow(); rysujSzyne(); dopasujWysokosc(); return; }

        dane = czytajDane(nav);
        if (!dane.length) return;
        try { wybrana = JSON.parse(sessionStorage.getItem(KLUCZ) || '{}') || {}; } catch (e) { wybrana = {}; }
        wczytajPamiec();
        producent = startowyProducent();
        grupaAktywna = grupaZPrzelacznika();

        pasek = el('div', 'kiosk-prod');
        pasek.setAttribute('role', 'group');
        pasek.setAttribute('aria-label', 'Producent');
        kiosk = el('div', 'kiosk');
        szyna = el('div', 'kiosk-szyna');
        szyna.setAttribute('role', 'tablist');
        szyna.setAttribute('aria-label', 'Kategorie');
        scena = el('div', 'kiosk-scena');
        kiosk.appendChild(szyna);
        kiosk.appendChild(scena);
        nav.parentNode.insertBefore(kiosk, nav.nextSibling);
        nav.parentNode.insertBefore(pasek, kiosk);
        document.documentElement.classList.add('kiosk-on');
        rysujProducentow();
        rysujSzyne();
        dopasujWysokosc();

        // przełącznik Produkty / Części
        mob.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('.mobileCategorySwitcher__btn')) {
                setTimeout(function () { grupaAktywna = grupaZPrzelacznika(); rysujProducentow(); rysujSzyne(); dopasujWysokosc(); }, 0);
            }
        });
    }

    function poOtwarciuMenu() { setTimeout(zbuduj, 50); setTimeout(dopasujWysokosc, 400); }

    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.showBottomMenuSection-js, .showMenuSection-js')) poOtwarciuMenu();
    });
    window.addEventListener('resize', function () { setTimeout(dopasujWysokosc, 100); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(zbuduj, 300); });
    else setTimeout(zbuduj, 300);
    window.addEventListener('load', function () { setTimeout(zbuduj, 300); });
})();
