function initNavigation() {
    var currentPath = window.location.pathname;
    var filename = currentPath.split('/').pop() || 'index.html';

    var navMap = {
        'index.html': '主页',
        '': '主页',
        'articles.html': '文章',
        'projects.html': '项目',
        'gallery.html': '画廊',
        'links.html': '友链',
        'about.html': '关于'
    };

    var activeLabel = navMap[filename] || '主页';

    document.querySelectorAll('.nav-item').forEach(function (item) {
        var span = item.querySelector('span');
        if (!span) return;
        var label = span.textContent.trim();
        item.classList.remove('active');
        item.classList.add('text-textMuted', 'dark:text-slate-400');
        if (label === activeLabel) {
            item.classList.add('active');
            item.classList.remove('text-textMuted', 'dark:text-slate-400');
        }
    });

    document.querySelectorAll('.mobile-nav-item').forEach(function (item) {
        var span = item.querySelector('span');
        if (!span) return;
        var label = span.textContent.trim();
        item.classList.remove('text-slate-800', 'dark:text-slate-200');
        item.classList.add('text-slate-400');
        if (label === activeLabel) {
            item.classList.remove('text-slate-400');
            item.classList.add('text-slate-800', 'dark:text-slate-200');
        }
    });
}
