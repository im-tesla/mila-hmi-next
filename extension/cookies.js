const d = new Date().toISOString().slice(0, 10).replace(/-/g, '+');
const oneYear = new Date(Date.now() + 365 * 86400000).toUTCString();

document.cookie = 'OptanonAlertBoxClosed=' + d + ';domain=.spotify.com;path=/;expires=' + oneYear + ';SameSite=Lax';
document.cookie = 'OptanonConsent=isIABGlobal=false&datestamp=' + d + '&consentId=00000000-0000-0000-0000-000000000000&interactionCount=1&landingPath=NotLandingPage&groups=C0001:1,C0002:1,C0003:1,C0004:1;domain=.spotify.com;path=/;expires=' + oneYear + ';SameSite=Lax';

const hideBanner = () => {
  const selectors = [
    '[data-testid="cookie-banner"]',
    '[aria-label="Cookie banner"]',
    '#onetrust-consent-sdk',
    '#onetrust-banner-sdk',
    '.optanon-alert-box-wrapper',
    '[data-encore-id="banner"]',
  ];
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      el.remove();
    }
  }
};

const setMaxVolume = () => {
  const slider = document.querySelector('[data-testid="volume-bar"] input[type="range"]');
  if (slider && +slider.value < 1) {
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (desc && desc.set) {
      desc.set.call(slider, '1');
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
};

document.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('message', (e) => {
  if (e.data?.mila === 'pause') {
    document.querySelectorAll('video, audio').forEach(function (el) {
      el.pause();
      el.muted = true;
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const scrollStyle = document.createElement('style');
  scrollStyle.textContent = '*{scrollbar-width:none;-ms-overflow-style:none}::-webkit-scrollbar{display:none}';
  document.head.appendChild(scrollStyle);

  const style = document.createElement('style');
  style.textContent = [
    'a[href="/download"][data-encore-id="buttonTertiary"]',
    '[data-testid="pip-toggle-button"]',
    '[aria-label="Connect to a device"]',
    '[data-testid="volume-bar"]',
  ].join(',') + ' { display: none !important; }';
  style.textContent +=
    '[data-testid="now-playing-bar"] > div { grid-template-columns: minmax(0,1fr) auto auto !important; }' +
    '[class*="os-scrollbar"] { display: none !important; }';
  document.head.appendChild(style);

  hideBanner();
  setMaxVolume();
  new MutationObserver(() => { hideBanner(); setMaxVolume(); }).observe(document.body, {
    childList: true,
    subtree: true,
  });
});
