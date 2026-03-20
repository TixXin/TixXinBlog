function initTabs() {
    var tabs = document.querySelectorAll('[data-tab]');
    if (!tabs.length) return;

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var tabValue = tab.getAttribute('data-tab');

            if (tabValue === 'msg') {
                window.location.href = './guestbook.html';
                return;
            }

            tabs.forEach(function (t) {
                t.classList.remove('tab-active', 'text-slate-800', 'dark:text-slate-200', 'font-bold');
                t.classList.add('text-textMuted', 'dark:text-slate-400');
            });
            tab.classList.add('tab-active', 'text-slate-800', 'dark:text-slate-200', 'font-bold');
            tab.classList.remove('text-textMuted', 'dark:text-slate-400');

            var articles = document.querySelectorAll('[data-category]');
            articles.forEach(function (article) {
                if (tabValue === 'all') {
                    article.style.display = '';
                } else {
                    article.style.display = article.getAttribute('data-category') === tabValue ? '' : 'none';
                }
            });
        });
    });
}
