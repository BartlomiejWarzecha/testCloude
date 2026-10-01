// =============================================================================
// LISTA ŻYCZEŃ  (xepc-lista.js)
// Części z katalogu Husqvarna (xEPC), których nie ma w sklepie.
//
// Jak działa:
//  1. Klient klika w katalogu „Dodaj do koszyka” przy części, której sklep
//     nie ma -> xepc-koszyk.js dodaje ją tutaj (ListaZyczen.dodaj).
//  2. Obok wyszukiwarki w nagłówku jest ikona „Lista życzeń” z licznikiem
//     (na telefonie: pozycja „Lista” w dolnym menu, obok „Ulubione”).
//  3. Panel listy: numery części, ilości, skąd dodane + formularz
//     „Wyślij zapytanie”. Wysyłka tym samym wywołaniem co formularz
//     na stronie Kontakt (Contact/Send) -> mail do sklepu (i kopia do klienta).
//  4. Lista jest w przeglądarce klienta (localStorage), bez logowania.
//
// Ładować na wszystkich stronach (nagłówek), przed xepc-koszyk-*.js:
//   <script src="/usr/xepc-lista.js"></script>
// =============================================================================

(function (global) {
    'use strict';

    var CONFIG = {
        klucz:        'bs-lista-zyczen',     // localStorage
        maxPozycji:   50,
        maxIlosc:     99,
        adresKontaktu: '/kontakt,12',        // strona z formularzem Contact/Send
        dzial:        '1',                   // Dział w formularzu kontaktowym: 1 = Sklep
        katalogUrl:   '/husqvarna_katalog,37',
        // karta części w oficjalnym katalogu (nazwa i zdjęcie części) - link w panelu i w mailu
        kartaCzesciUrl: 'https://xepc-prod.husqvarnagroup.com/pl/part/',
        ga4:          true,
        debug:        false
    };

    function log() {
        if (!CONFIG.debug) return;
        console.log.apply(console, ['[lista-zyczen]'].concat(Array.prototype.slice.call(arguments)));
    }

    // ── Dane (localStorage; bez niego lista działa do zamknięcia strony) ─────
    var pamiec = null;

    function wczytaj() {
        try {
            var d = JSON.parse(global.localStorage.getItem(CONFIG.klucz) || 'null');
            if (d && Array.isArray(d.pozycje)) return d.pozycje;
        } catch (e) { /* prywatne okno / zablokowane dane */ }
        return pamiec || [];
    }

    function zapisz(pozycje) {
        pamiec = pozycje;
        try { global.localStorage.setItem(CONFIG.klucz, JSON.stringify({ v: 1, pozycje: pozycje })); } catch (e) { /* jw. */ }
        odswiez();
    }

    function normalizujKod(v) {
        return v === null || v === undefined ? '' : String(v).toUpperCase().replace(/[\s.\-\/]/g, '');
    }

    function poprawIlosc(v) {
        var n = Math.round(Number(v));
        if (!isFinite(n) || n < 1) return 1;
        return Math.min(n, CONFIG.maxIlosc);
    }

    // zrodlo: { nazwa: 'Kosiarka Husqvarna LC 353VE', url: 'https://...' } – skąd klient dodał część
    // nazwa: nazwa części, jeśli jest znana (katalog wysyła tylko numer i ilość - klient może ją dopisać)
    function dodaj(kod, ilosc, zrodlo, nazwa) {
        kod = normalizujKod(kod);
        if (!kod) return false;
        var pozycje = wczytaj().slice();
        var byla = null;
        pozycje.forEach(function (p) { if (p.kod === kod) byla = p; });
        if (byla) {
            byla.ilosc = poprawIlosc(byla.ilosc + poprawIlosc(ilosc));
            if (nazwa && !byla.nazwa) byla.nazwa = String(nazwa).slice(0, 100);
        } else {
            if (pozycje.length >= CONFIG.maxPozycji) return false;
            pozycje.push({
                kod:    kod,
                nazwa:  nazwa ? String(nazwa).slice(0, 100) : '',
                ilosc:  poprawIlosc(ilosc),
                zrodlo: zrodlo && zrodlo.nazwa ? String(zrodlo.nazwa).slice(0, 120) : '',
                url:    zrodlo && zrodlo.url ? String(zrodlo.url).slice(0, 300) : '',
                czas:   new Date().toISOString()
            });
        }
        zapisz(pozycje);
        mrugnij();
        return true;
    }

    function ustawIlosc(kod, ilosc) {
        zapisz(wczytaj().map(function (p) {
            if (p.kod === kod) p.ilosc = poprawIlosc(ilosc);
            return p;
        }));
    }

    function ustawNazwe(kod, nazwa) {
        zapisz(wczytaj().map(function (p) {
            if (p.kod === kod) p.nazwa = String(nazwa || '').trim().slice(0, 100);
            return p;
        }));
    }

    function kartaCzesci(kod) { return CONFIG.kartaCzesciUrl + encodeURIComponent(kod); }

    function usun(kod) {
        zapisz(wczytaj().filter(function (p) { return p.kod !== kod; }));
    }

    function wyczysc() { zapisz([]); }

    // ── Treść zapytania (formularz Kontakt) ──────────────────────────────────
    function tematZapytania(pozycje) {
        var kody = pozycje.map(function (p) { return p.kod; });
        var t = 'Lista życzeń – zapytanie o ' + pozycje.length + ' ' +
            (pozycje.length === 1 ? 'część' : 'części') + ': ' + kody.join(', ');
        return t.length > 120 ? t.slice(0, 117) + '...' : t;
    }

    function trescZapytania(pozycje, dane) {
        var linie = ['Zapytanie o części z listy życzeń (katalog części Husqvarna na stronie sklepu).',
                     'Tych części nie ma w sklepie – klient prosi o sprawdzenie dostępności i ceny.', ''];
        pozycje.forEach(function (p, i) {
            var l = (i + 1) + '. ' + p.kod + (p.nazwa ? ' – ' + p.nazwa : '') + ' – ' + p.ilosc + ' szt.';
            if (p.zrodlo) l += ' (dodane przy: ' + p.zrodlo + ')';
            linie.push(l);
            linie.push('   Karta części w katalogu Husqvarna: ' + kartaCzesci(p.kod));
            if (p.url) linie.push('   Strona sklepu: ' + p.url);
        });
        linie.push('');
        linie.push('Imię: ' + (dane.imie || '-'));
        linie.push('E-mail: ' + (dane.email || '-'));
        linie.push('Telefon: ' + (dane.telefon || '-'));
        if (dane.uwagi) { linie.push(''); linie.push('Uwagi klienta:'); linie.push(dane.uwagi); }
        return linie.join('\n');
    }

    function poprawnyEmail(e) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim());
    }

    // To samo co formularz na stronie Kontakt (app.post -> FormData, POST na adres strony).
    function wyslijZapytanie(dane) {
        var pozycje = wczytaj();
        if (!pozycje.length) return Promise.reject(new Error('Lista jest pusta.'));
        var fd = new global.FormData();
        fd.append('__csrf', global.__CSRF || '');
        fd.append('__action', 'Contact/Send');
        fd.append('department', CONFIG.dzial);
        fd.append('email', String(dane.email || '').trim());
        fd.append('phoneNo', String(dane.telefon || '').trim());
        fd.append('subject', tematZapytania(pozycje));
        fd.append('message', trescZapytania(pozycje, dane));
        if (dane.kopia) fd.append('copy', '1');
        return global.fetch(CONFIG.adresKontaktu, {
            method: 'POST', body: fd, credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        }).then(function (odp) {
            var a = (odp && odp.action) || {};
            if (!a.Result) throw new Error(a.Message || 'Nie udało się wysłać zapytania.');
            ga4('generate_lead', { lead_source: 'lista_zyczen', items_count: pozycje.length,
                part_number: pozycje.map(function (p) { return p.kod; }).join(',').slice(0, 100) });
            return a.Message || '';
        });
    }

    // ── Google Analytics 4 (przez js/ga4-events.js albo gtag) ────────────────
    function ga4(nazwa, parametry) {
        if (!CONFIG.ga4) return;
        try {
            if (typeof global.ga4Wyslij === 'function') { global.ga4Wyslij(nazwa, parametry); return; }
            if (typeof global.gtag !== 'function') return;
            global.__ga4Wlasne = true;
            try { global.gtag('event', nazwa, parametry); } finally { global.__ga4Wlasne = false; }
        } catch (e) { log('ga4', e); }
    }

    // ── Wygląd ───────────────────────────────────────────────────────────────
    var CSS =
        // ikona jak "Porównywarka" obok (link w span.headerSection__iconsMenuItem;
        // przycisk <button> dostałby ramkę przycisku wyszukiwarki)
        '.headerSection .lz-ikona{position:relative;display:inline-flex;align-items:center;gap:6px;padding:4px;color:#191616;text-decoration:none;cursor:pointer}' +
        '.headerSection .lz-ikona svg{width:22px;height:22px;top:0;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
        '.headerSection .lz-ikona:hover{color:#e20000}' +
        '.lz-licznik{position:absolute;top:-6px;left:16px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e20000;color:#fff;font-size:11px;font-weight:700;line-height:18px;text-align:center;box-sizing:border-box}' +
        '.lz-licznik[hidden]{display:none}' +
        '.lz-mrug{animation:lzMrug .9s ease 2}' +
        '@keyframes lzMrug{0%,100%{transform:scale(1)}40%{transform:scale(1.35)}}' +
        // telefon: w nagłówku nie ma miejsca obok wyszukiwarki -> pozycja „Lista” w dolnym menu
        '@media (max-width:768px){.lz-miejsce{display:none !important}}' +
        '.bottomMenu .menuItem.lz-dolne .svgContainer svg{fill:none !important;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;width:22px;height:22px}' +
        '.bottomMenu .lz-dolne .itemsCounter{background:#e20000 !important;color:#fff !important}' +
        '.lz-tlo{position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;justify-content:flex-end}' +
        '.lz-tlo[hidden]{display:none}' +
        '.lz-panel{width:440px;max-width:100%;height:100%;overflow-y:auto;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,.2);display:flex;flex-direction:column;font-size:14px;color:#1a1a1a;box-sizing:border-box}' +
        '.lz-glowa{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 12px;border-bottom:1px solid #e5e5e5}' +
        '.lz-glowa h2{margin:0;font-size:20px;font-weight:700}' +
        '.lz-glowa p{margin:6px 0 0;font-size:13px;line-height:1.4;color:#555}' +
        '.lz-zamknij{background:none;border:0;font-size:28px;line-height:1;cursor:pointer;color:#444;padding:0 4px}' +
        '.lz-tresc{padding:14px 20px 24px;flex:1}' +
        '.lz-pusta{padding:20px 0;text-align:center;color:#555;line-height:1.5}' +
        '.lz-pusta a{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:8px;background:#e20000;color:#fff;text-decoration:none;font-weight:600}' +
        '.lz-lista{list-style:none;margin:0 0 16px;padding:0}' +
        '.lz-poz{display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid #eee}' +
        '.lz-poz__opis{flex:1;min-width:0}' +
        '.lz-poz__kod{font-weight:700;font-size:15px;letter-spacing:.3px}' +
        '.lz-poz__skad{font-size:12px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.lz-poz__nazwa-tekst{margin:2px 0;font-size:13px;color:#333}' +
        '.lz-panel .lz-poz__karta{display:block;margin:4px 0 2px;font-size:12px;color:#c40000;text-decoration:underline}' +
        '.lz-ile{display:inline-flex;border:1px solid #c9d1d8;border-radius:6px;overflow:hidden}' +
        '.lz-ile button{width:30px;height:30px;border:0;background:#f4f6f8;cursor:pointer;font-size:16px}' +
        '.lz-ile input{width:36px;border:0;text-align:center;font:inherit;-moz-appearance:textfield}' +
        '.lz-usun{background:none;border:0;cursor:pointer;color:#999;font-size:20px;padding:4px}' +
        '.lz-usun:hover{color:#e20000}' +
        '.lz-form h3{margin:8px 0 10px;font-size:16px}' +
        '.lz-form label{display:block;margin:0 0 10px;font-size:13px;font-weight:600;color:#333}' +
        '.lz-form input[type=text],.lz-form input[type=email],.lz-form input[type=tel],.lz-form textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:10px 12px;border:1px solid #c9d1d8;border-radius:6px;font:inherit;font-weight:400}' +
        '.lz-form textarea{min-height:70px;resize:vertical}' +
        '.lz-form .lz-kopia{display:flex;align-items:center;gap:8px;font-weight:400}' +
        '.lz-wyslij{width:100%;margin-top:6px;padding:14px;border:0;border-radius:8px;background:#e20000;color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer}' +
        '.lz-wyslij[disabled]{opacity:.6;cursor:wait}' +
        '.lz-blad{margin:8px 0 0;color:#c40000;font-size:13px}' +
        '.lz-ok{padding:24px 0;text-align:center;line-height:1.5}' +
        '.lz-ok strong{display:block;font-size:18px;margin-bottom:6px;color:#1a7f37}' +
        '.lz-uwaga{margin:12px 0 0;font-size:12px;color:#666;line-height:1.4}';

    function el(tag, klasa, tekst) {
        var e = document.createElement(tag);
        if (klasa) e.className = klasa;
        if (tekst !== undefined && tekst !== null) e.textContent = tekst;
        return e;
    }

    function ikonaSvg() {
        var NS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        // schowek z listą
        [['path', 'M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z'],
         ['path', 'M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2'],
         ['path', 'M9 11h6M9 15h6']].forEach(function (k) {
            var e = document.createElementNS(NS, k[0]);
            e.setAttribute('d', k[1]);
            svg.appendChild(e);
        });
        return svg;
    }

    // ── Ikona w nagłówku (obok wyszukiwarki) ─────────────────────────────────
    var ikona = null, licznik = null, dolne = null, licznikDolny = null;

    // Dolne menu na telefonie (Start / Kategorie / Koszyk / Ulubione / Konto) – po „Ulubione”.
    function wstawDolne() {
        var menu = document.querySelector('.bottomMenu');
        if (!menu || menu.querySelector('.lz-dolne')) return;
        dolne = el('a', 'menuItem lz-dolne');
        dolne.href = '#lista-zyczen';
        dolne.setAttribute('role', 'button');
        dolne.setAttribute('aria-label', 'Lista życzeń');
        var kontener = el('div', 'svgContainer');
        kontener.appendChild(ikonaSvg());
        licznikDolny = el('span', 'itemsCounter hidden');
        kontener.appendChild(licznikDolny);
        dolne.appendChild(kontener);
        dolne.appendChild(el('div', 'text', 'Lista'));
        dolne.addEventListener('click', function (e) { e.preventDefault(); otworz(); });
        var ulubione = menu.querySelector('.favouriteItemsButton');
        if (ulubione) ulubione.parentNode.insertBefore(dolne, ulubione.nextSibling);
        else menu.appendChild(dolne);
    }

    function wstawIkone() {
        if (document.querySelector('.lz-ikona')) return;
        var szukaj = document.querySelector('header .showSearchSection-js, header .mobileSearchIcon');
        var menu = document.querySelector('header .headerSection__iconsMenu');
        if (!szukaj && !menu) return;

        var miejsce = el('span', 'headerSection__iconsMenuItem lz-miejsce');
        ikona = el('a', 'header__icon lz-ikona');
        ikona.href = '#lista-zyczen';
        ikona.setAttribute('role', 'button');
        ikona.title = 'Lista życzeń – części, których nie mamy w sklepie';
        ikona.setAttribute('aria-label', 'Lista życzeń');
        ikona.appendChild(ikonaSvg());
        licznik = el('span', 'lz-licznik');
        licznik.hidden = true;
        ikona.appendChild(licznik);
        ikona.appendChild(el('span', 'iconsMenuItem__text', 'Lista życzeń'));
        ikona.addEventListener('click', function (e) { e.preventDefault(); otworz(); });
        miejsce.appendChild(ikona);

        if (szukaj && szukaj.parentNode) szukaj.parentNode.insertBefore(miejsce, szukaj.nextSibling);
        else menu.insertBefore(miejsce, menu.firstChild);
    }

    function mrugnij() {
        [licznik, licznikDolny].forEach(function (l) {
            if (!l) return;
            l.classList.remove('lz-mrug');
            void l.offsetWidth;   // restart animacji
            l.classList.add('lz-mrug');
        });
    }

    // ── Panel ────────────────────────────────────────────────────────────────
    var tlo = null, tresc = null, wyslane = false;

    function zbudujPanel() {
        if (tlo) return;
        tlo = el('div', 'lz-tlo');
        tlo.hidden = true;
        tlo.addEventListener('click', function (e) { if (e.target === tlo) zamknij(); });

        var panel = el('div', 'lz-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'Lista życzeń');

        var glowa = el('div', 'lz-glowa');
        var tytul = el('div');
        tytul.appendChild(el('h2', null, 'Lista życzeń'));
        tytul.appendChild(el('p', null, 'Części z katalogu Husqvarna, których nie mamy w sklepie. ' +
            'Wyślij zapytanie – sprawdzimy, czy możemy je sprowadzić, i odezwiemy się z ceną.'));
        var x = el('button', 'lz-zamknij', '×');
        x.type = 'button';
        x.setAttribute('aria-label', 'Zamknij');
        x.addEventListener('click', zamknij);
        glowa.appendChild(tytul);
        glowa.appendChild(x);

        tresc = el('div', 'lz-tresc');
        panel.appendChild(glowa);
        panel.appendChild(tresc);
        tlo.appendChild(panel);
        document.body.appendChild(tlo);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && tlo && !tlo.hidden) zamknij();
        });
    }

    function rysujPusta() {
        var p = el('div', 'lz-pusta');
        p.appendChild(el('p', null, 'Twoja lista jest pusta.'));
        p.appendChild(el('p', null, 'Gdy w katalogu części Husqvarna klikniesz „Dodaj do koszyka” przy części, ' +
            'której nie mamy w sklepie, trafi ona tutaj.'));
        var a = el('a', null, 'Otwórz katalog części');
        a.href = CONFIG.katalogUrl;
        p.appendChild(a);
        tresc.appendChild(p);
    }

    function rysujListe(pozycje) {
        var ul = el('ul', 'lz-lista');
        pozycje.forEach(function (p) {
            var li = el('li', 'lz-poz');
            var opis = el('div', 'lz-poz__opis');
            opis.appendChild(el('div', 'lz-poz__kod', 'Nr części ' + p.kod));
            // Katalog nie przekazuje nazwy części - link otwiera kartę części w oficjalnym katalogu.
            if (p.nazwa) opis.appendChild(el('div', 'lz-poz__nazwa-tekst', p.nazwa));
            var karta = el('a', 'lz-poz__karta', 'Sprawdź nazwę w katalogu Husqvarna ↗');
            karta.href = kartaCzesci(p.kod);
            karta.target = '_blank';
            karta.rel = 'noopener';
            opis.appendChild(karta);
            if (p.zrodlo) {
                var skad = el('div', 'lz-poz__skad', 'Dodane przy: ' + p.zrodlo);
                skad.title = p.zrodlo;
                opis.appendChild(skad);
            }
            var ile = el('div', 'lz-ile');
            var minus = el('button', null, '−');
            minus.type = 'button';
            minus.setAttribute('aria-label', 'Mniej');
            var pole = el('input');
            pole.type = 'number';
            pole.min = '1';
            pole.max = String(CONFIG.maxIlosc);
            pole.value = p.ilosc;
            pole.setAttribute('aria-label', 'Ilość ' + p.kod);
            var plus = el('button', null, '+');
            plus.type = 'button';
            plus.setAttribute('aria-label', 'Więcej');
            minus.addEventListener('click', function () { ustawIlosc(p.kod, p.ilosc - 1); });
            plus.addEventListener('click', function () { ustawIlosc(p.kod, p.ilosc + 1); });
            pole.addEventListener('change', function () { ustawIlosc(p.kod, pole.value); });
            ile.appendChild(minus); ile.appendChild(pole); ile.appendChild(plus);
            var x = el('button', 'lz-usun', '×');
            x.type = 'button';
            x.title = 'Usuń z listy';
            x.setAttribute('aria-label', 'Usuń ' + p.kod + ' z listy');
            x.addEventListener('click', function () { usun(p.kod); });
            li.appendChild(opis); li.appendChild(ile); li.appendChild(x);
            ul.appendChild(li);
        });
        tresc.appendChild(ul);
    }

    var szkic = { email: '', imie: '', telefon: '', uwagi: '', kopia: true };

    function pole(etykieta, typ, nazwa, wymagane) {
        var l = el('label', null, etykieta + (wymagane ? ' *' : ''));
        var i = el(typ === 'textarea' ? 'textarea' : 'input');
        if (typ !== 'textarea') i.type = typ;
        i.name = nazwa;
        i.value = szkic[nazwa] || '';
        if (wymagane) i.required = true;
        if (nazwa === 'email') i.autocomplete = 'email';
        if (nazwa === 'imie') i.autocomplete = 'given-name';
        if (nazwa === 'telefon') i.autocomplete = 'tel';
        i.addEventListener('input', function () { szkic[nazwa] = i.value; });
        l.appendChild(i);
        return l;
    }

    function rysujFormularz() {
        var f = el('form', 'lz-form');
        f.noValidate = true;
        f.appendChild(el('h3', null, 'Wyślij zapytanie o te części'));
        f.appendChild(pole('E-mail', 'email', 'email', true));
        f.appendChild(pole('Imię', 'text', 'imie', true));
        f.appendChild(pole('Telefon', 'tel', 'telefon', false));
        f.appendChild(pole('Uwagi (np. model i numer seryjny maszyny)', 'textarea', 'uwagi', false));
        var kopia = el('label', 'lz-kopia');
        var cb = el('input');
        cb.type = 'checkbox';
        cb.checked = szkic.kopia;
        cb.addEventListener('change', function () { szkic.kopia = cb.checked; });
        kopia.appendChild(cb);
        kopia.appendChild(document.createTextNode('Wyślij mi kopię wiadomości'));
        f.appendChild(kopia);
        var btn = el('button', 'lz-wyslij', 'Wyślij zapytanie');
        btn.type = 'submit';
        f.appendChild(btn);
        var blad = el('p', 'lz-blad');
        blad.hidden = true;
        f.appendChild(blad);
        f.appendChild(el('p', 'lz-uwaga', 'Odpowiemy mailowo lub telefonicznie. Zapytanie trafi do sklepu tak jak wiadomość z formularza na stronie Kontakt.'));

        f.addEventListener('submit', function (e) {
            e.preventDefault();
            blad.hidden = true;
            if (!poprawnyEmail(szkic.email)) return pokazBlad('Podaj poprawny adres e-mail.');
            if (!String(szkic.imie || '').trim()) return pokazBlad('Podaj imię.');
            btn.disabled = true;
            btn.textContent = 'Wysyłanie…';
            wyslijZapytanie(szkic).then(function () {
                wyslane = true;
                wyczysc();
            }, function (err) {
                btn.disabled = false;
                btn.textContent = 'Wyślij zapytanie';
                pokazBlad(err.message || 'Nie udało się wysłać zapytania. Spróbuj ponownie.');
            });
        });

        function pokazBlad(t) { blad.textContent = t; blad.hidden = false; }
        tresc.appendChild(f);
    }

    function rysujPodziekowanie() {
        var d = el('div', 'lz-ok');
        d.appendChild(el('strong', null, 'Dziękujemy, zapytanie wysłane!'));
        d.appendChild(el('p', null, 'Sprawdzimy dostępność części i odezwiemy się najszybciej, jak to możliwe.'));
        tresc.appendChild(d);
    }

    function rysuj() {
        if (!tresc) return;
        tresc.textContent = '';
        var pozycje = wczytaj();
        if (wyslane && !pozycje.length) return rysujPodziekowanie();
        if (!pozycje.length) return rysujPusta();
        rysujListe(pozycje);
        rysujFormularz();
    }

    function odswiez() {
        var n = wczytaj().length;
        if (licznik) {
            licznik.textContent = String(n);
            licznik.hidden = n === 0;
        }
        if (ikona) ikona.setAttribute('aria-label', 'Lista życzeń' + (n ? ' (' + n + ')' : ''));
        if (licznikDolny) {
            licznikDolny.textContent = String(n);
            licznikDolny.classList.toggle('hidden', n === 0);
        }
        if (dolne) dolne.setAttribute('aria-label', 'Lista życzeń' + (n ? ' (' + n + ')' : ''));
        if (tlo && !tlo.hidden) {
            // nie przerysowujemy formularza przy zmianie ilości, żeby nie gubić fokusu
            var akt = document.activeElement;
            var wForm = akt && akt.closest && akt.closest('.lz-form');
            if (!wForm) rysuj();
        }
    }

    var ostatniFokus = null;

    function otworz() {
        zbudujPanel();
        wyslane = false;
        ostatniFokus = document.activeElement;
        rysuj();
        tlo.hidden = false;
        document.body.style.overflow = 'hidden';
        var x = tlo.querySelector('.lz-zamknij');
        if (x) x.focus();
        ga4('wishlist_open', { items_count: wczytaj().length });
    }

    function zamknij() {
        if (!tlo) return;
        tlo.hidden = true;
        document.body.style.overflow = '';
        if (ostatniFokus && ostatniFokus.focus) ostatniFokus.focus();
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function start() {
        if (!document.getElementById('lz-css')) {
            var st = document.createElement('style');
            st.id = 'lz-css';
            st.textContent = CSS;
            document.head.appendChild(st);
        }
        wstawIkone();
        wstawDolne();
        odswiez();
        // zmiany z innej karty przeglądarki
        global.addEventListener('storage', function (e) { if (e.key === CONFIG.klucz) odswiez(); });
        if (/[#&]lista-zyczen\b/.test(global.location.hash)) otworz();
    }

    if (typeof document !== 'undefined' && document.addEventListener) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }

    global.ListaZyczen = {
        config:         CONFIG,
        dodaj:          dodaj,
        usun:           usun,
        ustawIlosc:     ustawIlosc,
        ustawNazwe:     ustawNazwe,
        pozycje:        wczytaj,
        wyczysc:        wyczysc,
        otworz:         otworz,
        zamknij:        zamknij,
        tematZapytania: tematZapytania,
        trescZapytania: trescZapytania,
        wyslijZapytanie: wyslijZapytanie
    };

})(typeof window !== 'undefined' ? window : globalThis);
