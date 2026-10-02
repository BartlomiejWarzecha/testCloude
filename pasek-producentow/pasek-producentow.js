// =============================================================================
// PASEK PRODUCENTÓW  (pasek-producentow.js)
// Strona główna: rząd przycisków z producentami nad banerem (.hero-slider).
// Kliknięcie -> lista produktów producenta (/producent=<nazwa>/produkty,2).
//
// Ładować na stronie głównej (albo w całym szablonie – na innych stronach nic nie robi):
//   <script src="/usr/pasek-producentow.js"></script>
//
// Logo: pliki z folderu logo/ (pasek-logo-*.png/.jpg) wgraj do /usr/.
// Producent z "logo" pokazuje obrazek (nazwa zostaje jako tekst alternatywny),
// bez "logo" – nazwę. Gdy pliku nie ma na serwerze, też wraca do nazwy.
// =============================================================================

(function () {
    'use strict';

    var TYTUL = 'Producenci';
    var KATALOG_LOGO = '/usr/';

    // Kolejność = kolejność na pasku. Linki sprawdzone 02.10.2026 (wszystkie mają produkty).
    var PRODUCENCI = [
        { nazwa: 'Husqvarna',         link: '/producent=husqvarna/produkty,2', logo: 'pasek-logo-husqvarna.png' },
        { nazwa: 'Gardena',           link: '/producent=gardena/produkty,2', logo: 'pasek-logo-gardena.png' },
        { nazwa: 'Stiga',             link: '/producent=stiga/produkty,2', logo: 'pasek-logo-stiga.png' },
        { nazwa: 'John Deere',        link: '/producent=john%20deere/produkty,2', logo: 'pasek-logo-john-deere.png' },
        { nazwa: 'AL-KO',             link: '/producent=al-ko/produkty,2', logo: 'pasek-logo-al-ko.png' },
        { nazwa: 'Cedrus',            link: '/producent=cedrus/produkty,2', logo: 'pasek-logo-cedrus.png' },
        { nazwa: 'Honda',             link: '/producent=honda/produkty,2', logo: 'pasek-logo-honda.png' },
        { nazwa: 'Briggs & Stratton', link: '/producent=briggs%26stratton/produkty,2', logo: 'pasek-logo-briggs-and-stratton.png' },
        { nazwa: 'Kawasaki',          link: '/producent=kawasaki/produkty,2', logo: 'pasek-logo-kawasaki.png' },
        { nazwa: 'Kohler',            link: '/producent=kohler/produkty,2', logo: 'pasek-logo-kohler.png' },
        { nazwa: 'Stihl',             link: '/producent=stihl/produkty,2', logo: 'pasek-logo-stihl.png' },
        { nazwa: 'Oregon',            link: '/producent=oregon/produkty,2', logo: 'pasek-logo-oregon.png' },
        { nazwa: 'Karcher',           link: '/producent=karcher/produkty,2', logo: 'pasek-logo-karcher.png' },
        { nazwa: 'Cub Cadet',         link: '/producent=cub%20cadet/produkty,2', logo: 'pasek-logo-cub-cadet.png' },
        { nazwa: 'MTD',               link: '/producent=mtd/produkty,2' },
        { nazwa: 'Wiedenmann',        link: '/producent=wiedenmann/produkty,2', logo: 'pasek-logo-wiedenmann.png' },
        { nazwa: 'WOLF-Garten',       link: '/producent=wolf-garten/produkty,2', logo: 'pasek-logo-wolf-garten.png' },
        { nazwa: 'Fiskars',           link: '/producent=fiskars/produkty,2', logo: 'pasek-logo-fiskars.png' },
        { nazwa: 'Milwaukee',         link: '/producent=milwaukee/produkty,2', logo: 'pasek-logo-milwaukee.png' },
        { nazwa: 'Emeralld',          link: '/producent=emeralld/produkty,2' },
        { nazwa: 'GKB Machines',      link: '/producent=gkb%20machines/produkty,2', logo: 'pasek-logo-gkb-machines.png' },
        { nazwa: 'Weibang',           link: '/producent=weibang/produkty,2', logo: 'pasek-logo-weibang.png' },
        { nazwa: 'Loncin',            link: '/producent=loncin/produkty,2' },
        { nazwa: 'LS Tractor',        link: '/producent=ls%20tractor/produkty,2', logo: 'pasek-logo-ls-tractor.png' },
        { nazwa: 'Samasz',            link: '/producent=samasz/produkty,2', logo: 'pasek-logo-samasz.png' },
        { nazwa: 'Earth & Turf',      link: '/producent=earth%26turf%20products/produkty,2', logo: 'pasek-logo-earth-and-turf.png' },
        { nazwa: '4Farmer',           link: '/producent=4farmer/produkty,2' },
        { nazwa: 'Agritec',           link: '/producent=agritec/produkty,2', logo: 'pasek-logo-agritec.png' },
        { nazwa: 'Bestway',           link: '/producent=bestway/produkty,2', logo: 'pasek-logo-bestway.png' },
        { nazwa: 'Bradas',            link: '/producent=bradas/produkty,2', logo: 'pasek-logo-bradas.png' },
        { nazwa: 'Cramer',            link: '/producent=cramer/produkty,2' },
        { nazwa: 'Garden Parts',      link: '/producent=garden%20parts/produkty,2', logo: 'pasek-logo-garden-parts.jpg' },
        { nazwa: 'Happs',             link: '/producent=happs/produkty,2' },
        { nazwa: 'Kramp',             link: '/producent=kramp/produkty,2', logo: 'pasek-logo-kramp.png' },
        { nazwa: 'RDM Parts',         link: '/producent=rdm%20parts/produkty,2', logo: 'pasek-logo-rdm-parts.png' },
        { nazwa: 'Stalco',            link: '/producent=stalco/produkty,2', logo: 'pasek-logo-stalco.png' },
        { nazwa: 'Step Systems',      link: '/producent=step%20systems/produkty,2', logo: 'pasek-logo-step-systems.jpg' },
        { nazwa: 'Vonblon',           link: '/producent=vonblon/produkty,2', logo: 'pasek-logo-vonblon.png' },
        { nazwa: 'Walbro',            link: '/producent=walbro/produkty,2', logo: 'pasek-logo-walbro.png' },
        { nazwa: 'Zama',              link: '/producent=zama/produkty,2', logo: 'pasek-logo-zama.png' }
    ];

    var CSS =
        '.pasek-prod{display:flex;align-items:center;gap:12px;margin:0 auto 24px;box-sizing:border-box;font-family:Poppins,sans-serif}' +
        '.pasek-prod__tytul{flex:0 0 auto;font-size:14px;font-weight:600;color:#1d2433;white-space:nowrap}' +
        '.pasek-prod__okno{position:relative;flex:1 1 auto;min-width:0}' +
        '.pasek-prod__lista{display:flex;gap:8px;overflow-x:auto;scroll-behavior:smooth;scroll-snap-type:x proximity;' +
            'scrollbar-width:none;padding:2px;margin:0;list-style:none}' +
        '.pasek-prod__lista::-webkit-scrollbar{display:none}' +
        '.pasek-prod__lista li{flex:0 0 auto;scroll-snap-align:start}' +
        '.pasek-prod__link{display:flex;align-items:center;justify-content:center;height:40px;padding:0 16px;box-sizing:border-box;' +
            'border:1px solid #dcdfe4;border-radius:8px;background:#fff;color:#1d2433;font-size:14px;font-weight:600;' +
            'text-decoration:none;white-space:nowrap;transition:border-color .15s,background .15s}' +
        '.pasek-prod__link:hover,.pasek-prod__link:focus-visible{border-color:#22355c;color:#22355c;outline:none;box-shadow:0 1px 4px rgba(34,53,92,.15)}' +
        '.pasek-prod__link--logo{padding:0 14px}' +
        '.pasek-prod__link img{max-height:28px;max-width:110px;width:auto;height:auto;display:block}' +
        '.pasek-prod__strzalka{flex:0 0 auto;width:36px;height:36px;border:1px solid #dcdfe4;border-radius:50%;background:#fff;' +
            'color:#1d2433;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;padding:0}' +
        '.pasek-prod__strzalka:hover{border-color:#22355c;color:#22355c}' +
        '.pasek-prod__strzalka[disabled]{opacity:.35;cursor:default}' +
        '.pasek-prod__okno::after{content:"";position:absolute;top:0;right:0;bottom:0;width:32px;pointer-events:none;' +
            'background:linear-gradient(to right,rgba(255,255,255,0),#fff)}' +
        '@media (max-width:768px){.pasek-prod{gap:8px;margin-bottom:16px;padding:0 16px}' +
            '.pasek-prod__tytul,.pasek-prod__strzalka{display:none}' +
            '.pasek-prod__link{height:36px;padding:0 12px;font-size:13px}' +
            '.pasek-prod__link img{max-height:22px;max-width:90px}}';

    function zbuduj() {
        var pasek = document.createElement('nav');
        pasek.className = 'pasek-prod';
        pasek.setAttribute('aria-label', TYTUL);

        var tytul = document.createElement('span');
        tytul.className = 'pasek-prod__tytul';
        tytul.textContent = TYTUL + ':';

        var okno = document.createElement('div');
        okno.className = 'pasek-prod__okno';
        var lista = document.createElement('ul');
        lista.className = 'pasek-prod__lista';
        PRODUCENCI.forEach(function (p) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.className = 'pasek-prod__link';
            a.href = p.link;
            if (p.logo) {
                var img = document.createElement('img');
                img.alt = p.nazwa; img.title = p.nazwa; img.loading = 'lazy';
                img.onerror = function () { a.className = 'pasek-prod__link'; a.textContent = p.nazwa; };
                img.src = KATALOG_LOGO + p.logo;
                a.className += ' pasek-prod__link--logo';
                a.setAttribute('aria-label', p.nazwa);
                a.appendChild(img);
            } else {
                a.textContent = p.nazwa;
            }
            li.appendChild(a);
            lista.appendChild(li);
        });
        okno.appendChild(lista);

        function strzalka(znak, kierunek, etykieta) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pasek-prod__strzalka';
            b.setAttribute('aria-label', etykieta);
            b.textContent = znak;
            b.addEventListener('click', function () {
                lista.scrollBy({ left: kierunek * Math.max(200, lista.clientWidth * 0.8), behavior: 'smooth' });
            });
            return b;
        }
        var lewa = strzalka('‹', -1, 'Przewiń w lewo'), prawa = strzalka('›', 1, 'Przewiń w prawo');
        function odswiezStrzalki() {
            lewa.disabled = lista.scrollLeft <= 2;
            prawa.disabled = lista.scrollLeft + lista.clientWidth >= lista.scrollWidth - 2;
        }
        lista.addEventListener('scroll', odswiezStrzalki, { passive: true });
        window.addEventListener('resize', odswiezStrzalki);

        pasek.appendChild(tytul);
        pasek.appendChild(lewa);
        pasek.appendChild(okno);
        pasek.appendChild(prawa);
        return { el: pasek, odswiez: odswiezStrzalki };
    }

    function start() {
        var slider = document.querySelector('main .gridContainer .hero-slider');   // tylko strona główna
        if (!slider || document.querySelector('.pasek-prod')) return;

        var st = document.createElement('style');
        st.textContent = CSS;
        document.head.appendChild(st);

        var p = zbuduj();
        var kontener = slider.closest('.gridContainer');
        var wrap = document.createElement('div');
        wrap.style.order = '0';
        wrap.appendChild(p.el);
        kontener.insertBefore(wrap, kontener.firstChild);

        // Szerokość i położenie jak baner (krawędzie równo z banerem).
        function dopasuj() {
            if (window.innerWidth <= 768) { p.el.style.width = ''; p.el.style.marginLeft = ''; p.odswiez(); return; }
            var s = slider.getBoundingClientRect(), k = kontener.getBoundingClientRect();
            p.el.style.width = Math.round(s.width) + 'px';
            p.el.style.marginLeft = Math.round(s.left - k.left) + 'px';
            p.odswiez();
        }
        dopasuj();
        window.addEventListener('resize', dopasuj);
        window.addEventListener('load', dopasuj);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
