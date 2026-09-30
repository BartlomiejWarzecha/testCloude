// Test bez przeglądarki: node xepc-koszyk/test/xepc-schemat.test.js
'use strict';
const assert = require('assert');
const path = require('path');
require(path.join(__dirname, '..', 'xepc-schemat.js'));
const S = global.XepcSchemat;

const dane = {
    modele: [
        { nazwa: 'Automower 430X', szukaj: ['430X'], kontekst: 'automower', mp: 'MP_125561650', article: '967673202' },
        { nazwa: 'Automower 440',  szukaj: ['440'],  kontekst: 'automower', mp: 'MP_440', article: '1' }
    ],
    produkty: { '967673202': { nazwa: 'Automower 430X', mp: 'MP_125561650', article: '967673202' } }
};
const etykiety = w => w.widoki.map(x => x.etykieta);

// Adres jak w katalogu: /pl/product/MP_125561650?article=967673202
assert.strictEqual(S.urlProduktu('MP_125561650', '967673202'),
    'https://xepc-prod.husqvarnagroup.com/pl/product/MP_125561650?article=967673202&domain=https%3A%2F%2Fwww.betkowskiservice.pl%2F');

// CZĘŚĆ: bateria z kartą produktu 44993
let w = S.zbudujWidoki({ kod: '529606802', nazwa: 'Akumulator Bateria Automowera Husqvarna 430X 440 450X 550 ORYGINAŁ', modele: 'KATEGORIA SPRZEDAŻY A' }, dane);
assert.strictEqual(w.tryb, 'czesc');
assert.deepStrictEqual(etykiety(w), ['Schemat: Automower 430X', 'Schemat: Automower 440', 'Karta części 529606802']);
assert.ok(w.widoki[2].url.startsWith('https://xepc-prod.husqvarnagroup.com/pl/part/529606802?domain='));

// "430X" nie pasuje do "430XH"; model z atrybutu "Modele Husqvarna:" też się liczy
w = S.zbudujWidoki({ kod: '589300801', nazwa: 'Koło przednie Husqvarna Automower AM 305 310 Mark II 405X 415X ORYGINAŁ',
    modele: 'Modele Husqvarna: Automower 115H, 305E, 310 Mark II 310E, 315 Mark II, 405X, 415X, Aspire R4 320, 320, 330X, 430X, 430XH, 440' }, dane);
assert.deepStrictEqual(etykiety(w), ['Schemat: Automower 430X', 'Schemat: Automower 440', 'Karta części 589300801']);
w = S.zbudujWidoki({ kod: '1', nazwa: 'Husqvarna Automower 430XH pokrywa', modele: '' }, dane);
assert.deepStrictEqual(etykiety(w), []);   // brak schematu -> brak zakładki (nie sama karta części)

// Piła "Husqvarna 440" to nie Automower 440 (brak kontekstu "automower")
w = S.zbudujWidoki({ kod: '503000000', nazwa: 'Łańcuch Husqvarna 440 450', modele: '' }, dane);
assert.deepStrictEqual(etykiety(w), []);

// Inna marka -> nic
w = S.zbudujWidoki({ kod: '737-05066', nazwa: 'Filtr powietrza CubCadet MTD', modele: '' }, dane);
assert.deepStrictEqual(w.widoki, []);

// PRODUKT (maszyna): kod w "produkty" -> tylko schematy maszyny
w = S.zbudujWidoki({ kod: '967 67 32-02', nazwa: 'Robot koszący Husqvarna Automower 430X', modele: '' }, dane);
assert.strictEqual(w.tryb, 'produkt');
assert.deepStrictEqual(etykiety(w), ['Schematy: Automower 430X']);

// PRODUKT: wpis może być samym MP, article = Kod towaru (LC253S = 970541501)
w = S.zbudujWidoki({ kod: '970541501', nazwa: 'Kosiarka spalinowa Husqvarna LC253S', modele: '' },
    { produkty: { '970541501': 'MP_TEST' } });
assert.strictEqual(w.tryb, 'produkt');
assert.ok(w.widoki[0].url.startsWith('https://xepc-prod.husqvarnagroup.com/pl/product/MP_TEST?article=970541501&domain='));

