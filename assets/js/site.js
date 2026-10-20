(function () {
    'use strict';

    var root = document.documentElement;
    var header = document.querySelector('[data-header]');

    var year = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach(function (node) {
        node.textContent = year;
    });

    if (window.location.protocol === 'file:') {
        document.querySelectorAll('a[href]').forEach(function (link) {
            var href = link.getAttribute('href');

            if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return;

            var match = href.match(/^([^?#]*)(.*)$/);
            if (match[1] && match[1].slice(-1) === '/') {
                link.setAttribute('href', match[1] + 'index.html' + match[2]);
            }
        });
    }

    var pending = false;
    var update = function () {
        pending = false;
        var y = window.scrollY;
        var max = root.scrollHeight - window.innerHeight;
        header.classList.toggle('is-scrolled', y > 8);
        header.style.setProperty('--scroll', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    };
    var schedule = function () {
        if (pending) return;
        pending = true;
        window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    var toggle = document.querySelector('[data-menu-toggle]');
    var menu = document.getElementById(toggle.getAttribute('aria-controls'));
    var toggleLabel = toggle.querySelector('[data-menu-label]');
    var behind = document.querySelectorAll('main, footer, .skip-link');

    var setOpen = function (open, restoreFocus) {
        toggle.setAttribute('aria-expanded', String(open));
        toggleLabel.textContent = open ? 'Close menu' : 'Open menu';
        header.classList.toggle('is-open', open);
        root.classList.toggle('menu-open', open);
        behind.forEach(function (node) {
            node.inert = open;
        });

        if (open) {
            menu.querySelector('a').focus({ preventScroll: true });
        } else if (restoreFocus) {
            toggle.focus();
        }
    };

    toggle.addEventListener('click', function () {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    menu.addEventListener('click', function (event) {
        if (event.target.closest('a')) setOpen(false);
    });

    var headerInner = header.querySelector('.header-inner');
    headerInner.addEventListener('click', function (event) {
        if (event.target === headerInner && header.classList.contains('is-open')) setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && header.classList.contains('is-open')) {
            setOpen(false, true);
        }
    });

    window.matchMedia('(max-width: 1023.98px)').addEventListener('change', function (event) {
        if (!event.matches) setOpen(false);
    });

    var navLinks = [].slice.call(document.querySelectorAll('[data-nav-link]')).filter(function (link) {
        return link.getAttribute('href').charAt(0) === '#';
    });

    if (navLinks.length) {
        var setActive = function (id) {
            navLinks.forEach(function (link) {
                link.classList.toggle('is-active', link.getAttribute('href') === '#' + id);
            });
        };

        var sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) setActive(entry.target.id);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });

        document.querySelectorAll('main > section[id]').forEach(function (section) {
            sectionObserver.observe(section);
        });
    }

    var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    document.querySelectorAll('[data-reveal]').forEach(function (node) {
        revealObserver.observe(node);
    });
})();
