/**
 * Page-context interceptor for Clalit Appointment Finder.
 * This file runs in the PAGE context (not extension context) to intercept
 * XHR, fetch, and jQuery.ajax calls to SearchDiaries.
 *
 * It is loaded as an external script (not inline) to comply with CSP.
 */
(function () {
  'use strict';

  // ---- Intercept XMLHttpRequest ----
  var origXhrOpen = XMLHttpRequest.prototype.open;
  var origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._clalitUrl = url;
    this._clalitMethod = method;
    return origXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    if (
      this._clalitMethod === 'POST' &&
      this._clalitUrl &&
      this._clalitUrl.indexOf('SearchDiaries') !== -1
    ) {
      console.log('[Clalit Interceptor] XHR SearchDiaries captured:', body);
      window.postMessage(
        { type: '__CLALIT_CAPTURED_SEARCH', payload: body || '', source: 'xhr' },
        '*'
      );
    }
    return origXhrSend.apply(this, arguments);
  };

  // ---- Intercept fetch() ----
  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url ? input.url : '';
    var method = init && init.method ? init.method.toUpperCase() : 'GET';
    var body = init && init.body ? init.body : null;

    if (method === 'POST' && url.indexOf('SearchDiaries') !== -1 && body) {
      var bodyStr = typeof body === 'string' ? body : '';
      if (body instanceof URLSearchParams) bodyStr = body.toString();
      if (body instanceof FormData) {
        var parts = [];
        body.forEach(function (v, k) {
          parts.push(k + '=' + encodeURIComponent(v));
        });
        bodyStr = parts.join('&');
      }
      console.log('[Clalit Interceptor] fetch SearchDiaries captured:', bodyStr);
      window.postMessage(
        { type: '__CLALIT_CAPTURED_SEARCH', payload: bodyStr, source: 'fetch' },
        '*'
      );
    }

    return origFetch.apply(this, arguments);
  };

  // ---- Intercept jQuery.ajax if available ----
  function patchJQuery(jq) {
    if (!jq || !jq.ajax || jq._clalitPatched) return;
    jq._clalitPatched = true;
    var origAjax = jq.ajax;
    jq.ajax = function (urlOrSettings, settings) {
      var opts =
        typeof urlOrSettings === 'string'
          ? Object.assign({}, settings || {}, { url: urlOrSettings })
          : Object.assign({}, urlOrSettings || {});
      var url = opts.url || '';
      var method = (opts.method || opts.type || 'GET').toUpperCase();
      var data = opts.data || '';

      if (method === 'POST' && url.indexOf('SearchDiaries') !== -1 && data) {
        var bodyStr = typeof data === 'string' ? data : '';
        if (typeof data === 'object' && !(data instanceof FormData)) {
          var parts = [];
          for (var k in data) {
            if (data.hasOwnProperty(k)) parts.push(k + '=' + encodeURIComponent(data[k]));
          }
          bodyStr = parts.join('&');
        }
        console.log('[Clalit Interceptor] jQuery.ajax SearchDiaries captured:', bodyStr);
        window.postMessage(
          { type: '__CLALIT_CAPTURED_SEARCH', payload: bodyStr, source: 'jquery' },
          '*'
        );
      }

      return origAjax.apply(this, arguments);
    };
  }

  // Patch jQuery now if it exists
  if (typeof jQuery !== 'undefined') patchJQuery(jQuery);
  if (typeof $ !== 'undefined' && $ !== jQuery && $ && $.ajax) patchJQuery($);

  // Watch for jQuery being loaded later
  try {
    var _jqValue = window.jQuery;
    Object.defineProperty(window, 'jQuery', {
      configurable: true,
      get: function () {
        return _jqValue;
      },
      set: function (v) {
        _jqValue = v;
        if (v && v.ajax) patchJQuery(v);
      },
    });
  } catch (e) {
    // If defineProperty fails, use interval fallback
    setInterval(function () {
      if (window.jQuery && !window.jQuery._clalitPatched) patchJQuery(window.jQuery);
    }, 500);
  }

  console.log(
    '[Clalit Interceptor] XHR + fetch + jQuery interceptors installed in frame:',
    window.location.href.substring(0, 80)
  );
})();
