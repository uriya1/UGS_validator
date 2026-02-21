/**
 * Clalit Appointment Finder – Panel Logic
 * Runs inside the iframe side-panel.
 *
 * Features:
 * - Tab-based UI: Main (search + results) and Stats/Log
 * - Configurable check intervals
 * - Found appointments shown at top of main tab with alert banner
 * - Auto-switches to main tab and clicks real search button when appointments found
 * - Auto-focuses Chrome tab when appointments found
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const STATE_KEY = 'clalit_finder_state';
  let state = {
    monitoring: false,
    currentDate: '',
    currentDoctor: '',
    searchPayload: '',
    capturedPayload: '',
    searchCity: 'להבים',
    searchSpecCode: '58',
    searchNearby: true,
    intervalMin: 4,
    intervalMax: 6,
    dismissed: [],
    foundEarlier: [],
    lastCheck: null,
    checksCount: 0,
    totalEarlierFound: 0,
    totalDoctorsScanned: 0,
    totalPagesScanned: 0,
    errorCount: 0,
    sessionExpiredCount: 0,
    bestEarliestDate: null,
    monitoringStartedAt: null,
    lastSessionOk: null,
    nextCheckAt: null,
  };

  const pendingFetches = new Map();
  let fetchCounter = 0;

  // -------------------------------------------------------------------------
  // DOM refs
  // -------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const statusBar = $('#statusBar');
  const statusText = $('#statusText');
  const currentDateInput = $('#currentDate');
  const currentDoctorInput = $('#currentDoctor');
  const searchPayloadInput = $('#searchPayload');
  const searchCityInput = $('#searchCity');
  const searchSpecSelect = $('#searchSpecialization');
  const searchNearbyCheckbox = $('#searchNearby');
  const intervalMinInput = $('#intervalMin');
  const intervalMaxInput = $('#intervalMax');
  const autoCaptureBar = $('#autoCaptureBar');
  const autoCaptureText = $('#autoCaptureText');
  const capturedInfo = $('#capturedInfo');
  const capturedPayloadPreview = $('#capturedPayloadPreview');
  const clearCapturedBtn = $('#clearCapturedBtn');
  const startBtn = $('#startBtn');
  const stopBtn = $('#stopBtn');
  const manualCheckBtn = $('#manualCheckBtn');
  const backToSearchBtn = $('#backToSearchBtn');
  const alertBanner = $('#alertBanner');
  const alertTitle = $('#alertTitle');
  const alertSubtitle = $('#alertSubtitle');
  const resultsSection = $('#resultsSection');
  const resultsContainer = $('#resultsContainer');
  const dismissedSection = $('#dismissedSection');
  const dismissedToggle = $('#dismissedToggle');
  const dismissedList = $('#dismissedList');
  const dismissedCount = $('#dismissedCount');
  const logArea = $('#logArea');
  const clearLogBtn = $('#clearLogBtn');
  const mainBadge = $('#mainBadge');

  // Main tab timing display
  const mainLastCheck = $('#mainLastCheck');
  const mainNextCheck = $('#mainNextCheck');

  // Stats
  const statChecks = $('#statChecks');
  const statFound = $('#statFound');
  const statDismissed = $('#statDismissed');
  const statDoctors = $('#statDoctors');
  const statPages = $('#statPages');
  const statErrors = $('#statErrors');
  const statLastCheck = $('#statLastCheck');
  const statNextCheck = $('#statNextCheck');
  const statBestDate = $('#statBestDate');
  const statSession = $('#statSession');
  const statsUptime = $('#statsUptime');
  const statsUptimeText = $('#statsUptimeText');

  // Tab elements
  const tabBtns = $$('.tab-btn');
  const tabContents = $$('.tab-content');

  // -------------------------------------------------------------------------
  // Tab switching
  // -------------------------------------------------------------------------
  function switchTab(tabId) {
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === `tab-${tabId}`);
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------
  function saveState() {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch {}
  }

  // -------------------------------------------------------------------------
  // Logging
  // -------------------------------------------------------------------------
  function log(msg, level = 'info') {
    const ts = new Date().toLocaleTimeString('he-IL');
    const entry = document.createElement('div');
    entry.className = `log-entry ${level}`;
    entry.textContent = `[${ts}] ${msg}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------
  function setStatus(text, type = 'idle') {
    statusBar.className = `header-status ${type}`;
    statusText.textContent = text;
  }

  // -------------------------------------------------------------------------
  // Date helpers
  // -------------------------------------------------------------------------
  function parseDDMMYYYY(str) {
    if (!str) return null;
    const p = str.split('.');
    if (p.length !== 3) return null;
    return new Date(+p[2], +p[1] - 1, +p[0]);
  }

  // Parse ISO date (YYYY-MM-DD) as LOCAL time (not UTC)
  function parseISOLocal(str) {
    if (!str) return null;
    const p = str.split('-');
    if (p.length !== 3) return new Date(str);
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function formatDateHebrew(str) {
    const d = parseDDMMYYYY(str);
    if (!d) return str;
    return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  function daysBetween(dateStr, isoOrDDMMYYYY) {
    const d1 = parseDDMMYYYY(dateStr);
    const d2 = isoOrDDMMYYYY.includes('-') ? parseISOLocal(isoOrDDMMYYYY) : parseDDMMYYYY(isoOrDDMMYYYY);
    if (!d1 || !d2) return null;
    return Math.round((d2 - d1) / 864e5);
  }

  // -------------------------------------------------------------------------
  // Stats rendering
  // -------------------------------------------------------------------------
  let uptimeInterval = null;

  function renderStats() {
    statChecks.textContent = state.checksCount;
    statFound.textContent = state.totalEarlierFound;
    statDismissed.textContent = state.dismissed.length;
    statDoctors.textContent = state.totalDoctorsScanned;
    statPages.textContent = state.totalPagesScanned;
    statErrors.textContent = state.errorCount;

    let lastCheckText = '–';
    if (state.lastCheck) {
      const d = new Date(state.lastCheck);
      lastCheckText = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    statLastCheck.textContent = lastCheckText;
    if (mainLastCheck) mainLastCheck.textContent = lastCheckText;

    let nextCheckText = '–';
    if (state.monitoring && state.nextCheckAt) {
      const next = new Date(state.nextCheckAt);
      const now = new Date();
      const diffSec = Math.round((next - now) / 1000);
      if (diffSec > 0) {
        const m = Math.floor(diffSec / 60);
        const s = diffSec % 60;
        nextCheckText = `בעוד ${m}:${String(s).padStart(2, '0')}`;
      } else if (diffSec > -30) {
        nextCheckText = 'עכשיו...';
      } else {
        nextCheckText = 'ממתין לטיימר...';
      }
    } else if (state.monitoring) {
      nextCheckText = 'ממתין לטיימר...';
    }
    statNextCheck.textContent = nextCheckText;
    if (mainNextCheck) mainNextCheck.textContent = nextCheckText;

    statBestDate.textContent = state.bestEarliestDate || '–';

    if (state.lastSessionOk) {
      const ago = Math.round((Date.now() - new Date(state.lastSessionOk).getTime()) / 1000);
      if (ago < 120) {
        statSession.textContent = 'תקין';
        statSession.style.color = '#0369a1';
      } else {
        statSession.textContent = `אומת לפני ${Math.floor(ago / 60)} דק׳`;
        statSession.style.color = '#ea580c';
      }
    } else {
      statSession.textContent = '–';
      statSession.style.color = '';
    }

    if (state.monitoring && state.monitoringStartedAt) {
      statsUptime.classList.remove('inactive');
      updateUptimeText();
    } else {
      statsUptime.classList.add('inactive');
      statsUptimeText.textContent = 'מעקב לא פעיל';
    }
  }

  function updateUptimeText() {
    if (!state.monitoring || !state.monitoringStartedAt) return;
    const elapsed = Math.round((Date.now() - new Date(state.monitoringStartedAt).getTime()) / 1000);
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    let text = 'מעקב פעיל כבר ';
    if (h > 0) text += `${h} שעות `;
    if (m > 0 || h > 0) text += `${m} דקות `;
    text += `${s} שניות`;
    statsUptimeText.textContent = text;
  }

  function startStatsTicker() {
    if (uptimeInterval) clearInterval(uptimeInterval);
    uptimeInterval = setInterval(renderStats, 1000);
  }

  // -------------------------------------------------------------------------
  // Payload
  // -------------------------------------------------------------------------
  function getEffectivePayload() {
    const manual = (searchPayloadInput ? searchPayloadInput.value.trim() : '') || state.searchPayload.trim();
    if (manual) return manual;
    if (state.capturedPayload) return state.capturedPayload;
    return buildPayloadFromFields();
  }

  function buildPayloadFromFields() {
    const city = (searchCityInput ? searchCityInput.value.trim() : '') || state.searchCity || 'להבים';
    const specCode = (searchSpecSelect ? searchSpecSelect.value : '') || state.searchSpecCode || '58';
    const nearby = searchNearbyCheckbox ? searchNearbyCheckbox.checked : (state.searchNearby !== false);

    const params = new URLSearchParams();
    params.set('SelectedGroupCode', '0');
    params.set('SelectedSpecializationCode', specCode);
    params.set('SelectedDoctorName', '');
    params.set('IsSearchDiariesByDistricts', nearby ? 'true' : 'false');
    params.set('SelectedCityName', city);
    return params.toString();
  }

  function updateCaptureUI() {
    if (state.capturedPayload) {
      autoCaptureBar.className = 'auto-capture-bar captured';
      autoCaptureText.textContent = '✅ הגדרות חיפוש נתפסו מהאתר';
      if (capturedInfo) {
        capturedInfo.style.display = 'block';
        try {
          const params = new URLSearchParams(state.capturedPayload);
          const preview = [];
          for (const [k, v] of params.entries()) {
            if (v) preview.push(`${k}=${decodeURIComponent(v)}`);
          }
          capturedPayloadPreview.textContent = preview.join(' | ');
        } catch {
          capturedPayloadPreview.textContent = state.capturedPayload.substring(0, 120);
        }
      }
    } else {
      autoCaptureBar.className = 'auto-capture-bar pending';
      autoCaptureText.textContent = 'ממתין לתפוס הגדרות מהאתר (או השתמשו בשדות למטה)';
      if (capturedInfo) capturedInfo.style.display = 'none';
    }
  }

  // -------------------------------------------------------------------------
  // Fetch proxy
  // -------------------------------------------------------------------------
  function proxyFetch(url, payload) {
    return new Promise((resolve, reject) => {
      const requestId = `req_${++fetchCounter}_${Date.now()}`;
      pendingFetches.set(requestId, { resolve, reject });
      window.parent.postMessage({ type: 'CLALIT_FETCH_REQUEST', requestId, url, payload }, '*');
      setTimeout(() => {
        if (pendingFetches.has(requestId)) {
          pendingFetches.delete(requestId);
          reject(new Error('TIMEOUT'));
        }
      }, 30000);
    });
  }

  // Message handling
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'CLALIT_FETCH_RESPONSE') {
      const { requestId, data, error, status } = event.data;
      const pending = pendingFetches.get(requestId);
      if (!pending) return;
      pendingFetches.delete(requestId);
      if (error) pending.reject(new Error(error));
      else pending.resolve({ data, status });
    }

    if (event.data.type === 'CLALIT_RUN_CHECK') {
      if (state.monitoring) {
        log('בדיקה אוטומטית מטיימר...', 'info');
        runFullSearch();
      }
    }

    if (event.data.type === 'CLALIT_PAYLOAD_CAPTURED') {
      state.capturedPayload = event.data.payload;
      saveState();
      updateCaptureUI();
      log(`הגדרות חיפוש נתפסו! payload: ${event.data.payload}`, 'success');
    }

    if (event.data.type === 'CLALIT_FORM_FIELDS') {
      log(`שדות טופס מהאתר: ${JSON.stringify(event.data.fields)}`, 'info');
    }
  });

  // -------------------------------------------------------------------------
  // Parse HTML response
  // -------------------------------------------------------------------------
  let _debugDumpedFirst = 0;

  function parseAppointments(html, cutoffDate) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const diaries = doc.querySelectorAll('li.diary');
    const results = [];
    let hitCutoff = false;
    let consecutivePastCutoff = 0;
    const CUTOFF_THRESHOLD = 3;

    for (const li of diaries) {
      if (li.id && li.id.includes('mushlamBanner')) continue;

      // Debug: dump info of first two diary entries to log
      if (_debugDumpedFirst < 2) {
        _debugDumpedFirst++;
        const rawText = (li.textContent || '').replace(/\s+/g, ' ').trim().substring(0, 300);
        log(`[DEBUG] תור #${_debugDumpedFirst} text: ${rawText}`, 'info');
      }

      const nameEl = li.querySelector('.doctorName a');
      const clinicEl = li.querySelector('.clinicDetails a.clinicDetails');
      const addressEls = li.querySelectorAll('.clinicDetails');
      const visitBtn = li.querySelector('.createVisitButton, a[data-action-link*="AvailableVisit"]');

      const dateEl = li.querySelector('.visitDateTime span.visitDateTime');
      const allDateTimeSpans = li.querySelectorAll('.visitDateTime span');

      // Debug: log all spans inside visitDateTime
      if (allDateTimeSpans.length > 0 && results.length === 0) {
        const spanTexts = [];
        allDateTimeSpans.forEach((s, i) => {
          spanTexts.push(`span[${i}] class="${s.className}" text="${s.textContent.trim()}"`);
        });
        log(`[DEBUG] visitDateTime spans: ${spanTexts.join(' | ')}`, 'info');
      }

      const doctorName = nameEl ? nameEl.textContent.trim() : 'לא ידוע';

      let date = '';
      let time = '';
      const dateText = dateEl ? dateEl.textContent.trim() : '';

      allDateTimeSpans.forEach((s) => {
        const txt = s.textContent.trim();
        if (!txt) return;
        if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(txt)) {
          date = txt;
        } else if (/^\d{1,2}:\d{2}$/.test(txt)) {
          time = txt;
        } else if (/\d{1,2}\.\d{1,2}\.\d{4}/.test(txt)) {
          const m = txt.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*(\d{1,2}:\d{2})?/);
          if (m) {
            date = m[1];
            if (m[2]) time = m[2];
          }
        }
      });

      if (!date && dateText) {
        const m = dateText.match(/(\d{1,2}\.\d{1,2}\.\d{4})\s*(\d{1,2}:\d{2})?/);
        if (m) {
          date = m[1];
          if (m[2]) time = m[2];
        } else {
          date = dateText;
        }
      }

      // Fallback: search the entire li text for a date pattern
      // Handles cases like "התור הפנוי הקרוב בתאריך 18.02.2026" that
      // may not be inside a .visitDateTime element
      if (!date) {
        const fullText = li.textContent || '';
        const fallbackMatch = fullText.match(/(\d{1,2}\.\d{1,2}\.\d{4})/);
        if (fallbackMatch) {
          date = fallbackMatch[1];
          log(`[DEBUG] תאריך נמצא ב-fallback מתוך טקסט כללי: ${date} (${doctorName})`, 'info');
          const timeMatch = fullText.match(/(\d{1,2}:\d{2})/);
          if (timeMatch) time = timeMatch[1];
        }
      }

      if (!date) {
        // No date found – skip but reset consecutive counter so dateless
        // entries don't cause premature cutoff
        consecutivePastCutoff = 0;
        log(`[DEBUG] דילוג על תור ללא תאריך: ${doctorName}`, 'warn');
        continue;
      }

      // Early exit: stop only after 3 consecutive appointments past the cutoff
      if (cutoffDate) {
        const apptDate = parseDDMMYYYY(date);
        if (!apptDate) {
          // Unparseable date – skip but reset counter
          consecutivePastCutoff = 0;
          continue;
        }
        if (apptDate >= cutoffDate) {
          consecutivePastCutoff++;
          if (consecutivePastCutoff >= CUTOFF_THRESHOLD) {
            hitCutoff = true;
            break;
          }
          continue;
        } else {
          consecutivePastCutoff = 0;
        }
      }

      const clinic = clinicEl ? clinicEl.textContent.trim() : '';
      let address = '';
      if (addressEls.length >= 2) address = addressEls[1].textContent.trim();

      // Extract city: try from address first ("כתובת: חפץ חיים 51, אופקים" → "אופקים")
      // Then try from all text nodes with "כתובת:" pattern
      let city = '';
      // Gather all text from clinicDetails elements
      let fullAddressText = '';
      addressEls.forEach(el => { fullAddressText += ' ' + el.textContent.trim(); });

      // Look for "כתובת:...., CITY" pattern anywhere
      const addrMatch = fullAddressText.match(/כתובת:\s*[^,]+,\s*([^\n]+)/);
      if (addrMatch) {
        city = addrMatch[1].trim().replace(/טלפון:.*/, '').trim();
      }

      // Debug: log address extraction for first result
      if (results.length === 0) {
        log(`[DEBUG] clinic="${clinic}", address="${address}", fullAddr="${fullAddressText.substring(0,150)}", city="${city}"`, 'info');
      }
      let diaryId = '';
      let visitLink = '';
      if (visitBtn) {
        visitLink = visitBtn.getAttribute('data-action-link') || '';
        const m = visitLink.match(/Index\/([a-f0-9-]+)/i);
        if (m) diaryId = m[1];
      }

      const uniqueId = diaryId || `${doctorName}_${date}_${time}`;
      results.push({ doctorName, date, time, clinic, address, city, diaryId, visitLink, uniqueId });
    }

    let totalPages = 1;
    const pager = doc.querySelector('#pager');
    if (pager) {
      pager.querySelectorAll('a[data-action-link*="pageNumber"]').forEach((a) => {
        const n = parseInt(a.getAttribute('title'));
        if (!isNaN(n) && n > totalPages) totalPages = n;
      });
    }
    return { appointments: results, totalPages, hitCutoff };
  }

  // -------------------------------------------------------------------------
  // Full search
  // -------------------------------------------------------------------------
  async function runFullSearch() {
    log('מתחיל חיפוש...', 'info');
    setStatus('מחפש תורים...', 'active');

    const payload = getEffectivePayload();
    log(`payload: ${payload.substring(0, 120)}`, 'info');

    let allAppointments = [];

    try {
      const res1 = await proxyFetch(
        'https://e-services.clalit.co.il/Zimunet/Diary/SearchDiaries',
        payload
      );

      log(`תשובה: status=${res1.status}, length=${(res1.data || '').length}`, 'info');

      let htmlData;
      try {
        const json = JSON.parse(res1.data);
        log(`JSON parsed: errorType=${json.errorType}, message=${json.message || 'null'}, dataLen=${(json.data || '').length}`, 'info');
        if (json.errorType && json.errorType !== 0) {
          log(`שגיאת שרת: errorType=${json.errorType}, message=${json.message}`, 'error');
          log(`תוכן תשובה (200 תווים): ${(res1.data || '').substring(0, 200)}`, 'error');
          throw new Error(`שגיאה מהשרת (errorType=${json.errorType}): ${json.message || 'ללא הודעה'}`);
        }
        htmlData = json.data || '';
        if (!htmlData) log('אזהרה: json.data ריק', 'warn');
      } catch (parseErr) {
        if (parseErr.message && parseErr.message.startsWith('שגיאה מהשרת')) throw parseErr;
        log(`לא JSON – ניסיון פענוח נכשל: ${parseErr.message}`, 'warn');
        log(`תוכן תשובה (300 תווים): ${(res1.data || '').substring(0, 300)}`, 'warn');
        if (res1.data && (
          res1.data.includes('Login') || res1.data.includes('OTP') ||
          res1.data.includes('כניסה למערכת') || res1.data.includes('הזדהות')
        )) throw new Error('SESSION_EXPIRED');
        throw parseErr;
      }

      const cutoffDate = state.currentDate ? parseISOLocal(state.currentDate) : null;
      log(`[DEBUG] cutoffDate=${cutoffDate ? cutoffDate.toLocaleDateString('he-IL') : 'null'}, raw="${state.currentDate}"`, 'info');
      const { appointments, totalPages, hitCutoff } = parseAppointments(htmlData, cutoffDate);
      allAppointments = [...appointments];
      state.totalPagesScanned++;
      log(`עמוד 1/${totalPages} – ${appointments.length} תורים מוקדמים${hitCutoff ? ' (הגענו לתאריך התור – עוצרים)' : ''}`, 'info');

      if (!hitCutoff) {
        for (let page = 2; page <= totalPages; page++) {
          try {
            const pageRes = await proxyFetch(
              'https://e-services.clalit.co.il/Zimunet/Diary/Paging',
              `pageNumber=${page}`
            );
            let pageHtml;
            try { const pj = JSON.parse(pageRes.data); pageHtml = pj.data || ''; }
            catch { pageHtml = pageRes.data; }
            const pr = parseAppointments(pageHtml, cutoffDate);
            allAppointments = [...allAppointments, ...pr.appointments];
            state.totalPagesScanned++;
            log(`עמוד ${page}/${totalPages} – ${pr.appointments.length} תורים מוקדמים${pr.hitCutoff ? ' (הגענו לתאריך התור – עוצרים)' : ''}`, 'info');
            if (pr.hitCutoff) break;
          } catch (e) {
            if (e.message === 'SESSION_EXPIRED') throw e;
            log(`שגיאה בעמוד ${page}: ${e.message}`, 'warn');
          }
        }
      }
    } catch (e) {
      state.errorCount++;
      if (e.message === 'SESSION_EXPIRED') {
        state.sessionExpiredCount++;
        state.lastSessionOk = null;
        log('הסשן פג תוקף – יש להתחבר מחדש עם OTP', 'error');
        setStatus('הסשן פג תוקף – יש להתחבר מחדש', 'error');
        window.parent.postMessage({ type: 'CLALIT_NOTIFY_SESSION_EXPIRED' }, '*');
        playAlertSound();
        renderStats(); saveState();
        return;
      }
      if (e.message === 'TIMEOUT') {
        log('הבקשה נכשלה – timeout (30 שניות)', 'error');
        setStatus('הבקשה נכשלה – timeout', 'error');
        renderStats(); saveState();
        return;
      }
      log(`שגיאה: ${e.message}`, 'error');
      if (e.stack) log(`stack: ${e.stack.split('\n').slice(0, 3).join(' | ')}`, 'error');
      setStatus(`שגיאה: ${e.message.substring(0, 60)}`, 'error');
      renderStats(); saveState();
      return;
    }

    const now = new Date();
    state.lastCheck = now.toISOString();
    state.checksCount++;
    state.totalDoctorsScanned += allAppointments.length;
    state.lastSessionOk = now.toISOString();

    const minMs = (state.intervalMin || 4) * 60 * 1000;
    const maxMs = (state.intervalMax || 6) * 60 * 1000;
    const nextDelayMs = minMs + Math.random() * (maxMs - minMs);
    state.nextCheckAt = new Date(now.getTime() + nextDelayMs).toISOString();

    if (allAppointments.length > 0) {
      const sample = allAppointments[0];
      log(`דוגמה: ${sample.doctorName}, ${sample.date}${sample.time ? ' ' + sample.time : ''}, id=${sample.uniqueId.substring(0, 30)}`, 'info');
      log(`[DEBUG] visitLink="${sample.visitLink || 'EMPTY'}", diaryId="${sample.diaryId || 'EMPTY'}"`, 'info');
    }
    log(`סה"כ ${allAppointments.length} תורים מוקדמים יותר מ-${state.currentDate || '?'}`, 'info');
    if (state.monitoring) {
      const nextMin = Math.round(nextDelayMs / 60000 * 10) / 10;
      log(`בדיקה הבאה בעוד ~${nextMin} דקות`, 'info');
    }

    processResults(allAppointments);
    renderStats();
    saveState();
  }

  // -------------------------------------------------------------------------
  // Compare results
  // -------------------------------------------------------------------------
  function processResults(appointments) {
    if (!state.currentDate) {
      log('לא הוגדר תאריך תור נוכחי', 'warn');
      setStatus('חסר תאריך תור נוכחי', 'warning');
      return;
    }

    const currentDateObj = parseISOLocal(state.currentDate);
    const earlier = appointments.filter((a) => {
      const d = parseDDMMYYYY(a.date);
      return d && d < currentDateObj;
    });

    // Build dismissed set from all possible identifiers
    const dismissedIds = new Set();
    state.dismissed.forEach((d) => {
      if (d.uniqueId) dismissedIds.add(d.uniqueId);
      if (d.diaryId) dismissedIds.add(d.diaryId);
      dismissedIds.add(`${d.doctorName}_${d.date}_${d.time || ''}`);
      dismissedIds.add(`${d.doctorName}_${d.date}`);
    });

    const newEarlier = earlier.filter((a) => {
      if (dismissedIds.has(a.uniqueId)) return false;
      if (a.diaryId && dismissedIds.has(a.diaryId)) return false;
      if (dismissedIds.has(`${a.doctorName}_${a.date}_${a.time || ''}`)) return false;
      if (dismissedIds.has(`${a.doctorName}_${a.date}`)) return false;
      return true;
    });
    log(`earlier=${earlier.length}, dismissed=${state.dismissed.length}, newEarlier=${newEarlier.length}`, 'info');

    if (newEarlier.length > 0) {
      log(`נמצאו ${newEarlier.length} תורים מוקדמים יותר!`, 'success');
      setStatus(`נמצאו ${newEarlier.length} תורים מוקדמים!`, 'active');

      state.totalEarlierFound += newEarlier.length;
      state.foundEarlier = newEarlier;
      renderResults(newEarlier);
      showAlertBanner(newEarlier.length);

      const earliest = [...newEarlier].sort((a, b) => parseDDMMYYYY(a.date) - parseDDMMYYYY(b.date))[0];

      if (earliest) {
        const bestSoFar = state.bestEarliestDate ? parseDDMMYYYY(state.bestEarliestDate) : null;
        const candidateDate = parseDDMMYYYY(earliest.date);
        if (!bestSoFar || (candidateDate && candidateDate < bestSoFar)) {
          state.bestEarliestDate = earliest.date;
        }
      }

      // Notify: send notification + focus tab + click search on real page
      window.parent.postMessage({
        type: 'CLALIT_NOTIFY_EARLIER',
        payload: {
          doctorName: earliest.doctorName,
          date: earliest.date,
          clinic: earliest.clinic,
        },
      }, '*');

      // Ask the content script to click the real search button on the page
      window.parent.postMessage({ type: 'CLALIT_CLICK_SEARCH_BUTTON' }, '*');

      // Ask background to focus the Clalit tab
      window.parent.postMessage({ type: 'CLALIT_FOCUS_TAB' }, '*');

      // Switch to main tab in the panel
      switchTab('main');

      playAlertSound();
    } else {
      log('לא נמצאו תורים מוקדמים חדשים', 'info');
      state.foundEarlier = [];
      renderResults([]);
      hideAlertBanner();

      if (state.monitoring) {
        setStatus('מעקב פעיל – אין תורים חדשים', 'active');
      } else {
        setStatus('לא נמצאו תורים מוקדמים', 'idle');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Alert banner
  // -------------------------------------------------------------------------
  function showAlertBanner(count) {
    alertTitle.textContent = `נמצאו ${count} תורים מוקדמים!`;
    alertSubtitle.textContent = 'כפתור "חיפוש" בדף כללית נלחץ אוטומטית – תפסו את התור!';
    alertBanner.classList.add('show');
    // Show badge on main tab if on stats tab
    mainBadge.textContent = count;
    mainBadge.classList.add('show');
  }

  function hideAlertBanner() {
    alertBanner.classList.remove('show');
    mainBadge.classList.remove('show');
  }

  // -------------------------------------------------------------------------
  // Alert sound
  // -------------------------------------------------------------------------
  function playAlertSound() {
    window.parent.postMessage({ type: 'CLALIT_PLAY_ALERT_SOUND' }, '*');
  }

  // -------------------------------------------------------------------------
  // Render results
  // -------------------------------------------------------------------------
  function renderResults(appointments) {
    resultsContainer.innerHTML = '';
    if (!appointments.length) {
      resultsSection.style.display = 'none';
      return;
    }

    resultsSection.style.display = 'block';
    const sorted = [...appointments].sort((a, b) => parseDDMMYYYY(a.date) - parseDDMMYYYY(b.date));

    sorted.forEach((appt) => {
      const card = document.createElement('div');
      card.className = 'appointment-card';
      const diff = daysBetween(appt.date, state.currentDate);
      const diffLabel = diff !== null ? `${Math.abs(diff)} ימים מוקדם יותר` : '';
      const timeDisplay = appt.time ? `<span class="appt-time">${appt.time}</span>` : '';
      const idDisplay = appt.uniqueId ? `<div class="appt-id">ID: ${appt.uniqueId}</div>` : '';

      const hasDirectLink = appt.visitLink || appt.diaryId;
      const actionLabel = hasDirectLink
        ? '<div class="appt-action">לחצו לצפייה בתורים ←</div>'
        : '<div class="appt-action">לחצו לעבור לדף כללית ←</div>';

      // Build location display with city in bold
      let locationHtml = '';
      const cityName = appt.city || '';
      const clinicName = appt.clinic || '';
      const displayText = clinicName || cityName || '';

      if (cityName && displayText.includes(cityName)) {
        // Bold the city name within the clinic text
        locationHtml = displayText.replace(cityName, `<strong>${cityName}</strong>`);
      } else if (cityName) {
        locationHtml = `<strong>${cityName}</strong> – ${clinicName}`;
      } else {
        locationHtml = displayText;
      }

      card.innerHTML = `
        <button class="dismiss-btn" title="לא מעוניין בתור הזה">✕</button>
        <div class="doctor-name">${appt.doctorName}</div>
        <div class="date">
          ${diffLabel ? `<span class="days-diff">${diffLabel}</span>` : ''}
          ${timeDisplay}
          ${formatDateHebrew(appt.date)}
        </div>
        ${locationHtml ? `<div class="appt-location">${locationHtml}</div>` : ''}
        ${idDisplay}
        ${actionLabel}
      `;

      card.querySelector('.dismiss-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.dismissed.push({
          uniqueId: appt.uniqueId,
          diaryId: appt.diaryId || '',
          doctorName: appt.doctorName,
          date: appt.date,
          time: appt.time || '',
          clinic: appt.clinic,
        });
        state.foundEarlier = state.foundEarlier.filter((a) => a.uniqueId !== appt.uniqueId);
        saveState();
        renderResults(state.foundEarlier);
        renderDismissed();
        renderStats();
        if (state.foundEarlier.length === 0) hideAlertBanner();
        log(`וויתרת על: ${appt.doctorName} – ${appt.date}${appt.time ? ' ' + appt.time : ''}`, 'warn');
      });

      card.addEventListener('click', () => {
        const url = appt.visitLink
          ? `https://e-services.clalit.co.il${appt.visitLink}`
          : appt.diaryId
            ? `https://e-services.clalit.co.il/Zimunet/AvailableVisit/Index/${appt.diaryId}?isUpdateVisit=False`
            : null;

        if (url) {
          window.parent.postMessage({ type: 'CLALIT_NAVIGATE_TO', url }, '*');
          log(`לחצת על תור: ${appt.doctorName} – פותח עמוד קביעת תור`, 'info');
        } else {
          window.parent.postMessage({ type: 'CLALIT_CLICK_SEARCH_BUTTON' }, '*');
          window.parent.postMessage({ type: 'CLALIT_FOCUS_TAB' }, '*');
          log(`לחצת על תור: ${appt.doctorName} – אין diaryId, מעביר לדף חיפוש`, 'info');
        }
      });

      resultsContainer.appendChild(card);
    });
  }

  // -------------------------------------------------------------------------
  // Dismissed
  // -------------------------------------------------------------------------
  function renderDismissed() {
    if (!state.dismissed.length) { dismissedSection.style.display = 'none'; return; }
    dismissedSection.style.display = 'block';
    dismissedCount.textContent = state.dismissed.length;
    dismissedList.innerHTML = '';
    state.dismissed.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'dismissed-item';
      const timeStr = item.time ? ` ${item.time}` : '';
      el.innerHTML = `<span>${item.doctorName} – ${item.date}${timeStr} – ${item.clinic}</span><button class="restore-btn">שחזר</button>`;
      el.querySelector('.restore-btn').addEventListener('click', () => {
        state.dismissed.splice(idx, 1);
        saveState();
        renderDismissed();
        renderStats();
        log('שוחזר תור לרשימת המעקב', 'info');
      });
      dismissedList.appendChild(el);
    });
  }

  // -------------------------------------------------------------------------
  // Monitoring
  // -------------------------------------------------------------------------
  function startMonitoring() {
    if (!state.currentDate) {
      log('יש להזין תאריך תור נוכחי', 'error');
      setStatus('חסר תאריך תור נוכחי', 'error');
      return;
    }

    state.monitoring = true;
    state.monitoringStartedAt = new Date().toISOString();
    state.nextCheckAt = new Date().toISOString();
    saveState();
    updateUI();
    renderStats();

    // Send interval config to background
    window.parent.postMessage({
      type: 'CLALIT_START_MONITORING',
      intervalMin: state.intervalMin,
      intervalMax: state.intervalMax,
    }, '*');
    log(`מעקב הופעל – בדיקה כל ${state.intervalMin}-${state.intervalMax} דקות`, 'success');
    setStatus('מעקב פעיל', 'active');
    runFullSearch();
  }

  function stopMonitoring() {
    state.monitoring = false;
    state.monitoringStartedAt = null;
    state.nextCheckAt = null;
    saveState();
    updateUI();
    renderStats();
    window.parent.postMessage({ type: 'CLALIT_STOP_MONITORING' }, '*');
    log('מעקב הופסק', 'warn');
    setStatus('מעקב הופסק', 'idle');
  }

  function updateUI() {
    startBtn.style.display = state.monitoring ? 'none' : 'flex';
    stopBtn.style.display = state.monitoring ? 'flex' : 'none';
  }

  // -------------------------------------------------------------------------
  // Event listeners
  // -------------------------------------------------------------------------
  function syncFieldsToState() {
    state.currentDate = currentDateInput.value;
    state.currentDoctor = currentDoctorInput ? currentDoctorInput.value.trim() : '';
    state.searchPayload = searchPayloadInput ? searchPayloadInput.value.trim() : '';
    state.searchCity = searchCityInput ? searchCityInput.value.trim() : state.searchCity;
    state.searchSpecCode = searchSpecSelect ? searchSpecSelect.value : state.searchSpecCode;
    state.searchNearby = searchNearbyCheckbox ? searchNearbyCheckbox.checked : state.searchNearby;
    state.intervalMin = parseInt(intervalMinInput.value) || 4;
    state.intervalMax = parseInt(intervalMaxInput.value) || 6;
    if (state.intervalMin < 1) state.intervalMin = 1;
    if (state.intervalMax < state.intervalMin) state.intervalMax = state.intervalMin;
    saveState();
  }

  startBtn.addEventListener('click', () => { syncFieldsToState(); startMonitoring(); });
  stopBtn.addEventListener('click', stopMonitoring);
  manualCheckBtn.addEventListener('click', () => { syncFieldsToState(); runFullSearch(); });
  backToSearchBtn.addEventListener('click', () => {
    window.parent.postMessage({ type: 'CLALIT_NAVIGATE_TO', url: 'https://e-services.clalit.co.il/Zimunet/Diary' }, '*');
    log('חוזר לדף חיפוש כללית', 'info');
  });

  currentDateInput.addEventListener('change', () => { state.currentDate = currentDateInput.value; saveState(); });

  if (searchPayloadInput) searchPayloadInput.addEventListener('input', () => { state.searchPayload = searchPayloadInput.value.trim(); saveState(); });
  if (searchCityInput) searchCityInput.addEventListener('input', () => { state.searchCity = searchCityInput.value.trim(); saveState(); });
  if (searchSpecSelect) searchSpecSelect.addEventListener('change', () => { state.searchSpecCode = searchSpecSelect.value; saveState(); });
  if (searchNearbyCheckbox) searchNearbyCheckbox.addEventListener('change', () => { state.searchNearby = searchNearbyCheckbox.checked; saveState(); });

  intervalMinInput.addEventListener('change', () => { state.intervalMin = parseInt(intervalMinInput.value) || 4; saveState(); });
  intervalMaxInput.addEventListener('change', () => { state.intervalMax = parseInt(intervalMaxInput.value) || 6; saveState(); });

  if (clearCapturedBtn) {
    clearCapturedBtn.addEventListener('click', () => {
      state.capturedPayload = '';
      saveState();
      updateCaptureUI();
      log('הגדרות חיפוש נוקו – ישתמש בשדות למעלה או תפסו מחדש מהאתר', 'info');
    });
  }

  clearLogBtn.addEventListener('click', () => { logArea.innerHTML = ''; log('יומן נוקה', 'info'); });
  dismissedToggle.addEventListener('click', () => { dismissedToggle.classList.toggle('open'); dismissedList.classList.toggle('show'); });

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  function init() {
    loadState();

    if (state.currentDate) currentDateInput.value = state.currentDate;
    if (state.currentDoctor && currentDoctorInput) currentDoctorInput.value = state.currentDoctor;
    if (state.searchPayload && searchPayloadInput) searchPayloadInput.value = state.searchPayload;
    if (state.searchCity && searchCityInput) searchCityInput.value = state.searchCity;
    if (state.searchSpecCode && searchSpecSelect) searchSpecSelect.value = state.searchSpecCode;
    if (searchNearbyCheckbox) searchNearbyCheckbox.checked = state.searchNearby !== false;
    intervalMinInput.value = state.intervalMin || 4;
    intervalMaxInput.value = state.intervalMax || 6;
    updateCaptureUI();

    updateUI();
    renderDismissed();
    renderStats();
    startStatsTicker();

    if (state.foundEarlier && state.foundEarlier.length) {
      renderResults(state.foundEarlier);
      showAlertBanner(state.foundEarlier.length);
    }

    if (state.monitoring) {
      setStatus('מעקב פעיל', 'active');
      log('מעקב פעיל – ממתין לבדיקה הבאה', 'info');
      window.parent.postMessage({
        type: 'CLALIT_START_MONITORING',
        intervalMin: state.intervalMin,
        intervalMax: state.intervalMax,
      }, '*');
    }

    if (state.lastCheck) {
      const d = new Date(state.lastCheck);
      log(`בדיקה אחרונה: ${d.toLocaleString('he-IL')} (${state.checksCount} בדיקות סה"כ)`, 'info');
    }

    if (state.capturedPayload) {
      log('משתמש ב-payload שנתפס מהאתר', 'success');
    } else if ((state.searchPayload || '').trim()) {
      log('משתמש ב-payload ידני', 'info');
    } else {
      log(`ישתמש בהגדרות: ${state.searchCity || 'להבים'}, אורתופדיה, כולל סביבה=${state.searchNearby !== false}`, 'info');
    }
  }

  init();
})();
