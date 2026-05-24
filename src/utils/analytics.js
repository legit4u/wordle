export function initGA(measurementId) {
  if (!measurementId) return;

  // Insert gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: true });
}

export function sendEvent(name, params = {}) {
  if (!import.meta.env.PROD || !import.meta.env.VITE_GA_ID) return;
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    } else if (window.dataLayer) {
      window.dataLayer.push({ event: name, ...params });
    }
  } catch (e) {
    // fail silently in production
  }
}
