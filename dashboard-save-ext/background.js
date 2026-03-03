const DEFAULT_URL = 'http://100.107.254.10:4321';

browser.browserAction.onClicked.addListener(async (tab) => {
  const { dashboardUrl = DEFAULT_URL } = await browser.storage.local.get('dashboardUrl');
  const base = dashboardUrl.replace(/\/$/, '');
  const saveUrl = `${base}/save`
    + `?url=${encodeURIComponent(tab.url)}`
    + `&name=${encodeURIComponent(tab.title)}`;

  try {
    await browser.windows.create({
      url:    saveUrl,
      type:   'popup',
      width:  480,
      height: 365,
    });
  } catch {
    // Android Firefox doesn't support browser.windows.create — open as a tab instead.
    browser.tabs.create({ url: saveUrl });
  }
});
