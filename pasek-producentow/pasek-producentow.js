// =============================================================================
// PASEK PRODUCENTÓW  (pasek-producentow.js)
// 1. Strona główna: rząd logo producentów nad banerem (.hero-slider). Kliknięcie
//    otwiera stronę kategorii (/produkty,2) z wybranym producentem.
// 2. Strona kategorii /produkty,2: ten sam pasek nad okruszkami – jak pasek
//    „Producent” w menu na telefonie (js/menu-kiosk.js). Po wyborze producenta
//    zostają tylko kategorie z jego produktami, zdjęcia kafelków
//    pokazują jego produkty, a linki prowadzą do listy przefiltrowanej
//    (/producent=<adres>/produkty/...,2,<id>). Dalej filtr trzymają sklep i
//    js/kafle-kategorii.js. Wybór jest wspólny z menu na telefonie i komputerze
//    (sessionStorage „bs-kiosk-producent”), dane kategorii też
//    (localStorage „bs-kiosk-producent-dane”).
//
// 3. Pozostałe strony na komputerze (lista kategorii, karta produktu, strony
//    informacyjne): pasek nad okruszkami (bieżącą ścieżką). Na liście kategorii przełącza
//    producenta w bieżącej kategorii i ukrywa producentów bez produktów w niej;
//    gdzie indziej prowadzi do /produkty,2 z wybranym producentem. Bez paska
//    w koszyku, zamówieniu, na koncie i przy logowaniu.
//
// Ładować w szablonie całego sklepu:
//   <script src="/usr/pasek-producentow.js"></script>
//
// Logo: pliki z folderu logo/ (pasek-logo-*.png/.jpg) wgraj do /usr/.
// Producent z "logo" pokazuje obrazek (nazwa zostaje jako tekst alternatywny),
// bez "logo" – nazwę. Gdy pliku nie ma na serwerze, też wraca do nazwy.
// =============================================================================

