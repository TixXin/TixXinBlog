function initInteractions() {
    initSearchOverlay();
    initInfiniteScroll();
    initFormFeedback();
    initDonatePopup();
    initReadingProgress();
    initScrollspy();
    initCodeCopy();
    initTooltips();
    initStickyBackNav();
}

function initStickyBackNav() {
    // Handled by scheme switcher in article.html
}

function initSearchOverlay() {
    var searchInputs = document.querySelectorAll('input[type="text"][placeholder*="搜索"]');
    searchInputs.forEach(function (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var query = input.value.trim();
                if (!query) return;
                showToast('搜索功能开发中，敬请期待...');
                input.value = '';
            }
        });
        input.addEventListener('focus', function () {
            input.setAttribute('placeholder', '输入关键词后按 Enter 搜索...');
        });
        input.addEventListener('blur', function () {
            var original = input.dataset.placeholder || input.getAttribute('placeholder');
            if (!input.dataset.placeholder) {
                input.dataset.placeholder = original;
            }
        });
    });
}

function initInfiniteScroll() {
    var spinner = document.getElementById('loading-spinner');
    var articleList = document.getElementById('article-list');
    if (!spinner || !articleList) return;

    var loadedCount = 0;
    var totalCount = 20;
    var isLoading = false;

    var mockArticles = [];
    for (var i = 1; i <= totalCount; i++) {
        var isTech = i % 2 !== 0;
        mockArticles.push({
            id: i,
            category: isTech ? 'tech' : 'life',
            date: '2024-0' + (Math.floor(Math.random() * 3) + 1) + '-' + String(Math.floor(Math.random() * 28) + 1).padStart(2, '0'),
            folder: isTech ? '前端开发' : '生活随笔',
            views: Math.floor(Math.random() * 1000) + 100,
            likes: Math.floor(Math.random() * 80) + 5,
            comments: Math.floor(Math.random() * 30),
            readTime: Math.floor(Math.random() * 15) + 3,
            title: (isTech ? '深入理解前端技术架构与性能优化 ' : '关于生活与工作的平衡思考法则 ') + i,
            desc: '这是一段模拟的文章摘要内容，用于展示瀑布流无限滚动的效果。文章内容涵盖了各种技术细节和生活感悟，希望能给你带来启发和思考...',
            tags: isTech ? ['# Web', '# 架构'] : ['# 随笔', '# 思考'],
            tagColors: isTech ? 
                ['bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20', 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'] : 
                ['bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20', 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20']
        });
    }

    function renderArticle(article) {
        var tagsHtml = article.tags.map(function(tag, index) {
            return '<span class="px-2 py-0.5 ' + article.tagColors[index] + ' text-[11px] font-semibold rounded-md border">' + tag + '</span>';
        }).join('');

        var html = `
            <article data-category="${article.category}" onclick="window.location.href='./article.html'" class="group relative bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 p-5 rounded-2xl hover:shadow-xl hover:shadow-slate-500/5 dark:hover:shadow-slate-500/10 hover:border-slate-200 dark:hover:border-slate-500/30 transition-all duration-300 cursor-pointer opacity-0 animate-fade-in-up">
                <div class="flex flex-col">
                    <h2 class="text-lg font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white transition-colors leading-snug mb-2">${article.title}</h2>
                    <p class="text-slate-500 dark:text-slate-400 text-[13px] leading-relaxed line-clamp-2 mb-3">${article.desc}</p>
                    <div class="flex flex-wrap items-center gap-1.5">
                        ${tagsHtml}
                    </div>
                </div>
                <div class="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                    <div class="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                        <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${article.readTime} min</span>
                        <span class="flex items-center gap-1"><i data-lucide="heart" class="w-3 h-3"></i> ${article.likes}</span>
                        <span class="flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> ${article.views}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <span>${article.date}</span>
                        <span class="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span>${article.folder}</span>
                        <span class="w-0.5 h-0.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span class="flex items-center gap-0.5"><i data-lucide="message-square" class="w-3 h-3"></i> ${article.comments}</span>
                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"></i>
                    </div>
                </div>
            </article>
        `;
        
        var tempDiv = document.createElement('div');
        tempDiv.innerHTML = html.trim();
        var articleEl = tempDiv.firstChild;
        
        // 插入到 loading-spinner 之前
        articleList.insertBefore(articleEl, spinner);
        
        // 触发动画
        setTimeout(function() {
            articleEl.classList.remove('opacity-0', 'animate-fade-in-up');
        }, 50);
        
        if (window.lucide) lucide.createIcons();
    }

    function loadMore() {
        if (isLoading || loadedCount >= totalCount) return;
        isLoading = true;
        
        // 模拟网络延迟
        setTimeout(function() {
            var batchSize = 4;
            var endIndex = Math.min(loadedCount + batchSize, totalCount);
            
            for (var i = loadedCount; i < endIndex; i++) {
                renderArticle(mockArticles[i]);
            }
            
            loadedCount = endIndex;
            isLoading = false;
            
            if (loadedCount >= totalCount) {
                spinner.innerHTML = '<span class="text-sm text-slate-400">没有更多文章了</span>';
                spinner.classList.remove('animate-spin');
                var icon = spinner.querySelector('i');
                if (icon) icon.remove();
            }
        }, 800);
    }

    // Use a slightly larger rootMargin to trigger load before hitting the absolute bottom
    var observer = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
            loadMore();
        }
    }, { root: articleList, rootMargin: '100px', threshold: 0.1 });

    observer.observe(spinner);
}

