document.addEventListener('DOMContentLoaded', function () {
    var currentYear = new Date().getFullYear();
    document.querySelectorAll('[data-current-year]').forEach(function (node) {
        node.textContent = currentYear;
    });

    var isLocalFile = window.location.protocol === 'file:';

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

        // Use clean homepage URL instead of /#home when navigating from project pages.
        if (href !== '#home' && href.endsWith('#home')) {
            href = href.slice(0, -'#home'.length);
        }

        // On file://, directory-style links open folders; force index.html fallback.
        if (isLocalFile && !href.startsWith('#')) {
            var parts = href.split('#');
            var path = parts[0];
            var hash = parts.length > 1 ? '#' + parts.slice(1).join('#') : '';

            if (path.endsWith('/')) {
                href = path + 'index.html' + hash;
            } else {
                href = path + hash;
            }
        }

        link.setAttribute('href', href);
    });
});
