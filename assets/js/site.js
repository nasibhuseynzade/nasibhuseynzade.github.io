document.addEventListener('DOMContentLoaded', function () {
    var currentYear = new Date().getFullYear();
    document.querySelectorAll('[data-current-year]').forEach(function (node) {
        node.textContent = currentYear;
    });

    var isLocalFile = window.location.protocol === 'file:';
    var sectionIds = ['home', 'about', 'projects', 'contact'];

    function normalizeSectionHref(href) {
        if (href.startsWith('#')) {
            return href;
        }

        var match = href.match(/#([a-z0-9_-]+)$/i);
        if (!match) {
            return href;
        }

        var section = match[1].toLowerCase();
        if (!sectionIds.includes(section)) {
            return href;
        }

        var baseHref = href.slice(0, -match[0].length);
        if (section === 'home') {
            return baseHref;
        }

        var separator = baseHref.includes('?') ? '&' : '?';
        return baseHref + separator + 'section=' + section;
    }

    function applyLocalIndexFallback(href) {
        if (!isLocalFile || href.startsWith('#')) {
            return href;
        }

        var hashIndex = href.indexOf('#');
        var hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
        var pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;

        var queryIndex = pathAndQuery.indexOf('?');
        var path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery;
        var query = queryIndex >= 0 ? pathAndQuery.slice(queryIndex) : '';

        if (path.endsWith('/')) {
            path += 'index.html';
        }

        return path + query + hash;
    }

    document.querySelectorAll('a[href]').forEach(function (link) {
        var href = link.getAttribute('href');

        if (!href) {
            return;
        }

        if (
            href.startsWith('http://') ||
            href.startsWith('https://') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            href.startsWith('javascript:')
        ) {
            return;
        }

        href = normalizeSectionHref(href);
        href = applyLocalIndexFallback(href);

        link.setAttribute('href', href);
    });

    var requestedSection = new URLSearchParams(window.location.search).get('section');
    if (requestedSection) {
        var sectionId = requestedSection.toLowerCase();

        if (sectionIds.includes(sectionId)) {
            if (sectionId === 'home') {
                window.scrollTo(0, 0);
            } else {
                var targetSection = document.getElementById(sectionId);
                if (targetSection) {
                    var offsetTop = targetSection.offsetTop - 80;
                    window.scrollTo(0, Math.max(0, offsetTop));
                }
            }

            if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState(null, '', window.location.pathname);
            }
        }
    }
});