// Tryb automatyczny domyślnie wyłączony: maszyna bez wpisu nie dostaje zakładki z błędem
assert.strictEqual(S.config.maszynaPoKodzie, null);
assert.notStrictEqual(S.zbudujWidoki({ kod: '970488401', nazwa: 'Kosiarka Husqvarna', modele: '' }, {}).tryb, 'produkt');
// Po włączeniu: sam Kod towaru maszyny -> /pl/product/<Kod>
S.config.maszynaPoKodzie = /^9[67]\d{7}$/;
w = S.zbudujWidoki({ kod: '970541201', nazwa: 'Kosiarka spalinowa Husqvarna LC253S', modele: '' }, {});
assert.strictEqual(w.tryb, 'produkt');
assert.strictEqual(w.widoki[0].url, 'https://xepc-prod.husqvarnagroup.com/pl/product/970541201?domain=https%3A%2F%2Fwww.betkowskiservice.pl%2F');
// część (5xxxxxxxx) nie jest maszyną
assert.notStrictEqual(S.zbudujWidoki({ kod: '529606802', nazwa: 'Akumulator Husqvarna', modele: '' }, {}).tryb, 'produkt');
// inna marka z kodem 97... -> nic
assert.deepStrictEqual(S.zbudujWidoki({ kod: '970000000', nazwa: 'Kosiarka Stiga', modele: '' }, {}).widoki, []);
S.config.maszynaPoKodzie = null;

// Odmiany kodu w sklepie korzystają z wpisu numeru bazowego
const danePr = { produkty: { '967244501': 'MP_A', '967674001': 'MP_B' } };
for (const [kod, mp, art] of [['967244501 10 METROW', 'MP_A', '967244501'], ['967674001_OT1', 'MP_B', '967674001'], ['967244501', 'MP_A', '967244501']]) {
    w = S.zbudujWidoki({ kod, nazwa: 'Husqvarna', modele: '' }, danePr);
    assert.strictEqual(w.tryb, 'produkt', kod);
    assert.ok(w.widoki[0].url.includes('/product/' + mp + '?article=' + art + '&'), kod + ' -> ' + w.widoki[0].url);
}
// Wpis dokładny ma pierwszeństwo przed bazowym
w = S.zbudujWidoki({ kod: '967674001_OT1', nazwa: 'Husqvarna', modele: '' }, { produkty: { '967674001': 'MP_B', '967674001_OT1': 'MP_C' } });
assert.ok(w.widoki[0].url.includes('/product/MP_C?'));

// Pusty wpis (do uzupełnienia) -> brak zakładki, bez błędu
w = S.zbudujWidoki({ kod: '970541201', nazwa: 'Kosiarka Husqvarna LC253S', modele: '' }, { produkty: { '970541201': '' } });
assert.notStrictEqual(w.tryb, 'produkt');
// Prawdziwy plik danych jest poprawny i zawiera wszystkie maszyny
const plik = require(path.join(__dirname, '..', 'xepc-schematy.json'));
assert.ok(Object.keys(plik.produkty).length >= 1560);

// Maszyna bez MP (LC347VE 970541401): ani zakładki, ani "Karty części" z błędem
for (const d of [{ produkty: { '970541401': '' } }, {}]) {
    w = S.zbudujWidoki({ kod: '970541401', nazwa: 'Kosiarka spalinowa Husqvarna LC347VE', modele: '' }, d);
    assert.deepStrictEqual(w.widoki, [], JSON.stringify(d));
}
// Część dalej dostaje kartę części
assert.deepStrictEqual(S.zbudujWidoki({ kod: '529606802', nazwa: 'Akumulator Husqvarna 430X Automower', modele: '' }, { modele: dane.modele, produkty: { '970541401': '' } }).widoki.map(x => x.etykieta), ['Schemat: Automower 430X', 'Karta części 529606802']);

// WYSZUKIWANIE
const et = w => w.widoki.map(x => x.etykieta);
const daneW = { nazwy: { LC140P: { nazwa: 'LC 140P', mp: 'MP_125562330', article: '970488101' },
                         LC353VE: { nazwa: 'LC 353VE', mp: 'MP_125562490', article: '970541701' } },
                produkty: { '970488101': 'MP_125562330', '970488201': 'MP_125562331' } };
// "LC 140P": model z frazy + maszyny z wyników (bez duplikatu), na końcu katalog
w = S.dopasujWyszukiwanie('LC 140P', [
    { Code: '970488101', NameNoHtml: 'Kosiarka spalinowa Husqvarna LC140P' },
    { Code: '970488201', NameNoHtml: 'Kosiarka spalinowa Husqvarna LC140SP' },
    { Code: '599349391', NameNoHtml: 'Przewód linka LC 140P Husqvarna' }], daneW, '/producent=husqvarna/produkty,2');
