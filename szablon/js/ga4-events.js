// =============================================================================
// GA4 - DODATKOWE ŚLEDZENIE ZDARZEŃ (ga4-events.js) - 2026-09-29
// Uzupełnia istniejącą implementację GA4 (G-YDK0H1QXXT, gtag w szablonie
// Comarch) - nie dubluje zdarzeń, które sklep już wysyła.
//
// 1. Zdarzenia e-commerce z szablonu, które GA4 dotąd gubił
//    (view_item, view_item_list, view_cart, begin_checkout, purchase...):
//    sklep wywołuje je przed gtag('config'), więc GA4 ich nie wysyłał.
//    Wysyłamy je ponownie po konfiguracji (purchase - raz na transakcję).
// 2. Wyszukiwarki: search (ogólna i części - komputer, telefon, menu),
//    wybór pól wyszukiwarki części, podpowiedzi, brak wyników.
// 3. add_to_cart ze sklepu dostaje źródło (skąd dodano: karta produktu,
//    lista, wyniki wyszukiwania, strona główna, popup...) + item_list_name.
// 4. select_item (kliknięcie produktu na listach), sortowanie, filtry,
//    strony listy, menu i kafelki kategorii, kontakt, udostępnianie,
//    zmiana języka, głębokość przewinięcia, 404.
//
// Parametry własne (add_source, search_type, part_* itd.) trzeba raz
// zarejestrować w GA4: Administracja > Definicje niestandardowe.
// Podgląd na żywo: dodaj do adresu ?ga4debug=1 (GA4 > DebugView).
// =============================================================================

