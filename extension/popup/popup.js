// Popup script for extension icon
document.addEventListener('DOMContentLoaded', () => {
  const showButton = document.getElementById('showFloatingUI');
  const hideButton = document.getElementById('hideFloatingUI');
  const status = document.getElementById('status');

  // Helper function to send message with error handling
  function sendMessage(tabId, message, callback) {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          // Ignore connection errors - content script might not be ready
          if (chrome.runtime.lastError.message.includes('Receiving end does not exist') ||
              chrome.runtime.lastError.message.includes('message port closed')) {
            console.log('Content script not ready yet:', chrome.runtime.lastError.message);
            if (callback) callback({ success: false, error: 'Content script not ready' });
          } else {
            console.error('Error:', chrome.runtime.lastError.message);
            status.textContent = '⚠️ Extension not active on this page. Please refresh the page.';
            status.style.background = '#fff3cd';
            if (callback) callback(null);
          }
        } else {
          if (callback) callback(response);
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      if (callback) callback(null);
    }
  }

  // Check if we're on a Unity page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    
    const url = tabs[0].url;
    const isUnityPage = /unity\.com|unity3d\.com|cloud\.unity\.com/.test(url);
    
    if (!isUnityPage) {
      status.textContent = '⚠️ Not on a Unity Gaming Services page';
      status.style.background = '#fff3cd';
      showButton.disabled = true;
      return;
    }

    // Check if floating UI is already shown
    sendMessage(tabs[0].id, { action: 'checkUI' }, (response) => {
      if (response && response.visible) {
        showButton.style.display = 'none';
        hideButton.style.display = 'block';
        status.textContent = '✓ Floating UI is visible';
        status.style.background = '#d4edda';
      }
    });
  });

  showButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      sendMessage(tabs[0].id, { action: 'showUI' }, (response) => {
        if (response && response.success) {
          showButton.style.display = 'none';
          hideButton.style.display = 'block';
          status.textContent = '✓ Floating UI is now visible';
          status.style.background = '#d4edda';
        } else {
          status.textContent = '⚠️ Could not show UI. Try refreshing the page.';
          status.style.background = '#fff3cd';
        }
      });
    });
  });

  hideButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      sendMessage(tabs[0].id, { action: 'hideUI' }, (response) => {
        if (response && response.success) {
          showButton.style.display = 'block';
          hideButton.style.display = 'none';
          status.textContent = 'Ready to validate JEXL expressions';
          status.style.background = '#e7f3ff';
        }
      });
    });
  });
});
