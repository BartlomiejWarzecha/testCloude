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
global.fetch = async () => ({ ok: true, json: async () => [{ k: '589300801', id: 48426 }] });
global.__CSRF = 'csrf-token';
global.app = { showTemporaryPopup: (t, typ) => popups.push([typ, t]) };
global.ui = { updateProductsInCart: () => {} };
global.$ = { post: (url, data) => { posted.push(data); return Promise.resolve({ action: { Result: true }, collection: {} }); } };

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
    // Obca domena -> ignorowana
    send('https://evil.example', { partNumber: '589300801' });
    // Wysokość -> iframe
    send(X.config.xepcOrigin, 1800);
    assert.strictEqual(iframe.style.height, '1800px');
    // Dodanie do koszyka + część, której nie ma w sklepie
    send(X.config.xepcOrigin, { items: [{ partNumber: '589300801', quantity: 3 }, { partNumber: '999999999' }] });
    await new Promise(r => setTimeout(r, 20));

    assert.strictEqual(posted.length, 1);
    assert.strictEqual(posted[0].__action, 'Cart/Add');
    assert.strictEqual(posted[0].__csrf, 'csrf-token');
    assert.deepStrictEqual(JSON.parse(posted[0].__parameters), [{ productId: '48426', quantity: '3' }]);
    assert.ok(popups.some(([typ, t]) => typ === 'info' && t.includes('999999999')));
    assert.ok(popups.some(([typ, t]) => typ === 'success' && t.includes('589300801')));
    console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