(function () {
    'use strict';

    if (window.__ga4Events) return;
    window.__ga4Events = true;

    var GA_ID = 'G-YDK0H1QXXT';
    var LOG = '[ga4-events]';

    // ── Tryb podglądu (?ga4debug=1 włącza do końca sesji, ?ga4debug=0 wyłącza) ──
    var debug = false;
    try {
        var qd = new URLSearchParams(location.search).get('ga4debug');
        if (qd === '1') sessionStorage.setItem('ga4debug', '1');
        if (qd === '0') sessionStorage.removeItem('ga4debug');
        debug = sessionStorage.getItem('ga4debug') === '1';
    } catch (e) {}

    function wyslij(nazwa, parametry) {
        if (typeof window.gtag !== 'function') return;
        var p = parametry || {};
        if (debug) { p.debug_mode = true; console.log(LOG, nazwa, p); }
        window.__ga4Wlasne = true;           // nasze zdarzenie - wrapper go nie zmienia
        try { window.gtag('event', nazwa, p); } finally { window.__ga4Wlasne = false; }
    }
    window.ga4Wyslij = wyslij;               // do ręcznych testów w konsoli

    function tekst(el, max) {
        if (!el) return '';
        return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, max || 100);
    }
    function zapisz(klucz, wartosc) { try { sessionStorage.setItem(klucz, JSON.stringify(wartosc)); } catch (e) {} }
    function odczytaj(klucz) { try { return JSON.parse(sessionStorage.getItem(klucz) || 'null'); } catch (e) { return null; } }
    function usun(klucz) { try { sessionStorage.removeItem(klucz); } catch (e) {} }

    // ── Typ strony ───────────────────────────────────────────────────────────
    var parametryUrl = new URLSearchParams(location.search);
    var frazaUrl = (parametryUrl.get('search') || '').trim();

    function typStrony() {
        var p = location.pathname;
        if (p === '/' || p === '') return 'strona_glowna';
        if (/,3,\d+(,\d+)?$/.test(p) || document.querySelector('.productDetails-buttons--cartAdd')) return 'karta_produktu';
        if (frazaUrl) return 'wyniki_wyszukiwania';
        if (/,2(,\d+)?$/.test(p) || document.querySelector('.product-list-js')) return 'lista_produktow';
        if (/zamowienie|koszyk/.test(p)) return 'koszyk_zamowienie';
        if (/ulubione|wishlist/i.test(p)) return 'ulubione';
        return 'inna';
    }
    var TYP_STRONY = typStrony();

    // Nazwa sekcji, w której jest element (np. moduł na stronie głównej).
    function nazwaSekcji(el) {
        var a = el;
        for (var i = 0; i < 10 && a && a !== document.body; i++) {
            a = a.parentElement;
            if (!a) break;
            var naglowki = a.querySelectorAll('h2, h3, .section-title, [class*="__title"]');
            for (var k = 0; k < naglowki.length; k++) {
                var n = naglowki[k];
                if (n.closest('.product-item, [class*="product-item"]')) continue;
                var t = tekst(n, 70);
                if (t.length > 2 && t.length < 70) return t;
            }
        }
        return '';
    }

    // Skąd pochodzi kliknięcie (dodanie do koszyka, wybór produktu).
    function zrodlo(el) {
        if (el.closest('.after-add-to-cart-popup, .after-adding-to-cart-popup-ai-js')) return { zrodlo: 'popup_po_dodaniu', lista: 'Polecane po dodaniu do koszyka' };
        if (el.closest('.header-recommended, .headerSearchForm-js')) return { zrodlo: 'podpowiedzi_wyszukiwarki', lista: 'Podpowiedzi wyszukiwarki' };
        if (el.closest('.wishListPopup, [class*="wishList"][class*="popup"]')) return { zrodlo: 'ulubione', lista: 'Ulubione' };
        if (TYP_STRONY === 'karta_produktu') {
            if (el.closest('.productDetails-buttons--cartAdd, .productDetails-buttons--wishList, .fab-target-button-js')) return { zrodlo: 'karta_produktu', lista: '' };
            return { zrodlo: 'karta_produktu_polecane', lista: nazwaSekcji(el) || 'Polecane na karcie produktu' };
        }
        if (el.closest('.product-list-js, .product-list__grid-js')) {
            if (TYP_STRONY === 'wyniki_wyszukiwania') return { zrodlo: 'wyniki_wyszukiwania', lista: 'Wyniki wyszukiwania' };
            return { zrodlo: 'lista_kategorii', lista: tekst(document.querySelector('.category-nav__current, h1'), 70) || 'Lista produktów' };
        }
        if (TYP_STRONY === 'strona_glowna') return { zrodlo: 'strona_glowna', lista: nazwaSekcji(el) || 'Strona główna' };
        if (TYP_STRONY === 'koszyk_zamowienie') return { zrodlo: 'koszyk', lista: nazwaSekcji(el) || 'Koszyk' };
        return { zrodlo: TYP_STRONY, lista: nazwaSekcji(el) };
    }

    // ── 1. Zdarzenia e-commerce wywołane przed gtag('config') ────────────────
    var DO_POWTORZENIA = ['view_item', 'view_item_list', 'view_cart', 'begin_checkout',
        'add_shipping_info', 'add_payment_info', 'purchase', 'view_promotion', 'refund'];

    function czyArgumenty(e) { return Object.prototype.toString.call(e) === '[object Arguments]'; }

    function powtorzZgubione() {
        var dl = window.dataLayer || [];
        var cfg = -1;
        for (var i = 0; i < dl.length; i++) {
            if (czyArgumenty(dl[i]) && dl[i][0] === 'config' && dl[i][1] === GA_ID) { cfg = i; break; }
        }
        if (cfg < 0) return;
        for (var j = 0; j < cfg; j++) {
            var e = dl[j];
            if (!czyArgumenty(e) || e[0] !== 'event' || DO_POWTORZENIA.indexOf(e[1]) < 0 || e.__ga4Powtorzone) continue;
            e.__ga4Powtorzone = true;
            var p = JSON.parse(JSON.stringify(e[2] || {}));
            if (e[1] === 'purchase') {
                var id = p.transaction_id ? String(p.transaction_id) : '';
                try {
                    if (id && localStorage.getItem('ga4_purchase_' + id)) continue;
                    if (id) localStorage.setItem('ga4_purchase_' + id, '1');
                } catch (x) {}
            }
            p.event_source = 'szablon_sklepu';
            wyslij(e[1], p);
        }
    }

    // ── 3. add_to_cart / add_to_wishlist z informacją o źródle ────────────────
    var ostatnieKlikniecie = null;   // { zrodlo, lista, czas }

    function opakujGtag() {
        var oryginal = window.gtag;
        if (typeof oryginal !== 'function' || oryginal.__ga4Opakowany) return;
        var nowy = function () {
            try {
                if (!window.__ga4Wlasne && arguments[0] === 'event' &&
                    (arguments[1] === 'add_to_cart' || arguments[1] === 'add_to_wishlist')) {
                    var p = arguments[2] = arguments[2] || {};
                    var ctx = (ostatnieKlikniecie && Date.now() - ostatnieKlikniecie.czas < 15000) ? ostatnieKlikniecie : zrodloBezKlikniecia();
                    p.add_source = ctx.zrodlo;
                    p.page_type = TYP_STRONY;
                    if (ctx.lista) {
                        p.item_list_name = ctx.lista;
                        (p.items || []).forEach(function (it) { if (!it.item_list_name) it.item_list_name = ctx.lista; });
                    }
                    if (frazaUrl) p.search_term = frazaUrl;
                    if (debug) { p.debug_mode = true; console.log(LOG, arguments[1], p); }
                }
            } catch (e) {}
            return oryginal.apply(this, arguments);
        };
        nowy.__ga4Opakowany = true;
        window.gtag = nowy;
    }
    function zrodloBezKlikniecia() { return { zrodlo: TYP_STRONY, lista: '' }; }

    var SEL_DO_KOSZYKA = '.js-addToCart, .cartAdd-js, .add-to-cart, .product-item__addToCart, .productDetails-buttons--cartAdd';
    var SEL_ULUBIONE = '.wishListPopup-js, .productWishListShowPopup-js, .wishlistButton';

    // ── 2. Wyszukiwarki ──────────────────────────────────────────────────────
    var POLA_CZESCI = {
        komputer: { producent: 'manufacturerSearch', urzadzenie: 'categorySearch', model: 'searchInput', przycisk: '.part-search .searchButton' },
        telefon:  { producent: 'mss-manufacturer-search', urzadzenie: 'mss-category-search', model: 'mss-search-input', przycisk: '#mss-wrapper .mss-btn' },
        menu:     { producent: 'psm-manufacturer-search', urzadzenie: 'psm-category-search', model: 'psm-search-input', przycisk: '#psm-btn' }
    };

    function wartosc(id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }

    function kontekstCzesci(miejsce) {
        var p = POLA_CZESCI[miejsce];
        return {
            typ: 'czesci', miejsce: miejsce,
            producent: wartosc(p.producent),
            urzadzenie: wartosc(p.urzadzenie),
            model: wartosc(p.model),
            czas: Date.now()
        };
    }

    function miejsceWyszukiwarkiCzesci(el) {
        if (el.closest('#psm-wrapper')) return 'menu';
        if (el.closest('#mss-wrapper, .mobile-sticky-search')) return 'telefon';
        if (el.closest('.part-search')) return 'komputer';
        return '';
    }

    // Zapamiętujemy wyszukiwanie przed przejściem na stronę wyników,
    // a zdarzenie "search" wysyłamy już na stronie wyników (z liczbą wyników).
    function zapamietajWyszukiwanie(ctx) { zapisz('ga4_search', ctx); }

    function wyslijWyszukiwanie() {
        var ctx = odczytaj('ga4_search');
        usun('ga4_search');
        var swieze = ctx && Date.now() - ctx.czas < 30000;
        if (!frazaUrl && !(swieze && ctx.typ === 'czesci')) return;

        var licznik = tekst(document.getElementById('items-counter'));
        var m = licznik.match(/z\s*(\d+)/);
        var wyniki = m ? parseInt(m[1], 10) : (document.querySelector('.product-list__grid-js .product-item') ? null : 0);

        var p = {
            search_term: frazaUrl || (swieze ? [ctx.producent, ctx.urzadzenie, ctx.model].filter(Boolean).join(' | ') : ''),
            search_type: swieze ? ctx.typ : 'ogolna',
            search_source: swieze ? ctx.miejsce : 'inne'
        };
        if (wyniki !== null) p.results_count = wyniki;
        if (swieze && ctx.typ === 'czesci') {
            if (ctx.producent) p.part_manufacturer = ctx.producent;
            if (ctx.urzadzenie) p.part_device = ctx.urzadzenie;
            if (ctx.model) p.part_model = ctx.model;
        }
        wyslij('search', p);
        if (wyniki === 0) wyslij('search_no_results', p);
    }

    // ── 4. Zaangażowanie ─────────────────────────────────────────────────────
    function idProduktu(href) {
        var m = (href || '').match(/,3,\d+,(\d+)(?:[?#].*)?$/) || (href || '').match(/,3,(\d+)(?:[?#].*)?$/);
        return m ? m[1] : '';
    }

    function wybierzProdukt(a) {
        var id = idProduktu(a.getAttribute('href'));
        if (!id) return;
        var kafelek = a.closest('.product-item, [class*="product-item"], li, .swiper-slide') || a;
        var nazwa = tekst(kafelek.querySelector('h2, h3, .product-name, [class*="name"]'), 100) || a.getAttribute('aria-label') || tekst(a, 100);
        nazwa = nazwa.replace(/^Towar\s+/, '');
        var cenaEl = kafelek.querySelector('.promoPrice') || kafelek.querySelector('.normalPrice') || kafelek.querySelector('[class*="price"]');
        var cenaM = tekst(cenaEl, 60).match(/\d[\d\s]*,\d{2}/);
        var cena = cenaM ? cenaM[0].replace(/\s/g, '').replace(',', '.') : '';
        var ctx = zrodlo(a);
        var lista = ctx.lista || ctx.zrodlo;
        var siatka = kafelek.closest('.product-list__grid-js, .swiper-wrapper, ul') || kafelek.parentElement;
        var wszystkie = siatka ? Array.prototype.indexOf.call(siatka.querySelectorAll('.product-item, .swiper-slide, li'), kafelek) : -1;
        var item = { item_id: id, item_name: nazwa, item_list_name: lista };
        if (cena && !isNaN(parseFloat(cena))) item.price = parseFloat(cena);
        if (wszystkie > -1) item.index = wszystkie;
        wyslij('select_item', { item_list_name: lista, select_source: ctx.zrodlo, items: [item] });
    }

    var progiScrolla = [25, 50, 75, 90];
    var wyslaneProgi = {};
    function sprawdzScroll() {
        var doc = document.documentElement;
        var lista = document.querySelector('.product-list-js');
        var procent;
        if (lista && lista.scrollHeight > lista.clientHeight + 50 && getComputedStyle(lista).overflowY !== 'visible') {
            // telefon: lista produktów ma własny pasek przewijania
            procent = (lista.scrollTop + lista.clientHeight) / lista.scrollHeight * 100;
        } else {
            procent = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1) * 100;
        }
        progiScrolla.forEach(function (p) {
            if (procent >= p && !wyslaneProgi[p]) {
                wyslaneProgi[p] = true;
                wyslij('scroll_depth', { percent_scrolled: p, page_type: TYP_STRONY });
            }
        });
    }

    // ── Kliknięcia (jeden nasłuch na całą stronę, w fazie przechwytywania) ──
    document.addEventListener('click', function (ev) {
        var el = ev.target;
        if (!el || !el.closest) return;
        try {
            // dodanie do koszyka / ulubionych - zapamiętujemy źródło, samo zdarzenie wysyła sklep
            if (el.closest(SEL_DO_KOSZYKA) || el.closest(SEL_ULUBIONE)) {
                var ctx = zrodlo(el);
                ostatnieKlikniecie = { zrodlo: ctx.zrodlo, lista: ctx.lista, czas: Date.now() };
                return;
            }

            // wyszukiwarka części - przycisk "Szukaj części"
            var miejsce = miejsceWyszukiwarkiCzesci(el);
            if (miejsce && el.closest('.searchButton, .mss-btn, #psm-btn')) {
                zapamietajWyszukiwanie(kontekstCzesci(miejsce));
                return;
            }

            // zwykła wyszukiwarka - lupka / "Szukaj"
            if (el.closest('.getSearch-js')) {
                zapamietajWyszukiwanie({ typ: 'ogolna', miejsce: 'naglowek', czas: Date.now() });
                return;
            }

            var a = el.closest('a[href]');

            // podpowiedzi zwykłej wyszukiwarki
            var podp = el.closest('.header-recommended, .searchForm__searchAutocomplete-js, [class*="searchAutocomplete"]');
            if (podp && a) {
                if (idProduktu(a.getAttribute('href'))) { wybierzProdukt(a); }
                else { wyslij('search_suggestion_click', { suggestion_text: tekst(a, 80), link_url: a.href }); }
                return;
            }

            // produkt na liście / w module
            if (a && idProduktu(a.getAttribute('href')) &&
                (TYP_STRONY !== 'karta_produktu' || a.closest('.swiper, .swiper-slide, [class*="related"], [class*="recommend"], .product-item'))) {
                wybierzProdukt(a);
                return;
            }

            // sortowanie listy
            var sort = el.closest('.display-details__sorting li[data-value]');
            if (sort) { wyslij('list_sort', { sort_by: tekst(sort, 40), page_type: TYP_STRONY }); return; }

            // filtry listy
            if (el.closest('.product-list__filters-trigger')) { wyslij('list_filter_open', { page_type: TYP_STRONY }); return; }
            var filtr = el.closest('.product-list__filters input, .product-list__filters label, .product-list__filters [role="button"], .product-list__filters a');
            if (filtr) {
                var grupa = filtr.closest('[class*="filter"]');
                wyslij('list_filter', { filter_value: tekst(filtr, 60) || filtr.value || '', filter_group: tekst(grupa && grupa.querySelector('[class*="title"], [class*="name"], h3, h4'), 40), page_type: TYP_STRONY });
                return;
            }

            // strony listy
            if (el.closest('.product-list__pagination, .pagination')) {
                wyslij('list_pagination', { page_label: tekst(el.closest('li, a, span'), 20), page_type: TYP_STRONY });
                return;
            }

            // menu "Kategorie" na telefonie i jego zakładki
            var zakladka = el.closest('.mobileCategorySwitcher__btn');
            if (zakladka) { wyslij('menu_interaction', { menu_action: 'zakladka', menu_label: tekst(zakladka, 30) }); return; }
            if (el.closest('.showBottomMenuSection-js')) { wyslij('menu_interaction', { menu_action: 'otwarcie_menu', menu_label: 'Kategorie' }); return; }

            // kafelki podkategorii i kategorie w menu
            var kat = el.closest('.sub-category-link, .category-link, .category-main-link, .home-cats__item a, a.home-cats__item');
            if (kat) {
                wyslij('category_click', {
                    category_name: tekst(kat.querySelector('.productsList__products--top-subcategories-container-data-name, .category-link__label, .category_menu_tekst, .home-cats__label') || kat, 70),
                    click_source: kat.closest('header') ? 'menu' : (TYP_STRONY === 'strona_glowna' ? 'strona_glowna' : 'kafelki_podkategorii'),
                    link_url: kat.href || ''
                });
                return;
            }

            if (a) {
                var href = a.getAttribute('href') || '';
                // kontakt
                if (/^tel:/i.test(href)) { wyslij('contact_click', { contact_method: 'telefon', link_text: tekst(a, 40) }); return; }
                if (/^mailto:/i.test(href)) { wyslij('contact_click', { contact_method: 'email', link_text: tekst(a, 40) }); return; }
                if (/wa\.me|whatsapp|m\.me\/|messenger/i.test(href)) { wyslij('contact_click', { contact_method: /whatsapp|wa\.me/i.test(href) ? 'whatsapp' : 'messenger' }); return; }
                // udostępnianie produktu
                var siec = /facebook\.com\/sharer/i.test(href) ? 'facebook' : /twitter\.com\/intent|x\.com\/intent/i.test(href) ? 'x' : /pinterest\.com\/pin/i.test(href) ? 'pinterest' : '';
                if (siec) { wyslij('share', { method: siec, content_type: 'product', item_id: idProduktu(location.pathname) }); return; }
            }
        } catch (e) { if (debug) console.warn(LOG, e); }
    }, true);

    // Enter w polach wyszukiwarek
    document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' || !ev.target || !ev.target.closest) return;
        var el = ev.target;
        if (el.id === 'searchFormPhrase' || el.closest('.headerSearchForm-js')) {
            zapamietajWyszukiwanie({ typ: 'ogolna', miejsce: 'naglowek', czas: Date.now() });
            return;
        }
        var miejsce = miejsceWyszukiwarkiCzesci(el);
        if (miejsce) zapamietajWyszukiwanie(kontekstCzesci(miejsce));
    }, true);

    // Wybór producenta / urządzenia / modelu w wyszukiwarce części
    var ostatnieWybory = {};
    document.addEventListener('change', function (ev) {
        var el = ev.target;
        if (!el || !el.id) return;
        Object.keys(POLA_CZESCI).forEach(function (miejsce) {
            var p = POLA_CZESCI[miejsce];
            var pole = el.id === p.producent ? 'producent' : el.id === p.urzadzenie ? 'urzadzenie' : el.id === p.model ? 'model' : '';
            if (!pole) return;
            var v = (el.value || '').trim();
            var klucz = miejsce + pole;
            if (!v || ostatnieWybory[klucz] === v) return;
            ostatnieWybory[klucz] = v;
            wyslij('part_search_field', { search_source: miejsce, part_field: pole, part_value: v.slice(0, 100) });
        });
    }, true);

    // Zmiana języka (GTranslate)
    function opakujTlumacza() {
        var org = window.doGTranslate;
        if (typeof org !== 'function' || org.__ga4) return;
        var nowy = function (para) {
            try { wyslij('language_change', { language: String(para || '').split('|')[1] || '' }); } catch (e) {}
            return org.apply(this, arguments);
        };
        nowy.__ga4 = true;
        window.doGTranslate = nowy;
    }

    // ── Start ────────────────────────────────────────────────────────────────
    function start() {
        opakujGtag();
        powtorzZgubione();
        wyslijWyszukiwanie();
        opakujTlumacza();

        // strona 404
        if (/404|nie znaleziono|nie istnieje/i.test(document.title) || document.querySelector('.notFound, .page-not-found, .error404')) {
            wyslij('page_not_found', { page_path: location.pathname, page_referrer: document.referrer || '' });
        }

        // przewijanie (okno i lista produktów na telefonie)
        var zaplanowane = false;
        function naScroll() {
            if (zaplanowane) return;
            zaplanowane = true;
            setTimeout(function () { zaplanowane = false; sprawdzScroll(); }, 400);
        }
        window.addEventListener('scroll', naScroll, { passive: true });
        document.addEventListener('scroll', function (e) { if (e.target && e.target.classList && e.target.classList.contains('product-list-js')) naScroll(); }, { passive: true, capture: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
    // GTranslate i niektóre skrypty sklepu ładują się później
    window.addEventListener('load', function () { opakujTlumacza(); opakujGtag(); });
})();