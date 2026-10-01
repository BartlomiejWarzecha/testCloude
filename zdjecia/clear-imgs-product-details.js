(function () {
    'use strict';

    function isBadSrc(src) {
        return !src || src === '' || src.includes('img-placeholder');
    }

    function cleanProductGallery() {
        var mainWrapper  = document.querySelector('.main-gallery-js .swiper-wrapper');
        var thumbWrapper = document.querySelector('.thumbs-gallery-js .swiper-wrapper');

        if (!mainWrapper) return;

        // Snapshot slide lists before any removal
        var mainSlides  = Array.from(mainWrapper.children);
        var thumbSlides = thumbWrapper ? Array.from(thumbWrapper.children) : [];

        var toRemove   = [];   // indices of bad image slides
        var pendingAsync = 0;

        function finalize() {
            if (pendingAsync > 0) return;

            // Remove in reverse order so earlier indices stay valid
            toRemove.sort(function (a, b) { return b - a; });
            toRemove.forEach(function (i) {
                if (mainSlides[i]  && mainSlides[i].parentElement)  mainSlides[i].remove();
                if (thumbSlides[i] && thumbSlides[i].parentElement) thumbSlides[i].remove();
            });

            // Re-initialize swiper state
            var mainEl  = document.querySelector('.main-gallery-js');
            var thumbEl = document.querySelector('.thumbs-gallery-js');

            if (window.Swiper) {
                if (mainEl  && mainEl.swiper)  { mainEl.swiper.slideTo(0, 0); mainEl.swiper.update(); }
                if (thumbEl && thumbEl.swiper) { thumbEl.swiper.slideTo(0, 0); thumbEl.swiper.update(); }
            }
        }

        mainSlides.forEach(function (slide, index) {
            // Leave video slides alone (iframe / video inside)
            if (slide.classList.contains('video')) return;
            // Slajd zastępczy z clear-imgs.js (zdjęcie z opisu / placeholder) – nie usuwać
            if (slide.getAttribute('data-fallback') === '1') return;

            var img = slide.querySelector('img.productDetails-images--image');
            if (!img) return;

            // Force eager so the browser resolves load/error as fast as possible
            img.loading = 'eager';

            // Placeholder assigned directly in template → remove without waiting
            if (isBadSrc(img.getAttribute('src'))) {
                toRemove.push(index);
                return;
            }

            if (img.complete) {
                // Browser already knows the result
                if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
                    toRemove.push(index);
                }
            } else {
                // Image still in flight — wait for the network verdict
                pendingAsync++;

                function onResult() {
                    if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
                        toRemove.push(index);
                    }
                    pendingAsync--;
                    finalize();
                }

                img.addEventListener('load',  onResult, { once: true });
                img.addEventListener('error', onResult, { once: true });
            }
        });

        // Covers the all-synchronous case (all images already complete)
        finalize();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', cleanProductGallery);
    } else {
        cleanProductGallery();
    }
})();
