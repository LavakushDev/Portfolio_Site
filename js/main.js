document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSmoothScroll();
    initScrollReveal();
    initSkillBars();
    initCounters();
    initProjectsToggle();
    initCoordsBg();
});

/* ==========================================
   NAVIGATION
   ========================================== */
function initNavigation() {
    const navbar   = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu  = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                navToggle.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    // Active link highlight
    const sections = document.querySelectorAll('section[id]');
    const highlight = () => {
        const scrollY = window.scrollY;
        const navH = navbar ? navbar.offsetHeight : 0;
        sections.forEach(section => {
            const top = section.offsetTop - navH - 80;
            const bottom = top + section.offsetHeight;
            const id = section.getAttribute('id');
            if (scrollY >= top && scrollY < bottom) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) link.classList.add('active');
                });
            }
        });
    };
    window.addEventListener('scroll', highlight, { passive: true });
    highlight();
}

/* ==========================================
   SMOOTH SCROLL
   ========================================== */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const navH = document.getElementById('navbar')?.offsetHeight || 0;
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.scrollY - navH,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ==========================================
   SCROLL REVEAL
   ========================================== */
function initScrollReveal() {
    const els = document.querySelectorAll('.reveal');
    const check = () => {
        const wh = window.innerHeight;
        els.forEach(el => {
            if (el.getBoundingClientRect().top < wh - 80) el.classList.add('visible');
        });
    };
    check();
    let tick = false;
    window.addEventListener('scroll', () => {
        if (!tick) {
            requestAnimationFrame(() => { check(); tick = false; });
            tick = true;
        }
    }, { passive: true });
}

/* ==========================================
   SKILL BARS
   ========================================== */
function initSkillBars() {
    const bars = document.querySelectorAll('.skill-progress[data-progress]');
    if (!bars.length) return;

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const bar = entry.target;
                bar.style.width = bar.dataset.progress + '%';
                io.unobserve(bar);
            }
        });
    }, { threshold: 0.3 });

    bars.forEach(bar => io.observe(bar));
}

/* ==========================================
   STAT COUNTERS
   ========================================== */
function initCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    if (!counters.length) return;

    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.count, 10);
            const duration = 1200;
            const step = 16;
            const increment = target / (duration / step);
            let current = 0;

            const tick = () => {
                current = Math.min(current + increment, target);
                el.textContent = Math.round(current);
                if (current < target) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            io.unobserve(el);
        });
    }, { threshold: 0.5 });

    counters.forEach(el => io.observe(el));
}

/* ==========================================
   PROJECTS SHOW MORE / LESS
   ========================================== */
function initProjectsToggle() {
    const btn        = document.getElementById('projects-toggle-btn');
    const countEl    = document.getElementById('visible-count');
    const hiddenCards = document.querySelectorAll('.project-card.project-hidden');
    const total      = document.querySelectorAll('.project-card').length;
    const initial    = total - hiddenCards.length;

    if (!btn || !hiddenCards.length) return;

    let expanded = false;

    btn.addEventListener('click', () => {
        expanded = !expanded;

        hiddenCards.forEach(card => {
            card.classList.toggle('show-card', expanded);
        });

        btn.classList.toggle('expanded', expanded);
        btn.querySelector('.toggle-text').textContent = expanded ? 'Show Less' : 'Show More Projects';
        if (countEl) countEl.textContent = expanded ? total : initial;
    });
}

/* ==========================================
   FLOATING GIS COORDINATES BACKGROUND
   ========================================== */
function initCoordsBg() {
    const canvas = document.getElementById('coords-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const COUNT = 28;
    let labels = [];
    let paused = false;

    // WA / Perth region coordinate pool
    function randCoord() {
        const lat = -(28 + Math.random() * 8);   // -28 to -36 (SW Australia)
        const lon =  113 + Math.random() * 8;    // 113 to 121 (WA)
        const latStr = Math.abs(lat).toFixed(4) + '° S';
        const lonStr = lon.toFixed(4) + '° E';
        const forms = [
            `${latStr}  ${lonStr}`,
            `LAT ${lat.toFixed(4)}  LON ${lon.toFixed(4)}`,
            `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
            `${latStr} · ${lonStr}`,
            `WGS84  ${lat.toFixed(3)}  ${lon.toFixed(3)}`,
            `MGA2020  ${latStr}  ${lonStr}`,
        ];
        return forms[Math.floor(Math.random() * forms.length)];
    }

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function spawnLabel(offscreen = false) {
        const side = Math.random();
        let x, y, vx, vy;
        const speed = 0.18 + Math.random() * 0.28;
        const angle = (Math.random() - 0.5) * 0.4;  // mostly horizontal

        if (offscreen) {
            // start from a random edge
            if (side < 0.5) {
                x = -220; y = Math.random() * canvas.height;
            } else {
                x = Math.random() * canvas.width; y = canvas.height + 20;
            }
        } else {
            x = Math.random() * canvas.width;
            y = Math.random() * canvas.height;
        }
        vx = speed * Math.cos(angle);
        vy = -speed * Math.sin(angle) + (Math.random() - 0.5) * 0.08;

        return {
            x, y, vx, vy,
            text: randCoord(),
            fontSize: 9 + Math.floor(Math.random() * 5),
            maxOpacity: 0.055 + Math.random() * 0.085,
            opacity: offscreen ? 0 : Math.random() * 0.1,
            phase: offscreen ? 'in' : 'hold',
            holdLeft: 300 + Math.random() * 600,
            fadeSpeed: 0.0008 + Math.random() * 0.0012,
        };
    }

    function init() {
        resize();
        labels = Array.from({ length: COUNT }, () => spawnLabel(false));
    }

    function tick() {
        if (!paused) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.textBaseline = 'top';

            for (let i = 0; i < labels.length; i++) {
                const l = labels[i];
                l.x += l.vx;
                l.y += l.vy;

                // Fade lifecycle
                if (l.phase === 'in') {
                    l.opacity += l.fadeSpeed;
                    if (l.opacity >= l.maxOpacity) { l.opacity = l.maxOpacity; l.phase = 'hold'; }
                } else if (l.phase === 'hold') {
                    l.holdLeft--;
                    if (l.holdLeft <= 0) l.phase = 'out';
                } else {
                    l.opacity -= l.fadeSpeed;
                    if (l.opacity <= 0) labels[i] = spawnLabel(true);
                }

                // Off-screen cull
                const w = ctx.measureText(l.text).width;
                if (l.x > canvas.width + 240 || l.x + w < -240 ||
                    l.y > canvas.height + 30 || l.y < -30) {
                    labels[i] = spawnLabel(true);
                    continue;
                }

                ctx.save();
                ctx.globalAlpha = Math.max(0, l.opacity);
                ctx.font = `${l.fontSize}px "Courier New", monospace`;
                ctx.fillStyle = '#F97316';
                ctx.fillText(l.text, l.x, l.y);
                ctx.restore();
            }
        }
        requestAnimationFrame(tick);
    }

    init();
    tick();

    window.addEventListener('resize', () => { resize(); }, { passive: true });

    document.addEventListener('visibilitychange', () => {
        paused = document.hidden;
    });
}

/* ==========================================
   KEYBOARD / VISIBILITY
   ========================================== */
document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('pause-animations', document.hidden);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const navToggle = document.getElementById('nav-toggle');
        const navMenu   = document.getElementById('nav-menu');
        if (navMenu?.classList.contains('active')) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});
