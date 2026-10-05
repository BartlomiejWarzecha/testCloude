// =============================================================================
// PORÓWNYWARKA  (porownywarka.js) – strona porownywarka,9
// Zamiast osobnego slidera w każdym wierszu: jedna tabela, w której kolumny
// produktów przewijają się razem, a nazwy cech zostają przyklejone z lewej.
// - „Pokaż tylko różnice” + wyróżnienie wierszy, w których produkty się różnią,
// - puste cechy (żaden produkt nie ma danych), „Ocena” bez opinii i „Marka”
//   powtarzająca „Producenta” są ukryte; brak danych zawsze jako „—”,
// - poprawne wartości: skrypt sklepu wstawiał spację przed każdą wielką literą
//   („B R A K D A N Y C H”, „K OŁ O”, „25,4 M M”) – czytamy je z HTML strony
//   przed tą zmianą; nazwy cech i wartości PISANE WERSALIKAMI – zwykłą pisownią,
// - pasek z nazwami i cenami przyklejony u góry przy przewijaniu długiej listy,
// - „Najniższa cena” przy najtańszym produkcie,
// - usuwanie produktu bez przeładowania strony, „Wyczyść porównanie” z potwierdzeniem,
// - „+ Dodaj produkt” (powrót do ostatnio oglądanej kategorii),
// - telefon: dwa produkty obok siebie, nazwa cechy nad wartościami, przewijanie
//   palcem kolumna po kolumnie.
// „Dodaj do koszyka” i „Ulubione” to oryginalne przyciski sklepu (działają jak dotąd).
//
// Ładować w szablonie całego sklepu (poza porównywarką tylko zapamiętuje
// ostatnią listę produktów dla „+ Dodaj produkt”):
//   <script src="/usr/porownywarka.js"></script>
// =============================================================================

