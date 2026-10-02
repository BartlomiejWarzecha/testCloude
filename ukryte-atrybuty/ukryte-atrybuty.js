// =============================================================================
// UKRYTE ATRYBUTY  (ukryte-atrybuty.js)
// Atrybut „KATEGORIA SPRZEDAŻY” jest wewnętrzny (dla sklepu), klient go nie
// potrzebuje. Na karcie produktu ukrywa go szablon karty, w koszyku js/koszyk.js,
// a ten skrypt – w oknie „Szczegóły produktu”, które otwiera się z listy
// produktów (szablon partials/products-list/add-to-cart-popup.html), i wszędzie
// indziej, gdzie pojawi się taki atrybut.
// Grupa jest tylko ukryta (display:none): ukryte pole attributeId zostaje
// w formularzu, więc „Dodaj do koszyka” dalej wysyła atrybut (bez niego sklep
// odpowiada „wybierz atrybuty towaru”).
//
// Ładować w szablonie całego sklepu:
//   <script src="/usr/ukryte-atrybuty.js"></script>
// =============================================================================

(function () {
    'use strict';

    // nazwy atrybutów do ukrycia (wielkość liter bez znaczenia, dwukropek opcjonalny)
    var UKRYTE = /^\s*KATEGORIA SPRZEDA[ŻZ]Y\s*:?\s*$/i;

    function ukryj(korzen) {
        if (!korzen || !korzen.querySelectorAll) return;
        [].forEach.call(korzen.querySelectorAll('.attribute-name'), function (n) {
            if (!UKRYTE.test(n.textContent)) return;
            var grupa = n.closest('.input-group') || n.parentNode;
            if (!grupa || grupa.getAttribute('data-bs-ukryty')) return;
            grupa.style.display = 'none';
            grupa.setAttribute('data-bs-ukryty', '1');
        });
    }

    function start() {
        ukryj(document);
        if (!window.MutationObserver) return;
        // okno „Szczegóły produktu” sklep dokleja do strony po kliknięciu „Do koszyka”
        new MutationObserver(function (zmiany) {
            for (var i = 0; i < zmiany.length; i++) {
                var dodane = zmiany[i].addedNodes;
                for (var j = 0; j < dodane.length; j++) if (dodane[j].nodeType === 1) ukryj(dodane[j]);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
