// =============================================================================
// CENA ORIENTACYJNA W EURO  (cena-euro.js)
// Gdy klient ogląda sklep przetłumaczony przez GTranslate / Tłumacza Google
// na inny język niż polski, pod ceną w złotych pokazuje się jej przeliczenie
// na euro wg średniego kursu NBP (tabela A), np. „≈ 754,15 € – cena orientacyjna”.
//
// Zasady (żeby nie wprowadzać klienta w błąd):
// - cena w PLN zostaje bez zmian i jest jedyną ceną sprzedaży; euro jest tylko
//   dodatkową informacją, mniejszą i oznaczoną jako orientacyjna,
// - przy cenie podajemy źródło i datę kursu oraz że płatność jest w PLN,
// - nie przeliczamy ceny sprzed obniżki ani „najniższej ceny z 30 dni”
//   (te informacje zostają tylko w PLN), nie ruszamy danych dla Google (schema.org),
// - gdy kursu nie da się pobrać albo jest starszy niż 7 dni, euro się nie pokazuje.
//
// Ładować w szablonie całego sklepu:
//   <script src="/usr/cena-euro.js"></script>
// =============================================================================

(function () {
    'use strict';

    // Języki, przy których pokazujemy euro: wszystkie z przełącznika poza polskim.
    // Żeby ograniczyć do wybranych, wpisz np. ['de', 'fr', 'sk'].
    var JEZYKI = null;
    var WALUTA = 'EUR';
    var KURS_URL = 'https://api.nbp.pl/api/exchangerates/rates/A/' + WALUTA + '/?format=json';
    var KLUCZ = 'bs-kurs-' + WALUTA.toLowerCase();
    var ODSWIEZ_MS = 6 * 3600 * 1000;          // nowy kurs najwyżej co 6 h
    var NAJSTARSZY_DNI = 7;                    // starszego kursu nie pokazujemy

    // Ceny w PLN, pod którymi pokazujemy euro (cena sprzedaży, nie stara cena):
    var KARTA = '.productDetails-prices';                       // karta produktu
    var LISTA = '.product-item__prices .redPrice, .product-item__prices .normalPrice, ' +
                '.pricesContainer__normalPrice';                // kafelki i polecane

    var CSS =
        '.cena-euro{display:block;font-size:13px;line-height:1.35;color:#5b6270;font-weight:400;margin-top:2px}' +
        '.cena-euro__kwota{font-weight:600;color:#3a4150;white-space:nowrap}' +
        '.cena-euro--karta{font-size:15px;margin:4px 0 6px}' +
        '.cena-euro--karta .cena-euro__info{display:block;font-size:12px;color:#6b7280;margin-top:2px}';

    var kurs = null;            // { mid: 4.3745, data: '2026-10-02' }
    var jezyk = null;           // np. 'de', null = polski / brak tłumaczenia

    // ── Kurs NBP ─────────────────────────────────────────────────────────────
    function zapamietany() {
        try { return JSON.parse(localStorage.getItem(KLUCZ) || 'null'); } catch (e) { return null; }
    }
    function aktualny(k) {
        if (!k || !(k.mid > 0) || !k.data) return false;
        var wiek = (Date.now() - new Date(k.data + 'T12:00:00').getTime()) / 864e5;
        return wiek <= NAJSTARSZY_DNI;
    }
    var wTrakcie = null;   // jedno zapytanie naraz, nawet gdy strona zmienia się w trakcie
    function pobierzKurs() {
        if (wTrakcie) return wTrakcie;
        wTrakcie = pobierzKursTeraz();
        wTrakcie.then(function () { wTrakcie = null; });
        return wTrakcie;
    }
    function pobierzKursTeraz() {
        var z = zapamietany();
        if (aktualny(z)) kurs = z;
        if (z && aktualny(z) && Date.now() - z.t < ODSWIEZ_MS) return Promise.resolve(kurs);
        // bez ciasteczek i nagłówków – zwykłe publiczne zapytanie do API NBP
        return fetch(KURS_URL, { credentials: 'omit' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        }).then(function (d) {
            var r = d && d.rates && d.rates[0];
            if (!r || !(r.mid > 0)) throw new Error('brak kursu');
            kurs = { mid: r.mid, data: r.effectiveDate, tabela: r.no, t: Date.now() };
            try { localStorage.setItem(KLUCZ, JSON.stringify(kurs)); } catch (e) {}
            return kurs;
        }).catch(function () { return aktualny(kurs) ? kurs : (kurs = null); });
    }

    // ── Język z GTranslate / Tłumacza Google ─────────────────────────────────
    function ciasteczko(n) {
        var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + n + '=([^;]*)'));
        return m ? decodeURIComponent(m[1]) : '';
    }
    function wykryjJezyk() {
        var j = '';
        var g = ciasteczko('googtrans').match(/^\/[a-z-]+\/([a-zA-Z-]+)/);   // „/pl/de”
        if (g) j = g[1];
        var html = document.documentElement;
        if (!j && /translated-(ltr|rtl)/.test(html.className)) j = html.getAttribute('lang') || '';
        j = j.toLowerCase().split('-')[0];
        if (!j || j === 'pl' || j === 'auto') return null;
        if (JEZYKI && JEZYKI.indexOf(j) < 0) return null;
        return j;
    }

    // ── Liczenie i formatowanie ──────────────────────────────────────────────
    // „3 299,00 zł” / „3299,00” -> 3299
    function liczba(t) {
        var s = String(t || '').replace(/[^\d,.\-]/g, '');
        if (!s) return NaN;
        if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
        return parseFloat(s);
    }
    function kwota(pln) {
        var eur = Math.round(pln / kurs.mid * 100) / 100;
        try { return new Intl.NumberFormat(jezyk || 'pl', { style: 'currency', currency: WALUTA }).format(eur); }
        catch (e) { return eur.toFixed(2).replace('.', ',') + ' €'; }
    }
    function dataKursu() {
        var p = kurs.data.split('-');
        return p[2] + '.' + p[1] + '.' + p[0];
    }
    function kursTekst() { return String(kurs.mid).replace('.', ','); }
    function opis() {
        return 'Cena orientacyjna: przeliczenie wg średniego kursu NBP z ' + dataKursu() +
            ' (1 ' + WALUTA + ' = ' + kursTekst() + ' zł). Cena sprzedaży i płatność w PLN.';
    }

    // element z kwotą; sama kwota nie jest tłumaczona (notranslate), opis tłumaczy tłumacz strony
    function element(pln, karta) {
        var el = document.createElement(karta ? 'div' : 'span');
        el.className = 'cena-euro' + (karta ? ' cena-euro--karta' : '');
        el.setAttribute('data-pln', String(pln));
        el.title = opis();
        var k = document.createElement('span');
        k.className = 'cena-euro__kwota notranslate';
        k.setAttribute('translate', 'no');
        k.textContent = '≈ ' + kwota(pln);
        el.appendChild(k);
        if (karta) {
            el.appendChild(document.createTextNode(' – cena orientacyjna'));
            var info = document.createElement('span');
            info.className = 'cena-euro__info';
            info.textContent = 'Przeliczenie wg średniego kursu NBP z ' + dataKursu() + ' (1 ' + WALUTA + ' = ' +
                kursTekst() + ' zł). Cena sprzedaży i płatność w PLN; kwota w euro ma charakter informacyjny.';
            el.appendChild(info);
        } else {
            el.appendChild(document.createTextNode(' (orientacyjnie)'));
        }
        return el;
    }

    // ── Wstawianie ───────────────────────────────────────────────────────────
    function usunWszystko() {
        [].forEach.call(document.querySelectorAll('.cena-euro'), function (e) { e.remove(); });
    }
    // cena sprzedaży na karcie: pierwsza widoczna kwota poza starą ceną, kaucją i najniższą z 30 dni
    function cenaKarty(box) {
        var bloki = box.children;
        for (var i = 0; i < bloki.length; i++) {
            var b = bloki[i];
            if (b.tagName === 'INPUT' || b.classList.contains('cena-euro')) continue;
            if (/old-price|deposit|min-price|loyalty/.test(b.className) || b.classList.contains('hidden')) continue;
            var v = b.querySelector('.value');
            if (v && b.offsetParent !== null) return { blok: b, pln: liczba(v.textContent) };
        }
        return null;
    }
    function odswiez() {
        if (!jezyk || !kurs) { usunWszystko(); return; }
        // karta produktu (wersja na komputer i na telefon)
        [].forEach.call(document.querySelectorAll(KARTA), function (box) {
            var c = cenaKarty(box), stary = box.querySelector(':scope > .cena-euro');
            if (!c || !(c.pln > 0)) { if (stary) stary.remove(); return; }
            if (stary && stary.getAttribute('data-pln') === String(c.pln) && stary.getAttribute('data-j') === jezyk) return;
            if (stary) stary.remove();
            var el = element(c.pln, true);
            el.setAttribute('data-j', jezyk);
            // na końcu bloku cen (pod „najniższą ceną z 30 dni”) – ceny w PLN zostają razem
            var po = box.querySelector(':scope > .min-price:not(.hidden)') || box.querySelector(':scope > .old-price:not(.hidden)') || c.blok;
            box.insertBefore(el, po.nextSibling);
        });
        // listy produktów
        [].forEach.call(document.querySelectorAll(LISTA), function (cena) {
            var pln = liczba(cena.textContent), nast = cena.nextElementSibling;
            var stary = nast && nast.classList.contains('cena-euro') ? nast : null;
            if (!(pln > 0)) { if (stary) stary.remove(); return; }
            if (stary && stary.getAttribute('data-pln') === String(pln) && stary.getAttribute('data-j') === jezyk) return;
            if (stary) stary.remove();
            var el = element(pln, false);
            el.setAttribute('data-j', jezyk);
            cena.parentNode.insertBefore(el, cena.nextSibling);
        });
    }

    // zmiany na stronie (lista po filtrze, wariant produktu, zmiana języka) – odświeżamy raz na klatkę
    var czeka = false;
    function zaplanuj() {
        if (czeka) return;
        czeka = true;
        (window.requestAnimationFrame || setTimeout)(function () {
            czeka = false;
            var j = wykryjJezyk();
            if (j && !kurs) {   // klient właśnie przełączył język – dopiero teraz pobieramy kurs
                jezyk = j;
                pobierzKurs().then(odswiez);
                return;
            }
            jezyk = j;
            odswiez();
        });
    }

    function start() {
        var st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);
        jezyk = wykryjJezyk();
        // kurs pobieramy tylko, gdy strona jest w obcym języku
        (jezyk ? pobierzKurs() : Promise.resolve()).then(odswiez);
        if (window.MutationObserver) {
            new MutationObserver(function (zmiany) {
                for (var i = 0; i < zmiany.length; i++) {
                    var t = zmiany[i].target;
                    // własne zmiany i tłumaczenie tekstu euro nie wywołują ponownego liczenia
                    if (t.closest && t.closest('.cena-euro')) continue;
                    if (t.nodeType === 3 && t.parentNode && t.parentNode.closest && t.parentNode.closest('.cena-euro')) continue;
                    zaplanuj();
                    return;
                }
            }).observe(document.body, { childList: true, subtree: true, characterData: true });
            // tłumacz oznacza zmianę języka na <html> (klasa translated-ltr, atrybut lang)
            new MutationObserver(zaplanuj).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'lang'] });
        }
        // GTranslate zmienia ciasteczko bez zmiany strony – sprawdzamy co 2 s
        setInterval(function () { if (wykryjJezyk() !== jezyk) zaplanuj(); }, 2000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