(function () {
    'use strict';
    if (window.__bsPorownywarka) return;
    window.__bsPorownywarka = true;

    var KLUCZ_LISTA = 'bs-porownywarka-lista';
    var MAX_PRODUKTOW = 4;
    var UKRYTE_CECHY = /^\s*KATEGORIA SPRZEDA[ŻZ]Y\s*:?\s*$/i;     // wewnętrzne, jak w ukryte-atrybuty.js
    var BRAK = /^\s*(-+|—|–|brak danych|brak|n\/a|)\s*$/i;

    // ── Poza porównywarką: zapamiętaj ostatnią listę produktów ───────────────
    function naPorownywarce() { return /(^|\/)porownywarka,9/.test(location.pathname); }
    if (!naPorownywarce()) {
        if (/,2(,\d+)?\/?$/.test(location.pathname) || /,2,\d+/.test(location.pathname)) {
            try { sessionStorage.setItem(KLUCZ_LISTA, location.pathname + location.search); } catch (e) {}
        }
        return;
    }

    var CSS =
        '.pc{font-family:Poppins,sans-serif;color:#1d2433;margin:8px 0 40px}' +
        '.pc *,.pc-pasek,.pc-pasek *{box-sizing:border-box}' +
        '.pc-pasek{font-family:Poppins,sans-serif}' +
        '.pc-gora{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;margin:0 0 16px}' +
        '.pc-tytul{font-size:22px;font-weight:600;margin:0;flex:1 1 auto}' +
        '.pc-przel{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;font-weight:600;user-select:none}' +
        '.pc-przel input{position:absolute;opacity:0;width:1px;height:1px}' +
        '.pc-przel__tor{width:40px;height:22px;border-radius:11px;background:#c9ced6;position:relative;transition:background .15s;flex:0 0 auto}' +
        '.pc-przel__tor::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}' +
        '.pc-przel input:checked+.pc-przel__tor{background:#22355c}' +
        '.pc-przel input:checked+.pc-przel__tor::after{left:21px}' +
        '.pc-przel input:focus-visible+.pc-przel__tor{outline:2px solid #22355c;outline-offset:2px}' +
        '.pc-przel small{font-weight:400;color:#6b7280}' +
        '.pc-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border:1px solid #dcdfe4;border-radius:8px;background:#fff;' +
            'color:#1d2433;font:inherit;font-size:14px;font-weight:600;text-decoration:none;cursor:pointer}' +
        '.pc-btn:hover{border-color:#22355c;color:#22355c}' +
        '.pc-btn--usun{color:#6b7280;font-weight:500}' +
        '.pc-przewin{position:relative;overflow-x:auto;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;' +
            'border:1px solid #e3e6ea;border-radius:10px;background:#fff}' +
        '.pc-tab{border-collapse:separate;border-spacing:0;width:100%;min-width:max-content;table-layout:fixed}' +
        '.pc-tab th,.pc-tab td{padding:12px 16px;vertical-align:top;text-align:left;font-size:14px;line-height:1.45;border-bottom:1px solid #eef0f3}' +
        '.pc-lab{position:sticky;left:0;z-index:2;background:#fafbfc;width:220px;min-width:220px;max-width:220px;font-weight:500;color:#4a5263;' +
            'box-shadow:1px 0 0 #e3e6ea}' +
        '.pc-kol{width:250px;min-width:250px;scroll-snap-align:start}' +
        '.pc-tab td+td,.pc-tab th.pc-kol+th.pc-kol{border-left:1px solid #f1f3f5}' +
        '.pc-prod{position:relative;padding-top:16px!important;background:#fff;font-weight:400}' +
        '.pc-rog{font-size:12px;font-weight:400;color:#6b7280;vertical-align:bottom!important}' +
        '.pc-rog i{display:inline-block;width:3px;height:14px;background:#22355c;vertical-align:-2px;margin-right:6px}' +
        '.pc-rog__l{display:block;margin-top:4px}' +
        '.pc-rog__naj b,.pc-naj::before{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;' +
            'background:#16a34a;color:#fff;font-size:10px;font-weight:700;margin-right:6px;vertical-align:1px}' +
        '.pc-tab td.pc-naj{background:#ecfdf3;color:#166534}' +
        '.pc-naj::before{content:"✓"}' +
        '.pc-prod__usun{position:absolute;top:8px;right:8px;width:30px;height:30px;border:0;border-radius:50%;background:#f3f4f6;' +
            'color:#4a5263;font-size:18px;line-height:30px;cursor:pointer;padding:0}' +
        '.pc-prod__usun:hover{background:#e5e7eb;color:#b42318}' +
        '.pc-prod__img{display:flex;align-items:center;justify-content:center;height:150px;margin:0 28px 10px}' +
        '.pc-prod__img img{max-width:100%;max-height:150px;object-fit:contain}' +
        '.pc-prod__nazwa{display:block;font-weight:600;font-size:14px;line-height:1.35;color:#1d2433;text-decoration:none;margin-bottom:8px;' +
            'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:57px}' +
        '.pc-prod__nazwa:hover{color:#22355c;text-decoration:underline}' +
        '.pc-prod .productPrices{margin-bottom:10px}' +
        '.pc-prod .productPrice{font-size:20px;font-weight:700;color:#1d2433}' +
        '.pc-prod .productPrice.redPrice{color:#e30613}' +
        '.pc-prod .productPrice .currency{font-size:14px}' +
        '.pc-prod .previousPrice{font-size:13px;text-decoration:line-through;color:#6b7280}' +
        '.pc-prod .min-price{font-size:11px;color:#6b7280;line-height:1.3}' +
        '.pc-prod .buttons{display:flex;align-items:center;gap:10px}' +
        '.pc-prod .addToCartButton{flex:1 1 auto;min-height:42px;padding:8px 12px;border:0;border-radius:8px;background:#e30613;' +
            'color:#fff;font:inherit;font-size:13px;font-weight:700;text-transform:uppercase;cursor:pointer}' +
        '.pc-prod .addToCartButton:hover{background:#c40510}' +
        '.pc-prod .addToFavouriteButton{flex:0 0 auto;cursor:pointer}' +
        '.pc-najtaniej{display:inline-block;margin-bottom:6px;padding:2px 8px;border-radius:999px;background:#e8f5ee;color:#166534;font-size:12px;font-weight:600}' +
        '.pc-grupa th{background:#f3f5f8;font-size:13px;font-weight:700;color:#22355c;text-transform:none;letter-spacing:.02em;padding:9px 16px}' +
        '.pc-grupa th span{position:sticky;left:16px}' +
        '.pc-rozne .pc-lab{box-shadow:inset 3px 0 0 #22355c,1px 0 0 #e3e6ea;color:#1d2433}' +
        '.pc-rozne td{font-weight:600}' +
        '.pc-brak{color:#9aa1ad;font-weight:400!important}' +
        '.pc-etykieta{display:none}' +
        '.pc-podpowiedz{display:none;font-size:12px;color:#6b7280;margin:-6px 0 8px}' +
        '.pc-tylko-roznice .pc-wiersz:not(.pc-rozne),.pc-tylko-roznice .pc-etykieta:not(.pc-rozne){display:none}' +
        '.pc-tylko-roznice .pc-grupa.pc-pusta{display:none}' +
        '.pc-dodaj{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;min-height:260px;' +
            'border:2px dashed #dcdfe4;border-radius:10px;color:#22355c;text-decoration:none;font-weight:600;text-align:center;padding:16px}' +
        '.pc-dodaj:hover{border-color:#22355c;background:#f7f9fc}' +
        '.pc-dodaj b{font-size:34px;line-height:1}' +
        '.pc-dodaj small{font-weight:400;color:#6b7280;font-size:12px}' +
        // przyklejony pasek z nazwami i cenami
        '.pc-pasek{position:fixed;top:0;left:0;right:0;z-index:50;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08);' +
            'transform:translateY(-110%);transition:transform .18s;pointer-events:none}' +
        '.pc-pasek.pc-widoczny{transform:none;pointer-events:auto}' +
        '.pc-pasek__okno{overflow:hidden;margin:0 auto}' +
        '.pc-pasek__rzad{display:flex}' +
        '.pc-pasek__lab{flex:0 0 220px;padding:8px 16px;font-size:13px;font-weight:600;color:#4a5263;background:#fafbfc;position:relative;z-index:1}' +
        '.pc-pasek__kol{flex:0 0 250px;padding:8px 16px;display:flex;gap:10px;align-items:center;min-width:0}' +
        '.pc-pasek__kol img{width:36px;height:36px;object-fit:contain;flex:0 0 auto}' +
        '.pc-pasek__kol div{min-width:0}' +
        '.pc-pasek__kol a{display:block;font-size:13px;font-weight:600;color:#1d2433;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.pc-pasek__kol span{font-size:13px;font-weight:700;color:#e30613}' +
        '.pc-pusto{width:100%;text-align:center;padding:48px 16px}' +
        '.pc-pusto p{font-size:16px;margin:0 0 18px}' +
        '.pc-pusto .pc-btn{margin:4px}' +
        // telefon: dwa produkty obok siebie, nazwa cechy nad wartościami
        '@media (max-width:768px){' +
            '.pc-tytul{font-size:18px;flex-basis:100%}' +
            '.pc-gora{gap:10px}' +
            '.pc-przewin{scroll-snap-type:x mandatory;border-radius:8px}' +
            '.pc-tab th.pc-lab,.pc-tab td.pc-lab,.pc-wiersz>.pc-lab{display:none}' +
            '.pc-etykieta{display:table-row}' +
            '.pc-podpowiedz{display:block}' +
            '.pc-etykieta th{padding:10px 12px 2px;border-bottom:0;font-size:12px;font-weight:600;color:#6b7280;background:#fff}' +
            '.pc-etykieta th span{position:sticky;left:12px}' +
            '.pc-rozne.pc-etykieta th{color:#22355c}' +
            '.pc-kol{width:calc((100vw - 34px)/2);min-width:calc((100vw - 34px)/2)}' +
            '.pc-tab th,.pc-tab td{padding:4px 12px 10px;font-size:13px}' +
            '.pc-prod{padding-top:12px!important}' +
            '.pc-prod__img{height:100px;margin:0 22px 8px}.pc-prod__img img{max-height:100px}' +
            '.pc-prod .productPrice{font-size:17px}' +
            '.pc-prod .buttons{gap:6px}.pc-prod .addToCartButton{font-size:11px;min-height:38px;padding:6px 8px}' +
            '.pc-rozne td{box-shadow:none}' +
            '.pc-pasek__lab{display:none}.pc-pasek__kol{flex-basis:calc((100vw - 34px)/2);padding:6px 10px}.pc-pasek__kol img{display:none}' +
            '.pc-dodaj{min-height:200px}' +
        '}';

    // ── Pomocnicze ───────────────────────────────────────────────────────────
    function el(tag, klasa, tekst) {
        var e = document.createElement(tag);
        if (klasa) e.className = klasa;
        if (tekst != null) e.textContent = tekst;
        return e;
    }
    function tekst(n) { return n ? (n.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
    function wersaliki(t) { return t && t === t.toUpperCase() && /[A-ZĄĆĘŁŃÓŚŹŻ]{3}/.test(t); }
    function zwykle(t) { t = t.toLocaleLowerCase('pl'); return t.charAt(0).toLocaleUpperCase('pl') + t.slice(1); }
    // nazwa cechy: „ŚREDNICA TARCZY” -> „Średnica tarczy”
    function nazwaCechy(t) { return wersaliki(t) ? zwykle(t) : t; }
    // wartość: „KOŁO” -> „Koło”, „25,4 MM” -> „25,4 mm”; kody (z cyframi, bez spacji) zostają
    function wartosc(t) {
        t = t.replace(/(\d)\s*(MM|CM|KG|KW|ML|CM3|CCM)\b/g, function (m, d, j) {
            return d + ' ' + ({ KW: 'kW', CM3: 'cm³', CCM: 'cm³' }[j] || j.toLowerCase());
        });
        if (wersaliki(t) && !/\d/.test(t)) t = zwykle(t);
        return t;
    }
    function porownawczo(t) { return String(t || '').toLocaleLowerCase('pl').replace(/\s+/g, ' ').trim(); }
    // „1 179,00 zł” / „1,179.00 PLN” -> 1179
    function liczba(t) {
        var s = String(t || '').replace(/[^\d.,]/g, '');
        var m = s.match(/^(.*?)[.,](\d{2})$/);
        if (m) return parseFloat((m[1].replace(/[.,]/g, '') || '0') + '.' + m[2]);
        return parseFloat(s.replace(/[.,]/g, ''));
    }

    // ── Dane ─────────────────────────────────────────────────────────────────
    // Produkty z bieżącej strony (zdjęcie, nazwa, ceny, oryginalne przyciski sklepu).
    function produktyZeStrony(kont) {
        var widziane = {};
        return [].map.call(kont.querySelectorAll('#firstRow .topSection-productInfo'), function (s) {
            var id = (s.querySelector('input[name="productId"]') || {}).value || (s.querySelector('.removeItem') || { getAttribute: function () { return ''; } }).getAttribute('data-id');
            if (!id || widziane[id]) return null;
            widziane[id] = 1;
            var a = s.querySelector('.productName a');
            var img = s.querySelector('.productImage img');
            var cena = s.querySelector('.productPrice');
            return {
                id: String(id),
                nazwa: tekst(a) || (img && img.alt) || '',
                url: a ? a.getAttribute('href') : '#',
                img: img ? (img.getAttribute('data-lazy') || img.getAttribute('src')) : '',
                ceny: s.querySelector('.productPrices'),
                przyciski: s.querySelector('.buttons'),
                cena: cena ? liczba(cena.textContent) : NaN
            };
        }).filter(Boolean);
    }
    // Wiersze cech z HTML strony (przed skryptem sklepu, który psuł wartości).
    function wierszeZHtml(doc, ile) {
        var wiersze = [];
        [].forEach.call(doc.querySelectorAll('.comparerContainer .row'), function (r) {
            if (r.id === 'firstRow') return;
            var nazwa = tekst(r.querySelector('.propertyName'));
            if (!nazwa) return;
            var grupa = r.classList.contains('groupInfo');
            var komorki = [].slice.call(r.querySelectorAll('.propertyValueContainer'), 0, ile);
            var w = { nazwa: nazwa, grupa: grupa, wartosci: [] };
            komorki.forEach(function (k) {
                var ocena = k.querySelector('.rating');
                if (ocena) {
                    var licz = tekst(ocena.querySelector('.ratingCount')).replace(/\D/g, '');
                    w.ocena = true;
                    w.wartosci.push({ html: ocena.outerHTML, tekst: licz, brak: !licz || licz === '0' });
                    return;
                }
                var t = tekst(k);
                var brak = BRAK.test(t);
                w.wartosci.push({ tekst: brak ? '' : wartosc(t), brak: brak });
            });
            wiersze.push(w);
        });
        return wiersze;
    }
    function pobierzWiersze(ile) {
        return fetch(location.pathname + location.search, { credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (html) {
            return wierszeZHtml(new DOMParser().parseFromString(html, 'text/html'), ile);
        });
    }

    // ── Najkorzystniejsza wartość ────────────────────────────────────────────
    // Tylko cechy, przy których wiadomo, co jest lepsze (rozpoznawane po nazwie).
    // Cechy niejednoznaczne (napięcie, długość prowadnicy, wysokość koszenia…) bez wyróżnienia.
    var WIECEJ_LEPIEJ = /(moc|pojemno|szeroko\S* (koszenia|robocza|cięcia|ciecia)|powierzchni|zasięg|zasieg|czas pracy|wydajno|ciśnieni|cisnieni|przepływ|przeplyw|gwarancj|nachyleni|liczba stref|długość węża|dlugosc weza|udźwig|udzwig|prędkość jazdy|siła ciągu|sila ciagu)/i;
    var MNIEJ_LEPIEJ = /(^waga|masa|ciężar|ciezar|hałas|halas|głośno|glosno|poziom (mocy )?akustyczn|ci[sś]nienia akustyczn|drgania|wibracj|czas ładowania|czas ladowania|zużycie|zuzycie|spalanie)/i;
    var NIEJEDNOZNACZNE = /(napięci|napieci|prowadnic|wysoko\S* koszenia|obroty|prędkość obrotowa|predkosc obrotowa|średnica|srednica|gwint|podziałka|podzialka)/i;
    // liczba i jednostka z wartości („5,1 kg”, „1 200 m²”, „~25 m”); zakresy („25–75 mm”) pomijamy
    function liczbaZJednostka(t) {
        t = String(t || '').trim();
        if (/\d\s*[-–—]\s*\d/.test(t)) return null;
        // przedrostki „do 600 m²”, „max. 25”, „ok. 3 h”, „~5 kg”
        t = t.replace(/^(?:\s|do\b|max\.?|maks\.?|ok\.?|około|okolo|ponad|~|≈)+/i, '');
        var m = t.match(/^(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,](\d+))?\s*(.*)$/i);
        if (!m) return null;
        var j = m[3].toLowerCase().replace(/\s+/g, ' ').trim().replace(/^m2$/, 'm²').replace(/^m3$/, 'm³');
        return { n: parseFloat(m[1].replace(/[ \u00a0]/g, '') + (m[2] ? '.' + m[2] : '')), j: j };
    }
    // „Od ręki” = 0 dni, „3 – 5 dni” = 3, „24 h” = 1
    function dniDostawy(t) {
        t = porownawczo(t);
        if (/od r[eę]ki|dost[eę]pny|natychmiast|24 ?h/.test(t)) return /24 ?h/.test(t) ? 1 : 0;
        var m = t.match(/(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }
    // indeksy produktów z najkorzystniejszą wartością (puste, gdy nie da się ocenić albo wszystkie równe)
    function najlepsze(w) {
        var kierunek = 0, liczby;
        if (/^dost[eę]pno/i.test(w.nazwa)) {
            kierunek = -1;
            liczby = w.wartosci.map(function (v) { return v.brak ? null : dniDostawy(v.tekst); });
        } else {
            if (NIEJEDNOZNACZNE.test(w.nazwa)) return [];
            if (MNIEJ_LEPIEJ.test(w.nazwa)) kierunek = -1;
            else if (WIECEJ_LEPIEJ.test(w.nazwa)) kierunek = 1;
            if (!kierunek) return [];
            var jedn = null, zgodne = true;
            liczby = w.wartosci.map(function (v) {
                if (v.brak) return null;
                var x = liczbaZJednostka(v.tekst);
                if (!x) { zgodne = false; return null; }
                if (jedn === null) jedn = x.j; else if (x.j !== jedn) zgodne = false;   // różne jednostki – nie porównujemy
                return x.n;
            });
            if (!zgodne) return [];
        }
        var znane = liczby.filter(function (n) { return n !== null && !isNaN(n); });
        if (znane.length < 2) return [];
        var best = kierunek > 0 ? Math.max.apply(null, znane) : Math.min.apply(null, znane);
        if (znane.every(function (n) { return n === best; })) return [];
        var idx = [];
        liczby.forEach(function (n, i) { if (n === best) idx.push(i); });
        return idx;
    }

    // ── Budowa tabeli ────────────────────────────────────────────────────────
    var stan = { produkty: [], wiersze: [], tylkoRoznice: false };
    var pc, tab, przewin, licznik, przelLicz, pasek, podp;

    function czyRozne(w) {
        var z = {};
        w.wartosci.forEach(function (v) { z[v.brak ? '∅' : porownawczo(v.tekst)] = 1; });
        return Object.keys(z).length > 1;
    }
    function widoczneWiersze() {
        var producent = stan.wiersze.filter(function (w) { return /^producent$/i.test(w.nazwa); })[0];
        return stan.wiersze.filter(function (w) {
            if (w.grupa) return true;
            if (UKRYTE_CECHY.test(w.nazwa)) return false;
            if (w.wartosci.every(function (v) { return v.brak; })) return false;     // nikt nie ma danych / brak opinii
            // „Marka” = „Producent” u wszystkich produktów
            if (/^marka$/i.test(w.nazwa) && producent && w.wartosci.every(function (v, i) {
                return porownawczo(v.tekst) === porownawczo((producent.wartosci[i] || {}).tekst);
            })) return false;
            return true;
        });
    }

    function komorkaProduktu(p, najtaniej) {
        var th = el('th', 'pc-kol pc-prod');
        th.setAttribute('scope', 'col');
        th.setAttribute('data-id', p.id);
        var usun = el('button', 'pc-prod__usun', '×');
        usun.type = 'button';
        usun.title = 'Usuń z porównania';
        usun.setAttribute('aria-label', 'Usuń z porównania: ' + p.nazwa);
        usun.addEventListener('click', function () { usunProdukt(p.id); });
        th.appendChild(usun);
        var fot = el('a', 'pc-prod__img');
        fot.href = p.url;
        fot.setAttribute('tabindex', '-1');
        if (p.img) {
            var img = el('img');
            img.src = p.img;
            img.alt = p.nazwa;
            img.loading = 'lazy';
            img.onerror = function () { fot.textContent = ''; };
            fot.appendChild(img);
        }
        th.appendChild(fot);
        var n = el('a', 'pc-prod__nazwa', p.nazwa);
        n.href = p.url;
        n.title = p.nazwa;
        th.appendChild(n);
        if (najtaniej) th.appendChild(el('span', 'pc-najtaniej', 'Najniższa cena'));
        if (p.ceny) th.appendChild(p.ceny);
        if (p.przyciski) th.appendChild(p.przyciski);
        return th;
    }

    function zbuduj() {
        var ile = stan.produkty.length;
        tab.textContent = '';
        var ceny = stan.produkty.map(function (p) { return p.cena; }).filter(function (c) { return c > 0; });
        var min = ceny.length > 1 ? Math.min.apply(null, ceny) : NaN;
        var ileMin = stan.produkty.filter(function (p) { return p.cena === min; }).length;

        var thead = el('thead'), tr = el('tr');
        var rog = el('th', 'pc-lab');
        rog.setAttribute('scope', 'col');
        rog.className = 'pc-lab pc-rog';
        if (ile > 1) {
            var l1 = el('span', 'pc-rog__l');
            l1.appendChild(el('i'));
            l1.appendChild(document.createTextNode('Wyróżnione cechy różnią produkty'));
            rog.appendChild(l1);
            var l2 = el('span', 'pc-rog__l pc-rog__naj');
            l2.appendChild(el('b', null, '✓'));
            l2.appendChild(document.createTextNode('Najkorzystniejsza wartość'));
            rog.appendChild(l2);
        }
        tr.appendChild(rog);
        stan.produkty.forEach(function (p) { tr.appendChild(komorkaProduktu(p, p.cena === min && ileMin === 1)); });
        var dodaj = ile < MAX_PRODUKTOW;
        if (dodaj) {
            var thD = el('th', 'pc-kol');
            var a = el('a', 'pc-dodaj');
            a.href = ostatniaLista();
            a.appendChild(el('b', null, '+'));
            a.appendChild(el('span', null, 'Dodaj produkt do porównania'));
            a.appendChild(el('small', null, 'Wróć do listy i kliknij „Porównaj” (do ' + MAX_PRODUKTOW + ' produktów)'));
            thD.appendChild(a);
            tr.appendChild(thD);
        }
        thead.appendChild(tr);
        tab.appendChild(thead);

        var tbody = el('tbody'), kolumn = ile + (dodaj ? 1 : 0);
        var lista = widoczneWiersze(), roznic = 0, najlepszych = 0;
        // grupa bez widocznych wierszy (np. same puste cechy) – bez nagłówka
        lista = lista.filter(function (w, i) {
            if (!w.grupa) return true;
            var nast = lista[i + 1];
            return nast && !nast.grupa;
        });
        var aktGrupa = null;
        lista.forEach(function (w) {
            if (w.grupa) {
                aktGrupa = el('tr', 'pc-grupa pc-pusta');
                var th = el('th');
                th.colSpan = kolumn + 1;
                th.setAttribute('scope', 'colgroup');
                th.appendChild(el('span', null, nazwaCechy(w.nazwa)));
                aktGrupa.appendChild(th);
                tbody.appendChild(aktGrupa);
                return;
            }
            // kod towaru różni się zawsze – nie wyróżniamy go i nie liczymy jako różnicy
            var rozne = ile > 1 && !/^kod( towaru)?$/i.test(w.nazwa) && czyRozne(w);
            if (rozne) { roznic++; if (aktGrupa) aktGrupa.classList.remove('pc-pusta'); }
            var nazwa = nazwaCechy(w.nazwa);
            // telefon: nazwa cechy w osobnym wierszu nad wartościami
            var et = el('tr', 'pc-etykieta' + (rozne ? ' pc-rozne' : ''));
            var thE = el('th');
            thE.colSpan = kolumn;
            thE.appendChild(el('span', null, nazwa));
            et.appendChild(thE);
            tbody.appendChild(et);
            var r = el('tr', 'pc-wiersz' + (rozne ? ' pc-rozne' : ''));
            var lab = el('th', 'pc-lab', nazwa);
            lab.setAttribute('scope', 'row');
            r.appendChild(lab);
            var naj = ile > 1 ? najlepsze(w) : [];
            if (naj.length) najlepszych++;
            w.wartosci.forEach(function (v, i) {
                var td = el('td', 'pc-kol' + (v.brak ? ' pc-brak' : '') + (naj.indexOf(i) >= 0 ? ' pc-naj' : ''));
                if (naj.indexOf(i) >= 0) td.title = 'Najkorzystniejsza wartość w porównaniu';
                if (v.brak) td.textContent = '—';
                else if (v.html) td.innerHTML = v.html;
                else td.textContent = v.tekst;
                r.appendChild(td);
            });
            if (dodaj) r.appendChild(el('td', 'pc-kol'));
            tbody.appendChild(r);
        });
        tab.appendChild(tbody);
        var lNaj = tab.querySelector('.pc-rog__naj');
        if (lNaj) lNaj.hidden = !najlepszych;

        licznik.textContent = 'Porównanie produktów (' + ile + ')';
        podp.textContent = ile > 2 ? 'Przesuń tabelę w bok, żeby zobaczyć pozostałe produkty (' + ile + ') →' : '';
        przelLicz.textContent = ile > 1 ? '(' + roznic + ')' : '';
        pc.querySelector('.pc-przel').hidden = ile < 2;
        zbudujPasek();
    }

    // ── Pasek przyklejony u góry ─────────────────────────────────────────────
    function zbudujPasek() {
        if (!pasek) {
            pasek = el('div', 'pc-pasek');
            pasek.setAttribute('aria-hidden', 'true');
            pasek.appendChild(el('div', 'pc-pasek__okno'));
            document.body.appendChild(pasek);
            window.addEventListener('scroll', pokazPasek, { passive: true });
            window.addEventListener('resize', function () { wymiarPaska(); pokazPasek(); });
            przewin.addEventListener('scroll', function () { pasek.firstChild.scrollLeft = przewin.scrollLeft; }, { passive: true });
        }
        var okno = pasek.firstChild, rzad = el('div', 'pc-pasek__rzad');
        okno.textContent = '';
        rzad.appendChild(el('div', 'pc-pasek__lab', 'Porównujesz'));
        stan.produkty.forEach(function (p) {
            var k = el('div', 'pc-pasek__kol');
            if (p.img) { var i = el('img'); i.src = p.img; i.alt = ''; i.onerror = function () { this.remove(); }; k.appendChild(i); }
            var d = el('div'), a = el('a', null, p.nazwa);
            a.href = p.url;
            d.appendChild(a);
            var cena = p.ceny && p.ceny.querySelector('.productPrice');
            if (cena) d.appendChild(el('span', null, tekst(cena)));
            k.appendChild(d);
            rzad.appendChild(k);
        });
        okno.appendChild(rzad);
        wymiarPaska();
        pokazPasek();
    }
    function wymiarPaska() {
        if (!pasek) return;
        var r = przewin.getBoundingClientRect(), okno = pasek.firstChild;
        okno.style.width = r.width + 'px';
        okno.style.marginLeft = r.left + 'px';
        var naglowki = tab.querySelectorAll('thead th'), kol = okno.querySelectorAll('.pc-pasek__lab, .pc-pasek__kol');
        for (var i = 0; i < kol.length && i < naglowki.length; i++) {
            if (getComputedStyle(naglowki[i]).display === 'none') { kol[i].style.display = 'none'; continue; }
            kol[i].style.display = '';
            kol[i].style.flexBasis = naglowki[i].getBoundingClientRect().width + 'px';
        }
        okno.scrollLeft = przewin.scrollLeft;
    }
    function pokazPasek() {
        var th = tab.querySelector('thead');
        if (!th) return;
        var g = th.getBoundingClientRect(), t = tab.getBoundingClientRect();
        pasek.classList.toggle('pc-widoczny', g.bottom < 0 && t.bottom > 120);
    }

    // ── Akcje ────────────────────────────────────────────────────────────────
    function usunZSesji(id) {
        return window.$.post(null, { __action: 'product/ComparisonToolDelete', __csrf: window.__CSRF, productId: id });
    }
    function usunProdukt(id) {
        var th = tab.querySelector('th[data-id="' + id + '"]');
        if (th) th.style.opacity = '.4';
        usunZSesji(id).then(function () {
            stan.produkty = stan.produkty.filter(function (p) { return p.id !== id; });
            var idx = -1;
            [].forEach.call(tab.querySelectorAll('thead th.pc-prod'), function (x, i) { if (x.getAttribute('data-id') === id) idx = i; });
            if (idx >= 0) stan.wiersze.forEach(function (w) { if (!w.grupa) w.wartosci.splice(idx, 1); });
            if (!stan.produkty.length) { location.reload(); return; }
            zbuduj();
            if (typeof window.ga4Wyslij === 'function') try { window.ga4Wyslij('compare_remove', { products: stan.produkty.length }); } catch (e) {}
        }, function () {
            if (th) th.style.opacity = '';
            if (window.app && app.showTemporaryPopup) app.showTemporaryPopup('Nie udało się usunąć produktu. Spróbuj ponownie.', 'error');
        });
    }
    function wyczysc() {
        if (!window.confirm('Usunąć wszystkie produkty z porównania?')) return;
        var ids = stan.produkty.map(function (p) { return p.id; });
        ids.reduce(function (pr, id) { return pr.then(function () { return usunZSesji(id); }); }, Promise.resolve())
            .then(function () { location.reload(); }, function () { location.reload(); });
    }
    function ostatniaLista() {
        var l = null;
        try { l = sessionStorage.getItem(KLUCZ_LISTA); } catch (e) {}
        if (!l && document.referrer) {
            try { var u = new URL(document.referrer); if (u.origin === location.origin && /,2/.test(u.pathname)) l = u.pathname + u.search; } catch (e) {}
        }
        return l || '/produkty,2';
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function pusto(kont) {
        var stare = kont.querySelector('.noProducts');
        if (!stare) return;
        var box = el('div', 'pc pc-pusto');
        box.appendChild(el('p', null, 'Nie masz jeszcze produktów do porównania. Kliknij „Porównaj” przy produkcie, ' +
            'żeby zestawić do ' + MAX_PRODUKTOW + ' produktów obok siebie.'));
        var a = el('a', 'pc-btn', 'Wróć do ostatniej listy produktów');
        a.href = ostatniaLista();
        box.appendChild(a);
        var b = el('a', 'pc-btn', 'Wszystkie kategorie');
        b.href = '/produkty,2';
        box.appendChild(b);
        stare.parentNode.replaceChild(box, stare);
    }

    function start() {
        var kont = document.querySelector('.comparerContainer');
        if (!kont || kont.__pc) return;
        kont.__pc = true;
        var st = el('style');
        st.textContent = CSS;
        document.head.appendChild(st);

        var produkty = produktyZeStrony(kont);
        if (!produkty.length) { pusto(kont); return; }

        pobierzWiersze(produkty.length).then(function (wiersze) {
            stan.produkty = produkty;
            stan.wiersze = wiersze;

            pc = el('div', 'pc');
            var gora = el('div', 'pc-gora');
            licznik = el('h1', 'pc-tytul');
            gora.appendChild(licznik);
            var przel = el('label', 'pc-przel');
            var ch = el('input');
            ch.type = 'checkbox';
            ch.addEventListener('change', function () {
                stan.tylkoRoznice = ch.checked;
                pc.classList.toggle('pc-tylko-roznice', ch.checked);
                wymiarPaska();
            });
            przel.appendChild(ch);
            przel.appendChild(el('span', 'pc-przel__tor'));
            przel.appendChild(el('span', null, 'Pokaż tylko różnice'));
            przelLicz = el('small');
            przel.appendChild(przelLicz);
            gora.appendChild(przel);
            var czysc = el('button', 'pc-btn pc-btn--usun', 'Wyczyść porównanie');
            czysc.type = 'button';
            czysc.addEventListener('click', wyczysc);
            gora.appendChild(czysc);
            pc.appendChild(gora);
            podp = el('p', 'pc-podpowiedz');
            pc.appendChild(podp);

            przewin = el('div', 'pc-przewin');
            przewin.setAttribute('tabindex', '0');
            przewin.setAttribute('aria-label', 'Tabela porównania – przewiń w bok, żeby zobaczyć kolejne produkty');
            tab = el('table', 'pc-tab');
            przewin.appendChild(tab);
            pc.appendChild(przewin);

            // nowa tabela w miejscu starej (w .comparerContainer – tam działają przyciski sklepu)
            var stara = kont.querySelector(':scope > .page-padding');
            var opak = el('div', 'page-padding');
            opak.appendChild(pc);
            kont.insertBefore(opak, stara);
            zbuduj();
            stara.style.display = 'none';
            if (typeof window.ga4Wyslij === 'function') try { window.ga4Wyslij('compare_view', { products: produkty.length }); } catch (e) {}
        }).catch(function (e) {
            try { console.warn('[porownywarka] zostaje widok sklepu:', e); } catch (x) {}
        });
    }

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();
