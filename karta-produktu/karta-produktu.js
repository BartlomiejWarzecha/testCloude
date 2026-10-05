// =============================================================================
// KARTA PRODUKTU  (karta-produktu.js)
// 1. Zakładka „Parametry”: cechy produktu (Producent silnika, Dedykowana
//    powierzchnia, Metoda koszenia…) zamiast stosu boksów nad opisem trafiają do
//    zakładki obok „Opis towaru” (na telefonie – do listy zakładek, jak
//    „Identyfikatory towaru”), jako czytelna tabela nazwa – wartość.
//    Oryginalne boksy są tylko ukryte: ich pola attributeId zostają w formularzu,
//    więc „Dodaj do koszyka” wysyła atrybuty jak dotąd. Wybór wariantu (np.
//    „Modele Husqvarna:”) zostaje przy przycisku koszyka – to nie jest parametr.
// 2. Telefon: górna belka z sekcjami karty (Produkt, Opis, Parametry, Części,
//    Akcesoria, Polecane, Opinie…). Wzorem Amazona, Allegro, Zalando, IKEA
//    i zaleceń Baymard / NN/g:
//    - pojawia się dopiero, gdy główny przycisk „Dodaj do koszyka” zniknie
//      z ekranu (przy zdjęciach i cenie nie zabiera miejsca); koszyk zostaje
//      w dolnej belce sklepu,
//    - przewijane w bok „chipy” 36 px, pole dotyku 44 px, aktywna sekcja
//      podświetlona i przewinięta do widoku (scroll-spy),
//    - dotknięcie płynnie przewija do sekcji (bez animacji, gdy telefon ma
//      włączone ograniczenie ruchu) albo otwiera zakładkę (arkusz sklepu),
//    - 52 px wysokości, pod arkuszami i oknami sklepu.
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
        // belka sekcji (telefon)
        '.bs-sekcje{position:fixed;top:0;left:0;right:0;z-index:998;height:52px;background:#fff;' +
            'box-shadow:0 1px 0 #e6e8ec,0 4px 12px rgba(16,24,40,.08);transform:translateY(-100%);' +
            'transition:transform .2s ease;font-family:Poppins,sans-serif;padding-top:env(safe-area-inset-top)}' +
        '.bs-sekcje.bs-widoczna{transform:none}' +
        '.bs-sekcje__lista{display:flex;align-items:center;gap:8px;height:52px;margin:0;padding:0 16px;list-style:none;' +
            'overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-padding:0 16px}' +
        '.bs-sekcje__lista::-webkit-scrollbar{display:none}' +
        '.bs-sekcje__lista li{flex:0 0 auto}' +
        '.bs-sekcje__chip{position:relative;display:inline-flex;align-items:center;gap:4px;height:36px;padding:0 14px;' +
            'border:1px solid #dcdfe4;border-radius:18px;background:#fff;color:#1d2433;font:inherit;font-size:13px;' +
            'font-weight:600;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
        // pole dotyku 44 px przy chipie 36 px
        '.bs-sekcje__chip::after{content:"";position:absolute;left:-4px;right:-4px;top:-4px;bottom:-4px}' +
        '.bs-sekcje__chip[aria-current="true"]{background:#22355c;border-color:#22355c;color:#fff}' +
        '.bs-sekcje__chip:focus-visible{outline:2px solid #22355c;outline-offset:2px}' +
        '.bs-sekcje__chip small{font-weight:400;opacity:.75}' +
        '.bs-sekcje__chip--arkusz::before{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;' +
            'border-top:1.5px solid currentColor;transform:rotate(45deg);order:2;margin-left:2px;opacity:.6}' +
        // cieniowanie przy krawędzi = można przewinąć w bok
        '.bs-sekcje::after{content:"";position:absolute;top:0;right:0;bottom:0;width:28px;pointer-events:none;' +
            'background:linear-gradient(to right,rgba(255,255,255,0),#fff)}' +
        '@media (min-width:769px){.bs-sekcje{display:none}}' +
        '@media (prefers-reduced-motion:reduce){.bs-sekcje{transition:none}}';

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

    // ── 2. Górna belka sekcji (telefon) ──────────────────────────────────────
    var belka, lista, glownyPrzycisk, pozycje = [], aktywna = null, widoczna = false, czeka = false;

    function przewinDo(cel) {
        var y = cel.getBoundingClientRect().top + window.scrollY - 52 - 8;
        var plynnie = !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        try { window.scrollTo({ top: Math.max(0, y), behavior: plynnie ? 'smooth' : 'auto' }); } catch (e) { window.scrollTo(0, y); }
    }
    function nazwaZakladki(b) {
        var t = tekst(b.firstChild && b.firstChild.nodeType === 3 ? b.firstChild : b);
        if (/części zamienne/i.test(t)) return 'Części';
        if (/identyfikatory/i.test(t)) return 'Identyfikatory';
        if (/schemat/i.test(t)) return 'Schemat';
        return t.split(/\s{2,}|–/)[0].trim();
    }
    // sekcje obecne na tej karcie, w kolejności zakupowej
    function zbierzPozycje() {
        var p = [];
        var start = document.querySelector('.productDetails.productDetails-js') || document.querySelector('main');
        if (start) p.push({ nazwa: 'Produkt', cel: start });
        var opis = document.querySelector('.product-mobile-description');
        if (opis && opis.offsetParent !== null && tekst(opis).length > 20) p.push({ nazwa: 'Opis', cel: opis });
        var przyciski = [].filter.call(document.querySelectorAll('.productDetails-detailsButtons--button'), function (b) {
            return b.offsetParent !== null && b.getAttribute('data-content') !== 'description' && b.getAttribute('data-content') !== 'akcesoria';
        });
        function zakladka(id) {
            var b = przyciski.filter(function (x) { return x.getAttribute('data-content') === id; })[0];
            if (b) p.push({ nazwa: nazwaZakladki(b), przycisk: b, licznik: id === 'reviews' ? licznikOpinii() : '' });
        }
        zakladka(ID_ZAKLADKI);
        zakladka('xepc-czesci');
        var akc = document.querySelectorAll('.akc-mobile .akc-sekcja');
        [].forEach.call(akc.length ? akc : document.querySelectorAll('.akc-mobile'), function (s, i) {
            if (s.offsetParent === null) return;
            var h = tekst(s.querySelector('h2, h3, .akc-mtytul'));
            var nazwa = /polecan/i.test(h) ? 'Polecane' : /akcesori/i.test(h) || i === 0 ? 'Akcesoria' : (h.split(' ')[0] || 'Więcej');
            if (!p.some(function (x) { return x.nazwa === nazwa; })) p.push({ nazwa: nazwa, cel: s });
        });
        zakladka('reviews');
        // pozostałe zakładki widoczne na telefonie (np. Identyfikatory towaru)
        przyciski.forEach(function (b) {
            if (!p.some(function (x) { return x.przycisk === b; })) p.push({ nazwa: nazwaZakladki(b), przycisk: b });
        });
        return p;
    }
    function licznikOpinii() {
        var n = tekst(document.querySelector('.productDetails-reviews--count, .rating-count, .ratingCount, .productDetails-rating span'));
        var m = n.match(/\d+/);
        return m && m[0] !== '0' ? m[0] : '';
    }
    function rysuj() {
        var nowe = zbierzPozycje();
        var podpis = nowe.map(function (x) { return x.nazwa + (x.licznik || ''); }).join('|');
        if (lista.getAttribute('data-podpis') === podpis) { pozycje.forEach(function (x, i) { x.cel = nowe[i].cel; x.przycisk = nowe[i].przycisk; }); return; }
        lista.setAttribute('data-podpis', podpis);
        lista.textContent = '';
        pozycje = nowe;
        pozycje.forEach(function (x) {
            var li = el('li');
            var b = el('button', 'bs-sekcje__chip' + (x.przycisk ? ' bs-sekcje__chip--arkusz' : ''));
            b.type = 'button';
            b.appendChild(document.createTextNode(x.nazwa));
            if (x.licznik) b.appendChild(el('small', null, '(' + x.licznik + ')'));
            b.addEventListener('click', function () {
                ga4('product_section_nav', { section: x.nazwa });
                if (x.przycisk) { x.przycisk.click(); return; }
                ustawAktywna(x);
                przewinDo(x.cel);
            });
            x.el = b;
            li.appendChild(b);
            lista.appendChild(li);
        });
        aktywna = null;
        szpieg();
    }
    function ustawAktywna(x) {
        if (aktywna === x) return;
        aktywna = x;
        pozycje.forEach(function (y) { if (y.el) { if (y === x) y.el.setAttribute('aria-current', 'true'); else y.el.removeAttribute('aria-current'); } });
        if (x && x.el) {
            var cel = x.el.parentNode.offsetLeft - (lista.clientWidth - x.el.offsetWidth) / 2;
            try { lista.scrollTo({ left: Math.max(0, cel), behavior: 'smooth' }); } catch (e) { lista.scrollLeft = cel; }
        }
    }
    // scroll-spy: ostatnia sekcja, której początek minął belkę
    function szpieg() {
        var granica = 52 + 24, akt = null;
        pozycje.forEach(function (x) {
            if (!x.cel || x.cel.offsetParent === null) return;
            if (x.cel.getBoundingClientRect().top <= granica) akt = x;
        });
        ustawAktywna(akt || pozycje[0]);
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
        if (tak) rysuj();          // sekcje doczytywane później (akcesoria) pojawiają się przy pokazaniu
        belka.classList.toggle('bs-widoczna', tak);
        belka.setAttribute('aria-hidden', tak ? 'false' : 'true');
        [].forEach.call(lista.querySelectorAll('button'), function (b) { b.tabIndex = tak ? 0 : -1; });
    }
    function belkaSekcji() {
        if (!document.querySelector('#AddToCartForm')) return;
        belka = el('nav', 'bs-sekcje');
        belka.setAttribute('aria-label', 'Sekcje produktu');
        belka.setAttribute('aria-hidden', 'true');
        lista = el('ul', 'bs-sekcje__lista');
        belka.appendChild(lista);
        document.body.appendChild(belka);
        glownyPrzycisk = document.querySelector('.productDetails-section--fixed.hide-on-desktop .productDetails-buttons--cartAdd') ||
            document.querySelector('.productDetails-buttons--cartAdd');
        window.addEventListener('scroll', naPrzewiniecie, { passive: true });
        window.addEventListener('resize', naPrzewiniecie);
        naPrzewiniecie();
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function start() {
        if (!document.querySelector('#AddToCartForm .productDetails-attributes, #AddToCartForm')) return;   // tylko karta produktu
        var st = el('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        zakladkaParametry();
        belkaSekcji();
    }

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
