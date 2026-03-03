const DEFAULT_URL = 'http://100.107.254.10:4321';
const input  = document.getElementById('url-input');
const status = document.getElementById('status');

browser.storage.local.get('dashboardUrl').then(({ dashboardUrl }) => {
  input.value = dashboardUrl || DEFAULT_URL;
});

document.getElementById('save-btn').addEventListener('click', async () => {
  const val = input.value.trim().replace(/\/$/, '');
  if (!val) return;
  await browser.storage.local.set({ dashboardUrl: val });
  status.textContent = 'Saved';
  setTimeout(() => { status.textContent = ''; }, 1500);
});
