(() => {
  const root = document.documentElement;
  const menuButton = document.querySelector('[data-menu-button]');
  const navigation = document.querySelector('[data-navigation]');
  const themeButton = document.querySelector('[data-theme-button]');
  const year = document.querySelector('[data-year]');
  const isUkrainian = root.lang === 'uk';

  if (year) year.textContent = new Date().getFullYear();

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (themeButton) {
      const dark = theme === 'dark';
      themeButton.setAttribute('aria-pressed', String(dark));
      themeButton.setAttribute('title', dark
        ? (isUkrainian ? 'Світла тема' : 'Use light theme')
        : (isUkrainian ? 'Темна тема' : 'Use dark theme'));
    }
  };

  const storedTheme = localStorage.getItem('hereditas-theme');
  const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(storedTheme || preferredTheme);

  themeButton?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hereditas-theme', nextTheme);
    applyTheme(nextTheme);
  });

  const closeMenu = () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', isUkrainian ? 'Відкрити меню' : 'Open menu');
    navigation?.removeAttribute('data-open');
    document.body.classList.remove('menu-open');
  };

  menuButton?.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', !isOpen
      ? (isUkrainian ? 'Закрити меню' : 'Close menu')
      : (isUkrainian ? 'Відкрити меню' : 'Open menu'));
    navigation?.toggleAttribute('data-open', !isOpen);
    document.body.classList.toggle('menu-open', !isOpen);
  });

  navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && navigation?.hasAttribute('data-open')) {
      closeMenu();
      menuButton?.focus();
    }
  });

  // Google Analytics is loaded only after explicit visitor consent.
  const analyticsMeasurementId = 'G-H6PK1FG5F0';
  const analyticsConsentKey = 'hereditas-analytics-consent';

  const loadGoogleAnalytics = () => {
    if (window.__hereditasAnalyticsLoaded) return;
    window.__hereditasAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', analyticsMeasurementId);

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${analyticsMeasurementId}`;
    document.head.appendChild(script);
  };

  const removeConsentBanner = () => {
    document.querySelector('[data-analytics-consent]')?.remove();
  };

  const setAnalyticsConsent = (value) => {
    localStorage.setItem(analyticsConsentKey, value);
    removeConsentBanner();
    if (value === 'granted') loadGoogleAnalytics();
  };

  const showAnalyticsConsent = () => {
    if (document.querySelector('[data-analytics-consent]')) return;
    const banner = document.createElement('aside');
    banner.className = 'consent-banner';
    banner.setAttribute('data-analytics-consent', '');
    banner.setAttribute('aria-label', isUkrainian ? 'Налаштування вебаналітики' : 'Analytics settings');
    banner.innerHTML = `
      <div class="consent-copy">
        <strong>${isUkrainian ? 'Аналітика сайту' : 'Website analytics'}</strong>
        <p>${isUkrainian
          ? 'Ми використовуємо Google Analytics лише за вашою згодою, щоб розуміти загальне використання сайту. До згоди аналітика не завантажується.'
          : 'We use Google Analytics only with your consent to understand overall website use. Analytics is not loaded before consent.'}</p>
      </div>
      <div class="consent-actions">
        <button class="button button-secondary consent-button" type="button" data-analytics-reject>${isUkrainian ? 'Відхилити' : 'Reject'}</button>
        <button class="button consent-button" type="button" data-analytics-accept>${isUkrainian ? 'Дозволити аналітику' : 'Allow analytics'}</button>
      </div>`;
    document.body.appendChild(banner);
    banner.querySelector('[data-analytics-accept]')?.addEventListener('click', () => setAnalyticsConsent('granted'));
    banner.querySelector('[data-analytics-reject]')?.addEventListener('click', () => setAnalyticsConsent('denied'));
  };

  const storedAnalyticsConsent = localStorage.getItem(analyticsConsentKey);
  if (storedAnalyticsConsent === 'granted') {
    loadGoogleAnalytics();
  } else if (storedAnalyticsConsent !== 'denied') {
    showAnalyticsConsent();
  }

  document.querySelectorAll('[data-manage-analytics]').forEach((button) => {
    button.addEventListener('click', () => {
      localStorage.removeItem(analyticsConsentKey);
      showAnalyticsConsent();
    });
  });

})();
