document.addEventListener('DOMContentLoaded', function () {
    if (window.lucide) lucide.createIcons();
    initDarkMode();
    initNavigation();
    initTabs();
    if (typeof initInteractions === 'function') initInteractions();
});
