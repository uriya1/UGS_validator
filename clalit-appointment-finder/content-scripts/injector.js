/**
 * Clalit Appointment Finder – Content Script
 * Injected into e-services.clalit.co.il pages (including iframes via all_frames).
 *
 * - In the TOP frame: creates the side-panel UI and handles fetch proxying.
 * - In ALL frames (including nested iframes): installs request interceptors.
 */
(function () {
  'use strict';

  if (window.__clalitAppointmentFinderInjected) return;
  window.__clalitAppointmentFinderInjected = true;

  const isTopFrame = (window === window.top);

  const PANEL_WIDTH = 380;
  let panelVisible = false;
  let panelFrame = null;
  let toggleButton = null;

  // -------------------------------------------------------------------------
  // Toggle button (top frame only)
  // -------------------------------------------------------------------------
  function createToggleButton() {
    const btn = document.createElement('div');
    btn.id = 'clalit-finder-toggle';
    btn.title = 'Clalit Appointment Finder';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="32" height="32">
        <defs><linearGradient id="clbg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00b4d8"/><stop offset="100%" style="stop-color:#0077b6"/></linearGradient></defs>
        <rect width="128" height="128" rx="24" fill="url(#clbg)"/>
        <rect x="28" y="36" width="72" height="64" rx="8" fill="white" opacity="0.95"/>
        <rect x="28" y="36" width="72" height="20" rx="8" fill="#0077b6" opacity="0.8"/>
        <rect x="44" y="28" width="6" height="16" rx="3" fill="white"/>
        <rect x="78" y="28" width="6" height="16" rx="3" fill="white"/>
        <path d="M48 72 L58 82 L80 60" stroke="#00b4d8" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    Object.assign(btn.style, {
      position: 'fixed', top: '50%', right: '0', transform: 'translateY(-50%)',
      width: '44px', height: '44px', borderRadius: '8px 0 0 8px',
      background: 'linear-gradient(135deg, #00b4d8, #0077b6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', zIndex: '2147483646',
      boxShadow: '-2px 0 12px rgba(0,0,0,0.25)',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    });
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-50%) translateX(-4px)'; btn.style.boxShadow = '-4px 0 16px rgba(0,0,0,0.35)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'translateY(-50%)'; btn.style.boxShadow = '-2px 0 12px rgba(0,0,0,0.25)'; });
    btn.addEventListener('click', togglePanel);
    document.body.appendChild(btn);
    toggleButton = btn;
  }

  // -------------------------------------------------------------------------
  // Side panel iframe (top frame only)
  // -------------------------------------------------------------------------
  function createPanel() {
    const iframe = document.createElement('iframe');
    iframe.id = 'clalit-finder-panel';
    iframe.src = chrome.runtime.getURL('content-scripts/panel.html');
    Object.assign(iframe.style, {
      position: 'fixed', top: '0', right: `-${PANEL_WIDTH}px`,
      width: `${PANEL_WIDTH}px`, height: '100vh', border: 'none',
      zIndex: '2147483647', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
      transition: 'right 0.35s cubic-bezier(0.4, 0, 0.2, 1)', background: '#f8f9fa',
    });
    document.body.appendChild(iframe);
    panelFrame = iframe;
  }

  function togglePanel() {
    panelVisible = !panelVisible;
    if (panelFrame) panelFrame.style.right = panelVisible ? '0' : `-${PANEL_WIDTH}px`;
    if (toggleButton) toggleButton.style.right = panelVisible ? `${PANEL_WIDTH}px` : '0';
    try { localStorage.setItem('clalit_finder_panel_open', panelVisible ? '1' : '0'); } catch {}
  }

  function showPanel() {
    panelVisible = true;
    if (panelFrame) panelFrame.style.right = '0';
    if (toggleButton) toggleButton.style.right = `${PANEL_WIDTH}px`;
    try { localStorage.setItem('clalit_finder_panel_open', '1'); } catch {}
  }

  // -------------------------------------------------------------------------
  // Send to panel
  // -------------------------------------------------------------------------
  function sendToPanel(msg) {
    if (isTopFrame && panelFrame && panelFrame.contentWindow) {
      panelFrame.contentWindow.postMessage(msg, '*');
    } else if (!isTopFrame) {
      chrome.runtime.sendMessage({ action: 'relayToPanel', payload: msg });
    }
  }

  // -------------------------------------------------------------------------
  // Click the real search button on the Clalit page
  // -------------------------------------------------------------------------
  function clickSearchButton() {
    // Try in this frame first
    const btn = document.querySelector('#searchBtnSpec, input.searchButton, input[type="submit"].searchButton');
    if (btn) {
      console.log('[Clalit Finder] Clicking search button in', isTopFrame ? 'top frame' : 'iframe');
      btn.click();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Alert sound (runs in main page context where user gestures are registered)
  // -------------------------------------------------------------------------
  let _alertAudioCtx = null;

  function playAlertSound() {
    try {
      if (!_alertAudioCtx) _alertAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = _alertAudioCtx;
      const play = () => {
        // Play 3 ascending beeps, then repeat the pattern twice for attention
        const pattern = [659, 784, 880, 0, 659, 784, 880];
        pattern.forEach((freq, i) => {
          if (freq === 0) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.18 + 0.3);
          osc.start(ctx.currentTime + i * 0.18);
          osc.stop(ctx.currentTime + i * 0.18 + 0.3);
        });
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(play).catch(() => console.warn('[Clalit Finder] Audio resume failed'));
      } else {
        play();
      }
    } catch (e) {
      console.warn('[Clalit Finder] playAlertSound error:', e);
    }
  }

  // Try clicking in all iframes from the top frame
  function clickSearchButtonInAllFrames() {
    if (clickSearchButton()) return;
    // Send message to all frames in this tab to try clicking
    chrome.runtime.sendMessage({ action: 'clickSearchInFrames' });
  }

  // -------------------------------------------------------------------------
  // Fetch proxy (top frame only)
  // -------------------------------------------------------------------------
  async function proxyFetch(requestId, url, payload) {
    try {
      console.log(`[Clalit Finder] POST ${url} body=${(payload || '').substring(0, 120)}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': '*/*',
        },
        credentials: 'include',
        body: payload,
      });

      console.log(`[Clalit Finder] Response: status=${response.status}, redirected=${response.redirected}`);

      if (response.redirected) {
        sendToPanel({ type: 'CLALIT_FETCH_RESPONSE', requestId, error: 'SESSION_EXPIRED' });
        return;
      }
      if (response.status === 401 || response.status === 403) {
        sendToPanel({ type: 'CLALIT_FETCH_RESPONSE', requestId, error: 'SESSION_EXPIRED' });
        return;
      }

      const text = await response.text();
      console.log(`[Clalit Finder] Response body (first 300): ${text.substring(0, 300)}`);

      if (text.includes('Login') || text.includes('OTP') || text.includes('כניסה למערכת') || text.includes('הזדהות') || text.includes('OnlineWeb/Account')) {
        sendToPanel({ type: 'CLALIT_FETCH_RESPONSE', requestId, error: 'SESSION_EXPIRED' });
        return;
      }

      sendToPanel({ type: 'CLALIT_FETCH_RESPONSE', requestId, data: text, status: response.status });
    } catch (e) {
      console.error(`[Clalit Finder] Fetch error: ${e.message}`, e);
      sendToPanel({ type: 'CLALIT_FETCH_RESPONSE', requestId, error: e.message });
    }
  }

  // -------------------------------------------------------------------------
  // Chrome runtime messages
  // -------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'togglePanel' && isTopFrame) {
      togglePanel();
      sendResponse({ ok: true });
    }
    if (msg.action === 'runCheck' && isTopFrame) {
      sendToPanel({ type: 'CLALIT_RUN_CHECK' });
      sendResponse({ ok: true });
    }
    if (msg.action === 'relayCapturedPayload' && isTopFrame) {
      sendToPanel({ type: 'CLALIT_PAYLOAD_CAPTURED', payload: msg.payload });
      sendResponse({ ok: true });
    }
    // Click search button request from another frame or background
    if (msg.action === 'clickSearchButton') {
      const found = clickSearchButton();
      sendResponse({ ok: true, found });
    }
    return true;
  });

  // -------------------------------------------------------------------------
  // Handle messages from panel iframe (top frame only)
  // -------------------------------------------------------------------------
  if (isTopFrame) {
    window.addEventListener('message', (event) => {
      if (!event.data || !event.data.type) return;

      switch (event.data.type) {
        case 'CLALIT_FETCH_REQUEST':
          proxyFetch(event.data.requestId, event.data.url, event.data.payload);
          break;
        case 'CLALIT_NOTIFY_EARLIER':
          chrome.runtime.sendMessage({ action: 'notifyEarlierAppointment', data: event.data.payload });
          break;
        case 'CLALIT_NOTIFY_SESSION_EXPIRED':
          chrome.runtime.sendMessage({ action: 'notifySessionExpired' });
          break;
        case 'CLALIT_START_MONITORING':
          chrome.runtime.sendMessage({
            action: 'startMonitoring',
            intervalMin: event.data.intervalMin,
            intervalMax: event.data.intervalMax,
          });
          if (toggleButton) toggleButton.classList.add('monitoring');
          break;
        case 'CLALIT_STOP_MONITORING':
          chrome.runtime.sendMessage({ action: 'stopMonitoring' });
          if (toggleButton) toggleButton.classList.remove('monitoring');
          break;
        case 'CLALIT_OPEN_PANEL':
          if (!panelVisible) togglePanel();
          break;
        case 'CLALIT_CLICK_SEARCH_BUTTON':
          clickSearchButtonInAllFrames();
          break;
        case 'CLALIT_FOCUS_TAB':
          chrome.runtime.sendMessage({ action: 'focusClalitTab' });
          break;
        case 'CLALIT_PLAY_ALERT_SOUND':
          playAlertSound();
          break;
        case 'CLALIT_NAVIGATE_TO':
          if (event.data.url) {
            chrome.runtime.sendMessage({ action: 'focusClalitTab' });
            window.location.href = event.data.url;
          }
          break;
      }
    });
  }

  // -------------------------------------------------------------------------
  // Intercept SearchDiaries – external script (CSP-safe), runs in ALL frames
  // -------------------------------------------------------------------------
  function installRequestInterceptor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content-scripts/page-interceptor.js');
    script.onload = () => {
      script.remove();
      console.log('[Clalit Finder] page-interceptor.js loaded in', isTopFrame ? 'top frame' : 'iframe');
    };
    script.onerror = (e) => console.warn('[Clalit Finder] Failed to load page-interceptor.js:', e);
    (document.head || document.documentElement).appendChild(script);
  }

  // Listen for captured payload from page-context interceptor
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === '__CLALIT_CAPTURED_SEARCH') {
      console.log(`[Clalit Finder] Captured SearchDiaries via ${event.data.source} in ${isTopFrame ? 'top' : 'iframe'}:`, event.data.payload);
      sendToPanel({ type: 'CLALIT_PAYLOAD_CAPTURED', payload: event.data.payload });
    }
  }, true);

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  installRequestInterceptor();

  if (isTopFrame) {
    function initUI() {
      createToggleButton();
      createPanel();
      try {
        if (localStorage.getItem('clalit_finder_panel_open') === '1') {
          showPanel();
        }
      } catch {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initUI);
    } else {
      initUI();
    }
  } else {
    console.log(`[Clalit Finder] Interceptor installed in iframe: ${window.location.href.substring(0, 100)}`);
  }
})();
