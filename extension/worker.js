// -- Extension heartbeat for localhost --
// Refreshes a short-lived cookie so the app can detect if the extension goes down.

function heartbeat() {
  chrome.cookies.set({
    url: 'http://localhost:3000',
    name: 'mila_ext',
    value: '1',
    path: '/',
    expirationDate: Math.floor(Date.now() / 1000) + 10,
  });
  chrome.cookies.set({
    url: 'http://localhost:3000',
    name: 'mila_ext_ver',
    value: '1.0',
    path: '/',
    expirationDate: Math.floor(Date.now() / 1000) + 10,
  });
}
heartbeat();
if (chrome.alarms) {
  chrome.alarms.create('hb', { periodInMinutes: 1 / 12 }); // every 5s
  chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'hb') heartbeat(); });
} else {
  setInterval(heartbeat, 5000); // fallback
}

// -- Spotify cookie consent fixes --
chrome.cookies.set({
  url: 'https://open.spotify.com',
  name: 'OptanonAlertBoxClosed',
  value: new Date().toISOString().slice(0, 10),
  domain: '.spotify.com',
  path: '/',
  sameSite: 'lax',
});

chrome.cookies.set({
  url: 'https://open.spotify.com',
  name: 'OptanonConsent',
  value: 'isIABGlobal=false&datestamp=' + new Date().toISOString().slice(0, 10).replace(/-/g, '+') + '&consentId=00000000-0000-0000-0000-000000000000&interactionCount=1&landingPath=NotLandingPage&groups=C0001:1,C0002:1,C0003:1,C0004:1&host=',
  domain: '.spotify.com',
  path: '/',
  sameSite: 'lax',
});

// -- Netflix SameSite cookie fix --
// Netflix auth cookies use SameSite=Lax which blocks them in cross-site iframes.
// Convert all netflix.com cookies to SameSite=None; Secure so the iframe stays logged in.

function fixNetflixCookies() {
  chrome.cookies.getAll({ domain: '.netflix.com' }, (cookies) => {
    for (const c of cookies) {
      if (c.sameSite === 'no_restriction' && c.secure) continue;
      try {
        chrome.cookies.set({
          url: `https://www.netflix.com${c.path}`,
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: true,
          sameSite: 'no_restriction',
          httpOnly: c.httpOnly,
          expirationDate: c.expirationDate,
          storeId: c.storeId,
        });
      } catch (_) {}
    }
  });
}

// Run on startup
fixNetflixCookies();

// Auto-fix any new/changed Netflix cookies
chrome.cookies.onChanged.addListener(({ cookie, removed }) => {
  if (removed) return;
  if (!cookie.domain.includes('netflix.com')) return;
  if (cookie.sameSite === 'no_restriction' && cookie.secure) return;
  try {
    chrome.cookies.set({
      url: `https://www.netflix.com${cookie.path}`,
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: true,
      sameSite: 'no_restriction',
      httpOnly: cookie.httpOnly,
      expirationDate: cookie.expirationDate,
      storeId: cookie.storeId,
    });
  } catch (_) {}
});