(function () {
    'use strict';

    var TYTUL = 'Producenci';
    var KATALOG_LOGO = '/usr/';
    var STRONA_KATEGORII = '/produkty,2';
    // wspólne z menu sklepu (js/menu-kiosk.js, js/menu-desktop.js)
    var KLUCZ_PROD = 'bs-kiosk-producent';
    var KLUCZ_PAMIEC = 'bs-kiosk-producent-dane';
    var KLUCZ_MARKA = 'bs-pasek-marka';
    var WAZNOSC = 12 * 3600 * 1000;

    // s = adres producenta w sklepie (/producent=<s>/...). Nieznany adres sklep
    // po cichu pomija i pokazuje wszystkie produkty, więc adresy są sprawdzone
    // na danych sklepu (02.10.2026, liczba produktów zgodna z producentem).
    // Kawasaki i Kohler (silniki) oraz FJD (FJDynamics) są w sklepie tylko marką: marka = adres marki (/marka=<marka>/...).
    // Kolejność = kolejność na pasku.
    var PRODUCENCI = [
        { nazwa: 'Husqvarna',         s: 'husqvarna',       logo: 'pasek-logo-husqvarna.png' },
        { nazwa: 'Emeralld',          s: 'emeralld',        logo: 'pasek-logo-emeralld.png' },
        { nazwa: 'FJD',               marka: 'fjdynamics',  logo: 'pasek-logo-fjd.png' },
        { nazwa: 'Gardena',           s: 'gardena',         logo: 'pasek-logo-gardena.png' },
        { nazwa: 'Stiga',             s: 'stiga',           logo: 'pasek-logo-stiga.png' },
        { nazwa: 'John Deere',        s: 'john-deere',      logo: 'pasek-logo-john-deere.png' },
        { nazwa: 'AL-KO',             s: 'al-ko',           logo: 'pasek-logo-al-ko.png' },
        { nazwa: 'Cedrus',            s: 'cedrus',          logo: 'pasek-logo-cedrus.png' },
        { nazwa: 'Honda',             s: 'honda',           logo: 'pasek-logo-honda.png' },
        { nazwa: 'Briggs & Stratton', s: 'briggs-stratton', logo: 'pasek-logo-briggs-and-stratton.png' },
        { nazwa: 'Kawasaki',          marka: 'kawasaki',    logo: 'pasek-logo-kawasaki.png' },
        { nazwa: 'Kohler',            marka: 'kohler',      logo: 'pasek-logo-kohler.png' },
        { nazwa: 'Stihl',             s: 'stihl',           logo: 'pasek-logo-stihl.png' },
        { nazwa: 'Oregon',            s: 'oregon',          logo: 'pasek-logo-oregon.png' },
        { nazwa: 'Karcher',           s: 'karcher',         logo: 'pasek-logo-karcher.png' },
        { nazwa: 'Cub Cadet',         s: 'cub-cadet',       logo: 'pasek-logo-cub-cadet.png' },
        { nazwa: 'MTD',               s: 'mtd' },
        { nazwa: 'Wiedenmann',        s: 'wiedenmann',      logo: 'pasek-logo-wiedenmann.png' },
        { nazwa: 'WOLF-Garten',       s: 'wolf-garten',     logo: 'pasek-logo-wolf-garten.png' },
        { nazwa: 'Fiskars',           s: 'fiskars',         logo: 'pasek-logo-fiskars.png' },
        { nazwa: 'Milwaukee',         s: 'milwaukee',       logo: 'pasek-logo-milwaukee.png' },
        { nazwa: 'GKB Machines',      s: 'gkb-machines',    logo: 'pasek-logo-gkb-machines.png' },
        { nazwa: 'Weibang',           s: 'weibang',         logo: 'pasek-logo-weibang.png' },
        { nazwa: 'Loncin',            s: 'loncin' },
        { nazwa: 'Samasz',            s: 'samasz',          logo: 'pasek-logo-samasz.png' },
        { nazwa: 'Agritec',           s: 'agritec',         logo: 'pasek-logo-agritec.png' },
        { nazwa: 'Bradas',            s: 'bradas',          logo: 'pasek-logo-bradas.png' },
        { nazwa: 'Cramer',            s: 'cramer' },
        { nazwa: 'Garden Parts',      s: 'garden-parts',    logo: 'pasek-logo-garden-parts.jpg' },
        { nazwa: 'Kramp',             s: 'kramp',           logo: 'pasek-logo-kramp.png' },
        { nazwa: 'RDM Parts',         s: 'rdm-parts',       logo: 'pasek-logo-rdm-parts.png' },
        { nazwa: 'Stalco',            s: 'stalco',          logo: 'pasek-logo-stalco.png' },
        { nazwa: 'Walbro',            s: 'walbro',          logo: 'pasek-logo-walbro.png' },
        { nazwa: 'Zama',              s: 'zama',            logo: 'pasek-logo-zama.png' }
    ];

    var CSS =
        '.pasek-prod{display:flex;align-items:center;gap:12px;margin:0 auto 24px;box-sizing:border-box;font-family:Poppins,sans-serif}' +
        '.pasek-prod__tytul{flex:0 0 auto;font-size:14px;font-weight:600;color:#1d2433;white-space:nowrap}' +
        '.pasek-prod__okno{position:relative;flex:1 1 auto;min-width:0}' +
        '.pasek-prod__lista{display:flex;flex-wrap:nowrap;gap:8px;overflow-x:auto;scroll-behavior:smooth;scroll-snap-type:x proximity;' +
            'scrollbar-width:none;padding:2px;margin:0;list-style:none}' +
        '.pasek-prod__lista::-webkit-scrollbar{display:none}' +
        '.pasek-prod__lista li{flex:0 0 auto;scroll-snap-align:start}' +
        '.pasek-prod__link{display:flex;align-items:center;justify-content:center;height:40px;padding:0 16px;box-sizing:border-box;' +
            'border:1px solid #dcdfe4;border-radius:8px;background:#fff;color:#1d2433;font-size:14px;font-weight:600;' +
            'text-decoration:none;white-space:nowrap;transition:border-color .15s,background .15s}' +
        '.pasek-prod__link:hover,.pasek-prod__link:focus-visible{border-color:#22355c;color:#22355c;outline:none;box-shadow:0 1px 4px rgba(34,53,92,.15)}' +
        '.pasek-prod__link[aria-current="true"]{border-color:#22355c;box-shadow:inset 0 0 0 1px #22355c;background:#eef2f8;color:#22355c}' +
        '.pasek-prod__link--logo{padding:0 14px}' +
        '.pasek-prod__link img{max-height:28px;max-width:110px;width:auto;height:auto;display:block}' +
        '.pasek-prod__strzalka{flex:0 0 auto;width:36px;height:36px;border:1px solid #dcdfe4;border-radius:50%;background:#fff;' +
            'color:#1d2433;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0}' +
        '.pasek-prod__strzalka:hover{border-color:#22355c;color:#22355c}' +
        '.pasek-prod__strzalka[disabled]{opacity:.35;cursor:default}' +
        '.pasek-prod__okno::after{content:"";position:absolute;top:0;right:0;bottom:0;width:32px;pointer-events:none;' +
            'background:linear-gradient(to right,rgba(255,255,255,0),#fff)}' +
        '.pasek-prod--miesci .pasek-prod__strzalka{display:none}' +
        '.pasek-prod--miesci .pasek-prod__okno::after,.pasek-prod--koniec .pasek-prod__okno::after{display:none}' +
        // strona kategorii
        '.pasek-prod-kat{margin:0 0 20px;font-family:Poppins,sans-serif}' +
        '.pasek-prod-strona{padding:4px 0 16px}.pasek-prod-strona .pasek-prod{margin:0}.pasek-prod-strona .pasek-prod-kat{margin:0}' +
        '.pasek-prod__lista li[hidden]{display:none}' +
        '.pasek-prod-kat .pasek-prod{margin:0}' +
        '.pasek-prod__info{margin:10px 0 0;font-size:14px;color:#4a5263;line-height:1.5;text-align:left}' +
        '.pasek-prod__info b{color:#1d2433}' +
        '.pasek-prod__info a{color:#22355c;font-weight:600;text-decoration:underline;margin-left:12px;white-space:nowrap}' +
        '.product-list__categories-wrapper.pp-laduje{opacity:.45;pointer-events:none}' +
        '.product-list__categories-wrapper{transition:opacity .2s}' +
        'img.pp-foto{object-fit:contain!important;background:#fff}' +
        '@media (max-width:768px){.pasek-prod{gap:8px;margin-bottom:16px;padding:0 16px}' +
            '.pasek-prod__tytul,.pasek-prod__strzalka{display:none}' +
            '.pasek-prod__link{height:36px;padding:0 12px;font-size:13px}' +
            '.pasek-prod__link img{max-height:22px;max-width:90px}' +
            '.pasek-prod-kat{margin-bottom:14px}.pasek-prod-kat .pasek-prod{padding:0}.pasek-prod-strona{display:none}' +
            '.pasek-prod-strona.pasek-prod-strona--kat{display:block;padding:0 16px 12px}' +
            '.pasek-prod__info{font-size:13px}.pasek-prod__info a{display:inline-block;margin:4px 12px 0 0}}';

    // ── Wspólne ──────────────────────────────────────────────────────────────
    function filtr(p) { return p.marka ? 'marka=' + p.marka : 'producent=' + p.s; }
    function katId(href) { return (String(href || '').match(/,2,(\d+)/) || [])[1] || ''; }
    // „produkty/koszenie,2,39165” bez filtrów i ukośnika na początku
    function sciezka(href) {
        var p;
        try { p = new URL(href, location.origin + '/').pathname; } catch (e) { p = String(href || ''); }
        return p.split('/').filter(function (s) { return s && s.indexOf('=') < 0; }).join('/');
    }
    function ga4(nazwa, p) { try { if (typeof window.ga4Wyslij === 'function') window.ga4Wyslij(nazwa, p); } catch (e) {} }
    function produktow(n) {
        var d = n % 10, s = n % 100;
        return n + (n === 1 ? ' produkt' : (d >= 2 && d <= 4 && (s < 12 || s > 14)) ? ' produkty' : ' produktów');
    }

    function dodajCss() {
        if (document.getElementById('pasek-prod-css')) return;
        var st = document.createElement('style');
        st.id = 'pasek-prod-css';
        st.textContent = CSS;
        document.head.appendChild(st);
    }

    // lista: producenci; naKlik(p, a) – opcjonalnie (strona kategorii), p = null to „Wszyscy”.
    // opcje (inne strony): adres(p) – link przycisku, wszyscy – przycisk „Wszyscy”,
    // tytul, strona – nazwa strony do GA4, przed(p) – przed przejściem pod link
    function zbuduj(lista, naKlik, opcje) {
        opcje = opcje || {};
        var pasek = document.createElement('nav');
        pasek.className = 'pasek-prod';
        pasek.setAttribute('aria-label', TYTUL);

        var tytul = document.createElement('span');
        tytul.className = 'pasek-prod__tytul';
        tytul.textContent = (opcje.tytul || (naKlik ? 'Producent' : TYTUL)) + ':';

        var okno = document.createElement('div');
        okno.className = 'pasek-prod__okno';
        var ul = document.createElement('ul');
        ul.className = 'pasek-prod__lista';

        function dodaj(p) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.className = 'pasek-prod__link';
            a.href = opcje.adres ? opcje.adres(p) : STRONA_KATEGORII + (p ? '#' + filtr(p) : '');
            a.setAttribute('data-f', p ? filtr(p) : '');
            li.setAttribute('data-f', p ? filtr(p) : '');
            if (p && p.logo) {
                var img = document.createElement('img');
                img.alt = p.nazwa; img.title = p.nazwa; img.loading = 'lazy';
                img.onerror = function () { a.className = 'pasek-prod__link'; a.textContent = p.nazwa; };
                img.src = KATALOG_LOGO + p.logo;
                a.className += ' pasek-prod__link--logo';
                a.setAttribute('aria-label', p.nazwa);
                a.appendChild(img);
            } else {
                a.textContent = p ? p.nazwa : 'Wszyscy';
            }
            a.addEventListener('click', function (e) {
                if (naKlik) { e.preventDefault(); naKlik(p, a); return; }
                ga4('producer_bar_click', { producer: p ? p.nazwa : 'wszyscy', page: opcje.strona || 'glowna' });
                if (opcje.przed) opcje.przed(p);
            });
            li.appendChild(a);
            ul.appendChild(li);
        }
        if (naKlik || opcje.wszyscy) dodaj(null);
        lista.forEach(dodaj);
        okno.appendChild(ul);

        function strzalka(znak, kierunek, etykieta) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pasek-prod__strzalka';
            b.setAttribute('aria-label', etykieta);
            b.textContent = znak;
            b.addEventListener('click', function () {
                ul.scrollBy({ left: kierunek * Math.max(200, ul.clientWidth * 0.8), behavior: 'smooth' });
            });
            return b;
        }
        var lewa = strzalka('‹', -1, 'Przewiń w lewo'), prawa = strzalka('›', 1, 'Przewiń w prawo');
        // Przewijanie tylko gdy lista się nie mieści – inaczej bez strzałek i cieniowania.
        function odswiezStrzalki() {
            var miesci = ul.scrollWidth <= ul.clientWidth + 2;
            var koniec = ul.scrollLeft + ul.clientWidth >= ul.scrollWidth - 2;
            pasek.classList.toggle('pasek-prod--miesci', miesci);
            pasek.classList.toggle('pasek-prod--koniec', koniec);
            lewa.disabled = ul.scrollLeft <= 2;
            prawa.disabled = koniec;
        }
        ul.addEventListener('scroll', odswiezStrzalki, { passive: true });
        window.addEventListener('resize', odswiezStrzalki);
        ul.addEventListener('load', odswiezStrzalki, true);   // logo doczytane = zmiana szerokości

        // zaznaczenie wybranego producenta (f = filtr albo '' dla „Wszyscy”) i przewinięcie do niego
        function zaznacz(f) {
            var akt = null;
            [].forEach.call(ul.querySelectorAll('.pasek-prod__link'), function (a) {
                var on = a.getAttribute('data-f') === f;
                if (on) { a.setAttribute('aria-current', 'true'); akt = a; } else a.removeAttribute('aria-current');
            });
            if (akt) {
                var cel = Math.max(0, akt.parentNode.offsetLeft - (ul.clientWidth - akt.offsetWidth) / 2);
                try { ul.scrollTo({ left: cel, behavior: 'smooth' }); } catch (e) { ul.scrollLeft = cel; }
            }
        }

        pasek.appendChild(tytul);
        pasek.appendChild(lewa);
        pasek.appendChild(okno);
        pasek.appendChild(prawa);
        return { el: pasek, lista: ul, odswiez: odswiezStrzalki, zaznacz: zaznacz };
    }

    // ── 1. Strona główna ─────────────────────────────────────────────────────
    function startGlowna(slider) {
        dodajCss();
        var p = zbuduj(PRODUCENCI, null);
        var kontener = slider.closest('.gridContainer');
        var wrap = document.createElement('div');
        wrap.style.order = '0';
        wrap.appendChild(p.el);
        kontener.insertBefore(wrap, kontener.firstChild);

        // Szerokość i położenie jak baner (krawędzie równo z banerem).
        function dopasuj() {
            if (window.innerWidth <= 768) { p.el.style.width = ''; p.el.style.marginLeft = ''; p.odswiez(); return; }
            var s = slider.getBoundingClientRect(), k = kontener.getBoundingClientRect();
            p.el.style.width = Math.round(s.width) + 'px';
            p.el.style.marginLeft = Math.round(s.left - k.left) + 'px';
            p.odswiez();
        }
        dopasuj();
        window.addEventListener('resize', dopasuj);
        window.addEventListener('load', dopasuj);
    }

    // ── 2. Strona kategorii: dane producenta w kategorii ─────────────────────
    // Ten sam format i te same reguły co js/menu-kiosk.js (daneProducenta), więc
    // pamięć jest wspólna: { n: liczba produktów, img, imgs: zdjęcia, w: liczby w podkategoriach, t }.
    var pamiec = {};
    function wczytajPamiec() {
        var wynik = {};
        try {
            var z = JSON.parse(localStorage.getItem(KLUCZ_PAMIEC) || '{}') || {}, teraz = Date.now();
            Object.keys(z).forEach(function (k) { if (z[k] && z[k].t && teraz - z[k].t < WAZNOSC) wynik[k] = z[k]; });
        } catch (e) {}
        return wynik;
    }
    var zapisTimer = null;
    function zapiszPamiec() {
        clearTimeout(zapisTimer);
        zapisTimer = setTimeout(function () {
            try {
                // dopisujemy do tego, co mogło w międzyczasie zapisać menu
                var razem = wczytajPamiec();
                Object.keys(pamiec).forEach(function (k) { if (k.indexOf('=') < 0) razem[k] = pamiec[k]; });
                localStorage.setItem(KLUCZ_PAMIEC, JSON.stringify(razem));
            } catch (e) {}
        }, 400);
    }
    function zly(id) { return (window.KIOSK_ZNAK_WODNY || []).indexOf(id) >= 0; }
    // bez ciasteczek sesji: zapytania idą równolegle (jak w menu sklepu)
    function pobierzJson(url) {
        return fetch(url + (url.indexOf('?') < 0 ? '?' : '&') + '__collection=products', {
            credentials: 'omit', headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
    }
    function daneKategorii(p, href) {
        // klucz jak w menu („husqvarna|39165”); marki osobno, tylko w tej sesji strony
        var klucz = (p.marka ? 'marka=' + p.marka : p.s) + '|' + katId(href);
        if (pamiec[klucz]) return Promise.resolve(pamiec[klucz]);
        var czesci = /(^|\/)czesci-/.test(sciezka(href));
        var url = '/' + filtr(p) + '/' + sciezka(href) + '?sort=' + (czesci ? 9 : 10);
        return pobierzJson(url).then(function (r) {
            var c = (r && r.collection) || {};
            var lista = (c.Products || []).filter(function (x) { return x.ImageId > 0 && !zly(x.ImageId); });
            if (!czesci) lista = lista.slice().sort(function (a, b) { return (b.Price || 0) - (a.Price || 0); });
            lista = lista.slice().sort(function (a, b) { return (b.ImageId >= 20000 ? 1 : 0) - (a.ImageId >= 20000 ? 1 : 0); });
            var zdjecia = lista.slice(0, 4).map(function (x) { return '/img/large/' + x.ImageId; });
            var wezly = {};
            ((c.FilteringOptions && c.FilteringOptions.Groups) || []).forEach(function (g) {
                (g.Nodes || []).forEach(function (n) {
                    var id = (String((n.Group && n.Group.Id) || '').match(/(\d+)$/) || [])[1];
                    if (id) wezly[id] = n.Count || 0;
                });
            });
            var w = { n: c.TotalItems || 0, img: zdjecia[0] || '', imgs: zdjecia, w: wezly, t: Date.now() };
            pamiec[klucz] = w;
            if (!p.marka) zapiszPamiec();
            return w;
        }, function () { return null; });
    }
    function liczbaWszystkich(p) {
        return pobierzJson('/' + filtr(p) + STRONA_KATEGORII).then(function (r) {
            return ((r && r.collection) || {}).TotalItems || 0;
        }, function () { return null; });
    }

    // ── 2. Strona kategorii: kafelki ─────────────────────────────────────────
    function startKategorie(wrap) {
        var kafle = [].map.call(wrap.querySelectorAll('a.category-main-link'), function (a) {
            return { a: a, href: a.getAttribute('href') };
        });
        if (!kafle.length) return;
        dodajCss();
        pamiec = wczytajPamiec();

        var wybrany = startowy();
        var lista = PRODUCENCI.slice();
        // producent wybrany w menu, którego nie ma na pasku – dokładamy go na początek
        if (wybrany && !lista.some(function (x) { return filtr(x) === filtr(wybrany); })) lista.unshift(wybrany);

        var box = document.createElement('div');
        box.className = 'pasek-prod-kat';
        var pasek = zbuduj(lista, function (p) { wybierz(p, true); });
        pasek.el.classList.add('pasek-prod--kat');
        var info = document.createElement('div');
        info.className = 'pasek-prod__info';
        info.setAttribute('aria-live', 'polite');
        info.hidden = true;
        box.appendChild(pasek.el);
        box.appendChild(info);
        var okruszki = document.querySelector('main section.breadcrumbs-wrapper');
        if (okruszki) nadOkruszkami(okruszki, box, pasek, 'pasek-prod-strona--kat');
        else wrap.parentNode.insertBefore(box, wrap);
        pasek.odswiez();
        window.addEventListener('load', pasek.odswiez);

        var wersja = 0;
        function wybierz(p, zKlikniecia) {
            var moja = ++wersja;
            zapamietaj(p);
            pasek.zaznacz(p ? filtr(p) : '');
            if (zKlikniecia) ga4('producer_bar_click', { producer: p ? p.nazwa : 'wszyscy', page: 'kategorie' });
            if (!p) {
                kafle.forEach(przywroc);
                info.hidden = true;
                wrap.classList.remove('pp-laduje');
                return;
            }
            wrap.classList.add('pp-laduje');
            var czekaj = kafle.map(function (k) { return daneKategorii(p, k.href); });
            czekaj.push(liczbaWszystkich(p));
            Promise.all(czekaj).then(function (wyniki) {
                if (moja !== wersja) return;   // w międzyczasie wybrano innego producenta
                var razem = wyniki.pop(), kategorii = 0;
                kafle.forEach(function (k, i) {
                    var w = wyniki[i];
                    if (w && !w.n) { k.a.style.display = 'none'; return; }
                    kategorii++;
                    pokaz(k, p, w);
                });
                opisz(p, razem, kategorii);
                wrap.classList.remove('pp-laduje');
            });
        }

        function zapisz(k) {
            if (k.org) return;
            var img = k.a.querySelector('img');
            k.org = { href: k.href, src: img ? img.getAttribute('src') : null, klasa: img ? img.className : '' };
        }
        function pokaz(k, p, w) {
            zapisz(k);
            k.a.style.display = '';
            k.a.setAttribute('href', '/' + filtr(p) + '/' + sciezka(k.href));
            if (w && w.imgs && w.imgs.length) ustawZdjecie(k, w.imgs);
        }
        function przywroc(k) {
            k.a.style.display = '';
            if (!k.org) return;
            k.a.setAttribute('href', k.org.href);
            var img = k.a.querySelector('img');
            if (img && k.org.src !== null) {
                img.onerror = null;
                img.className = k.org.klasa;
                img.src = k.org.src;
            }
        }
        // zdjęcie produktu producenta; gdy się nie wczyta – następne, na końcu zdjęcie kategorii
        function ustawZdjecie(k, zrodla) {
            var img = k.a.querySelector('img');
            if (!img) {   // custom.js usuwa obrazek, gdy kategoria nie ma zdjęcia
                var kont = k.a.querySelector('.product-list__category-list-element-imgContainer');
                if (!kont) return;
                img = document.createElement('img');
                img.alt = 'Zdjęcie kategorii';
                img.className = 'product-list__category-list-element-img';
                kont.appendChild(img);
            }
            var i = 0;
            function nastepne() {
                if (i >= zrodla.length) {
                    img.onerror = null;
                    img.className = k.org.klasa;
                    if (k.org.src !== null) img.src = k.org.src;
                    return;
                }
                img.src = zrodla[i++];
            }
            img.onerror = nastepne;
            img.onload = function () { if (img.naturalWidth <= 2 && img.classList.contains('pp-foto')) nastepne(); };
            img.className = 'product-list__category-list-element-img pp-foto';
            nastepne();
        }
        function opisz(p, razem, kategorii) {
            info.textContent = '';
            var b = document.createElement('b');
            b.textContent = p.nazwa;
            info.appendChild(b);
            info.appendChild(document.createTextNode(kategorii
                ? ': ' + (razem ? produktow(razem) + ' w ' : '') + kategorii + (kategorii === 1 ? ' kategorii' : ' kategoriach')
                : ': brak produktów w sklepie'));
            if (kategorii) {
                var wsz = document.createElement('a');
                wsz.href = '/' + filtr(p) + STRONA_KATEGORII;
                wsz.textContent = 'Wszystkie produkty ' + p.nazwa;
                info.appendChild(wsz);
            }
            var x = document.createElement('a');
            x.href = STRONA_KATEGORII;
            x.textContent = 'Wszyscy producenci';
            x.addEventListener('click', function (e) { e.preventDefault(); wybierz(null, true); });
            info.appendChild(x);
            info.hidden = false;
        }

        // po wszystkich skryptach startowych sklepu (custom.js ustawia zdjęcia kafelków)
        setTimeout(function () { if (wybrany) wybierz(wybrany, false); else pasek.zaznacz(''); }, 0);
    }

    // producent na start: z adresu (#producent=… z paska na stronie głównej),
    // potem wybór z menu sklepu (ta sama karta), potem marka wybrana na pasku
    function znajdz(f) {
        var m = String(f || '').match(/^(producent|marka)=([^/&#]+)/);
        if (!m) return null;
        var v = decodeURIComponent(m[2]);
        var p = PRODUCENCI.filter(function (x) { return m[1] === 'marka' ? x.marka === v : x.s === v; })[0];
        if (p) return p;
        if (m[1] === 'marka') return null;
        // producent spoza paska (np. wybrany w menu) – nazwa z listy menu, jeśli jest
        var nazwa = v;
        ['gotowe', 'czesci'].forEach(function (g) {
            (((window.KIOSK_PRODUCENCI || {})[g]) || []).forEach(function (x) { if (x[1] === v) nazwa = x[0]; });
        });
        return { nazwa: nazwa, s: v };
    }
    function startowy() {
        var z = znajdz(location.hash.slice(1));
        if (z) return z;
        try {
            var s = sessionStorage.getItem(KLUCZ_PROD);
            if (s) { var o = JSON.parse(s); if (o && o.s) return znajdz('producent=' + o.s) || { nazwa: o.n || o.s, s: o.s }; }
            var mk = sessionStorage.getItem(KLUCZ_MARKA);
            if (mk) return znajdz('marka=' + mk);
        } catch (e) {}
        return null;
    }
    // wybór zapamiętany dla menu sklepu (producent) i dla tej strony (marka); adres do udostępnienia
    function zapamietaj(p) {
        zapamietajWybor(p);
        try { history.replaceState(history.state, '', location.pathname + location.search + (p ? '#' + filtr(p) : '')); } catch (e) {}
    }

    // ── 3. Inne strony (tylko komputer) ──────────────────────────────────────
    // Pasek nad okruszkami. Na liście kategorii przełącza producenta w bieżącej
    // kategorii (producenci bez produktów w niej są ukryci), na pozostałych
    // stronach prowadzi do /produkty,2 z wybranym producentem.
    // Bez paska: koszyk/zamówienie (4), rejestracja (5), konto (6),
    // konfiguracja (8), logowanie (32).
    var BEZ_PASKA = ['4', '5', '6', '8', '32'];
    var MQ = window.matchMedia ? window.matchMedia('(min-width: 769px)') : null;
    function naKomputerze() { return MQ ? MQ.matches : window.innerWidth > 768; }
    function typStrony() { return (location.pathname.match(/,(\d+)(?:,|\/|$)/) || [])[1] || ''; }
    // filtr producenta/marki zapisany w adresie (sklep wstawia go w różne miejsca ścieżki)
    function filtrZAdresu() {
        var f = location.pathname.split('/').filter(function (x) { return /^(producent|marka)=[^/]+$/.test(x); })[0];
        return f ? decodeURIComponent(f) : '';
    }

    function startStrona() {
        var typ = typStrony();
        if (BEZ_PASKA.indexOf(typ) >= 0) return;
        var okruszki = document.querySelector('main section.breadcrumbs-wrapper');
        if (!okruszki) return;
        dodajCss();
        // lista kategorii (adres z id kategorii, np. /produkty/koszenie,2,39165) – bez wyszukiwania
        var kategoria = typ === '2' && katId(location.pathname) && !/[?&](search|seaAtc)=/i.test(location.search);
        var biezacy = kategoria ? filtrZAdresu() : '';
        var lista = PRODUCENCI.slice();
        if (biezacy && !lista.some(function (x) { return filtr(x) === biezacy; })) {
            var obcy = znajdz(biezacy);
            if (obcy) lista.unshift(obcy);
        }
        var bezFiltra = '/' + sciezka(location.pathname);
        var pasek = zbuduj(lista, null, kategoria ? {
            tytul: 'Producent', wszyscy: true, strona: 'kategoria',
            adres: function (p) { return p ? '/' + filtr(p) + bezFiltra : bezFiltra; },
            przed: zapamietajWybor
        } : { strona: 'inna' });

        nadOkruszkami(okruszki, pasek.el, pasek, '');
        if (!kategoria) return;
        pasek.zaznacz(biezacy);

        // producenci bez produktów w tej kategorii znikają z paska (dane jak w menu sklepu,
        // pamiętane 12 h); liczby idą do podpowiedzi przycisku
        pamiec = wczytajPamiec();
        var kolejka = lista.filter(function (p) { return filtr(p) !== biezacy; }), aktywne = 0;
        function dalej() {
            while (aktywne < 6 && kolejka.length) {
                (function (p) {
                    aktywne++;
                    daneKategorii(p, location.pathname).then(function (w) {
                        aktywne--;
                        var li = pasek.lista.querySelector('li[data-f="' + filtr(p) + '"]');
                        if (li && w) {
                            if (!w.n) li.hidden = true;
                            else li.firstChild.title = p.nazwa + ' (' + produktow(w.n) + ')';
                        }
                        pasek.odswiez();
                        dalej();
                    });
                })(kolejka.shift());
            }
        }
        dalej();
    }
    // Pasek nad okruszkami (bieżącą ścieżką): lewa krawędź jak okruszki, szerokość jak
    // treść strony (np. 1400 px przy szerokim oknie). el – pasek albo pasek z opisem.
    function nadOkruszkami(okruszki, el, pasek, klasa) {
        var sekcja = document.createElement('section');
        sekcja.className = 'pasek-prod-strona' + (klasa ? ' ' + klasa : '');
        var srodek = document.createElement('div');
        srodek.className = 'page-padding';
        srodek.style.padding = '0';
        srodek.appendChild(el);
        sekcja.appendChild(srodek);
        okruszki.parentNode.insertBefore(sekcja, okruszki);
        function dopasuj() {
            if (!naKomputerze()) { el.style.marginLeft = el.style.width = ''; pasek.odswiez(); return; }
            var ul = okruszki.querySelector('.breadcrumbs') || okruszki;
            var siatka = document.querySelector('main .gridContainer');
            var r = ul.getBoundingClientRect(), s = srodek.getBoundingClientRect();
            var szer = window.innerWidth - 2 * r.left;
            if (siatka) { var g = siatka.getBoundingClientRect(); if (g.width > 200 && g.width < szer) szer = g.width; }
            el.style.marginLeft = Math.max(0, Math.round(r.left - s.left)) + 'px';
            el.style.width = Math.round(szer) + 'px';
            pasek.odswiez();
        }
        dopasuj();
        window.addEventListener('resize', dopasuj);
        window.addEventListener('load', dopasuj);
    }
    // wybór producenta z paska zapamiętany dla menu sklepu i strony /produkty,2 (bez zmiany adresu)
    function zapamietajWybor(p) {
        try {
            sessionStorage.setItem(KLUCZ_PROD, p && !p.marka ? JSON.stringify({ n: p.nazwa, s: p.s }) : '');
            if (p && p.marka) sessionStorage.setItem(KLUCZ_MARKA, p.marka); else sessionStorage.removeItem(KLUCZ_MARKA);
        } catch (e) {}
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function start() {
        if (document.querySelector('.pasek-prod')) return;
        var slider = document.querySelector('main .gridContainer .hero-slider');   // strona główna
        if (slider) { startGlowna(slider); return; }
        // strona kategorii: kafelki kategorii głównych na /produkty,2 (bez filtra w adresie)
        if (/^\/produkty,2\/?$/.test(location.pathname)) {
            var wrap = document.querySelector('.product-list__categories-wrapper');
            if (wrap) { startKategorie(wrap); return; }
        }
        if (naKomputerze()) startStrona();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
