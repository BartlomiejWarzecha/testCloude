// =============================================================================
// KARTA PRODUKTU  (karta-produktu.js)
// 1. Zakładka „Parametry”: cechy produktu (Producent silnika, Dedykowana
//    powierzchnia, Metoda koszenia…) zamiast stosu boksów nad opisem trafiają do
//    zakładki obok „Opis towaru”, jako czytelna tabela nazwa – wartość.
//    Oryginalne boksy są tylko ukryte: ich pola attributeId zostają w formularzu,
//    więc „Dodaj do koszyka” wysyła atrybuty jak dotąd. Wybór wariantu (np.
//    „Modele Husqvarna:”) zostaje przy przycisku koszyka – to nie jest parametr.
// 2. Telefon: zakładki (Parametry, Części zamienne, Identyfikatory, Opinie) są
//    zwykłymi sekcjami na stronie pod opisem – bez arkuszy na cały ekran.
//    Katalog części ładuje się, gdy klient do niego dojeżdża.
// 3. Telefon: górna belka sekcji (Zdjęcia, Opis, Parametry, Części, Identyfikatory,
//    Opinie, Akcesoria, Polecane – tylko te, które są na karcie, w kolejności
//    na stronie). Wzorem Allegro, Zalando, Amazona, Apple i zaleceń Baymard / NN/g:
//    - pojawia się, gdy główny „Dodaj do koszyka” zniknie z ekranu (koszyk
//      zostaje w dolnej belce sklepu), znika przy powrocie do góry,
//    - zakładki tekstowe z przesuwanym podkreśleniem aktywnej sekcji (scroll-spy),
//      aktywna zawsze na środku paska, cieniowanie przy krawędziach, gdy da się
//      przewinąć w bok, miniatura produktu przy „Zdjęcia”, liczba opinii,
//    - dotknięcie płynnie przewija do sekcji (bez animacji przy ograniczeniu
//      ruchu w telefonie); podczas przewijania podświetlenie nie skacze,
//    - pole dotyku 44 px, 50 px wysokości, półprzezroczyste tło z rozmyciem,
//      pod oknami sklepu.
//
// Ładować w szablonie całego sklepu (poza kartą produktu nic nie robi):
//   <script src="/usr/karta-produktu.js"></script>
// =============================================================================

