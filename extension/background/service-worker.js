const COLOR_PATH = "assets/ai_icon128.png";
const GRAY_PATH  = "assets/ai_icon_gray128.png";

fetch(chrome.runtime.getURL(GRAY_PATH))
  .then(r => console.log(GRAY_PATH, "status:", r.status, "ok:", r.ok, "url:", r.url))
  .catch(e => console.error("fetch failed for", GRAY_PATH, e));

async function pathToImageData(path, size = 32) {
  const url = chrome.runtime.getURL(path);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${path}`);

  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(bitmap, 0, 0, size, size);

  return ctx.getImageData(0, 0, size, size);
}

async function setIcon(tabId, colored) {
  if (!tabId) return;

  try {
    const path = colored ? COLOR_PATH : GRAY_PATH;

    // Chrome toolbar commonly uses 16/32 depending on DPI; we set both.
    const img16 = await pathToImageData(path, 16);
    const img32 = await pathToImageData(path, 32);

    chrome.action.setIcon(
      { tabId, imageData: { 16: img16, 32: img32 } },
      () => {
        if (chrome.runtime.lastError) {
          console.warn("setIcon error:", chrome.runtime.lastError.message);
        }
      }
    );

    chrome.action.setBadgeText({ tabId, text: "" });
  } catch (e) {
    console.warn("setIcon exception:", e);
  }
}



  console.log("UGS Validator SW loaded");

  function isCloudUnity(url) {
    try {
      const { hostname } = new URL(url);
      return hostname === 'cloud.unity.com' || hostname.endsWith('.cloud.unity.com');
    } catch {
      return false;
    }
  }
  
  
  
  function updateFromTab(tab) {
    if (!tab?.id || !tab?.url) return;
    setIcon(tab.id, isCloudUnity(tab.url));
  }
  
  chrome.runtime.onInstalled.addListener(() => {
    chrome.tabs.query({}, (tabs) => tabs.forEach(updateFromTab));
  });
  
  chrome.runtime.onStartup.addListener(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]) updateFromTab(tabs[0]);
    });
  });
  
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === 'complete') {
      console.log("onUpdated", { tabId, url: tab?.url, changeInfo });
      if (tab?.url) setIcon(tabId, isCloudUnity(tab.url));
    }
  });
  
  
  
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, (tab) => updateFromTab(tab));
  });
  
  chrome.action.onClicked.addListener((tab) => {
    if (!tab?.id || !isCloudUnity(tab.url || '')) return;
  
    chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' }, () => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || '';
        if (!msg.includes("Receiving end does not exist") && !msg.includes("message port closed")) {
          console.error('Error sending message:', msg);
        }
      }
    });
  });
  