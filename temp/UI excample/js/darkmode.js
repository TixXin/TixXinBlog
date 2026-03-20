function initDarkMode() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Apply initial theme
    if (saved === 'dark' || (saved === 'system' && prefersDark.matches) || (!saved && prefersDark.matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    const themeButtons = document.querySelectorAll('.theme-toggle-btn');
    if (!themeButtons.length) return;

    // Update active state of buttons
    function updateActiveButton() {
        const currentTheme = localStorage.getItem('theme') || 'system';
        themeButtons.forEach(btn => {
            const theme = btn.getAttribute('data-theme');
            if (theme === currentTheme) {
                btn.classList.add('theme-active');
                btn.classList.add('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-slate-200', 'shadow-sm');
                btn.classList.remove('text-slate-500', 'dark:text-slate-400');
            } else {
                btn.classList.remove('theme-active');
                btn.classList.remove('bg-white', 'dark:bg-slate-700', 'text-slate-800', 'dark:text-slate-200', 'shadow-sm');
                btn.classList.add('text-slate-500', 'dark:text-slate-400');
            }
        });
    }

    updateActiveButton();

    themeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const theme = this.getAttribute('data-theme');
            localStorage.setItem('theme', theme);
            
            if (theme === 'system') {
                if (prefersDark.matches) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            } else if (theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            updateActiveButton();
        });
    });

    // Listen for system theme changes
    prefersDark.addEventListener('change', (e) => {
        if (localStorage.getItem('theme') === 'system' || !localStorage.getItem('theme')) {
            if (e.matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    });
}
