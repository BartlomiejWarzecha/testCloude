document.addEventListener('DOMContentLoaded', function() {

    // Ręczne zdjęcia dla wybranych produktów (ID produktu w e-Sklepie).
    const IMAGE_EXCEPTIONS = {
        52507: [
            'https://upload.cdn.baselinker.com/products/3000710/d90c5cb2ae11da5accc97b8299fad773.jpg',
            'https://upload.cdn.baselinker.com/products/3000710/2cf86e83be1b6052535a93ff41384c81.jpg',
        ],
        52508: [
            'https://upload.cdn.baselinker.com/products/3000710/7eae37bc92d2eb0131bc43661fb2d3bd.jpg',
            'https://upload.cdn.baselinker.com/products/3000710/ddc93ac9cb279cfba8c70c5134202821.jpg'
        ],
    };

    // Produktu nigdy nie ukrywamy. Gdy brak zdjęcia, bierzemy kolejno:
    //  1) IMAGE_EXCEPTIONS,
    //  2) zdjęcia z opisu produktu (na liście: pobieramy kartę produktu w tle),
    //  3) placeholder sklepu.
    const CONFIG = {
        placeholder:   'css/img/img-placeholder.jpg',
        maxPobieran:   3,               // ile kart produktu pobierać naraz (lista, koszyk)
        maxZdjec:      4,               // ile zdjęć z opisu brać (część bywa usunięta – 403)
        cachePrefix:   'imgFallback:'   // sessionStorage: ID produktu -> lista zdjęć
    };

    // ───────────────────────────────────────────
    // ŹRÓDŁA ZDJĘĆ ZASTĘPCZYCH
    // ───────────────────────────────────────────

    function isPlaceholderSrc(src) {
        return !src || src.indexOf('img-placeholder') >= 0 || src.indexOf('alo.gif') >= 0;
    }

    // Zdjęcia z opisu produktu (dokument karty produktu: bieżący albo pobrany).
    function zdjeciaZOpisu(doc, bazowyUrl) {
        var imgs = doc.querySelectorAll(
            '.productDetails-content--descriptionText img, .product-mobile-description img');
        var wynik = [];
        Array.prototype.forEach.call(imgs, function(img) {
            var src = img.getAttribute('src') || img.getAttribute('data-src') || '';
            if (!src || src.indexOf('data:') === 0 || isPlaceholderSrc(src)) return;
            try { src = new URL(src, bazowyUrl || location.href).href; } catch (e) { return; }
            if (wynik.indexOf(src) < 0) wynik.push(src);
        });
        return wynik.slice(0, CONFIG.maxZdjec);
    }

    function czytajCache(productId) {
        try {
            var v = sessionStorage.getItem(CONFIG.cachePrefix + productId);
            return v ? JSON.parse(v) : null;
        } catch (e) { return null; }
    }

    function zapiszCache(productId, lista) {
        try { sessionStorage.setItem(CONFIG.cachePrefix + productId, JSON.stringify(lista)); } catch (e) { /* brak miejsca / prywatne okno */ }
    }

    // Kolejka pobrań, żeby lista z 50 produktami nie wysłała 50 zapytań naraz.
    var wTrakcie = 0, kolejka = [], obietnice = {};

    function wKolejce(zadanie) {
        return new Promise(function(ok) {
            kolejka.push(function() {
                wTrakcie++;
                zadanie().then(ok, function() { ok([]); }).then(function() {
                    wTrakcie--;
                    if (kolejka.length) kolejka.shift()();
                });
            });
            if (wTrakcie < CONFIG.maxPobieran) kolejka.shift()();
        });
    }

    // Lista zdjęć zastępczych dla produktu (może być pusta).
    function zdjeciaZastepcze(productId, urlProduktu) {
        if (productId && IMAGE_EXCEPTIONS[productId]) return Promise.resolve(IMAGE_EXCEPTIONS[productId]);
        var zCache = productId ? czytajCache(productId) : null;
        if (zCache) return Promise.resolve(zCache);
        if (!urlProduktu) return Promise.resolve([]);
        var klucz = productId || urlProduktu;
        if (!obietnice[klucz]) {
            obietnice[klucz] = wKolejce(function() {
                // Zwykły fetch (bez X-Requested-With) – sklep zwraca wtedy pełną kartę produktu.
                return fetch(urlProduktu, { credentials: 'same-origin' })
                    .then(function(r) { return r.ok ? r.text() : ''; })
                    .then(function(html) {
                        var doc = new DOMParser().parseFromString(html, 'text/html');
                        var lista = zdjeciaZOpisu(doc, new URL(urlProduktu, location.href).href);
                        if (productId) zapiszCache(productId, lista);
                        return lista;
                    });
            });
        }
        return obietnice[klucz];
    }

    // Pokazuje pierwsze zdjęcie z listy, które się wczyta (część zdjęć z opisu
    // bywa usunięta z serwera -> 403); na końcu placeholder sklepu.
    function pierwszeDzialajace(img, urls) {
        var lista = (urls || []).concat([CONFIG.placeholder]), i = 0;
        img.addEventListener('error', function() {
            if (i < lista.length - 1) img.src = lista[++i];
        });
        img.src = lista[0];
    }

    // ───────────────────────────────────────────
    // KAFELKI (listing produktów)
    // ───────────────────────────────────────────

    function ensureSecondImage(tile) {
        var imgEls = tile.querySelectorAll('img');
        if (imgEls.length !== 1) return; // drugi już jest lub brak pierwszego

        var input = tile.closest('.product-item__link')
            && tile.closest('.product-item__link').querySelector('.secondImageOnList-js');
        if (!input) return;

        var secondImgId   = input.getAttribute('data-secondImgId');
        var secondImgLink = input.getAttribute('data-secondImgLink');
        var secondImgExt  = input.getAttribute('data-secondImgExternal');

        if (!secondImgId && !secondImgLink && !secondImgExt) return;

        var img = document.createElement('img');
        img.alt = 'product_image';

        if (secondImgId && secondImgId !== '0') {
            var src = 'img/' + secondImgId + '/' + secondImgLink;
            img.src = src;
            img.dataset.src = src;
        } else if (secondImgExt) {
            img.src = secondImgExt;
        } else {
            return;
        }

        tile.appendChild(img);
    }

    function urlKafelka(tile) {
        var item = tile.closest('.product-item');
        var a = tile.closest('a[href]') || (item && item.querySelector('a.product-url[href]'));
        return (item && item.getAttribute('data-url')) || (a && a.getAttribute('href')) || null;
    }

    function checkTileImages(tile) {
        // Zbuduj drugi obrazek z data-* jeśli jeszcze nie istnieje w DOM
        ensureSecondImage(tile);

        var images = tile.querySelectorAll('.product-item__image img');
        if (!images.length) images = tile.querySelectorAll('img');

        // Wymuś natychmiastowe załadowanie obu obrazków
        images.forEach(function(img) {
            img.loading = 'eager';
            if (img.dataset.lazy) {
                img.src = img.dataset.lazy;
                delete img.dataset.lazy;
            }
        });

        var validImg = null;
        var loaded = 0;
        var total = images.length;

        var placeholder = tile.closest('.product-item__placeholder');
        var productIdInput = placeholder && placeholder.querySelector('.currentProductId');
        var productId = productIdInput ? parseInt(productIdInput.value, 10) : null;

        function applyFallback() {
            zdjeciaZastepcze(productId, urlKafelka(tile)).then(function(urls) {
                tile.querySelectorAll('img').forEach(function(i) {
                    i.style.display = 'none';
                });
                var img = document.createElement('img');
                img.alt = 'product_image';
                img.addEventListener('load', function() { tile.classList.add('loaded'); });
                pierwszeDzialajace(img, urls);
                tile.appendChild(img);
                // Kafelek zawsze widoczny (wcześniej był ukrywany).
                if (placeholder) placeholder.style.display = '';
                tile.classList.add('loaded');
            });
        }

        if (total === 0) {
            applyFallback();
            return;
        }

        images.forEach(function(img) {
            function evaluate() {
                loaded++;
                if (img.naturalWidth > 1 && img.naturalHeight > 1 && !isPlaceholderSrc(img.src) && validImg === null) {
                    validImg = img;
                }
                if (loaded === total) {
                    if (validImg === null) {
                        applyFallback();
                    } else {
                        // Jeśli pierwszy img jest zepsuty, skopiuj src poprawnego na jego miejsce
                        if (validImg !== images[0] && images[0]) {
                            images[0].src = validImg.src;
                        }
                        // Ukryj wszystkie poza pierwszym
                        images.forEach(function(i) {
                            if (i !== images[0]) i.style.display = 'none';
                        });
                    }
                }
            }
            if (img.complete) {
                evaluate();
            } else {
                img.addEventListener('load', evaluate);
                img.addEventListener('error', evaluate);
            }
        });
    }

    // Kafelki sprawdzamy dopiero, gdy zbliżają się do ekranu (400 px zapasu).
    var tileObserver = ('IntersectionObserver' in window)
        ? new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (!entry.isIntersecting) return;
                tileObserver.unobserve(entry.target);
                var tile = entry.target.querySelector('.product-item__image') || entry.target;
                checkTileImages(tile);
            });
        }, { rootMargin: '400px 0px' })
        : null;

    function runOnAllTiles() {
        document.querySelectorAll('.product-item__image').forEach(function(tile) {
            if (tile.dataset.imgQueued === '1') return;
            tile.dataset.imgQueued = '1';
            var target = tile.closest('.product-item__link') || tile;
            if (tileObserver) {
                tileObserver.observe(target);
            } else {
                checkTileImages(tile);
            }
        });
    }

    // ───────────────────────────────────────────
    // STRONA PRODUKTOWA (swiper galeria)
    // ───────────────────────────────────────────

    function getProductPageId() {
        // Na karcie produktu ID jest w formularzu koszyka; .currentProductId mają kafelki.
        var input = document.querySelector('#AddToCartForm input[name="productId"]')
            || document.querySelector('.currentProductId');
        return input ? parseInt(input.value, 10) : null;
    }

    // Galeria "bez zdjęć" w Comarch: <img src="css/img/alo.gif" data-lazy="css/img/img-placeholder.jpg">
    function isPlaceholder(img) {
        var lazy = img.getAttribute('data-lazy') || '';
        if (lazy && isPlaceholderSrc(lazy)) return true;
        if (img.complete) return isPlaceholderSrc(img.src) || img.naturalWidth <= 1;
        return isPlaceholderSrc(img.src) && !lazy;
    }

    function injectFallbackIntoSwiper(fallbackUrls) {
        var swiperWrapper = document.querySelector('.main-gallery-js .swiper-wrapper');
        if (!swiperWrapper) return;

        var existingImgs = swiperWrapper.querySelectorAll('.productDetails-images--image');
        var hasRealImages = Array.from(existingImgs).some(function(img) { return !isPlaceholder(img); });
        if (hasRealImages) return;

        swiperWrapper.innerHTML = '';

        fallbackUrls.forEach(function(url, index) {
            var slide = document.createElement('div');
            slide.className = 'productDetails-images--container swiper-slide loaded' +
                (index === 0 ? ' swiper-slide-active swiper-slide-visible' : '');
            slide.setAttribute('role', 'group');
            slide.setAttribute('aria-label', (index + 1) + ' / ' + fallbackUrls.length);
            slide.setAttribute('data-swiper-slide-index', index);
            slide.setAttribute('data-fallback', '1');   // clear-imgs-product-details.js go nie usuwa

            var img = document.createElement('img');
            img.className = 'productDetails-images--image';
            // Zepsute zdjęcie (np. usunięte z serwera – 403): usuń slajd, a gdy to
            // ostatni slajd – pokaż placeholder sklepu.
            img.addEventListener('error', function() {
                if (swiperWrapper.children.length > 1) {
                    slide.remove();
                    var g = document.querySelector('.main-gallery-js');
                    if (window.Swiper && g && g.swiper) g.swiper.update();
                } else if (!isPlaceholderSrc(img.src)) {
                    img.src = CONFIG.placeholder;
                }
            });
            img.src = url;

            slide.appendChild(img);
            swiperWrapper.appendChild(slide);
        });

        var gallery = document.querySelector('.main-gallery-js');
        if (fallbackUrls.length > 1 && gallery) {
            gallery.querySelectorAll('.swiper-button-prev, .swiper-button-next')
                .forEach(function(btn) {
                    btn.classList.remove('swiper-button-lock');
                });
        }
        if (window.Swiper && gallery && gallery.swiper) {
            gallery.swiper.update();
        }
    }

    function checkProductPage() {
        var gallery = document.querySelector('.main-gallery-js .swiper-wrapper');
        if (!gallery || gallery.dataset.fallbackChecked === '1') return;
        gallery.dataset.fallbackChecked = '1';

        var productId = getProductPageId();
        function fallback() {
            var urls = (productId && IMAGE_EXCEPTIONS[productId])
                || zdjeciaZOpisu(document)        // opis jest już na stronie
                || [];
            if (!urls.length) urls = [CONFIG.placeholder];
            injectFallbackIntoSwiper(urls);
        }

        var imgs = gallery.querySelectorAll('.productDetails-images--image');
        if (imgs.length === 0) { fallback(); return; }

        // Wszystkie to znacznik "brak zdjęć" -> od razu, bez czekania na wczytanie.
        if (Array.from(imgs).every(isPlaceholder)) { fallback(); return; }

        var checked = 0;
        imgs.forEach(function(img) {
            function evaluate() {
                checked++;
                if (checked === imgs.length) fallback();   // injectFallback sam sprawdzi, czy są prawdziwe zdjęcia
            }
            if (img.complete) {
                evaluate();
            } else {
                img.addEventListener('load', evaluate);
                img.addEventListener('error', evaluate);
            }
        });
    }

    // ───────────────────────────────────────────
    // KOSZYK (lista produktów w koszyku)
    // ───────────────────────────────────────────

    function checkCartItem(li) {
        var productId = parseInt(li.getAttribute('data-id'), 10);
        if (!productId) return;

        var figure = li.querySelector('.cart__figure');
        if (!figure) return;

        var img = figure.querySelector('img');
        if (!img) return;

        // Nie sprawdzaj ponownie już obsłużonego obrazka
        if (img.dataset.fallbackChecked === '1') return;

        img.loading = 'eager';

        function evaluate() {
            if (img.dataset.fallbackChecked === '1') return;
            img.dataset.fallbackChecked = '1';

            var isValid = img.naturalWidth > 1
                && img.naturalHeight > 1
                && !isPlaceholderSrc(img.src);
            if (isValid) return;

            var a = li.querySelector('a[href]');
            zdjeciaZastepcze(productId, a && a.getAttribute('href')).then(function(urls) {
                pierwszeDzialajace(img, urls);
            });
        }

        if (img.complete) {
            evaluate();
        } else {
            img.addEventListener('load', evaluate);
            img.addEventListener('error', evaluate);
        }
    }

    function runOnAllCartItems() {
        document.querySelectorAll('.cart__list-item--products').forEach(function(li) {
            checkCartItem(li);
        });
    }

    // ───────────────────────────────────────────
    // INIT
    // ───────────────────────────────────────────

    runOnAllTiles();
    checkProductPage();
    runOnAllCartItems();

    function interceptHistory(method) {
        var original = history[method];
        history[method] = function() {
            original.apply(this, arguments);
            window.dispatchEvent(new Event('urlchange'));
        };
    }
    interceptHistory('pushState');
    interceptHistory('replaceState');

    window.addEventListener('popstate', function() {
        window.dispatchEvent(new Event('urlchange'));
    });

    window.addEventListener('urlchange', function() {
        setTimeout(function() {
            runOnAllTiles();
            checkProductPage();
            runOnAllCartItems();
        }, 500);
    });

    var observer = new MutationObserver(function(mutations) {
        var hasNewTiles = mutations.some(function(mutation) {
            return Array.from(mutation.addedNodes).some(function(node) {
                return node.nodeType === 1 && (
                    node.matches('.product-item__image') ||
                    node.querySelector('.product-item__image') ||
                    node.matches('.main-gallery-js') ||
                    node.querySelector('.main-gallery-js') ||
                    node.matches('.cart__list-item--products') ||
                    node.querySelector('.cart__list-item--products')
                );
            });
        });
        if (hasNewTiles) {
            runOnAllTiles();
            checkProductPage();
            runOnAllCartItems();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});