(function () {
    'use strict';
    if (window.__bsKartaProduktu) return;
    window.__bsKartaProduktu = true;

    var ID_ZAKLADKI = 'parametry';
    var NAZWA_ZAKLADKI = 'Parametry';
    var UKRYTE_CECHY = /^\s*KATEGORIA SPRZEDA[ŻZ]Y\s*:?\s*$/i;   // wewnętrzne (jak w ukryte-atrybuty.js)
    var MQ = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null;
    function naTelefonie() { return MQ ? MQ.matches : window.innerWidth <= 768; }

    var CSS =
        // zakładka Parametry
        '.productDetails-content--parametry .bs-param-wiersz .value{white-space:normal}' +
        '.bs-param-ukryty{display:none!important}' +
        // ── telefon: zakładki jako sekcje na stronie (bez arkuszy) ──
        '@media (max-width:768px){' +
            'html.bs-karta-mobile .productDetails-detailsButtons{display:none!important}' +
            'html.bs-karta-mobile .productDetails-content.bs-inline{display:block!important;position:static!important;inset:auto!important;' +
                'top:auto!important;left:auto!important;right:auto!important;bottom:auto!important;width:auto!important;height:auto!important;' +
                'max-height:none!important;transform:none!important;z-index:auto!important;overflow:visible!important;' +
                'background:transparent!important;box-shadow:none!important;margin:0!important;padding:0!important;scroll-margin-top:60px;' +
                'visibility:visible!important;opacity:1!important;pointer-events:auto!important}' +
            'html.bs-karta-mobile .productDetails-content.bs-inline>.productDetails-content--header{display:none!important}' +
            'html.bs-karta-mobile .productDetails-content.bs-inline .productDetails-content--text{height:auto!important;max-height:none!important;' +
                'overflow:visible!important;padding:0!important}' +
            '.bs-sekcja-tytul{display:block;margin:28px 0 12px;padding-top:20px;border-top:1px solid #e6e8ec;' +
                'font-family:Poppins,sans-serif;font-size:19px;font-weight:700;color:#1d2433;line-height:1.3}' +
            '.bs-sekcja-tytul small{font-size:14px;font-weight:500;color:#6b7280;margin-left:6px}' +
        '}' +
        '.bs-sekcja-tytul{display:none}' +
        '@media (max-width:768px){html.bs-karta-mobile .bs-sekcja-tytul{display:block}}' +
        // ── telefon: górna belka sekcji ──
        '.bs-sekcje{position:fixed;top:0;left:0;right:0;z-index:998;background:rgba(255,255,255,.97);' +
            '-webkit-backdrop-filter:saturate(180%) blur(12px);backdrop-filter:saturate(180%) blur(12px);' +
            'box-shadow:0 1px 0 #e6e8ec,0 6px 16px rgba(16,24,40,.07);transform:translateY(-105%);transition:transform .22s cubic-bezier(.2,.8,.2,1);' +
            'font-family:Poppins,sans-serif;padding-top:env(safe-area-inset-top)}' +
        '.bs-sekcje.bs-widoczna{transform:none}' +
        '.bs-sekcje__okno{position:relative}' +
        '.bs-sekcje__lista{position:relative;display:flex;align-items:stretch;height:50px;margin:0;padding:0 8px;list-style:none;' +
            'overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-behavior:smooth}' +
        '.bs-sekcje__lista::-webkit-scrollbar{display:none}' +
        '.bs-sekcje__lista li{flex:0 0 auto;display:flex}' +
        '.bs-sekcje__tab{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border:0;background:none;' +
            'color:#4a5263;font:inherit;font-size:14px;font-weight:500;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
        '.bs-sekcje__tab[aria-current="true"]{color:#22355c;font-weight:700}' +
        '.bs-sekcje__tab:focus-visible{outline:2px solid #22355c;outline-offset:-4px;border-radius:6px}' +
        '.bs-sekcje__tab img{width:28px;height:28px;object-fit:contain;border-radius:6px;background:#f6f7f8;border:1px solid #eceef1}' +
        '.bs-sekcje__licz{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;' +
            'border-radius:10px;background:#eef1f6;color:#22355c;font-size:11px;font-weight:700}' +
        // przesuwane podkreślenie aktywnej sekcji
        '.bs-sekcje__linia{position:absolute;left:0;bottom:0;height:3px;width:0;border-radius:3px 3px 0 0;background:#22355c;' +
            'transition:transform .25s cubic-bezier(.2,.8,.2,1),width .25s cubic-bezier(.2,.8,.2,1);pointer-events:none}' +
        // cieniowanie przy krawędziach, gdy da się przewinąć w bok
        '.bs-sekcje__okno::before,.bs-sekcje__okno::after{content:"";position:absolute;top:0;bottom:0;width:24px;z-index:1;pointer-events:none;' +
            'opacity:0;transition:opacity .15s}' +
        '.bs-sekcje__okno::before{left:0;background:linear-gradient(to left,rgba(255,255,255,0),#fff)}' +
        '.bs-sekcje__okno::after{right:0;background:linear-gradient(to right,rgba(255,255,255,0),#fff)}' +
        '.bs-sekcje__okno.bs-lewo::before,.bs-sekcje__okno.bs-prawo::after{opacity:1}' +
        '@media (min-width:769px){.bs-sekcje{display:none}}' +
        '@media (prefers-reduced-motion:reduce){.bs-sekcje,.bs-sekcje__linia{transition:none}.bs-sekcje__lista{scroll-behavior:auto}}';

    function el(tag, klasa, tekst) {
        var e = document.createElement(tag);
        if (klasa) e.className = klasa;
        if (tekst != null) e.textContent = tekst;
        return e;
    }
    function tekst(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
    function ga4(nazwa, p) { try { if (typeof window.ga4Wyslij === 'function') window.ga4Wyslij(nazwa, p); } catch (e) {} }

    // ── 1. Zakładka „Parametry” ──────────────────────────────────────────────
    function wartoscCechy(t) {
        return t.replace(/(\d)\s*-\s*(\d)/g, '$1–$2')
                .replace(/\bm2\b/g, 'm²').replace(/\bm3\b/g, 'm³');
    }
    function zbierzParametry(formularz) {
        var lista = [], widziane = {};
        [].forEach.call(formularz.querySelectorAll('.productDetails-attributes .input-group.poly-container'), function (g) {
            var nazwa = tekst(g.querySelector('.attribute-name')).replace(/\s*:\s*$/, '');
            if (!nazwa || UKRYTE_CECHY.test(nazwa) || g.getAttribute('data-bs-ukryty')) return;
            var wartosci = [].map.call(g.querySelectorAll('.attributes-select .button-option, .attributes-select option'), function (o) {
                return wartoscCechy(tekst(o));
            }).filter(Boolean);
            // boks znika (styl na elemencie – CSS sklepu wymusza display:flex !important),
            // pole attributeId zostaje w formularzu
            g.classList.add('bs-param-ukryty');
            g.style.setProperty('display', 'none', 'important');
            if (!wartosci.length) return;
            var w = wartosci.join(', ');
            var klucz = nazwa.toLowerCase() + '|' + w.toLowerCase();
            if (widziane[klucz]) return;              // np. „Producent silnika” podany dwa razy
            widziane[klucz] = 1;
            lista.push({ nazwa: nazwa, wartosc: w });
        });
        return lista;
    }
    function zakladkaParametry() {
        var formularz = document.querySelector('#AddToCartForm');
        var przyciski = document.querySelector('.productDetails-detailsButtons');
        var wzorPrzycisku = przyciski && przyciski.querySelector('.productDetails-detailsButtons--button[data-content="attributes"]') ||
            (przyciski && przyciski.querySelector('.productDetails-detailsButtons--button'));
        var wzorPanelu = document.querySelector('.productDetails-content[data-content="attributes"]') ||
            document.querySelector('.productDetails-content[data-content]');
        if (!formularz || !wzorPrzycisku || !wzorPanelu || document.querySelector('[data-content="' + ID_ZAKLADKI + '"]')) return;
        var parametry = zbierzParametry(formularz);
        if (!parametry.length) return;

        var przycisk = el('div', 'productDetails-detailsButtons--button');
        przycisk.setAttribute('role', 'button');
        przycisk.setAttribute('tabindex', '0');
        przycisk.setAttribute('data-content', ID_ZAKLADKI);
        przycisk.appendChild(document.createTextNode(NAZWA_ZAKLADKI));
        var strzalka = wzorPrzycisku.querySelector('svg');
        if (strzalka) przycisk.appendChild(strzalka.cloneNode(true));
        przycisk.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); przycisk.click(); }
        });

        var panel = el('div', 'productDetails-content productDetails-content--attributes productDetails-content--parametry hidden');
        panel.setAttribute('data-content', ID_ZAKLADKI);
        var naglowek = wzorPanelu.querySelector('.productDetails-content--header');   // nagłówek + „zamknij” na telefonie
        if (naglowek) {
            naglowek = naglowek.cloneNode(true);
            var t = naglowek.querySelector('span');
            if (t) t.textContent = NAZWA_ZAKLADKI;
            panel.appendChild(naglowek);
        }
        var tresc = el('div', 'productDetails-content--text');
        parametry.forEach(function (p) {
            var r = el('div', 'productDetails-content--row bs-param-wiersz');
            r.appendChild(el('div', 'name', p.nazwa));
            r.appendChild(el('div', 'value', p.wartosc));
            tresc.appendChild(r);
        });
        panel.appendChild(tresc);

        wzorPanelu.parentNode.insertBefore(panel, wzorPanelu);
        // zaraz po „Opis towaru” (druga zakładka) – także gdy inne skrypty dołożą
        // swoje zakładki później (Akcesoria, Sprawdź części zamienne)
        function naMiejsce() {
            var po = przyciski.querySelector('[data-content="description"]');
            if (po) { if (po.nextElementSibling !== przycisk) po.parentNode.insertBefore(przycisk, po.nextSibling); }
            else if (przyciski.firstElementChild !== przycisk) przyciski.insertBefore(przycisk, przyciski.firstChild);
        }
        naMiejsce();
        if (window.MutationObserver) new MutationObserver(naMiejsce).observe(przyciski, { childList: true });
    }

    // ── 2. Telefon: zakładki jako sekcje na stronie ──────────────────────────
    // Panele zakładek (Parametry, Części zamienne, Identyfikatory, Opinie…) na
    // telefonie są zwykłymi sekcjami pod opisem, z nagłówkiem – bez arkuszy.
    // Na komputerze wszystko działa jak dotąd (zakładki). Opis i akcesoria mają
    // na telefonie własne bloki sklepu, więc ich panele zostają ukryte.
    var KOLEJNOSC = [ID_ZAKLADKI, 'xepc-czesci', 'attributes', 'reviews'];
    var NAZWY = { attributes: 'Identyfikatory towaru', reviews: 'Opinie', 'xepc-czesci': 'Części zamienne' };
    var BEZ_SEKCJI = { description: 1, akcesoria: 1 };

    function przyciskZakladki(id) {
        return document.querySelector('.productDetails-detailsButtons--button[data-content="' + id + '"]');
    }
    function nazwaPanelu(id) {
        if (NAZWY[id]) return NAZWY[id];
        if (id === ID_ZAKLADKI) return NAZWA_ZAKLADKI;
        var b = przyciskZakladki(id);
        return b ? tekst(b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild : b) : id;
    }
    function licznikOpinii() {
        var cand = document.querySelectorAll('.productDetails-reviews--count, .productDetails-rating .ratingCount, .rating-count, .reviewsCount');
        for (var i = 0; i < cand.length; i++) { var m = tekst(cand[i]).match(/\d+/); if (m) return m[0] === '0' ? '' : m[0]; }
        var lista = document.querySelectorAll('.productDetails-reviews--reviewsList > li');
        return lista.length ? String(lista.length) : '';
    }
    var znacznik = null;
    function porzadkujSekcje() {
        var panele = [].filter.call(document.querySelectorAll('.productDetails-content[data-content]'), function (p) {
            return !BEZ_SEKCJI[p.getAttribute('data-content')];
        });
        if (!panele.length) return;
        // kolejność na telefonie: Parametry, Części, Identyfikatory, Opinie, reszta
        // (przestawiamy rodzeństwo w tym samym rodzicu – zakładkom na komputerze to nie przeszkadza)
        if (!znacznik || !znacznik.parentNode) {
            znacznik = document.createComment('sekcje');
            panele[0].parentNode.insertBefore(znacznik, panele[0]);
        }
        var rodzic = znacznik.parentNode;
        panele.sort(function (a, b) {
            var ia = KOLEJNOSC.indexOf(a.getAttribute('data-content')), ib = KOLEJNOSC.indexOf(b.getAttribute('data-content'));
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
        panele = panele.filter(function (p) { return p.parentNode === rodzic; });
        // przestawiamy tylko, gdy kolejność się nie zgadza (inaczej obserwator zmian kręciłby się w kółko)
        var dobrze = panele.every(function (p, i) { return (panele[i + 1] || znacznik) === p.nextSibling; });
        if (!dobrze) panele.forEach(function (p) { rodzic.insertBefore(p, znacznik); });
        // akcesoria i polecane (blok .akc-mobile, tylko telefon) – za sekcjami, żeby parametry
        // były zaraz pod opisem
        var akc = document.querySelector('.akc-mobile');
        if (akc && znacznik.nextSibling !== akc) rodzic.insertBefore(akc, znacznik.nextSibling);
        panele.forEach(function (p) {
            var id = p.getAttribute('data-content');
            p.classList.add('bs-inline');
            p.id = p.id || 'sekcja-' + id;
            if (!p.querySelector(':scope > .bs-sekcja-tytul')) {
                var h = el('h2', 'bs-sekcja-tytul', nazwaPanelu(id));
                if (id === 'reviews') { var n = licznikOpinii(); if (n) h.appendChild(el('small', null, '(' + n + ')')); }
                p.insertBefore(h, p.firstChild);
            }
        });
        // katalog części Husqvarna ładuje się po kliknięciu zakładki – na telefonie,
        // gdy sekcja zbliża się do ekranu (zdarzenie bez bąbelkowania: tylko ładowanie
        // katalogu, bez przełączania zakładek sklepu)
        var xepc = document.querySelector('.productDetails-content[data-content="xepc-czesci"]');
        var bx = przyciskZakladki('xepc-czesci');
        if (xepc && bx && !xepc.__bsIo && window.IntersectionObserver) {
            xepc.__bsIo = true;
            var io = new IntersectionObserver(function (w) {
                if (!w[0].isIntersecting || !naTelefonie()) return;
                io.disconnect();
                bx.dispatchEvent(new Event('click', { bubbles: false }));
            }, { rootMargin: '600px 0px' });
            io.observe(xepc);
        }
    }
    // panele i akcesoria dokładają inne skrypty (część chwilę po wczytaniu) – porządkujemy też wtedy
    function sekcjeInline() {
        porzadkujSekcje();
        if (!window.MutationObserver) return;
        var t = null, mo = new MutationObserver(function () {
            clearTimeout(t);
            t = setTimeout(function () { porzadkujSekcje(); mo.takeRecords(); }, 250);
        });
        mo.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
        setTimeout(function () { mo.disconnect(); }, 20000);
    }
    function trybTelefonu() {
        document.documentElement.classList.toggle('bs-karta-mobile', naTelefonie());
    }

    // ── 3. Telefon: górna belka sekcji ───────────────────────────────────────
    var WYS = 50;
    var belka, okno, lista, linia, glownyPrzycisk, pozycje = [], aktywna = null, widoczna = false, czeka = false, blokadaDo = 0;

    function gora(e) { return e.getBoundingClientRect().top + window.scrollY; }
    function przewinDo(cel) {
        var y = Math.max(0, gora(cel) - WYS - 10);
        var plynnie = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        blokadaDo = Date.now() + (plynnie ? 900 : 100);      // podczas płynnego przewijania podświetlenie nie skacze
        try { window.scrollTo({ top: y, behavior: plynnie ? 'smooth' : 'auto' }); } catch (e) { window.scrollTo(0, y); }
    }
    function miniatura() {
        var img = document.querySelector('.productDetails-images img[src]:not([src*="alo.gif"]), .productDetails-images img[data-lazy]');
        return img ? (img.getAttribute('data-lazy') || img.currentSrc || img.src) : '';
    }
    // sekcje obecne na tej karcie, w kolejności na stronie
    function zbierzPozycje() {
        var p = [];
        function dodaj(nazwa, cel, extra) {
            if (!cel || cel.offsetParent === null || cel.getBoundingClientRect().height < 20) return;
            var x = { nazwa: nazwa, cel: cel };
            for (var k in extra || {}) x[k] = extra[k];
            p.push(x);
        }
        dodaj('Zdjęcia', document.querySelector('.productDetails-images') || document.querySelector('.productDetails'), { img: miniatura() });
        dodaj('Opis', document.querySelector('.product-mobile-description'));
        [].forEach.call(document.querySelectorAll('.productDetails-content.bs-inline'), function (s) {
            var id = s.getAttribute('data-content');
            var krotko = { attributes: 'Identyfikatory', 'xepc-czesci': 'Części' }[id] || nazwaPanelu(id);
            dodaj(krotko, s, id === 'reviews' ? { licznik: licznikOpinii() } : null);
        });
        var akc = document.querySelectorAll('.akc-mobile .akc-sekcja');
        [].forEach.call(akc.length ? akc : document.querySelectorAll('.akc-mobile'), function (s, i) {
            var h = tekst(s.querySelector('h2, h3, .akc-mtytul'));
            var nazwa = /polecan/i.test(h) ? 'Polecane' : (/akcesori/i.test(h) || i === 0) ? 'Akcesoria' : (h.split(' ')[0] || 'Więcej');
            if (!p.some(function (x) { return x.nazwa === nazwa; })) dodaj(nazwa, s);
        });
        p.sort(function (a, b) { return gora(a.cel) - gora(b.cel); });
        return p;
    }
    function rysuj() {
        var nowe = zbierzPozycje();
        var podpis = nowe.map(function (x) { return x.nazwa + (x.licznik || ''); }).join('|');
        if (lista.getAttribute('data-podpis') === podpis) {
            nowe.forEach(function (x, i) { pozycje[i].cel = x.cel; });
            return;
        }
        lista.setAttribute('data-podpis', podpis);
        lista.textContent = '';
        lista.appendChild(linia);
        pozycje = nowe;
        pozycje.forEach(function (x) {
            var li = el('li');
            var b = el('button', 'bs-sekcje__tab');
            b.type = 'button';
            if (x.img) { var im = el('img'); im.src = x.img; im.alt = ''; im.onerror = function () { this.remove(); }; b.appendChild(im); }
            b.appendChild(document.createTextNode(x.nazwa));
            if (x.licznik) b.appendChild(el('span', 'bs-sekcje__licz', x.licznik));
            b.addEventListener('click', function () {
                ga4('product_section_nav', { section: x.nazwa });
                ustawAktywna(x, true);
                przewinDo(x.cel);
            });
            x.el = b;
            li.appendChild(b);
            lista.appendChild(li);
        });
        aktywna = null;
        szpieg(true);
        krawedzie();
    }
    function ustawAktywna(x, wymus) {
        if (aktywna === x && !wymus) return;
        aktywna = x;
        pozycje.forEach(function (y) { if (y.el) { if (y === x) y.el.setAttribute('aria-current', 'true'); else y.el.removeAttribute('aria-current'); } });
        if (!x || !x.el) { linia.style.width = '0'; return; }
        // podkreślenie pod aktywną pozycją + pozycja na środku paska
        var li = x.el.parentNode;
        linia.style.width = (x.el.offsetWidth - 16) + 'px';
        linia.style.transform = 'translateX(' + (li.offsetLeft + 8) + 'px)';
        var cel = li.offsetLeft - (lista.clientWidth - li.offsetWidth) / 2;
        try { lista.scrollTo({ left: Math.max(0, cel) }); } catch (e) { lista.scrollLeft = cel; }
    }
    // scroll-spy: ostatnia sekcja, której początek minął belkę; na samym dole strony – ostatnia
    function szpieg(wymus) {
        if (!wymus && Date.now() < blokadaDo) return;
        var granica = WYS + 40, akt = pozycje[0] || null;
        pozycje.forEach(function (x) { if (x.cel.getBoundingClientRect().top <= granica) akt = x; });
        var dol = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
        if (dol && pozycje.length) {
            var ost = pozycje[pozycje.length - 1];
            if (ost.cel.getBoundingClientRect().top < window.innerHeight) akt = ost;
        }
        ustawAktywna(akt);
    }
    function krawedzie() {
        okno.classList.toggle('bs-lewo', lista.scrollLeft > 4);
        okno.classList.toggle('bs-prawo', lista.scrollLeft + lista.clientWidth < lista.scrollWidth - 4);
    }
    function naPrzewiniecie() {
        if (czeka) return;
        czeka = true;
        requestAnimationFrame(function () {
            czeka = false;
            if (!naTelefonie()) { pokaz(false); return; }
            var r = glownyPrzycisk && glownyPrzycisk.offsetParent !== null ? glownyPrzycisk.getBoundingClientRect() : null;
            pokaz(r ? r.bottom < 0 : window.scrollY > 600);
            if (widoczna) szpieg();
        });
    }
    function pokaz(tak) {
        if (tak === widoczna) return;
        widoczna = tak;
        if (tak) rysuj();          // sekcje doczytane później (akcesoria, opinie) pojawiają się przy pokazaniu
        belka.classList.toggle('bs-widoczna', tak);
        belka.setAttribute('aria-hidden', tak ? 'false' : 'true');
        [].forEach.call(lista.querySelectorAll('button'), function (b) { b.tabIndex = tak ? 0 : -1; });
        if (tak) requestAnimationFrame(function () { ustawAktywna(aktywna, true); krawedzie(); });
    }
    function belkaSekcji() {
        belka = el('nav', 'bs-sekcje');
        belka.setAttribute('aria-label', 'Sekcje produktu');
        belka.setAttribute('aria-hidden', 'true');
        okno = el('div', 'bs-sekcje__okno');
        lista = el('ul', 'bs-sekcje__lista');
        linia = el('span', 'bs-sekcje__linia');
        linia.setAttribute('aria-hidden', 'true');
        lista.appendChild(linia);
        okno.appendChild(lista);
        belka.appendChild(okno);
        document.body.appendChild(belka);
        glownyPrzycisk = document.querySelector('.productDetails-section--fixed.hide-on-desktop .productDetails-buttons--cartAdd') ||
            document.querySelector('.productDetails-buttons--cartAdd');
        lista.addEventListener('scroll', krawedzie, { passive: true });
        window.addEventListener('scroll', naPrzewiniecie, { passive: true });
        window.addEventListener('resize', function () { trybTelefonu(); naPrzewiniecie(); if (widoczna) ustawAktywna(aktywna, true); });
        naPrzewiniecie();
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function start() {
        if (!document.querySelector('#AddToCartForm .productDetails-attributes, #AddToCartForm')) return;   // tylko karta produktu
        var st = el('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        zakladkaParametry();
        if (!document.querySelector('#AddToCartForm')) return;
        trybTelefonu();
        sekcjeInline();
        belkaSekcji();
    }

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
