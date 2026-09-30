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
assert.deepStrictEqual(etykiety(w), ['Karta części 1']);

// Piła "Husqvarna 440" to nie Automower 440 (brak kontekstu "automower")
w = S.zbudujWidoki({ kod: '503000000', nazwa: 'Łańcuch Husqvarna 440 450', modele: '' }, dane);
assert.deepStrictEqual(etykiety(w), ['Karta części 503000000']);

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
assert.strictEqual(S.zbudujWidoki({ kod: '529606802', nazwa: 'Akumulator Husqvarna', modele: '' }, {}).tryb, 'czesc');
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
assert.deepStrictEqual(S.zbudujWidoki({ kod: '529606802', nazwa: 'Akumulator Husqvarna', modele: '' }, { produkty: { '970541401': '' } }).widoki.map(x => x.etykieta), ['Karta części 529606802']);

console.log('OK');