function initFormFeedback() {
    var submitBtns = document.querySelectorAll('button');
    submitBtns.forEach(function (btn) {
        if (btn.textContent.trim() === '提交申请' || btn.textContent.trim() === '发布留言') {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                var form = btn.closest('.grid, form') || btn.parentElement.parentElement;
                var isGuestbook = btn.textContent.trim() === '发布留言';
                
                var inputs = form ? form.querySelectorAll('input, textarea') : [];
                var hasValue = false;
                var textarea = form ? form.querySelector('textarea') : null;
                
                if (isGuestbook) {
                    if (!textarea) {
                        var parent = btn.parentElement;
                        while (parent && !parent.querySelector('textarea')) parent = parent.parentElement;
                        textarea = parent ? parent.querySelector('textarea') : null;
                    }
                    if (!textarea || !textarea.value.trim()) {
                        showToast('请输入留言内容');
                        return;
                    }
                    hasValue = true;
                } else {
                    inputs.forEach(function (inp) { if (inp.value.trim()) hasValue = true; });
                    if (!hasValue) {
                        showToast('请填写必要信息后再提交');
                        return;
                    }
                }

                // Loading state
                var originalText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline-block mr-2"></i> 提交中...';
                if (window.lucide) lucide.createIcons();
                btn.classList.add('opacity-80', 'cursor-not-allowed');

                setTimeout(function() {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                    btn.classList.remove('opacity-80', 'cursor-not-allowed');
                    if (window.lucide) lucide.createIcons();
                    
                    showToast(isGuestbook ? '✅ 留言发布成功！' : '✅ 友链申请已提交，感谢！我会尽快审核。');
                    
                    if (isGuestbook && textarea) {
                        var container = textarea.closest('div') || textarea.parentElement;
                        while (container && !container.querySelector('input')) container = container.parentElement;
                        if (container) {
                            var formInputs = container.querySelectorAll('input, textarea');
                            formInputs.forEach(function (inp) { inp.value = ''; });
                        } else {
                            textarea.value = '';
                        }
                    } else {
                        inputs.forEach(function (inp) { inp.value = ''; });
                    }
                }, 1000);
            });
        }
    });
}

function initDonatePopup() {
    var btns = document.querySelectorAll('button');
    btns.forEach(function (btn) {
        if (btn.textContent.trim() === '打赏支持') {
            btn.addEventListener('click', function () {
                showDonateModal();
            });
        }
    });
}

function showDonateModal() {
    var existing = document.getElementById('donate-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'donate-modal';
    modal.className = 'fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center';
    modal.onclick = function (e) { if (e.target === modal) modal.remove(); };
    modal.innerHTML =
        '<div class="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm mx-4 shadow-2xl text-center">' +
        '<div class="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-3xl">☕</div>' +
        '<h3 class="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">感谢你的支持</h3>' +
        '<p class="text-sm text-slate-500 dark:text-slate-400 mb-6">扫描下方二维码请我喝杯咖啡</p>' +
        '<div class="w-48 h-48 mx-auto bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-4">' +
        '<div class="text-center"><div class="text-4xl mb-2">📱</div><p class="text-xs text-slate-400">二维码占位</p></div>' +
        '</div>' +
        '<button onclick="this.closest(\'#donate-modal\').remove()" class="mt-2 px-6 py-2 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 rounded-xl text-sm font-medium hover:bg-slate-900 dark:hover:bg-slate-300 transition-colors">关闭</button>' +
        '</div>';
    document.body.appendChild(modal);
}

function showToast(message) {
    var existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast-notification fixed top-6 left-1/2 -translate-x-1/2 z-[200] bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 px-6 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all duration-300';
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -10px)';
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
    });

    setTimeout(function () {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, -10px)';
        setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
}

