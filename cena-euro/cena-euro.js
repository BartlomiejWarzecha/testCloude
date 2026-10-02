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
// Koszyk (zamowienie,4): pod każdą kwotą w PLN „≈ X €”, a pod kwotą do zapłaty
// notka o kursie NBP i płatności w PLN. Ceny przy wyborze dostawy/płatności bez euro.
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
        '.cena-euro--karta .cena-euro__info{display:block;font-size:12px;color:#6b7280;margin-top:2px}' +
        '.cena-euro--koszyk{text-align:right;font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;white-space:nowrap}' +
        '.cena-euro-nota{display:block;font-size:12px;line-height:1.4;color:#6b7280;font-weight:400;' +
            'letter-spacing:0;text-transform:none;margin:6px 0 10px;text-align:left}';

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

    // ── Teksty w języku klienta ──────────────────────────────────────────────
    // Tłumacz strony nie tłumaczy tekstu dopisanego po wczytaniu, więc opisy mamy gotowe.
    // kr – krótki dopisek na liście, cena – przy kwocie na karcie, info – pod nią,
    // nota – pod kwotą do zapłaty w koszyku. {d} = data kursu, {k} = kurs. Inne języki: angielski.
    var T = {
        en: { kr: 'indicative', cena: 'indicative price', info: 'Converted at the NBP average exchange rate of {d} (1 EUR = {k} PLN). Sale price and payment in PLN; the euro amount is for information only.', nota: 'Euro amounts are indicative, converted at the NBP average exchange rate of {d} (1 EUR = {k} PLN). Sale price and payment in PLN.' },
        de: { kr: 'Richtwert', cena: 'unverbindlicher Richtwert', info: 'Umgerechnet zum NBP-Mittelkurs vom {d} (1 EUR = {k} PLN). Verkaufspreis und Zahlung in PLN; der Euro-Betrag dient nur zur Information.', nota: 'Euro-Beträge sind Richtwerte, umgerechnet zum NBP-Mittelkurs vom {d} (1 EUR = {k} PLN). Verkaufspreis und Zahlung in PLN.' },
        fr: { kr: 'indicatif', cena: 'prix indicatif', info: 'Converti au taux moyen de la NBP du {d} (1 EUR = {k} PLN). Prix de vente et paiement en PLN ; le montant en euros est donné à titre informatif.', nota: 'Les montants en euros sont indicatifs, convertis au taux moyen de la NBP du {d} (1 EUR = {k} PLN). Prix de vente et paiement en PLN.' },
        sk: { kr: 'orientačne', cena: 'orientačná cena', info: 'Prepočet podľa priemerného kurzu NBP z {d} (1 EUR = {k} PLN). Predajná cena a platba v PLN; suma v eurách má len informatívny charakter.', nota: 'Sumy v eurách sú orientačné, prepočítané podľa priemerného kurzu NBP z {d} (1 EUR = {k} PLN). Predajná cena a platba v PLN.' },
        cs: { kr: 'orientačně', cena: 'orientační cena', info: 'Přepočet podle průměrného kurzu NBP z {d} (1 EUR = {k} PLN). Prodejní cena a platba v PLN; částka v eurech je pouze informativní.', nota: 'Částky v eurech jsou orientační, přepočtené podle průměrného kurzu NBP z {d} (1 EUR = {k} PLN). Prodejní cena a platba v PLN.' },
        it: { kr: 'indicativo', cena: 'prezzo indicativo', info: 'Convertito al cambio medio NBP del {d} (1 EUR = {k} PLN). Prezzo di vendita e pagamento in PLN; l’importo in euro è solo informativo.', nota: 'Gli importi in euro sono indicativi, convertiti al cambio medio NBP del {d} (1 EUR = {k} PLN). Prezzo di vendita e pagamento in PLN.' },
        hr: { kr: 'okvirno', cena: 'okvirna cijena', info: 'Preračunato po srednjem tečaju NBP-a od {d} (1 EUR = {k} PLN). Prodajna cijena i plaćanje u PLN; iznos u eurima je samo informativan.', nota: 'Iznosi u eurima su okvirni, preračunati po srednjem tečaju NBP-a od {d} (1 EUR = {k} PLN). Prodajna cijena i plaćanje u PLN.' },
        sl: { kr: 'okvirno', cena: 'okvirna cena', info: 'Preračunano po srednjem tečaju NBP z dne {d} (1 EUR = {k} PLN). Prodajna cena in plačilo v PLN; znesek v evrih je zgolj informativen.', nota: 'Zneski v evrih so okvirni, preračunani po srednjem tečaju NBP z dne {d} (1 EUR = {k} PLN). Prodajna cena in plačilo v PLN.' },
        da: { kr: 'vejledende', cena: 'vejledende pris', info: 'Omregnet til NBP’s gennemsnitskurs pr. {d} (1 EUR = {k} PLN). Salgspris og betaling i PLN; beløbet i euro er kun til orientering.', nota: 'Beløb i euro er vejledende, omregnet til NBP’s gennemsnitskurs pr. {d} (1 EUR = {k} PLN). Salgspris og betaling i PLN.' },
        no: { kr: 'veiledende', cena: 'veiledende pris', info: 'Omregnet etter NBPs gjennomsnittskurs per {d} (1 EUR = {k} PLN). Salgspris og betaling i PLN; beløpet i euro er kun til informasjon.', nota: 'Beløp i euro er veiledende, omregnet etter NBPs gjennomsnittskurs per {d} (1 EUR = {k} PLN). Salgspris og betaling i PLN.' },
        sv: { kr: 'ungefärligt', cena: 'ungefärligt pris', info: 'Omräknat enligt NBP:s genomsnittskurs den {d} (1 EUR = {k} PLN). Försäljningspris och betalning i PLN; beloppet i euro är endast vägledande.', nota: 'Belopp i euro är ungefärliga, omräknade enligt NBP:s genomsnittskurs den {d} (1 EUR = {k} PLN). Försäljningspris och betalning i PLN.' },
        fi: { kr: 'suuntaa-antava', cena: 'suuntaa-antava hinta', info: 'Muunnettu NBP:n keskikurssilla {d} (1 EUR = {k} PLN). Myyntihinta ja maksu PLN:nä; euromäärä on vain tiedoksi.', nota: 'Euromäärät ovat suuntaa-antavia, muunnettu NBP:n keskikurssilla {d} (1 EUR = {k} PLN). Myyntihinta ja maksu PLN:nä.' },
        lt: { kr: 'orientacinė', cena: 'orientacinė kaina', info: 'Perskaičiuota pagal NBP vidutinį kursą ({d}; 1 EUR = {k} PLN). Pardavimo kaina ir mokėjimas – PLN; suma eurais yra tik informacinė.', nota: 'Sumos eurais yra orientacinės, perskaičiuotos pagal NBP vidutinį kursą ({d}; 1 EUR = {k} PLN). Pardavimo kaina ir mokėjimas – PLN.' },
        lv: { kr: 'orientējoši', cena: 'orientējoša cena', info: 'Pārrēķināts pēc NBP vidējā kursa {d} (1 EUR = {k} PLN). Pārdošanas cena un maksājums PLN; summa eiro ir tikai informatīva.', nota: 'Summas eiro ir orientējošas, pārrēķinātas pēc NBP vidējā kursa {d} (1 EUR = {k} PLN). Pārdošanas cena un maksājums PLN.' },
        et: { kr: 'ligikaudne', cena: 'ligikaudne hind', info: 'Arvestatud NBP keskmise kursi järgi seisuga {d} (1 EUR = {k} PLN). Müügihind ja makse PLN-ides; summa eurodes on vaid informatiivne.', nota: 'Summad eurodes on ligikaudsed, arvestatud NBP keskmise kursi järgi seisuga {d} (1 EUR = {k} PLN). Müügihind ja makse PLN-ides.' },
        bg: { kr: 'ориентировъчно', cena: 'ориентировъчна цена', info: 'Преизчислено по средния курс на NBP от {d} (1 EUR = {k} PLN). Продажната цена и плащането са в PLN; сумата в евро е само за информация.', nota: 'Сумите в евро са ориентировъчни, преизчислени по средния курс на NBP от {d} (1 EUR = {k} PLN). Продажната цена и плащането са в PLN.' },
        el: { kr: 'ενδεικτικά', cena: 'ενδεικτική τιμή', info: 'Μετατροπή με τη μέση ισοτιμία της NBP της {d} (1 EUR = {k} PLN). Η τιμή πώλησης και η πληρωμή είναι σε PLN· το ποσό σε ευρώ είναι μόνο ενημερωτικό.', nota: 'Τα ποσά σε ευρώ είναι ενδεικτικά, με μετατροπή στη μέση ισοτιμία της NBP της {d} (1 EUR = {k} PLN). Η τιμή πώλησης και η πληρωμή είναι σε PLN.' },
        hu: { kr: 'tájékoztató', cena: 'tájékoztató ár', info: 'Átszámítva az NBP középárfolyamán ({d}; 1 EUR = {k} PLN). Az eladási ár és a fizetés PLN-ben; az euróösszeg csak tájékoztató jellegű.', nota: 'Az euróösszegek tájékoztató jellegűek, az NBP középárfolyamán átszámítva ({d}; 1 EUR = {k} PLN). Az eladási ár és a fizetés PLN-ben.' },
        ro: { kr: 'orientativ', cena: 'preț orientativ', info: 'Convertit la cursul mediu NBP din {d} (1 EUR = {k} PLN). Prețul de vânzare și plata sunt în PLN; suma în euro are caracter informativ.', nota: 'Sumele în euro sunt orientative, convertite la cursul mediu NBP din {d} (1 EUR = {k} PLN). Prețul de vânzare și plata sunt în PLN.' },
        pt: { kr: 'indicativo', cena: 'preço indicativo', info: 'Convertido à taxa média do NBP de {d} (1 EUR = {k} PLN). Preço de venda e pagamento em PLN; o valor em euros é apenas informativo.', nota: 'Os valores em euros são indicativos, convertidos à taxa média do NBP de {d} (1 EUR = {k} PLN). Preço de venda e pagamento em PLN.' },
        es: { kr: 'orientativo', cena: 'precio orientativo', info: 'Convertido al tipo de cambio medio del NBP del {d} (1 EUR = {k} PLN). Precio de venta y pago en PLN; el importe en euros es solo informativo.', nota: 'Los importes en euros son orientativos, convertidos al tipo de cambio medio del NBP del {d} (1 EUR = {k} PLN). Precio de venta y pago en PLN.' },
        nl: { kr: 'indicatief', cena: 'indicatieve prijs', info: 'Omgerekend tegen de gemiddelde NBP-koers van {d} (1 EUR = {k} PLN). Verkoopprijs en betaling in PLN; het bedrag in euro is alleen ter informatie.', nota: 'Bedragen in euro zijn indicatief, omgerekend tegen de gemiddelde NBP-koers van {d} (1 EUR = {k} PLN). Verkoopprijs en betaling in PLN.' },
        uk: { kr: 'орієнтовно', cena: 'орієнтовна ціна', info: 'Перераховано за середнім курсом NBP на {d} (1 EUR = {k} PLN). Ціна продажу та оплата в PLN; сума в євро має лише інформаційний характер.', nota: 'Суми в євро орієнтовні, перераховані за середнім курсом NBP на {d} (1 EUR = {k} PLN). Ціна продажу та оплата в PLN.' },
        ru: { kr: 'ориентировочно', cena: 'ориентировочная цена', info: 'Пересчитано по среднему курсу NBP на {d} (1 EUR = {k} PLN). Цена продажи и оплата в PLN; сумма в евро носит информационный характер.', nota: 'Суммы в евро ориентировочные, пересчитаны по среднему курсу NBP на {d} (1 EUR = {k} PLN). Цена продажи и оплата в PLN.' }
    };
    function tekst(pole) {
        var t = (T[jezyk] || T.en)[pole];
        return t.replace('{d}', dataKursu()).replace('{k}', kursTekst());
    }

    // ── Liczenie i formatowanie ──────────────────────────────────────────────
    // Kwota w dowolnym zapisie: „3 299,00 zł”, „3.299,00”, a po tłumaczeniu na angielski
    // „1,179.00 PLN” / „PLN 1,179.00”. Separator dziesiętny = ostatni przecinek albo kropka,
    // po którym są dokładnie 2 cyfry; pozostałe znaki to separatory tysięcy.
    function liczba(t) {
        var s = String(t || '').replace(/[^\d.,]/g, '');
        if (!s) return NaN;
        var m = s.match(/^(.*?)[.,](\d{2})$/);
        if (m) return parseFloat((m[1].replace(/[.,]/g, '') || '0') + '.' + m[2]);
        return parseFloat(s.replace(/[.,]/g, ''));
    }
    function kwota(pln) {
        var eur = Math.round(pln / kurs.mid * 100) / 100;
        try { return new Intl.NumberFormat(jezyk || 'pl', { style: 'currency', currency: WALUTA }).format(eur); }
        catch (e) { return eur.toFixed(2) + ' €'; }
    }
    function dataKursu() {
        // nazwa miesiąca zamiast 02/10 – zapis liczbowy różni się między krajami (10/02 w USA)
        try { return new Intl.DateTimeFormat(jezyk !== 'en' && T[jezyk] ? jezyk : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(kurs.data + 'T12:00:00')); }
        catch (e) { var p = kurs.data.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
    }
    function kursTekst() {
        try { return new Intl.NumberFormat(jezyk || 'pl', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(kurs.mid); }
        catch (e) { return String(kurs.mid); }
    }
    function opis() { return tekst('info'); }

    // element z kwotą; cały w języku klienta, więc tłumacz strony go nie rusza (notranslate)
    function element(pln, karta) {
        var el = document.createElement(karta ? 'div' : 'span');
        el.className = 'cena-euro notranslate' + (karta ? ' cena-euro--karta' : '');
        el.setAttribute('translate', 'no');
        el.setAttribute('data-pln', String(pln));
        el.title = opis();
        var k = document.createElement('span');
        k.className = 'cena-euro__kwota';
        k.textContent = '≈ ' + kwota(pln);
        el.appendChild(k);
        if (karta) {
            el.appendChild(document.createTextNode(' – ' + tekst('cena')));
            var info = document.createElement('span');
            info.className = 'cena-euro__info';
            info.textContent = tekst('info');
            el.appendChild(info);
        } else {
            el.appendChild(document.createTextNode(' (' + tekst('kr') + ')'));
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
    // ── Koszyk (zamowienie,4) ────────────────────────────────────────────────
    // Kwoty koszyka sklep doczytuje w przeglądarce, więc szukamy ich po treści: element,
    // którego cały tekst to kwota w PLN („2.399,00 PLN”, „39,00 zł”). Pomijamy zera, ukryte
    // i przekreślone kwoty oraz ceny przy wyborze dostawy i płatności (obok przycisku radio).
    // Pod największą kwotą („Do zapłaty”) jedna notka: kurs NBP i płatność w PLN.
    var LICZBA = '\\d{1,3}(?:[\\s\\u00a0.,\']\\d{3})*[.,]\\d{2}';
    var KWOTA = new RegExp('^(?:(?:zł|PLN)\\s*' + LICZBA + '|' + LICZBA + '\\s*(?:zł|PLN))$', 'i');
    function naKoszyku() { return /(^|\/)zamowienie,4/.test(location.pathname); }
    // tekst elementu bez naszych dopisków w euro
    function tekstBezEuro(el) {
        var t = '';
        (function zbierz(n) {
            for (var c = n.firstChild; c; c = c.nextSibling) {
                if (c.nodeType === 3) t += c.nodeValue;
                else if (c.nodeType === 1 && !c.classList.contains('cena-euro') && !/^(SCRIPT|STYLE)$/.test(c.nodeName)) zbierz(c);
            }
        })(el);
        return t.replace(/[\s\u00a0]+/g, ' ').trim();
    }
    // wiersz z kwotą: najbliższy element z czymś więcej niż sama kwota (np. „Versandkosten 39,00 PLN”)
    function wierszKwoty(el) {
        var w = el;
        while (w.parentNode && w.parentNode !== document.body && KWOTA.test(tekstBezEuro(w))) w = w.parentNode;
        return w;
    }
    // cena metody dostawy/płatności: najbliższy blok z przyciskiem radio zawiera tylko tę
    // jedną kwotę (opcja „Kurier … 39,00 PLN”); kolumna koszyka z produktami ma ich więcej
    function przyWyborze(el) {
        for (var r = el.parentNode, i = 0; r && r !== document.body && i < 6; r = r.parentNode, i++) {
            if (!r.querySelector('input[type="radio"]')) continue;
            return (tekstBezEuro(r).match(/\d[.,]\d{2}\s*(?:zł|PLN)|(?:zł|PLN)\s*\d[0-9\s.,']*[.,]\d{2}/gi) || []).length === 1;
        }
        return false;
    }
    function kwotyKoszyka() {
        var main = document.querySelector('main') || document.body, wynik = [];
        var w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false), t;
        while ((t = w.nextNode())) {
            if (!/\d[.,]\d{2}/.test(t.nodeValue)) continue;
            var el = t.parentNode;
            if (!el || el.closest('.cena-euro, script, style, select, option, textarea')) continue;
            // najmniejszy element z całą kwotą (np. <span>2.399,00</span> <span>PLN</span> razem)
            while (el && el !== main && !KWOTA.test(tekstBezEuro(el))) el = el.parentNode;
            if (!el || el === main) continue;
            // tłumacz Google owija tekst w <font> – dopisek wstawiamy do elementu sklepu
            while (el.nodeName === 'FONT' && el.parentNode !== main) el = el.parentNode;
            if (!KWOTA.test(tekstBezEuro(el)) || wynik.indexOf(el) >= 0) continue;
            if (el.offsetParent === null || przyWyborze(el)) continue;
            if ((getComputedStyle(el).textDecorationLine || '').indexOf('line-through') >= 0) continue;
            wynik.push(el);
        }
        return wynik;
    }
    function odswiezKoszyk() {
        var kwoty = kwotyKoszyka(), suma = null, sumaPln = 0;
        kwoty.forEach(function (el) {
            var pln = liczba(tekstBezEuro(el)), stary = el.querySelector(':scope > .cena-euro');
            if (!(pln > 0)) { if (stary) stary.remove(); return; }
            if (pln > sumaPln) { sumaPln = pln; suma = el; }
            if (stary && stary.getAttribute('data-pln') === String(pln) && stary.getAttribute('data-j') === jezyk) return;
            if (stary) stary.remove();
            var e = document.createElement('span');
            e.className = 'cena-euro cena-euro--koszyk notranslate';
            e.setAttribute('translate', 'no');
            e.setAttribute('data-pln', String(pln));
            e.setAttribute('data-j', jezyk);
            e.title = opis();
            e.textContent = '≈ ' + kwota(pln);
            el.appendChild(e);
        });
        // notka pod wierszem „Do zapłaty” (największa kwota w koszyku)
        var nota = document.querySelector('.cena-euro-nota');
        if (!suma) { if (nota) nota.remove(); return; }
        var wiersz = wierszKwoty(suma);
        var klucz = jezyk + '|' + kurs.data;
        if (nota && nota.previousSibling === wiersz && nota.getAttribute('data-k') === klucz) return;
        if (nota) nota.remove();
        nota = document.createElement('div');
        nota.className = 'cena-euro cena-euro-nota notranslate';
        nota.setAttribute('translate', 'no');
        nota.setAttribute('data-k', klucz);
        nota.textContent = tekst('nota');
        wiersz.parentNode.insertBefore(nota, wiersz.nextSibling);
    }

    function odswiez() {
        if (!jezyk || !kurs) { usunWszystko(); return; }
        if (naKoszyku()) { odswiezKoszyk(); return; }
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
