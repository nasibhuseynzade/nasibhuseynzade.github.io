document.addEventListener('DOMContentLoaded', function () {
    var currentYear = new Date().getFullYear();
    document.querySelectorAll('[data-current-year]').forEach(function (node) {
        node.textContent = currentYear;
    });

    var isLocalFile = window.location.protocol === 'file:';
    var managedSections = ['home', 'about', 'projects', 'contact'];

    function isManagedSection(sectionName) {
        return managedSections.indexOf(sectionName) !== -1;
    }

    function ensureLocalIndex(path) {
        if (isLocalFile && path.endsWith('/')) {
            return path + 'index.html';
        }

        return path;
    }

    function createSectionHref(path, sectionName) {
        var normalizedPath = ensureLocalIndex(path);

        if (sectionName === 'home') {
            return normalizedPath;
        }

        var separator = normalizedPath.indexOf('?') === -1 ? '?' : '&';
        return normalizedPath + separator + 'section=' + encodeURIComponent(sectionName);
    }

    function cleanCurrentUrl() {
        if (!window.history || typeof window.history.replaceState !== 'function') {
            return;
        }

        var url = new URL(window.location.href);
        var hadSectionQuery = url.searchParams.has('section');
        var hadHash = url.hash.length > 0;

        if (!hadSectionQuery && !hadHash) {
            return;
        }

        url.searchParams.delete('section');
        url.hash = '';

        var search = url.searchParams.toString();
        var cleanUrl = url.pathname + (search ? '?' + search : '');

        if (!isLocalFile && cleanUrl === '/index.html') {
            cleanUrl = '/';
        }

        window.history.replaceState(null, '', cleanUrl);
    }

    function handleRequestedSection() {
        var isLandingPage =
            document.getElementById('home') &&
            document.getElementById('about') &&
            document.getElementById('projects') &&
            document.getElementById('contact');

        if (!isLandingPage) {
            return;
        }

        var url = new URL(window.location.href);
        var requestedSection = '';
        var sectionFromQuery = url.searchParams.get('section');

        if (sectionFromQuery && isManagedSection(sectionFromQuery)) {
            requestedSection = sectionFromQuery;
        } else if (url.hash) {
            var sectionFromHash = url.hash.slice(1);

            if (isManagedSection(sectionFromHash)) {
                requestedSection = sectionFromHash;
            }
        }

        if (!requestedSection) {
            return;
        }

        var targetTop = 0;

        if (requestedSection !== 'home') {
            var sectionNode = document.getElementById(requestedSection);

            if (sectionNode) {
                targetTop = Math.max(0, sectionNode.offsetTop - 80);
            }
        }

        window.scrollTo({
            top: targetTop,
            behavior: 'auto'
        });

        cleanCurrentUrl();
    }

    handleRequestedSection();

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

        if (href.startsWith('#')) {
            return;
        }

        var hashIndex = href.indexOf('#');
        var path = hashIndex === -1 ? href : href.slice(0, hashIndex);
        var hash = hashIndex === -1 ? '' : href.slice(hashIndex + 1);

        if (path && hash && isManagedSection(hash)) {
            href = createSectionHref(path, hash);
            link.setAttribute('href', href);
            return;
        }

        // On file://, directory-style links open folders; force index.html fallback.
        if (isLocalFile) {
            path = ensureLocalIndex(path);
            href = hash ? path + '#' + hash : path;
        }

        link.setAttribute('href', href);
    });
});
