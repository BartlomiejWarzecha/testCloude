// =============================================================================
// FILTRY NA TELEFONIE (js/mobile-filters.js) - 2026-10-01
// Panel filtrów listy produktów (Comarch: .product-list__filters) na ekranach
// do 768 px zamienia się w pełnoekranową szufladę:
//  * pasek nad listą: przycisk „Filtry (liczba)” obok „Sortuj”, aktywne filtry
//    jako przewijane „pigułki”,
//  * grupy filtrów jako rozwijane sekcje z liczbą zaznaczonych, wyszukiwarka
//    w długich listach (np. marki), cena z polami od / do,
//  * jeden przycisk „Pokaż wyniki” na dole zamiast „Zastosuj” w każdej grupie,
//    „Wyczyść” u góry; zamknięcie bez zastosowania przywraca poprzedni wybór.
// Filtrowanie robi nadal sklep: zaznaczamy te same pola i klikamy jego
// „Zastosuj” (.productsList__filters--setValues), które pobiera wyniki (AJAX).
// Wygląd: css/mobile-filters.css. Na komputerze nic się nie zmienia.
// =============================================================================
(function () {
    'use strict';

    var MQ = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
    var MIN_DO_SZUKANIA = 9;     // od ilu opcji w grupie pokazujemy pole „Szukaj…”
    var DOMYSLNIE_OTWARTE = 2;   // ile pierwszych grup jest rozwiniętych

    var panel, lista, przyciskFiltry, licznikFiltry, licznikWynikow, przyciskWyniki, plywajacy, licznikPlywajacy;
    var otwarty = false, migawka = null;

    function naTelefonie() { return MQ ? MQ.matches : window.innerWidth <= 768; }
    function el(tag, klasa, tekst) {
        var e = document.createElement(tag);
        if (klasa) e.className = klasa;
        if (tekst !== undefined) e.textContent = tekst;
        return e;
    }
    function jq() { return window.jQuery || window.$; }

    // ── Stan filtrów ─────────────────────────────────────────────────────────
    function cena() {
        var min = panel.querySelector('.productsList__priceSlider__minPrice-js');
        var max = panel.querySelector('.productsList__priceSlider__maxPrice-js');
        if (!min || !max) return null;
        return {
            min: min, max: max,
            od: Number(min.value), do: Number(max.value),
            dolna: Number(min.getAttribute('min')), gorna: Number(max.getAttribute('max'))
        };
    }

    function ileAktywnych() {
        var n = panel.querySelectorAll('.filter-input:checked').length;
        var c = cena();
        if (c && (c.od > c.dolna || c.do < c.gorna)) n++;
        return n;
    }

    function zrobMigawke() {
        var c = cena();
        return {
            zaznaczone: [].map.call(panel.querySelectorAll('.filter-input:checked'), function (i) { return i.id; }),
            cena: c ? [c.od, c.do] : null
        };
    }

    function przywroc(m) {
        if (!m) return;
        [].forEach.call(panel.querySelectorAll('.filter-input'), function (i) {
            var ma = m.zaznaczone.indexOf(i.id) >= 0;
            if (i.checked !== ma) i.checked = ma;
            var kont = i.closest('.filter');
            if (kont) kont.classList.toggle('custom-checkbox--checked', ma);
        });
        if (m.cena) ustawCene(m.cena[0], m.cena[1]);
        odswiez();
    }

    // ── Cena: suwak sklepu (jQuery UI) + pola od / do ────────────────────────
    function ustawCene(od, doo) {
        var c = cena();
        if (!c) return;
        od = Math.max(c.dolna, Math.min(Number(od) || c.dolna, c.gorna));
        doo = Math.max(c.dolna, Math.min(Number(doo) || c.gorna, c.gorna));
        if (od > doo) { var t = od; od = doo; doo = t; }
        c.min.value = od;
        c.max.value = doo;
        var z = panel.querySelector('.productsList__priceSlider__from-js');
        var d = panel.querySelector('.productsList__priceSlider__to-js');
        if (z) z.textContent = od;
        if (d) d.textContent = doo;
        var $ = jq(), s = panel.querySelector('.productsList__priceSlider-js');
        try { if ($ && s && $(s).slider) $(s).slider('values', [od, doo]); } catch (e) { /* suwak jeszcze nie gotowy */ }
        polaCeny();
    }

    function polaCeny() {
        var c = cena();
        var od = panel.querySelector('.mf-cena__od'), doo = panel.querySelector('.mf-cena__do');
        if (!c || !od || !doo) return;
        if (document.activeElement !== od) od.value = c.od;
        if (document.activeElement !== doo) doo.value = c.do;
    }

    function dodajPolaCeny(grupa) {
        if (grupa.querySelector('.mf-cena')) return;
        var c = cena();
        if (!c) return;
        var w = el('div', 'mf-cena');
        function pole(klasa, etykieta) {
            var l = el('label', 'mf-cena__pole');
            l.appendChild(el('span', null, etykieta));
            var i = el('input', klasa);
            i.type = 'number';
            i.inputMode = 'numeric';
            i.min = c.dolna;
            i.max = c.gorna;
            i.addEventListener('change', function () {
                var od = panel.querySelector('.mf-cena__od').value, doo = panel.querySelector('.mf-cena__do').value;
                ustawCene(od, doo);
                odswiez();
            });
            l.appendChild(i);
            l.appendChild(el('span', 'mf-cena__zl', 'zł'));
            return l;
        }
        w.appendChild(pole('mf-cena__od', 'od'));
        w.appendChild(el('span', 'mf-cena__kreska', '–'));
        w.appendChild(pole('mf-cena__do', 'do'));
        var tag = grupa.querySelector('.price-filter__tag-wrapper');
        (tag || grupa).parentNode.insertBefore(w, tag ? tag.nextSibling : null);
        polaCeny();
        var $ = jq(), s = grupa.querySelector('.productsList__priceSlider-js');
        if ($ && s) $(s).on('slide slidechange slidestop', function () { setTimeout(function () { polaCeny(); odswiez(); }, 0); });
    }

    // ── Grupy jako rozwijane sekcje ──────────────────────────────────────────
    function tytulGrupy(g) { return g.querySelector('.price-filter__title, .filter-group__title'); }

    function przygotujGrupy() {
        var grupy = panel.querySelectorAll('.filter-group-wrapper');
        [].forEach.call(grupy, function (g, i) {
            if (g.getAttribute('data-mf')) return;
            g.setAttribute('data-mf', '1');
            var t = tytulGrupy(g);
            if (!t) return;
            t.classList.add('mf-tytul');
            t.setAttribute('role', 'button');
            t.setAttribute('tabindex', '0');
            var znaczek = el('span', 'mf-tytul__ile');
            t.appendChild(znaczek);
            function przelacz() {
                g.classList.toggle('mf-otwarta');
                t.setAttribute('aria-expanded', g.classList.contains('mf-otwarta') ? 'true' : 'false');
            }
            t.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); przelacz(); });
            t.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); przelacz(); }
            });
            var maZaznaczone = !!g.querySelector('.filter-input:checked');
            var otworz = i < DOMYSLNIE_OTWARTE || maZaznaczone;
            g.classList.toggle('mf-otwarta', otworz);
            t.setAttribute('aria-expanded', otworz ? 'true' : 'false');

            if (g.classList.contains('price-filter')) dodajPolaCeny(g);

            // wyszukiwarka w długich listach (marki itp.)
            var opcje = g.querySelectorAll('.filter:not(.hidden)');
            if (opcje.length >= MIN_DO_SZUKANIA && !g.querySelector('.mf-szukaj')) {
                var li = el('li', 'mf-szukaj');
                var inp = el('input');
                inp.type = 'search';
                inp.placeholder = 'Szukaj: ' + t.firstChild.textContent.trim().toLowerCase() + '…';
                inp.setAttribute('aria-label', inp.placeholder);
                inp.addEventListener('input', function () {
                    var q = inp.value.trim().toLowerCase();
                    [].forEach.call(g.querySelectorAll('.filter'), function (o) {
                        var txt = (o.textContent || '').toLowerCase();
                        o.classList.toggle('mf-ukryta', !!q && txt.indexOf(q) < 0);
                    });
                });
                inp.addEventListener('click', function (e) { e.stopPropagation(); });
                li.appendChild(inp);
                t.parentNode.insertBefore(li, t.nextSibling);
            }
        });
    }

    // ── Licznik, pigułki ─────────────────────────────────────────────────────
    function odswiez() {
        if (!panel) return;
        var n = ileAktywnych();
        if (licznikFiltry) { licznikFiltry.textContent = n; licznikFiltry.hidden = !n; }
        if (licznikPlywajacy) { licznikPlywajacy.textContent = n; licznikPlywajacy.hidden = !n; }
        if (przyciskFiltry) przyciskFiltry.setAttribute('aria-label', 'Filtry' + (n ? ' (' + n + ' aktywne)' : ''));
        if (licznikWynikow) licznikWynikow.textContent = n ? 'Wybrane filtry: ' + n : 'Nie wybrano filtrów';
        [].forEach.call(panel.querySelectorAll('.filter-group-wrapper'), function (g) {
            var z = g.querySelector('.mf-tytul__ile');
            if (!z) return;
            var ile = g.querySelectorAll('.filter-input:checked').length;
            if (g.classList.contains('price-filter')) {
                var c = cena();
                ile = c && (c.od > c.dolna || c.do < c.gorna) ? 1 : 0;
            }
            z.textContent = ile ? String(ile) : '';
            z.hidden = !ile;
        });
    }

    // ── Szuflada ─────────────────────────────────────────────────────────────
    function zbudujSzuflade() {
        if (panel.querySelector('.mf-glowa')) return;
        var glowa = el('div', 'mf-glowa');
        glowa.appendChild(el('span', 'mf-glowa__tytul', 'Filtry'));
        var wyczysc = el('button', 'mf-wyczysc', 'Wyczyść');
        wyczysc.type = 'button';
        wyczysc.addEventListener('click', function () {
            [].forEach.call(panel.querySelectorAll('.filter-input:checked'), function (i) {
                i.checked = false;
                var k = i.closest('.filter');
                if (k) k.classList.remove('custom-checkbox--checked');
            });
            var c = cena();
            if (c) ustawCene(c.dolna, c.gorna);
            odswiez();
        });
        var x = el('button', 'mf-zamknij', '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Zamknij filtry');
        x.addEventListener('click', function () { zamknij(false); });
        glowa.appendChild(wyczysc);
        glowa.appendChild(x);
        panel.insertBefore(glowa, panel.firstChild);

        var stopka = el('div', 'mf-stopka');
        licznikWynikow = el('span', 'mf-stopka__info');
        przyciskWyniki = el('button', 'mf-pokaz', 'Pokaż wyniki');
        przyciskWyniki.type = 'button';
        przyciskWyniki.addEventListener('click', zastosuj);
        stopka.appendChild(licznikWynikow);
        stopka.appendChild(przyciskWyniki);
        panel.appendChild(stopka);
    }

    function otworz() {
        if (otwarty) return;
        przygotujGrupy();
        zbudujSzuflade();
        migawka = zrobMigawke();
        otwarty = true;
        document.documentElement.classList.add('mf-otwarte');
        polaCeny();
        odswiez();
        var x = panel.querySelector('.mf-zamknij');
        if (x) x.focus();
        if (typeof window.ga4Wyslij === 'function') window.ga4Wyslij('filters_open', { active_filters: ileAktywnych() });
    }

    function zamknij(zostaw) {
        if (!otwarty) return;
        otwarty = false;
        document.documentElement.classList.remove('mf-otwarte');
        if (!zostaw) przywroc(migawka);
        migawka = null;
        if (przyciskFiltry) przyciskFiltry.focus();
    }

    function zastosuj() {
        var btn = panel.querySelector('.productsList__filters--setValues');
        var n = ileAktywnych();
        zamknij(true);
        if (btn) btn.click();
        if (typeof window.ga4Wyslij === 'function') window.ga4Wyslij('filters_apply', { active_filters: n });
    }

    // ── Pasek nad listą: „Filtry” obok „Sortuj” ─────────────────────────────
    function zbudujPasek() {
        if (document.querySelector('.mf-filtry')) return;
        var wiersz = document.querySelector('.display-details .display-details__sorting');
        wiersz = wiersz && wiersz.parentNode;
        if (!wiersz) return;
        przyciskFiltry = el('button', 'mf-filtry');
        przyciskFiltry.type = 'button';
        var ik = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
        przyciskFiltry.innerHTML = ik;
        przyciskFiltry.appendChild(el('span', 'mf-filtry__tekst', 'Filtry'));
        licznikFiltry = el('span', 'mf-filtry__ile');
        przyciskFiltry.appendChild(licznikFiltry);
        przyciskFiltry.addEventListener('click', otworz);
        wiersz.insertBefore(przyciskFiltry, wiersz.firstChild);
        wiersz.classList.add('mf-wiersz');

        // Pływający przycisk „Filtry” - gdy pasek nad listą zniknie z ekranu (przewinięta lista)
        plywajacy = el('button', 'mf-plywajacy');
        plywajacy.type = 'button';
        plywajacy.innerHTML = ik;
        plywajacy.appendChild(el('span', null, 'Filtry'));
        licznikPlywajacy = el('span', 'mf-filtry__ile');
        plywajacy.appendChild(licznikPlywajacy);
        plywajacy.addEventListener('click', otworz);
        document.body.appendChild(plywajacy);
        if (window.IntersectionObserver) {
            new IntersectionObserver(function (wpisy) {
                var w = wpisy[0];
                // pokazujemy tylko, gdy pasek jest nad ekranem (lista przewinięta w dół)
                plywajacy.classList.toggle('mf-widoczny', !w.isIntersecting && w.boundingClientRect.top < 0);
            }).observe(wiersz);
        }

        // „Sortuj:” + wybrany sposób sortowania
        var sort = wiersz.querySelector('.display-details__sorting');
        var tytul = sort && sort.querySelector('.display-details__title');
        if (tytul && !sort.querySelector('.mf-sort')) {
            var wybrane = el('span', 'mf-sort');
            tytul.parentNode.insertBefore(wybrane, tytul.nextSibling);
            var ustaw = function () {
                var s = sort.querySelector('.dropdown-menu__selected');
                wybrane.textContent = s ? s.textContent.trim() : '';
            };
            ustaw();
            sort.addEventListener('click', function () { setTimeout(ustaw, 50); setTimeout(ustaw, 1500); });
        }
    }

    // ── Start ────────────────────────────────────────────────────────────────
    var uruchomione = false;

    function start() {
        if (uruchomione) return;
        // tylko na telefonie; po obróceniu / zwężeniu okna uruchamiamy później
        if (!naTelefonie()) {
            if (MQ && MQ.addEventListener) MQ.addEventListener('change', function poZmianie() {
                if (naTelefonie()) { MQ.removeEventListener('change', poZmianie); start(); }
            });
            return;
        }
        panel = document.querySelector('.product-list__filters.searchFilters-js');
        if (!panel || !panel.querySelector('.filter-group-wrapper')) return;
        uruchomione = true;
        lista = panel.closest('.product-list-js');
        document.documentElement.classList.add('mf-on');
        zbudujPasek();
        przygotujGrupy();
        odswiez();

        // zmiany w filtrach (zaznaczenia, przeładowanie liczników po AJAX)
        panel.addEventListener('click', function () { setTimeout(odswiez, 0); });
        new MutationObserver(function () { odswiez(); polaCeny(); })
            .observe(panel, { subtree: true, attributes: true, attributeFilter: ['value', 'checked', 'disabled', 'class'] });
        // pigułki aktywnych filtrów / „Usuń wszystkie”: sklep reaguje tylko na krzyżyk (svg),
        // a na telefonie cała pigułka wygląda jak przycisk - przekazujemy klik do krzyżyka
        document.addEventListener('click', function (e) {
            var p = e.target.closest && e.target.closest('.removeFilter-js, #reset-filters');
            if (!p) return;
            if (!e.target.closest('svg')) {
                var x = p.querySelector('svg');
                if (x) x.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
            setTimeout(odswiez, 1500);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && otwarty) zamknij(false); });
        if (MQ && MQ.addEventListener) MQ.addEventListener('change', function () { if (!naTelefonie()) zamknij(false); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