assert.deepStrictEqual(et(w), ['Schemat: LC 140P', 'Schemat: LC140SP', 'Katalog części Husqvarna']);
assert.ok(w.widoki[1].url.includes('/product/MP_125562331?article=970488201&'));
// "kosiarka husqvarna lc353ve" -> model ze słownika, nawet bez maszyny w wynikach
assert.deepStrictEqual(et(S.dopasujWyszukiwanie('kosiarka husqvarna lc353ve', [], daneW, '/produkty,2')), ['Schemat: LC 353VE', 'Katalog części Husqvarna']);
// "LC140": nie ma modelu, ale wyniki to części Husqvarna -> sam katalog
assert.deepStrictEqual(et(S.dopasujWyszukiwanie('LC140', [{ Code: '587585401', NameNoHtml: 'Koło LC140 Husqvarna' }], daneW, '/producent=husqvarna/produkty,2')), ['Katalog części Husqvarna']);
// "husqvarna" -> katalog
assert.deepStrictEqual(et(S.dopasujWyszukiwanie('husqvarna', [], daneW, '/produkty,2')), ['Katalog części Husqvarna']);
// fraza bez związku z Husqvarną -> nic
assert.deepStrictEqual(S.dopasujWyszukiwanie('rękawice', [{ Code: 'X1', NameNoHtml: 'Rękawice robocze Stihl' }], daneW, '/produkty,2').widoki, []);
// prawdziwy plik danych ma słownik nazw
assert.strictEqual(plik.nazwy.LC140P.mp, 'MP_125562330');

// CZĘŚĆ + słownik "nazwy": model z tytułu części
const slownik = { nazwy: { LC353VE: { nazwa: 'LC 353VE', mp: 'MP_125562490', article: '970541701' },
                           '550': { nazwa: 'Automower 550', mp: 'MP_550', article: '1' },
                           '543XP': { nazwa: '543 XP', mp: 'MP_543', article: '2' } } };
w = S.zbudujWidoki({ kod: '589324605', nazwa: 'Pasek husqvarna LC353,LC 353V,LC353VE', modele: '' }, slownik);
assert.deepStrictEqual(etykiety(w), ['Schemat: LC 353VE', 'Karta części 589324605']);
// same liczby ze słownika nie łapią tytułów części ("550XP" to nie Automower 550)
w = S.zbudujWidoki({ kod: '537000000', nazwa: 'Tłumik Husqvarna 550 XP 543XP', modele: '' }, slownik);
assert.deepStrictEqual(etykiety(w), ['Schemat: 543 XP', 'Karta części 537000000']);
// filtr 501879706 (pilarka 254, brak w słowniku) -> brak zakładki
assert.deepStrictEqual(S.zbudujWidoki({ kod: '501879706', nazwa: 'Filtr powietrza 254 Husqvarna 501879706 ORYGINAŁ', modele: 'KATEGORIA SPRZEDAŻY A' }, plik).widoki, []);
// opcjonalnie dawne zachowanie
S.config.kartaCzesciBezSchematu = true;
assert.deepStrictEqual(etykiety(S.zbudujWidoki({ kod: '501879706', nazwa: 'Filtr Husqvarna', modele: '' }, {})), ['Karta części 501879706']);
S.config.kartaCzesciBezSchematu = false;

// Kolejność: tytuł -> opis
const sl2 = { nazwy: { LC353VE: { nazwa: 'LC 353VE', mp: 'MP_A', article: '1' }, LC247S: { nazwa: 'LC 247S', mp: 'MP_B', article: '2' } } };
w = S.zbudujWidoki({ kod: '501000001', nazwa: 'Filtr Husqvarna LC353VE', modele: '', opis: 'Pasuje też do LC 247S' }, sl2);
assert.deepStrictEqual(etykiety(w).filter(x => x.startsWith('Schemat')), ['Schemat: LC 353VE']);   // tytuł wygrywa, opis pominięty
assert.strictEqual(w.zrodlo, 'tytuł');
w = S.zbudujWidoki({ kod: '501000001', nazwa: 'Filtr powietrza Husqvarna 501000001', modele: '', opis: 'Pasuje do modeli: LC 247S, LC 353VE' }, sl2);
assert.deepStrictEqual(etykiety(w).filter(x => x.startsWith('Schemat')), ['Schemat: LC 247S', 'Schemat: LC 353VE']);
assert.strictEqual(w.zrodlo, 'opis');
assert.deepStrictEqual(S.zbudujWidoki({ kod: '501000001', nazwa: 'Filtr Husqvarna', modele: '', opis: '' }, sl2).widoki, []);

console.log('OK');
