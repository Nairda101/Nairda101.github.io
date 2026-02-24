(function () {
  function detectBasePath() {
    const metaBase = document.querySelector('meta[name="site-base"]')?.getAttribute('content')?.trim();
    if (metaBase) {
      const normalized = `/${metaBase.replace(/^\/+|\/+$/g, '')}`;
      return normalized === '/' ? '' : normalized;
    }

    const scriptTag = document.currentScript ||
      Array.from(document.scripts).find((script) => /(?:^|\/)assets\/site\.js(?:\?.*)?$/i.test(script.getAttribute('src') || script.src || ''));

    const scriptSrc = scriptTag?.src || scriptTag?.getAttribute('src') || '';
    if (!scriptSrc) {
      return '';
    }

    try {
      const scriptUrl = new URL(scriptSrc, window.location.href);
      const marker = '/assets/site.js';
      const index = scriptUrl.pathname.toLowerCase().indexOf(marker);
      if (index === -1) {
        return '';
      }

      const base = scriptUrl.pathname.slice(0, index);
      return base.replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }

  const basePath = detectBasePath();

  function withBase(path) {
    if (!path || /^https?:\/\//i.test(path) || path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('#')) {
      return path;
    }

    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${basePath}${clean}`.replace(/\/+/g, '/').replace(/^\/\//, '/');
  }

  const partialPaths = {
    header: withBase('/partials/header.html'),
    footer: withBase('/partials/footer.html')
  };

  const fuseCdn = 'https://cdn.jsdelivr.net/npm/fuse.js@6.6.2';

  async function fetchText(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return response.text();
  }

  async function injectPartials() {
    const headerSlot = document.getElementById('site-header');
    const footerSlot = document.getElementById('site-footer');

    const jobs = [];

    if (headerSlot) {
      jobs.push(
        fetchText(partialPaths.header).then((html) => {
          headerSlot.innerHTML = html;
        })
      );
    }

    if (footerSlot) {
      jobs.push(
        fetchText(partialPaths.footer).then((html) => {
          footerSlot.innerHTML = html;
        })
      );
    }

    await Promise.all(jobs);
  }

  function cleanupLegacyFooterContent() {
    const legacySocialBlocks = document.querySelectorAll('.social-section');
    legacySocialBlocks.forEach((section) => {
      if (!section.closest('#site-footer')) {
        section.remove();
      }
    });

    const legacyFooters = document.querySelectorAll('footer');
    legacyFooters.forEach((footer) => {
      if (footer.classList.contains('site-footer') || footer.closest('#site-footer')) {
        return;
      }
      footer.remove();
    });
  }

  function setFooterYear() {
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = String(new Date().getFullYear());
    }
  }

  function applyTitleColorToHeader() {
    const firstHeading = document.querySelector('h1, h2, h3');
    if (!firstHeading) return;

    const computed = window.getComputedStyle(firstHeading).color;
    const transparentValues = ['transparent', 'rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)'];

    if (!computed || transparentValues.includes(computed.trim().toLowerCase())) {
      return;
    }

    document.documentElement.style.setProperty('--site-title-color', computed);
  }

  function normalizePath(value) {
    let pathname = '/';

    try {
      const parsed = new URL(value || '/', window.location.origin);
      pathname = parsed.pathname || '/';
    } catch (_) {
      pathname = '/';
    }

    pathname = pathname.toLowerCase();

    if (pathname.endsWith('/index.html')) {
      pathname = pathname.slice(0, -'/index.html'.length) || '/';
    }

    pathname = pathname.replace(/\/+$/, '');
    return pathname || '/';
  }

  function applyNavBasePaths() {
    const nav = document.getElementById('site-nav');
    if (nav) {
      nav.querySelectorAll('a[href]').forEach((link) => {
        const href = link.getAttribute('href') || '';
        link.setAttribute('href', withBase(href));
      });
    }

    const logo = document.querySelector('.site-logo[href]');
    if (logo) {
      const href = logo.getAttribute('href') || '';
      logo.setAttribute('href', withBase(href));
    }
  }

  function setActiveNavLink() {
    const current = normalizePath(window.location.pathname);
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    const links = nav.querySelectorAll('a[href]');
    const parentToggles = nav.querySelectorAll('.submenu-toggle');

    parentToggles.forEach((toggle) => {
      toggle.removeAttribute('data-active-parent');
    });

    links.forEach((link) => {
      const target = normalizePath(link.getAttribute('href') || '');
      if (target === current) {
        link.setAttribute('aria-current', 'page');

        const submenu = link.closest('.submenu');
        const menuItem = link.closest('.menu-item.has-submenu');
        if (submenu && menuItem) {
          const toggle = menuItem.querySelector('.submenu-toggle');
          if (toggle) {
            toggle.setAttribute('data-active-parent', 'true');
          }
        }
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function setupMobileNavToggle() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.getElementById('site-nav');
    if (!toggle || !nav) return;

    const closeNav = () => {
      nav.setAttribute('data-open', 'false');
      toggle.setAttribute('aria-expanded', 'false');
      nav.querySelectorAll('.menu-item.has-submenu[data-open="true"]').forEach((item) => {
        item.setAttribute('data-open', 'false');
      });
      nav.querySelectorAll('.submenu-toggle[aria-expanded="true"]').forEach((submenuToggle) => {
        submenuToggle.setAttribute('aria-expanded', 'false');
      });
    };

    toggle.addEventListener('click', function () {
      const isOpen = nav.getAttribute('data-open') === 'true';
      const nextOpen = !isOpen;
      if (!nextOpen) {
        closeNav();
        return;
      }

      nav.setAttribute('data-open', 'true');
      toggle.setAttribute('aria-expanded', 'true');
    });

    nav.addEventListener('click', function (event) {
      if (!window.matchMedia('(max-width: 720px)').matches) return;
      const target = event.target;
      if (target && target.closest('a')) {
        closeNav();
      }
    });

    document.addEventListener('click', function (event) {
      if (!window.matchMedia('(max-width: 720px)').matches) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      if (nav.getAttribute('data-open') === 'true') {
        closeNav();
      }
    });

    window.addEventListener('resize', function () {
      if (!window.matchMedia('(max-width: 720px)').matches) {
        closeNav();
      }
    });
  }

  function setupSubmenus() {
    const nav = document.getElementById('site-nav');
    if (!nav) return;

    const menuItems = nav.querySelectorAll('.menu-item.has-submenu');
    const toggles = nav.querySelectorAll('.submenu-toggle');

    const closeAllSubmenus = () => {
      menuItems.forEach((item) => {
        item.setAttribute('data-open', 'false');
      });
      toggles.forEach((toggle) => {
        toggle.setAttribute('aria-expanded', 'false');
      });
    };

    toggles.forEach((toggle) => {
      toggle.addEventListener('click', function (event) {
        const menuItem = toggle.closest('.menu-item.has-submenu');
        if (!menuItem) return;

        const isOpen = menuItem.getAttribute('data-open') === 'true';
        const nextOpen = !isOpen;

        if (window.matchMedia('(max-width: 720px)').matches) {
          closeAllSubmenus();
        }

        menuItem.setAttribute('data-open', nextOpen ? 'true' : 'false');
        toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
        event.stopPropagation();
      });
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) {
        closeAllSubmenus();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closeAllSubmenus();
      }
    });
  }

  function setupScrollRevealHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    let lastY = window.scrollY || 0;
    let lastDirection = 'down';
    let upAccumulated = 0;
    let downAccumulated = 0;
    let isTicking = false;

    const minDelta = 2;
    const hideAfter = 120;
    const revealAfter = 10;
    const nearTop = 80;

    header.classList.add('header-visible');

    const updateHeader = () => {
      const currentY = window.scrollY || 0;
      const delta = currentY - lastY;

      if (currentY <= 8) {
        header.classList.remove('header-hidden');
        header.classList.add('header-visible');
        upAccumulated = 0;
        downAccumulated = 0;
        lastY = currentY;
        isTicking = false;
        return;
      }

      if (Math.abs(delta) < minDelta) {
        isTicking = false;
        return;
      }

      const direction = delta > 0 ? 'down' : 'up';
      if (direction !== lastDirection) {
        upAccumulated = 0;
        downAccumulated = 0;
        lastDirection = direction;
      }

      if (direction === 'down') {
        downAccumulated += delta;
        if (currentY > hideAfter && downAccumulated > revealAfter) {
          header.classList.add('header-hidden');
          header.classList.remove('header-visible');
        }
      } else {
        upAccumulated += Math.abs(delta);
        if (upAccumulated > revealAfter || currentY < nearTop) {
          header.classList.remove('header-hidden');
          header.classList.add('header-visible');
        }
      }

      lastY = currentY;
      isTicking = false;
    };

    window.addEventListener(
      'scroll',
      function () {
        if (!isTicking) {
          window.requestAnimationFrame(updateHeader);
          isTicking = true;
        }
      },
      { passive: true }
    );
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  function createResultsMarkup(results) {
    if (!results.length) {
      return '<div class="search-result-empty">No results found.</div>';
    }

    return results
      .slice(0, 8)
      .map((item) => {
        const data = item.item;
        return `<a class="search-result-item" href="${withBase(data.url)}">${data.title}</a>`;
      })
      .join('');
  }

  async function setupSearch() {
    const input = document.getElementById('site-search-input');
    const resultsBox = document.getElementById('site-search-results');
    const searchWrap = document.querySelector('.site-search');
    const searchToggle = document.querySelector('.search-toggle');
    const searchPanel = document.getElementById('site-search-panel');

    if (!input || !resultsBox || !searchWrap || !searchToggle || !searchPanel) return;

    const setSearchOpen = (isOpen) => {
      searchWrap.setAttribute('data-open', isOpen ? 'true' : 'false');
      searchToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        input.focus();
      }
    };

    searchToggle.addEventListener('click', function (event) {
      event.stopPropagation();
      const isOpen = searchWrap.getAttribute('data-open') === 'true';
      setSearchOpen(!isOpen);
    });

    await loadScript(fuseCdn);

    const response = await fetch(withBase('/search/search-index.json'), { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load search index: ${response.status}`);
    }

    const docs = await response.json();
    const fuse = new window.Fuse(docs, {
      includeScore: true,
      threshold: 0.35,
      keys: ['title', 'content']
    });

    const clearResults = () => {
      resultsBox.innerHTML = '';
      resultsBox.classList.remove('open');
    };

    const showResults = (query) => {
      const trimmed = query.trim();
      if (!trimmed) {
        clearResults();
        return;
      }

      setSearchOpen(true);

      const results = fuse.search(trimmed, { limit: 8 });
      resultsBox.innerHTML = createResultsMarkup(results);
      resultsBox.classList.add('open');
    };

    input.addEventListener('input', function (event) {
      showResults(event.target.value || '');
    });

    document.addEventListener('click', function (event) {
      if (!searchWrap.contains(event.target)) {
        clearResults();
        setSearchOpen(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        clearResults();
        setSearchOpen(false);
        input.blur();
      }
    });
  }

  async function init() {
    try {
      await injectPartials();
      cleanupLegacyFooterContent();
      applyTitleColorToHeader();
      setFooterYear();
      applyNavBasePaths();
      setActiveNavLink();
      setupMobileNavToggle();
      setupSubmenus();
      setupScrollRevealHeader();
      await setupSearch();
    } catch (error) {
      console.error('Site bootstrap failed:', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
