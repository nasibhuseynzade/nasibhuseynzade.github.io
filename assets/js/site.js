document.addEventListener('DOMContentLoaded', function () {
    var currentYear = new Date().getFullYear();
    document.querySelectorAll('[data-current-year]').forEach(function (node) {
        node.textContent = currentYear;
    });
});