function initReadingProgress() {
    var progressBar = document.getElementById('reading-progress');
    if (!progressBar) return;
    
    // In desktop, the scrollable area is .main-container or main .flex-1
    // In mobile, it's the window/document
    var scrollContainer = document.querySelector('main .flex-1');
    if (!scrollContainer) return;

    function updateProgress() {
        // Check if mobile (window scroll) or desktop (container scroll)
        var isMobile = window.innerWidth < 1280; // xl breakpoint
        var target = isMobile ? document.documentElement : scrollContainer;
        var scrollTop = isMobile ? window.scrollY : target.scrollTop;
        var scrollHeight = target.scrollHeight;
        var clientHeight = isMobile ? window.innerHeight : target.clientHeight;
        
        var maxScroll = scrollHeight - clientHeight;
        var progress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
        progressBar.style.width = progress + '%';
    }

    scrollContainer.addEventListener('scroll', updateProgress);
    window.addEventListener('scroll', updateProgress);
    window.addEventListener('resize', updateProgress);
    updateProgress();
}

function initScrollspy() {
    var headings = document.querySelectorAll('article h2[id], article h3[id]');
    var tocLinks = document.querySelectorAll('aside nav a[href^="#"], #mobile-toc-modal nav a[href^="#"]');
    if (!headings.length || !tocLinks.length) return;

    var scrollContainer = document.querySelector('main .flex-1');
    if (!scrollContainer) return;

    function updateActiveTOC() {
        var isMobile = window.innerWidth < 1280;
        var scrollTop = isMobile ? window.scrollY : scrollContainer.scrollTop;
        var offset = 100; // Offset for header
        
        var currentId = '';
        headings.forEach(function(heading) {
            var top = isMobile ? heading.getBoundingClientRect().top + window.scrollY : heading.offsetTop;
            if (scrollTop >= top - offset) {
                currentId = heading.getAttribute('id');
            }
        });

        tocLinks.forEach(function(link) {
            var href = link.getAttribute('href').substring(1);
            if (href === currentId) {
                link.classList.add('text-slate-900', 'dark:text-slate-100', 'bg-slate-50', 'dark:bg-slate-700/50');
                link.classList.remove('text-slate-600', 'dark:text-slate-300');
                var dot = link.querySelector('span');
                if (dot) {
                    dot.classList.remove('bg-slate-300', 'dark:bg-slate-600');
                    dot.classList.add('bg-slate-800', 'dark:bg-slate-200');
                }
            } else {
                link.classList.remove('text-slate-900', 'dark:text-slate-100', 'bg-slate-50', 'dark:bg-slate-700/50');
                link.classList.add('text-slate-600', 'dark:text-slate-300');
                var dot = link.querySelector('span');
                if (dot) {
                    dot.classList.add('bg-slate-300', 'dark:bg-slate-600');
                    dot.classList.remove('bg-slate-800', 'dark:bg-slate-200');
                }
            }
        });
    }

    scrollContainer.addEventListener('scroll', updateActiveTOC);
    window.addEventListener('scroll', updateActiveTOC);
    window.addEventListener('resize', updateActiveTOC);
    updateActiveTOC();
}

function initCodeCopy() {
    var copyBtns = document.querySelectorAll('.copy-btn');
    copyBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var pre = this.nextElementSibling;
            var code = pre ? pre.textContent : '';
            if (!code) return;
            
            navigator.clipboard.writeText(code).then(function() {
                var icon = btn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', 'check');
                    icon.classList.add('text-emerald-400');
                    if (window.lucide) lucide.createIcons();
                    
                    setTimeout(function() {
                        icon.setAttribute('data-lucide', 'copy');
                        icon.classList.remove('text-emerald-400');
                        if (window.lucide) lucide.createIcons();
                    }, 2000);
                }
                showToast('✅ 代码已复制到剪贴板');
            });
        });
    });
}

function initTooltips() {
    var tooltips = document.querySelectorAll('.cursor-help');
    tooltips.forEach(function(el) {
        var text = el.querySelector('span') ? el.querySelector('span').textContent : '';
        if (!text) return;
        
        var tooltipText = '';
        if (text.includes('PING')) tooltipText = '服务器当前延迟，状态良好';
        if (text.includes('Operational')) tooltipText = '所有系统服务运行正常';
        if (!tooltipText) return;

        el.style.position = 'relative';
        
        var tooltipEl = document.createElement('div');
        tooltipEl.className = 'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 text-[10px] font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none transition-opacity z-50 shadow-lg';
        tooltipEl.textContent = tooltipText;
        
        // Add arrow
        var arrow = document.createElement('div');
        arrow.className = 'absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800 dark:border-t-slate-200';
        tooltipEl.appendChild(arrow);
        
        el.appendChild(tooltipEl);
        
        el.addEventListener('mouseenter', function() {
            tooltipEl.classList.remove('opacity-0');
            tooltipEl.classList.add('opacity-100');
        });
        el.addEventListener('mouseleave', function() {
            tooltipEl.classList.add('opacity-0');
            tooltipEl.classList.remove('opacity-100');
        });
    });
}
