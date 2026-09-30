// Test bez przeglądarki: node xepc-koszyk/test/xepc-koszyk.test.js
'use strict';
const assert = require('assert');
const path = require('path');

// Minimalne środowisko strony sklepu.
const listeners = [];
const posted = [];
const popups = [];
const iframe = { contentWindow: {}, style: {} };
global.window = global;
global.addEventListener = (t, fn) => { if (t === 'message') listeners.push(fn); };
global.document = { querySelectorAll: () => [iframe] };
// Wyszukiwarka sklepu: kształt odpowiedzi jak na betkowskiservice.pl (30.09.2026).
const produkty = {
    '589300801': [{ Id: 48426, GIDNumber: 49120, Code: '589300801' }],
    '578443701': [{ Id: 3411, GIDNumber: 3411, Code: '578443701' }],
    // wyszukiwarka zwraca coś podobnego, ale nie ten numer
    '111111111': [{ Id: 777, GIDNumber: 777, Code: '1111111110' }]
};
global.location = { pathname: '/husqvarna_katalog,37' };
global.__CSRF = 'csrf-token';
global.app = { showTemporaryPopup: (t, typ) => popups.push([typ, t]) };
global.ui = { updateProductsInCart: () => {} };
global.$ = {
    post: (url, data) => { posted.push(data); return Promise.resolve({ action: { Result: true }, collection: {} }); },
    get: (url, data) => {
        if (data.__action === 'Get/SearchAutocomplete') {
            return Promise.resolve({ action: { Result: true, Redirect302: '//www.betkowskiservice.pl/produkty,2?seaAtc=' + data.search } });
        }
        const q = url.split('seaAtc=')[1];
        return Promise.resolve({ action: { Result: true }, collection: produkty[q] || [] });
    }
};

require(path.join(__dirname, '..', 'xepc-koszyk.js'));
const X = global.XepcKoszyk;
X.config.debug = false;

// Numery części
assert.strictEqual(X.normalizujKod('589 30 08-01'), '589300801');

// Różne możliwe kształty wiadomości
const ok = [{ kod: '589300801', ilosc: 2 }];
assert.deepStrictEqual(X.wyciagnijPozycje({ partNumber: '589 30 08-01', quantity: 2 }), ok);
assert.deepStrictEqual(X.wyciagnijPozycje(JSON.stringify({ type: 'addToCart', payload: { articleNo: '589300801', qty: '2' } })), ok);
assert.deepStrictEqual(X.wyciagnijPozycje({ items: [{ id: 'x', sku: 589300801, amount: 2 }] }), ok);
assert.deepStrictEqual(X.wyciagnijPozycje('589300801'), [{ kod: '589300801', ilosc: 1 }]);
// Pole jednoznaczne wygrywa z ogólnym "id"
assert.deepStrictEqual(X.wyciagnijPozycje({ id: 12345678, partNumber: '589300801' }), [{ kod: '589300801', ilosc: 1 }]);
// Wiadomości, które nie są koszykiem
assert.deepStrictEqual(X.wyciagnijPozycje({ type: 'navigate', path: '/pl/model' }), []);

const send = (origin, data) => listeners.forEach(fn => fn({ origin, data, source: iframe.contentWindow }));

(async () => {
    // ID z e-Sklepu (Id), nie z Optimy (GIDNumber)
    assert.strictEqual(await X.znajdzIdProduktu('589300801'), 48426);
    assert.strictEqual(await X.znajdzIdProduktu('578443701'), 3411);
    // Tylko identyczny kod
    assert.strictEqual(await X.znajdzIdProduktu('111111111'), null);

    // Obca domena -> ignorowana
    send('https://evil.example', { partNumber: '589300801' });
    // Wysokość -> iframe
    send(X.config.xepcOrigin, 1800);
    assert.strictEqual(iframe.style.height, '1800px');
    // Dodanie do koszyka + część, której nie ma w sklepie
    send(X.config.xepcOrigin, { items: [{ partNumber: '589 30 08-01', quantity: 3 }, { partNumber: '578443701' }, { partNumber: '999999999' }] });
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].__action, 'Cart/Add');
    assert.strictEqual(posted[0].__csrf, 'csrf-token');
    assert.deepStrictEqual(JSON.parse(posted[0].__parameters), [{ productId: '48426', quantity: '3' }, { productId: '3411', quantity: '1' }]);
    assert.ok(popups.some(([typ, t]) => typ === 'info' && t.includes('999999999')));
    assert.ok(popups.some(([typ, t]) => typ === 'success' && t.includes('589300801')));
    console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
