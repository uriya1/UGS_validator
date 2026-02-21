/**
 * Clalit Appointment Finder - Background Service Worker
 * Manages polling alarms, notifications, tab focusing, and configurable intervals.
 */

const ALARM_NAME = 'clalit-appointment-check';
const CLALIT_ORIGIN = 'https://e-services.clalit.co.il';

const COLOR_ICON = 'assets/icon128.png';
const GRAY_ICON  = 'assets/icon-gray128.png';

// Configurable interval (default 4-6 min, updated by panel)
let intervalMin = 4;
let intervalMax = 6;

console.log('Clalit Appointment Finder SW loaded');

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------
async function pathToImageData(path, size = 32) {
  const url = chrome.runtime.getURL(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${path}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

async function setIcon(tabId, colored) {
  if (!tabId) return;
  try {
    const path = colored ? COLOR_ICON : GRAY_ICON;
    const img16 = await pathToImageData(path, 16);
    const img32 = await pathToImageData(path, 32);
    chrome.action.setIcon(
      { tabId, imageData: { 16: img16, 32: img32 } },
      () => { if (chrome.runtime.lastError) console.warn('setIcon error:', chrome.runtime.lastError.message); }
    );
  } catch (e) {
    console.warn('setIcon exception:', e);
  }
}

function isClalit(url) {
  try { return new URL(url).hostname === 'e-services.clalit.co.il'; }
  catch { return false; }
}

function updateIconForTab(tab) {
  if (!tab?.id || !tab?.url) return;
  setIcon(tab.id, isClalit(tab.url));
}

// ---------------------------------------------------------------------------
// Alarm management – configurable interval
// ---------------------------------------------------------------------------
function scheduleNextCheck() {
  const min = Math.max(1, intervalMin);
  const max = Math.max(min, intervalMax);
  const delayMinutes = min + Math.random() * (max - min);
  chrome.alarms.create(ALARM_NAME, { delayInMinutes: delayMinutes });
  console.log(`Next appointment check in ${delayMinutes.toFixed(1)} minutes (range: ${min}-${max})`);
}

// ---------------------------------------------------------------------------
// When alarm fires
// ---------------------------------------------------------------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log('Alarm fired – requesting appointment check');

  const tabs = await chrome.tabs.query({ url: `${CLALIT_ORIGIN}/*` });
  if (tabs.length === 0) {
    console.log('No Clalit tab open – skipping check');
    scheduleNextCheck();
    return;
  }

  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'runCheck' });
    } catch (e) {
      console.warn('Could not reach tab', tab.id, e.message);
    }
  }
  scheduleNextCheck();
});

// ---------------------------------------------------------------------------
// Focus the Clalit tab and bring window to front
// ---------------------------------------------------------------------------
async function focusClalitTab() {
  try {
    const tabs = await chrome.tabs.query({ url: `${CLALIT_ORIGIN}/*` });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
      console.log('Focused Clalit tab', tabs[0].id);
    }
  } catch (e) {
    console.warn('focusClalitTab error:', e);
  }
}

// ---------------------------------------------------------------------------
// Messages from content script
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startMonitoring') {
    if (msg.intervalMin) intervalMin = msg.intervalMin;
    if (msg.intervalMax) intervalMax = msg.intervalMax;
    scheduleNextCheck();
    sendResponse({ ok: true });
  }

  if (msg.action === 'stopMonitoring') {
    chrome.alarms.clear(ALARM_NAME);
    sendResponse({ ok: true });
  }

  if (msg.action === 'notifyEarlierAppointment') {
    showNotification(msg.data);
    focusClalitTab();
  }

  if (msg.action === 'notifySessionExpired') {
    showSessionExpiredNotification();
  }

  if (msg.action === 'focusClalitTab') {
    focusClalitTab();
    sendResponse({ ok: true });
  }

  // Broadcast clickSearchButton to all frames in the sender's tab
  if (msg.action === 'clickSearchInFrames') {
    const tabId = sender?.tab?.id;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'clickSearchButton' }, () => {
        if (chrome.runtime.lastError) { /* some frames may not respond */ }
      });
    }
    sendResponse({ ok: true });
  }

  // Relay captured payload from an iframe content script to the top-frame
  if (msg.action === 'relayToPanel' && msg.payload) {
    const tabId = sender?.tab?.id;
    if (tabId && msg.payload.type === 'CLALIT_PAYLOAD_CAPTURED') {
      chrome.tabs.sendMessage(tabId, {
        action: 'relayCapturedPayload',
        payload: msg.payload.payload,
      }, () => {
        if (chrome.runtime.lastError) console.warn('relayToPanel error:', chrome.runtime.lastError.message);
      });
    }
    sendResponse({ ok: true });
  }

  return true;
});

// ---------------------------------------------------------------------------
// Chrome notifications
// ---------------------------------------------------------------------------
function showNotification(data) {
  const { doctorName, date, clinic } = data;
  chrome.notifications.create(`clalit-appt-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(COLOR_ICON),
    title: 'נמצא תור מוקדם יותר!',
    message: `${doctorName}\n${date}\n${clinic}`,
    priority: 2,
    requireInteraction: true,
  });
}

function showSessionExpiredNotification() {
  chrome.notifications.create('clalit-session-expired', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL(GRAY_ICON),
    title: 'הסשן פג תוקף',
    message: 'יש להתחבר מחדש עם OTP כדי להמשיך לחפש תורים',
    priority: 2,
    requireInteraction: true,
  });
}

chrome.notifications.onClicked.addListener(async (notifId) => {
  const tabs = await chrome.tabs.query({ url: `${CLALIT_ORIGIN}/*` });
  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: `${CLALIT_ORIGIN}/Zimunet/Diary` });
  }
});

// ---------------------------------------------------------------------------
// Tab lifecycle
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => tabs.forEach(updateIconForTab));
});

chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs?.[0]) updateIconForTab(tabs[0]);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') updateIconForTab(tab);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, updateIconForTab);
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;
  if (!isClalit(tab.url || '')) {
    chrome.tabs.create({ url: `${CLALIT_ORIGIN}/Zimunet/Diary` });
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' }, () => {
    if (chrome.runtime.lastError) { /* ignore */ }
  });
});
