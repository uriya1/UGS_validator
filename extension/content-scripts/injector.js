/**
 * Content Script - Injects validation UI into UGS pages
 * This script runs on Unity Gaming Services pages and enhances the UI
 */

(function() {
  'use strict';

  // Wait for dependencies to be available
  if (typeof UGS_PARAMETERS === 'undefined') {
    console.error('UGS_PARAMETERS not loaded');
    return;
  }
  
  if (typeof JEXLValidator === 'undefined') {
    console.error('JEXLValidator not loaded');
    return;
  }

  // Initialize validator
  const validator = new JEXLValidator(UGS_PARAMETERS);
  
  // Global cached remote config (loaded on page load)
  let globalCachedRemoteConfig = null;
  
  // Load cached remote config on page load
  function loadGlobalCachedConfig() {
    const url = window.location.href;
    const match = url.match(/projects\/([a-f0-9-]+)/i);
    const projectId = match ? match[1] : 'default';
    
    chrome.storage.local.get([`ugs_remote_config_${projectId}`], (result) => {
      const cachedConfig = result[`ugs_remote_config_${projectId}`];
      if (cachedConfig) {
        try {
          const config = JSON.parse(cachedConfig);
          if (config.attributes) {
            globalCachedRemoteConfig = config.attributes;
            console.log('UGS Validator: Loaded cached remote config for project:', projectId);
          }
        } catch (e) {
          console.error('UGS Validator: Error parsing cached config:', e);
        }
      }
    });
  }
  
  // Load on page load
  loadGlobalCachedConfig();
  
  // Create validation UI overlay
  function createValidationUI() {
    const style = document.createElement('style');
    style.textContent = `
      .ugs-validator-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border: 2px solid #0073e6;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
      }
      .ugs-validator-status {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .ugs-validator-status.valid {
        color: #28a745;
      }
      .ugs-validator-status.invalid {
        color: #dc3545;
      }
      .ugs-validator-errors {
        margin-top: 8px;
      }
      .ugs-validator-error {
        padding: 6px;
        margin: 4px 0;
        background: #fee;
        border-left: 3px solid #dc3545;
        border-radius: 4px;
        font-size: 12px;
      }
      .ugs-validator-warning {
        padding: 6px;
        margin: 4px 0;
        background: #fff3cd;
        border-left: 3px solid #ffc107;
        border-radius: 4px;
        font-size: 12px;
      }
      .ugs-validator-suggestion {
        padding: 6px;
        margin: 4px 0;
        background: #e7f3ff;
        border-left: 3px solid #0073e6;
        border-radius: 4px;
        font-size: 12px;
      }
      .ugs-validator-inline-error {
        position: absolute;
        background: #dc3545;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 10001;
        margin-top: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
      .ugs-validator-inline-warning {
        position: absolute;
        background: #ffc107;
        color: #000;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        z-index: 10001;
        margin-top: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(style);
  }

  // Find JEXL input fields in UGS pages - Look for code editor spans and actual inputs
  function findJEXLInputs() {
    const inputs = [];
    const seen = new Set();
    
    console.log('UGS Validator: Starting JEXL field detection (code editor mode)...');
    
    // Strategy 1: Find code editor spans (Monaco editor or similar)
    // Look for spans with class "mtk1" or similar in JEXL Condition sections
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const text = el.textContent || '';
      // Only match "Jexl Condition" or "JEXL Condition" - very specific
      if (/jexl\s*condition/i.test(text) && !seen.has(el)) {
        console.log('UGS Validator: Found element with "Jexl Condition" label:', el);
        
        // Find code editor spans (Monaco editor uses spans with classes like mtk1)
        let container = el;
        for (let i = 0; i < 10; i++) {
          if (!container) break;
          
          // Look for view-lines structure (Monaco editor structure)
          const viewLines = container.querySelector('.view-lines, .monaco-mouse-cursor-text');
          if (viewLines && !seen.has(viewLines)) {
            seen.add(viewLines);
            inputs.push(viewLines);
            console.log('UGS Validator: Found view-lines container:', viewLines);
          }
          
          // Look for code editor spans
          const codeEditorSpans = container.querySelectorAll('span.mtk1, span[class*="mtk"], .monaco-editor span, [contenteditable="true"]');
          codeEditorSpans.forEach(span => {
            // Check if this span is in a code editor context
            const editorContainer = span.closest('.monaco-editor, .CodeMirror, [role="textbox"], .view-lines, .monaco-mouse-cursor-text');
            if (editorContainer && !seen.has(editorContainer)) {
              seen.add(editorContainer);
              inputs.push(editorContainer);
              console.log('UGS Validator: Found code editor container:', editorContainer);
            }
          });
          
          // Also look for actual input/textarea fields
          const inputFields = container.querySelectorAll('input[type="text"], textarea, input:not([type])');
          inputFields.forEach(input => {
            if (seen.has(input)) return;
            if (input.offsetWidth === 0 || input.disabled) return;
            if (input.type === 'number' || input.type === 'range') return;
            
            const candidateContext = (input.closest('div, section')?.textContent || '').toLowerCase();
            if (!candidateContext.includes('rollout') && 
                !candidateContext.includes('percentage') &&
                /jexl\s*condition/i.test(candidateContext)) {
              seen.add(input);
              inputs.push(input);
              console.log('UGS Validator: Found JEXL input field:', input);
            }
          });
          
          container = container.parentElement;
          if (!container || container === document.body) break;
        }
      }
    });
    
    // Strategy 2: Find Monaco editor directly
    const monacoEditors = document.querySelectorAll('.monaco-editor, .CodeMirror, [role="textbox"]');
    monacoEditors.forEach(editor => {
      if (seen.has(editor)) return;
      
      // Check if this editor is in a JEXL Condition section
      const context = (editor.closest('div, section')?.textContent || '').toLowerCase();
      if (/jexl\s*condition/i.test(context) && !/rollout|percentage/i.test(context.substring(0, 200))) {
        seen.add(editor);
        inputs.push(editor);
        console.log('UGS Validator: Found Monaco editor in JEXL section:', editor);
      }
    });

    console.log(`UGS Validator: Found ${inputs.length} JEXL Condition field(s):`, inputs);
    return inputs;
  }
  
  // Find the actual editable element (span.mtk1 or input)
  function findEditableElement(container) {
    // If it's already an input/textarea, return it
    if (container.tagName === 'INPUT' || container.tagName === 'TEXTAREA') {
      return container;
    }
    
    // Look for view-lines structure first (Monaco editor structure)
    const viewLines = container.querySelector('.view-lines, .monaco-mouse-cursor-text');
    if (viewLines) return viewLines;
    
    // Look for contenteditable or code editor spans
    const editable = container.querySelector('[contenteditable="true"], span.mtk1, .monaco-editor .view-lines');
    if (editable) return editable;
    
    // Look for the actual text spans in Monaco editor
    const textSpans = container.querySelectorAll('span.mtk1, span[class*="mtk"]');
    if (textSpans.length > 0) {
      // Return the container and we'll manipulate the spans
      return container;
    }
    
    return container;
  }

    // Attach validation to input field or code editor
  function attachValidation(input) {
    // Skip if already attached
    if (input.dataset.ugsValidatorAttached === 'true') {
      return;
    }
    
    // Skip if input is not visible
    if (input.offsetWidth === 0 && input.offsetHeight === 0) {
      return;
    }
    
    // Check if this is the JEXL Condition field - be very specific
    const fieldContext = (input.closest('div, section')?.textContent || '').toLowerCase();
    const isJEXLField = /jexl\s*condition/i.test(fieldContext) && 
                        !/rollout|percentage/i.test(fieldContext.substring(0, 200));
    
    if (!isJEXLField) {
      return; // Don't attach to non-JEXL fields
    }
    
    if (isJEXLField && !activeJEXLField) {
      activeJEXLField = input;
      highlightJEXLField();
      console.log('UGS Validator: Set as active JEXL Condition field:', input);
    }
    
    input.dataset.ugsValidatorAttached = 'true';
    console.log('UGS Validator: Attaching to input', input, 'isJEXL:', isJEXLField);
    
    // Find the actual editable element (span.mtk1 for code editors)
    const editable = findEditableElement(input);
    
    // For code editors, find the span.mtk1 directly
    // Also check for view-line structure
    let jexlSpan = null;
    if (editable.querySelector) {
      // First try to find span.mtk1 in view-line structure
      const viewLine = editable.querySelector('.view-line');
      if (viewLine) {
        const spans = viewLine.querySelectorAll('span.mtk1, span[class*="mtk"]');
        if (spans.length > 0) {
          jexlSpan = spans[0];
          console.log('UGS Validator: Found JEXL span in view-line:', jexlSpan);
        }
      }
      
      // If not found, look for spans directly
      if (!jexlSpan) {
        const spans = editable.querySelectorAll('span.mtk1, span[class*="mtk"]');
        if (spans.length > 0) {
          // Find the span in JEXL Condition context
          jexlSpan = Array.from(spans).find(span => {
            const context = (span.closest('div, section')?.textContent || '').toLowerCase();
            return /jexl\s*condition/i.test(context);
          }) || spans[0];
          console.log('UGS Validator: Found JEXL span:', jexlSpan);
        }
      }
    }

    // Ensure parent has relative positioning
    let parent = input.parentElement;
    if (!parent || getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Create inline validation indicator - position it near the span
    const indicator = document.createElement('div');
    indicator.className = 'ugs-validator-inline-error';
    indicator.style.display = 'none';
    indicator.id = `ugs-validator-${Date.now()}`;
    
    // If we have a span, position indicator relative to it
    if (jexlSpan) {
      const spanParent = jexlSpan.parentElement;
      if (spanParent && getComputedStyle(spanParent).position === 'static') {
        spanParent.style.position = 'relative';
      }
      spanParent.appendChild(indicator);
    } else {
      parent.appendChild(indicator);
    }

    // Debounce function for real-time validation
    let validationTimeout = null;
    const validate = () => {
      // Clear previous timeout
      if (validationTimeout) {
        clearTimeout(validationTimeout);
      }
      
      // Debounce validation to avoid excessive calls while typing
      validationTimeout = setTimeout(() => {
        performValidation();
      }, 300); // 300ms delay
    };
    
    // Actual validation function
    const performValidation = () => {
      // Get expression from the span.mtk1 or editable element
      let expression = '';
      
      // First, try to get value from Monaco editor model if available
      const monacoContainer = (jexlSpan || editable).closest('.monaco-editor');
      if (monacoContainer) {
        try {
          let editor = null;
          
          // Try multiple ways to find Monaco editor instance
          if (window.monaco && window.monaco.editor) {
            const editors = window.monaco.editor.getEditors();
            editor = editors.find(e => {
              try {
                return e.getContainerDomNode() === monacoContainer;
              } catch (err) {
                return false;
              }
            });
          }
          
          if (!editor && monacoContainer.__monacoEditor) {
            editor = monacoContainer.__monacoEditor;
          }
          
          if (!editor && monacoContainer._editor) {
            editor = monacoContainer._editor;
          }
          
          // If we found the editor, get value from its model
          if (editor && typeof editor.getValue === 'function') {
            expression = editor.getValue();
            console.log('UGS Validator: Reading from Monaco editor model:', expression);
          }
        } catch (e) {
          console.log('UGS Validator: Could not read from Monaco editor model:', e);
        }
      }
      
      // Fallback to DOM reading if Monaco model not available
      if (!expression) {
        if (jexlSpan) {
          // Get text directly from the JEXL span
          expression = jexlSpan.textContent || jexlSpan.innerText || '';
          console.log('UGS Validator: Reading from span.mtk1:', expression);
        } else if (editable.tagName === 'INPUT' || editable.tagName === 'TEXTAREA') {
          expression = editable.value || '';
        } else if (editable.contentEditable === 'true') {
          expression = editable.textContent || editable.innerText || '';
        } else {
          // For code editor spans, check for view-line structure first
          const viewLine = editable.querySelector('.view-line');
          if (viewLine) {
            const spans = viewLine.querySelectorAll('span.mtk1, span[class*="mtk"]');
            expression = Array.from(spans).map(s => s.textContent).join('');
            console.log('UGS Validator: Reading from view-line:', expression);
          }
          
          // If not found in view-line, get text from all spans
          if (!expression) {
            const spans = editable.querySelectorAll('span.mtk1, span[class*="mtk"]');
            expression = Array.from(spans).map(s => s.textContent).join('');
          }
          
          // Fallback to textContent
          if (!expression) {
            expression = editable.textContent || editable.innerText || '';
          }
        }
      }
      
      // Always validate if there's content (UGS JEXL fields should always be validated)
      // Check if this looks like it might be a JEXL field
      const isLikelyJEXLField = 
        /jexl|condition|expression/i.test(input.name || '') ||
        /jexl|condition|expression/i.test(input.id || '') ||
        /jexl|condition|expression/i.test((input.closest('div, section')?.textContent || '').substring(0, 200));
      
      // Only validate if this is actually a JEXL Condition field
      // Double-check that this field is in a JEXL Condition section
      const fieldContext = (editable.closest('div, section')?.textContent || '').toLowerCase();
      const isActuallyJEXLField = /jexl\s*condition/i.test(fieldContext) && 
                                   !/rollout|percentage/i.test(fieldContext.substring(0, 200));
      
      if (!isActuallyJEXLField) {
        // This is not a JEXL field, don't validate
        indicator.style.display = 'none';
        if (editable.style) {
          editable.style.borderColor = '';
          editable.style.borderWidth = '';
          editable.style.boxShadow = '';
        }
        return;
      }
      
      // Use unified validation function - same as panel validation (works even when panel is closed)
      // Always validate, regardless of panel visibility
      const result = validateJEXLExpression(expression);
      
      console.log('UGS Validator: Real-time validation result:', {
        expression: expression.substring(0, 50),
        valid: result.valid,
        errors: result.errors.length,
        warnings: result.warnings.length,
        suggestions: result.suggestions.length,
        panelVisible: panelVisible
      });

      // Position indicator - if we have a span, position relative to it
      if (jexlSpan) {
        const rect = jexlSpan.getBoundingClientRect();
        const parentRect = jexlSpan.parentElement.getBoundingClientRect();
        indicator.style.top = `${rect.height + 4}px`;
        indicator.style.left = '0px';
      } else {
        const rect = input.getBoundingClientRect();
        indicator.style.top = `${rect.height + 4}px`;
        indicator.style.left = '0px';
      }

      // Get remote config for type validation if available - use same logic as panel
      let remoteConfigData = null;
      try {
        const configInput = document.querySelector('#ugs-remote-config');
        if (configInput && configInput.value) {
          const config = JSON.parse(configInput.value);
          if (config.attributes) {
            remoteConfigData = config.attributes;
          }
        }
      } catch (e) {
        // Config not loaded or invalid
      }
      
      // If no config in input, use global cached config (same as panel validation)
      if (!remoteConfigData) {
        remoteConfigData = globalCachedRemoteConfig;
      }
      
      // Add type validation if remote config is available (same validation logic as panel)
      if (remoteConfigData) {
        const typeErrors = validateTypesAgainstConfig(expression, remoteConfigData);
        if (typeErrors.length > 0) {
          result.errors.push(...typeErrors);
          result.valid = false;
        }
      }
      
      // Update indicator - make it very visible, especially for span.mtk1
      if (!result.valid || result.errors.length > 0) {
        indicator.className = 'ugs-validator-inline-error';
        indicator.textContent = `❌ ${result.errors[0]?.message || 'Invalid JEXL'}`;
        indicator.style.display = 'block';
        indicator.style.backgroundColor = '#dc3545';
        indicator.style.color = 'white';
        indicator.style.padding = '8px 12px';
        indicator.style.fontSize = '13px';
        indicator.style.fontWeight = 'bold';
        indicator.style.zIndex = '1000000';
        indicator.style.position = 'absolute';
        indicator.style.top = '100%';
        indicator.style.left = '0';
        indicator.style.marginTop = '4px';
        indicator.style.whiteSpace = 'nowrap';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        
        // Apply strong styling to span.mtk1 if it exists - make it very visible
        if (jexlSpan) {
          jexlSpan.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
          jexlSpan.style.border = '2px solid #dc3545';
          jexlSpan.style.borderRadius = '4px';
          jexlSpan.style.padding = '2px 6px';
          jexlSpan.style.boxShadow = '0 0 8px rgba(220, 53, 69, 0.5)';
          jexlSpan.style.outline = '2px solid rgba(220, 53, 69, 0.3)';
          jexlSpan.style.outlineOffset = '2px';
          // Also add a red dot indicator
          if (!jexlSpan.dataset.errorIndicator) {
            const errorDot = document.createElement('span');
            errorDot.textContent = ' ⚠️';
            errorDot.style.color = '#dc3545';
            errorDot.style.fontSize = '14px';
            errorDot.style.fontWeight = 'bold';
            jexlSpan.appendChild(errorDot);
            jexlSpan.dataset.errorIndicator = 'true';
          }
        }
        
        // Apply styling to editable element
        if (editable.style) {
          editable.style.borderColor = '#dc3545';
          editable.style.borderWidth = '3px';
          editable.style.borderStyle = 'solid';
          editable.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.2)';
        }
        // For Monaco editor, also style the container
        const monacoContainer = editable.closest('.monaco-editor');
        if (monacoContainer) {
          monacoContainer.style.outline = '3px solid #dc3545';
        }
        console.log('UGS Validator: ❌ ERROR -', result.errors[0]?.message);
      } else if (result.warnings.length > 0) {
        indicator.className = 'ugs-validator-inline-warning';
        indicator.textContent = `⚠️ ${result.warnings[0]?.message || 'Warning'}`;
        indicator.style.display = 'block';
        indicator.style.backgroundColor = '#ffc107';
        indicator.style.color = '#000';
        indicator.style.padding = '8px 12px';
        indicator.style.fontSize = '13px';
        indicator.style.zIndex = '1000000';
        
        if (jexlSpan) {
          jexlSpan.style.backgroundColor = 'rgba(255, 193, 7, 0.1)';
          jexlSpan.style.borderBottom = '2px solid #ffc107';
          jexlSpan.style.padding = '2px 4px';
          jexlSpan.style.borderRadius = '3px';
        }
        
        if (editable.style) {
          editable.style.borderColor = '#ffc107';
          editable.style.borderWidth = '3px';
          editable.style.borderStyle = 'solid';
          editable.style.boxShadow = '0 0 0 3px rgba(255, 193, 7, 0.2)';
        }
        const monacoContainer = editable.closest('.monaco-editor');
        if (monacoContainer) {
          monacoContainer.style.outline = '3px solid #ffc107';
        }
        console.log('UGS Validator: ⚠️ WARNING -', result.warnings[0]?.message);
      } else if (expression.trim().length > 0) {
        // Check if it actually has UGS parameters
        const hasUGSParams = /\b(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/.test(expression);
        if (hasUGSParams) {
          indicator.style.display = 'none';
          
        // Remove error styling from span
        if (jexlSpan) {
          jexlSpan.style.backgroundColor = '';
          jexlSpan.style.border = '';
          jexlSpan.style.borderBottom = '';
          jexlSpan.style.padding = '';
          jexlSpan.style.borderRadius = '';
          jexlSpan.style.boxShadow = '';
          jexlSpan.style.outline = '';
          jexlSpan.style.outlineOffset = '';
          // Remove error indicator
          if (jexlSpan.dataset.errorIndicator) {
            const errorDot = jexlSpan.querySelector('span[style*="color: rgb(220, 53, 69)"]');
            if (errorDot) errorDot.remove();
            delete jexlSpan.dataset.errorIndicator;
          }
        }
          
          if (editable.style) {
            editable.style.borderColor = '#28a745';
            editable.style.borderWidth = '3px';
            editable.style.borderStyle = 'solid';
            editable.style.boxShadow = '0 0 0 3px rgba(40, 167, 69, 0.2)';
          }
          const monacoContainer = editable.closest('.monaco-editor');
          if (monacoContainer) {
            monacoContainer.style.outline = '3px solid #28a745';
          }
          console.log('UGS Validator: ✅ VALID JEXL');
        } else {
          // Has content but no UGS parameters - show as invalid
          indicator.className = 'ugs-validator-inline-error';
          indicator.textContent = `❌ Expression must reference UGS/Wisdom parameters`;
          indicator.style.display = 'block';
          indicator.style.zIndex = '1000000';
          
          if (jexlSpan) {
            jexlSpan.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
            jexlSpan.style.border = '2px solid #dc3545';
            jexlSpan.style.borderRadius = '4px';
            jexlSpan.style.padding = '2px 6px';
            jexlSpan.style.boxShadow = '0 0 8px rgba(220, 53, 69, 0.5)';
            jexlSpan.style.outline = '2px solid rgba(220, 53, 69, 0.3)';
            jexlSpan.style.outlineOffset = '2px';
            // Add error indicator
            if (!jexlSpan.dataset.errorIndicator) {
              const errorDot = document.createElement('span');
              errorDot.textContent = ' ⚠️';
              errorDot.style.color = '#dc3545';
              errorDot.style.fontSize = '14px';
              errorDot.style.fontWeight = 'bold';
              jexlSpan.appendChild(errorDot);
              jexlSpan.dataset.errorIndicator = 'true';
            }
          }
          
          if (editable.style) {
            editable.style.borderColor = '#dc3545';
            editable.style.borderWidth = '3px';
            editable.style.borderStyle = 'solid';
            editable.style.boxShadow = '0 0 0 3px rgba(220, 53, 69, 0.2)';
          }
          const monacoContainer = editable.closest('.monaco-editor');
          if (monacoContainer) {
            monacoContainer.style.outline = '3px solid #dc3545';
          }
        }
      } else {
        indicator.style.display = 'none';
        
        // Remove styling from span
        if (jexlSpan) {
          jexlSpan.style.backgroundColor = '';
          jexlSpan.style.border = '';
          jexlSpan.style.borderBottom = '';
          jexlSpan.style.padding = '';
          jexlSpan.style.borderRadius = '';
          jexlSpan.style.boxShadow = '';
          jexlSpan.style.outline = '';
          jexlSpan.style.outlineOffset = '';
          // Remove error indicator
          if (jexlSpan.dataset.errorIndicator) {
            const errorDot = jexlSpan.querySelector('span[style*="color: rgb(220, 53, 69)"]');
            if (errorDot) errorDot.remove();
            delete jexlSpan.dataset.errorIndicator;
          }
        }
        
        if (editable.style) {
          editable.style.borderColor = '';
          editable.style.borderWidth = '';
          editable.style.borderStyle = '';
          editable.style.boxShadow = '';
        }
        const monacoContainer = editable.closest('.monaco-editor');
        if (monacoContainer) {
          monacoContainer.style.outline = '';
        }
      }

      // Update floating overlay with enhanced suggestions (only if visible)
      if (overlayVisible) {
        updateValidationOverlay(result, expression);
      }
    };

    // Attach event listeners - use multiple events for better coverage
    // Listen on both input container and editable element
    const attachEvents = (element) => {
      element.addEventListener('input', validate);
      element.addEventListener('keyup', validate);
      element.addEventListener('keydown', validate);
      element.addEventListener('blur', validate);
      element.addEventListener('change', validate);
      element.addEventListener('paste', () => setTimeout(validate, 10));
      element.addEventListener('focus', () => {
        const fieldContext = (element.closest('div, section')?.textContent || '').toLowerCase();
        const checkIsJEXL = /jexl\s*condition/i.test(fieldContext) && 
                            !/rollout|percentage/i.test(fieldContext.substring(0, 200));
        if (checkIsJEXL) {
          activeJEXLField = input;
          highlightJEXLField();
        }
      });
    };
    
    attachEvents(input);
    // Only attach events to editable if it exists and is different from input
    if (editable && editable !== input && editable !== null) {
      attachEvents(editable);
    }
    
    // For code editor spans, listen to mutations on the span itself
    if (jexlSpan) {
      const observer = new MutationObserver(() => {
        validate();
      });
      observer.observe(jexlSpan, { childList: true, subtree: true, characterData: true });
      
      // Also watch the view-line parent if it exists
      const viewLine = jexlSpan.closest('.view-line');
      if (viewLine && viewLine !== jexlSpan) {
        observer.observe(viewLine, { childList: true, subtree: true, characterData: true });
      }
      
      // Also listen to input events on the span's parent and all ancestors
      let parent = jexlSpan.parentElement;
      let depth = 0;
      while (parent && depth < 5) {
        parent.addEventListener('input', validate);
        parent.addEventListener('keyup', validate);
        parent.addEventListener('keydown', validate);
        parent.addEventListener('paste', () => setTimeout(validate, 10));
        parent = parent.parentElement;
        depth++;
      }
      
      // Also add a periodic check to catch any changes that might be missed
      const intervalId = setInterval(() => {
        const currentText = jexlSpan.textContent || jexlSpan.innerText || '';
        if (currentText !== (jexlSpan.dataset.lastValidatedText || '')) {
          jexlSpan.dataset.lastValidatedText = currentText;
          validate();
        }
      }, 500);
      
      // Store interval ID for cleanup
      jexlSpan.dataset.validationIntervalId = intervalId;
      
      // Run initial validation immediately if span already has content (including "true", "false", etc.)
      const immediateText = jexlSpan.textContent || jexlSpan.innerText || '';
      const trimmedText = immediateText.trim();
      if (trimmedText.length > 0) {
        jexlSpan.dataset.lastValidatedText = trimmedText;
        // Force validation immediately for initial values like "true"
        performValidation();
      }
      
      // Also run validation after a short delay to catch any delayed updates
      setTimeout(() => {
        const currentText = jexlSpan.textContent || jexlSpan.innerText || '';
        const currentTrimmed = currentText.trim();
        if (currentTrimmed.length > 0 && currentTrimmed !== (jexlSpan.dataset.lastValidatedText || '')) {
          jexlSpan.dataset.lastValidatedText = currentTrimmed;
          performValidation();
        }
      }, 200);
    } else if (editable.querySelector('span.mtk1') || editable.querySelector('.view-line')) {
      const observer = new MutationObserver(() => {
        validate();
      });
      observer.observe(editable, { childList: true, subtree: true, characterData: true });
      
      // Also watch view-line structure if it exists
      const viewLine = editable.querySelector('.view-line');
      if (viewLine) {
        observer.observe(viewLine, { childList: true, subtree: true, characterData: true });
      }
    }

    // Initial validation
    setTimeout(validate, 100);
    
    // If this is the JEXL Condition field, highlight it
    if (isJEXLField) {
      setTimeout(() => {
        activeJEXLField = input;
        highlightJEXLField();
      }, 200);
    } else {
      // Not a JEXL field, remove any validation styling
      indicator.style.display = 'none';
      if (editable.style) {
        editable.style.borderColor = '';
        editable.style.borderWidth = '';
        editable.style.boxShadow = '';
      }
    }
  }

  // Track the active JEXL field
  let activeJEXLField = null;

  // Create floating validation overlay
  let validationOverlay = null;
  let overlayVisible = false;
  
  function createValidationOverlay() {
    if (validationOverlay) return validationOverlay;

    validationOverlay = document.createElement('div');
    validationOverlay.className = 'ugs-validator-overlay';
    validationOverlay.style.display = 'none'; // Hidden by default
    validationOverlay.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="color: #0073e6;">UGS Validator</strong>
        <div style="display: flex; gap: 4px;">
          <button id="ugs-validator-scan" style="padding: 4px 8px; background: #0073e6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Scan Fields</button>
          <button id="ugs-validator-close" style="padding: 4px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">✕</button>
        </div>
      </div>
      <div class="ugs-validator-status" id="ugs-validator-status">
        <span>UGS Validator Ready</span>
      </div>
      <div style="margin: 12px 0; padding: 8px; background: #f8f9fa; border-radius: 4px;">
        <label style="display: block; font-size: 12px; font-weight: bold; margin-bottom: 4px; color: #333;">Test JEXL Expression:</label>
        <textarea id="ugs-validator-test-input" placeholder="Type JEXL here to validate..." style="width: 100%; min-height: 60px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
        <div id="ugs-validator-test-result" style="margin-top: 6px; font-size: 11px; min-height: 20px;"></div>
        <button id="ugs-validator-inject" style="margin-top: 8px; padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; width: 100%;">Inject into UGS Field</button>
      </div>
      <div class="ugs-validator-errors" id="ugs-validator-errors"></div>
    `;
    
    // Add scan button handler
    validationOverlay.querySelector('#ugs-validator-scan').addEventListener('click', () => {
      console.log('UGS Validator: Manual scan triggered');
      const inputs = findJEXLInputs();
      inputs.forEach(attachValidation);
      highlightJEXLField();
      const statusEl = validationOverlay.querySelector('#ugs-validator-status');
      statusEl.innerHTML = `<span>🔍 Scanned - Found ${inputs.length} field(s)</span>`;
    });
    
    // Add close button handler
    validationOverlay.querySelector('#ugs-validator-close').addEventListener('click', () => {
      hideValidationOverlay();
    });
    
    // Add test input validation
    const testInput = validationOverlay.querySelector('#ugs-validator-test-input');
    const testResult = validationOverlay.querySelector('#ugs-validator-test-result');
    
    testInput.addEventListener('input', () => {
      const expression = testInput.value;
      const result = validator.validate(expression);
      
      // Check if expression has UGS parameters
      const hasUGSParams = /\b(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/.test(expression);
      
      if (!result.valid || result.errors.length > 0) {
        testResult.innerHTML = `<span style="color: #dc3545;">❌ ${result.errors[0]?.message || 'Invalid JEXL'}</span>`;
        testInput.style.borderColor = '#dc3545';
      } else if (!hasUGSParams && expression.trim().length > 0) {
        testResult.innerHTML = `<span style="color: #dc3545;">❌ Expression must reference UGS/Wisdom parameters (e.g., user.sw_main_level == 4)</span>`;
        testInput.style.borderColor = '#dc3545';
      } else if (result.warnings.length > 0) {
        testResult.innerHTML = `<span style="color: #ffc107;">⚠️ ${result.warnings[0]?.message}</span>`;
        testInput.style.borderColor = '#ffc107';
      } else if (expression.trim().length > 0 && hasUGSParams) {
        testResult.innerHTML = `<span style="color: #28a745;">✅ Valid JEXL Expression</span>`;
        testInput.style.borderColor = '#28a745';
      } else {
        testResult.innerHTML = '';
        testInput.style.borderColor = '#ddd';
      }
    });
    
    // Add inject button handler
    validationOverlay.querySelector('#ugs-validator-inject').addEventListener('click', () => {
      const expression = testInput.value.trim();
      if (!expression) {
        alert('Please enter a JEXL expression first');
        return;
      }
      
      // Validate before injecting
      const result = validator.validate(expression);
      if (!result.valid || result.errors.length > 0) {
        if (!confirm(`This expression has errors:\n${result.errors[0]?.message}\n\nInject anyway?`)) {
          return;
        }
      }
      
      // Find and inject into the active JEXL field
      if (activeJEXLField) {
        activeJEXLField.value = expression;
        activeJEXLField.dispatchEvent(new Event('input', { bubbles: true }));
        activeJEXLField.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Trigger validation on the field
        const validateEvent = new Event('input', { bubbles: true });
        activeJEXLField.dispatchEvent(validateEvent);
        
        // Scroll to field and highlight it
        activeJEXLField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightJEXLField();
        
        console.log('UGS Validator: Injected expression into field:', expression);
        testResult.innerHTML = `<span style="color: #28a745;">✅ Injected into UGS field!</span>`;
      } else {
        // Try to find the field
        const inputs = findJEXLInputs();
        if (inputs.length > 0) {
          const field = inputs[0];
          field.value = expression;
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
          activeJEXLField = field;
          highlightJEXLField();
          testResult.innerHTML = `<span style="color: #28a745;">✅ Injected into UGS field!</span>`;
        } else {
          alert('Could not find JEXL input field. Please click "Scan Fields" first.');
        }
      }
    });
    
    document.body.appendChild(validationOverlay);
    return validationOverlay;
  }

  // Highlight the JEXL field
  function highlightJEXLField() {
    // Remove previous highlights
    document.querySelectorAll('.ugs-validator-highlight').forEach(el => {
      el.classList.remove('ugs-validator-highlight');
      el.style.outline = '';
      el.style.outlineOffset = '';
    });
    
    if (activeJEXLField) {
      activeJEXLField.classList.add('ugs-validator-highlight');
      activeJEXLField.style.outline = '4px solid #0073e6';
      activeJEXLField.style.outlineOffset = '2px';
      activeJEXLField.style.transition = 'outline 0.3s ease';
      
      // Scroll to it
      activeJEXLField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      console.log('UGS Validator: Highlighted field:', activeJEXLField);
    }
  }

  // Update validation overlay with results
  function updateValidationOverlay(result, expression = '') {
    if (!validationOverlay) {
      createValidationOverlay();
    }

    const statusEl = validationOverlay.querySelector('#ugs-validator-status');
    const errorsEl = validationOverlay.querySelector('#ugs-validator-errors');

    if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
      statusEl.className = 'ugs-validator-status valid';
      statusEl.innerHTML = '<span>✓ Valid JEXL Expression</span>';
      errorsEl.innerHTML = '';
    } else {
      statusEl.className = 'ugs-validator-status invalid';
      statusEl.innerHTML = `<span>✗ ${result.errors.length} Error(s), ${result.warnings.length} Warning(s)</span>`;
      
      let html = '';
      
      // Show errors
      result.errors.forEach(error => {
        html += `<div class="ugs-validator-error"><strong>Error:</strong> ${error.message}</div>`;
      });
      
      // Show warnings with parameter info
      result.warnings.forEach(warning => {
        let warningHtml = `<div class="ugs-validator-warning"><strong>Warning:</strong> ${warning.message}`;
        if (warning.parameter && typeof ParameterUtils !== 'undefined') {
          const param = ParameterUtils.findParameter(warning.parameter);
          if (param && param.example) {
            warningHtml += `<br><small style="color: #666;">Example: <code>${param.example}</code></small>`;
          }
        }
        warningHtml += '</div>';
        html += warningHtml;
      });
      
      // Show suggestions with examples
      result.suggestions.forEach(suggestion => {
        let suggestionHtml = `<div class="ugs-validator-suggestion"><strong>💡 Suggestion:</strong> ${suggestion.message}`;
        if (suggestion.examples && suggestion.examples.length > 0) {
          suggestionHtml += `<br><small style="color: #666;">Examples: ${suggestion.examples.map(e => `<code>${e}</code>`).join(', ')}</small>`;
        }
        suggestionHtml += '</div>';
        html += suggestionHtml;
      });
      
      errorsEl.innerHTML = html;
    }
  }

  // Create injected side panel
  let sidePanel = null;
  let panelVisible = false;
  
  function createSidePanel() {
    if (sidePanel) return sidePanel;
    
    // Adjust body margin to make room for panel
    const originalBodyMargin = document.body.style.marginRight || '';
    
    sidePanel = document.createElement('div');
    sidePanel.id = 'ugs-validator-side-panel';
    sidePanel.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 400px;
      height: 100vh;
      background: #ffffff;
      box-shadow: -2px 0 10px rgba(0,0,0,0.1);
      z-index: 999999;
      overflow: hidden;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Store original margin
    sidePanel.dataset.originalMargin = originalBodyMargin;
    
    // Get logo URL
    const logoUrl = chrome.runtime.getURL('assets/logo.png');
    const aiIconUrl = chrome.runtime.getURL('assets/ai_icon.svg');
    
    // Load Poppins font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
    
    // Add CSS for animations and panel input focus styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      /* Remove blue focus outline from all inputs and textareas in the panel */
      #ugs-side-panel input:focus,
      #ugs-side-panel textarea:focus {
        outline: none !important;
        box-shadow: none !important;
      }
      .ugs-convert-btn-animating {
        position: relative;
        overflow: visible !important;
        cursor: default !important;
        opacity: 0.9 !important;
      }
      .ugs-convert-btn-animating::before {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50px;
        background: linear-gradient(
          90deg,
          #FF4E21, #FFBA00, #10B981, #3B82F6, #FF4E21
        );
        background-size: 300% 300%;
        opacity: 1;
        pointer-events: none;
        -webkit-mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask:
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        mask-composite: exclude;
        padding: 3px;
        animation: borderShift 1s linear infinite;
        z-index: -1;
      }
      @keyframes borderShift {
        0% { background-position: 0% 50%; }
        100% { background-position: 100% 50%; }
      }
    `;
    document.head.appendChild(style);
    
    // Create panel HTML inline - Unity color scheme with glossy gradient background and tabs
    sidePanel.innerHTML = `
      <div style="position: relative; height: 100%; background: linear-gradient(135deg, rgba(255, 78, 33, 0.15) 0%, rgba(255, 186, 0, 0.32) 100%); display: flex; flex-direction: column; backdrop-filter: blur(10px);">
        <!-- Header Section -->
        <div style="padding: 20px 24px; border-bottom: 1px solid #e5e7eb; background: #ffffff; backdrop-filter: blur(10px);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${logoUrl}" alt="SmartConfig" style="width: 32px; height: 32px; object-fit: contain;">
              <h1 style="font-size: 18px; font-weight: 600; color: #1a1a1a; margin: 0; font-family: 'Poppins', sans-serif;">
                SmartConfig
              </h1>
            </div>
            <button id="ugs-panel-close" style="width: 32px; height: 32px; background: transparent; color: #6b7280; border: none; border-radius: 50%; cursor: pointer; font-size: 20px; font-weight: 300; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6'; this.style.transform='scale(1.1)'" onmouseout="this.style.background='transparent'; this.style.transform='scale(1)'">✕</button>
          </div>
        </div>
        
        <!-- Tabs Navigation -->
        <div style="display: flex; background: #ffffff; border-bottom: 1px solid #e5e7eb; padding: 0 24px;">
          <button id="ugs-tab-targeting" class="ugs-tab-btn" style="flex: 1; padding: 12px 16px; background: transparent; border: none; border-bottom: 3px solid #FF4E21; color: #FF4E21; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; font-family: 'Poppins', sans-serif;">Targeting</button>
          <button id="ugs-tab-content" class="ugs-tab-btn" style="flex: 1; padding: 12px 16px; background: transparent; border: none; border-bottom: 3px solid transparent; color: #6b7280; font-size: 14px; font-weight: 400; cursor: pointer; transition: all 0.2s; font-family: 'Poppins', sans-serif;">Content</button>
        </div>
        
        <!-- Main Content Area -->
        <div style="flex: 1; overflow-y: auto; padding: 20px 24px;">
          <!-- Targeting Tab Content -->
          <div id="ugs-tab-targeting-content" class="ugs-tab-content">
            <!-- Main Section: Free Text Input with AI and Validation Buttons -->
          <div style="background: rgba(255,255,255,0.9); border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); backdrop-filter: blur(10px);">
            <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Generate JEXL</h3>
            <div style="position: relative;">
              <textarea id="ugs-product-req" style="width: 100%; min-height: 120px; padding: 16px; padding-right: 40px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; resize: vertical; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; background: rgba(255,255,255,0.9); transition: border-color 0.2s;" placeholder="Enter your product requirement or JEXL expression here..." onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
              <button class="ugs-copy-btn" data-target="ugs-product-req" style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            
            <!-- AI Output Textarea (separate from input, appears after AI generation) -->
            <div id="ugs-ai-output-container" style="display: none; margin-top: 12px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">AI Generated JEXL (you can edit this):</label>
              <div style="position: relative;">
                <textarea id="ugs-ai-output" style="width: 100%; min-height: 100px; padding: 16px; padding-right: 40px; border: 2px solid #FF4E21; border-radius: 12px; font-size: 14px; resize: vertical; font-family: 'Monaco', 'Menlo', monospace; box-sizing: border-box; background: rgba(255,255,255,0.95); transition: border-color 0.2s;" placeholder="AI generated JEXL will appear here..." onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#FF4E21';"></textarea>
                <button class="ugs-copy-btn" data-target="ugs-ai-output" style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Button Row -->
            <div style="display: flex; gap: 12px; margin-top: 16px;">
              <!-- Validation Button (Secondary) -->
              <button id="ugs-validate-btn" style="flex: 1; padding: 12px 20px; background: #ffffff; color: #9ca3af; border: 2px solid #9ca3af; border-radius: 50px; cursor: not-allowed; font-size: 14px; font-weight: 400; transition: all 0.2s; opacity: 0.5; display: flex; align-items: center; justify-content: center; gap: 8px;" disabled>
                <span>Validate</span>
              </button>
              
              <!-- AI Generate Button (Primary) - on the right -->
              <button id="ugs-convert-btn" style="flex: 1; padding: 12px 20px; background: #ffffff; color: #000000; border: 2px solid #000000; border-radius: 50px; cursor: pointer; font-size: 14px; font-weight: 400; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; overflow: hidden;" onmouseover="if(!this.disabled) { this.style.background='#000000'; this.style.color='white'; this.style.borderColor='#000000'; this.style.borderWidth='2px'; this.style.transform='translateY(-2px)'; const icon = this.querySelector('#ugs-ai-star'); if(icon) icon.style.filter='brightness(0) saturate(100%) invert(100%)'; } else { this.style.cursor='not-allowed'; }" onmouseout="if(!this.disabled) { this.style.background='#ffffff'; this.style.color='#000000'; this.style.borderColor='#000000'; this.style.borderWidth='2px'; this.style.transform='translateY(0)'; const icon = this.querySelector('#ugs-ai-star'); if(icon) icon.style.filter='brightness(0) saturate(100%)'; } else { this.style.cursor='not-allowed'; }">
                <img id="ugs-ai-star" src="${aiIconUrl}" alt="AI" style="width: 16px; height: 16px; flex-shrink: 0; transition: transform 0.2s; filter: brightness(0) saturate(100%);">
                <span>AI Generate</span>
              </button>
            </div>
            
            <!-- Gemini API Key Section (below buttons) - only show if not set -->
            <div id="ugs-gemini-api-key-container" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(229,231,235,0.5); display: none;">
              <div style="position: relative;">
                <input type="password" id="ugs-gemini-api-key" style="width: 100%; padding: 10px; padding-right: 40px; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 12px; font-family: monospace; box-sizing: border-box; background: rgba(255,255,255,0.8);" placeholder="Gemini API Key (required for AI generate)" onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#e5e7eb';">
                <button class="ugs-copy-btn" data-target="ugs-gemini-api-key" style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <!-- Results -->
            <div id="ugs-convert-result" style="margin-top: 16px; padding: 12px; border-radius: 12px; font-size: 13px; display: none; line-height: 1.5;"></div>
            <div id="ugs-validation-result" style="margin-top: 12px; padding: 12px; border-radius: 12px; font-size: 13px; min-height: 20px; display: none; line-height: 1.5;"></div>
          </div>
          
          <!-- Remote Config Section (Collapsible) -->
          <div style="margin-bottom: 16px;">
            <details style="background: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.5); border-radius: 12px; overflow: hidden; backdrop-filter: blur(10px);">
              <summary style="padding: 12px 16px; font-size: 13px; font-weight: 500; color: #111827; cursor: pointer; list-style: none; display: flex; align-items: center; justify-content: space-between;">
                <span>Remote Config (for type validation)</span>
                <span style="color: #6b7280;">▼</span>
              </summary>
              <div style="padding: 16px; border-top: 1px solid rgba(229,231,235,0.5); overflow: hidden;">
                <div style="position: relative;">
                  <textarea id="ugs-remote-config" style="width: 100%; min-height: 120px; padding: 10px; padding-right: 40px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 11px; resize: vertical; font-family: 'Monaco', 'Menlo', monospace; background: rgba(255,255,255,0.9); box-sizing: border-box;" placeholder="Paste the remote config JSON here for type validation..." onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#d1d5db';"></textarea>
                  <button class="ugs-copy-btn" data-target="ugs-remote-config" style="position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <button id="ugs-save-config-btn" style="width: 100%; padding: 10px; margin-top: 12px; background: #ffffff; color: #FF4E21; border: 2px solid #9ca3af; border-radius: 50px; cursor: not-allowed; font-size: 13px; font-weight: 400; transition: all 0.2s; box-sizing: border-box; opacity: 0.5;" disabled onmouseover="if(!this.disabled) { this.style.background='#FF4E21'; this.style.color='white'; this.style.borderColor='#FF4E21'; this.style.transform='translateY(-2px)'; } else { this.style.cursor='not-allowed'; }" onmouseout="if(!this.disabled) { this.style.background='#ffffff'; this.style.color='#FF4E21'; this.style.borderColor='#FF4E21'; this.style.transform='translateY(0)'; } else { this.style.cursor='not-allowed'; }">Save Config</button>
                <div id="ugs-config-status" style="margin-top: 12px; padding: 12px; border-radius: 8px; font-size: 12px; display: none;"></div>
              </div>
            </details>
          </div>
          
          <!-- Inject Button -->
          <div style="margin-top: 20px;">
            <button id="ugs-inject-btn" style="width: 100%; padding: 14px 20px; background: #ffffff; color: #1a1a1a; border: 2px solid #9ca3af; border-radius: 50px; cursor: not-allowed; font-size: 15px; font-weight: 400; transition: all 0.2s; opacity: 0.5;" disabled onmouseover="if(!this.disabled) { this.style.background='#FF4E21'; this.style.color='white'; this.style.borderColor='#FF4E21'; this.style.transform='translateY(-2px)'; } else { this.style.cursor='not-allowed'; }" onmouseout="if(!this.disabled) { this.style.background='#FF4E21'; this.style.color='white'; this.style.borderColor='#FF4E21'; this.style.transform='translateY(0)'; } else { this.style.cursor='not-allowed'; }">Inject into JEXL Condition Field</button>
            <div id="ugs-inject-result" style="margin-top: 12px; padding: 12px; border-radius: 12px; font-size: 12px; display: none;"></div>
          </div>
          </div>
          
          <!-- Content Tab Content -->
          <div id="ugs-tab-content-content" class="ugs-tab-content" style="display: none;">
            <!-- Main Section: Free Text Input with AI Generate for JSON Config -->
            <div style="background: rgba(255,255,255,0.9); border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); backdrop-filter: blur(10px);">
              <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Generate JSON Config</h3>
              <div style="position: relative;">
                <textarea id="ugs-content-req" style="width: 100%; min-height: 120px; padding: 16px; padding-right: 40px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; resize: vertical; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; box-sizing: border-box; background: rgba(255,255,255,0.9); transition: border-color 0.2s;" placeholder="Enter your content requirement (e.g., 'disable extra hole feature' or 'enable extra hole with price 200')..." onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
                <button class="ugs-copy-btn" data-target="ugs-content-req" style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
              
              <!-- AI Output for Content -->
              <div id="ugs-content-ai-output-container" style="display: none; margin-top: 12px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">Config Key Name:</label>
                <div style="position: relative; margin-bottom: 12px;">
                  <input type="text" id="ugs-content-config-key" readonly style="width: 100%; padding: 10px; padding-right: 40px; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; font-family: 'Monaco', 'Menlo', monospace; box-sizing: border-box; background: rgba(255,255,255,0.95); color: #1a1a1a; font-weight: 600;" placeholder="Config key will appear here..." onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#e5e7eb';">
                  <button class="ugs-copy-btn" data-target="ugs-content-config-key" style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #6b7280; margin-bottom: 8px;">Config Value (you can edit this):</label>
                <div style="position: relative;">
                  <textarea id="ugs-content-ai-output" style="width: 100%; min-height: 150px; padding: 16px; padding-right: 40px; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 14px; resize: vertical; font-family: 'Monaco', 'Menlo', monospace; box-sizing: border-box; background: rgba(255,255,255,0.95); transition: border-color 0.2s;" placeholder="AI generated JSON config value will appear here..." onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#e5e7eb';"></textarea>
                  <button class="ugs-copy-btn" data-target="ugs-content-ai-output" style="position: absolute; top: 12px; right: 12px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <!-- AI Generate Button for Content -->
              <div style="display: flex; gap: 12px; margin-top: 16px;">
                <button id="ugs-content-convert-btn" style="flex: 1; padding: 12px 20px; background: #ffffff; color: #000000; border: 2px solid #000000; border-radius: 50px; cursor: pointer; font-size: 14px; font-weight: 400; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; position: relative; overflow: hidden;" onmouseover="if(!this.disabled) { this.style.background='#000000'; this.style.color='white'; this.style.borderColor='#000000'; this.style.borderWidth='2px'; this.style.transform='translateY(-2px)'; const icon = this.querySelector('#ugs-content-ai-star'); if(icon) icon.style.filter='brightness(0) saturate(100%) invert(100%)'; } else { this.style.cursor='not-allowed'; }" onmouseout="if(!this.disabled) { this.style.background='#ffffff'; this.style.color='#000000'; this.style.borderColor='#000000'; this.style.borderWidth='2px'; this.style.transform='translateY(0)'; const icon = this.querySelector('#ugs-content-ai-star'); if(icon) icon.style.filter='brightness(0) saturate(100%)'; } else { this.style.cursor='not-allowed'; }">
                  <img id="ugs-content-ai-star" src="${aiIconUrl}" alt="AI" style="width: 16px; height: 16px; flex-shrink: 0; transition: transform 0.2s; filter: brightness(0) saturate(100%);">
                  <span>AI Generate</span>
                </button>
              </div>
              
              <!-- Gemini API Key Section (below buttons) - only show if not set -->
              <div id="ugs-content-gemini-api-key-container" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(229,231,235,0.5); display: none;">
                <div style="position: relative;">
                  <input type="password" id="ugs-content-gemini-api-key" style="width: 100%; padding: 10px; padding-right: 40px; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 12px; font-family: monospace; box-sizing: border-box; background: rgba(255,255,255,0.8);" placeholder="Gemini API Key (required for AI generate)" onfocus="this.style.borderColor='#FF4E21'; this.style.outline='none';" onblur="this.style.borderColor='#e5e7eb';">
                  <button class="ugs-copy-btn" data-target="ugs-content-gemini-api-key" style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; background: rgba(255,255,255,0.9); border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; z-index: 10;" onmouseover="this.style.background='#f3f4f6'; this.style.borderColor='#9ca3af';" onmouseout="this.style.background='rgba(255,255,255,0.9)'; this.style.borderColor='#e5e7eb';" title="Copy to clipboard">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #6b7280;">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  </button>
                </div>
              </div>
              
              <!-- Results -->
              <div id="ugs-content-convert-result" style="margin-top: 16px; padding: 12px; border-radius: 12px; font-size: 13px; display: none; line-height: 1.5;"></div>
            </div>
            
              <!-- Inject Button for Content (hidden for now) -->
              <div style="margin-top: 20px; display: none;">
                <button id="ugs-content-inject-btn" style="width: 100%; padding: 14px 20px; background: #ffffff; color: #1a1a1a; border: 2px solid #9ca3af; border-radius: 50px; cursor: not-allowed; font-size: 14px; font-weight: 400; transition: all 0.2s; opacity: 0.5;" disabled onmouseover="if(!this.disabled) { this.style.background='#FF4E21'; this.style.color='white'; this.style.borderColor='#FF4E21'; this.style.transform='translateY(-2px)'; }" onmouseout="if(!this.disabled) { this.style.background='#FF4E21'; this.style.color='white'; this.style.borderColor='#FF4E21'; this.style.transform='translateY(0)'; }">Inject JSON Config</button>
                <div id="ugs-content-inject-result" style="margin-top: 12px; padding: 12px; border-radius: 12px; font-size: 12px; display: none;"></div>
              </div>
          </div>
        </div>
      </div>
    `;
    
    // Initialize panel functionality
    try {
      initPanelFunctionality();
    } catch (error) {
      console.error('UGS Validator: Error initializing panel functionality:', error);
      // Still append the panel even if initialization fails
    }
    
    document.body.appendChild(sidePanel);
    return sidePanel;
  }
  
  function initPanelFunctionality() {
    if (!sidePanel) {
      console.error('UGS Validator: sidePanel is null, cannot initialize functionality');
      return;
    }
    
    // Tab switching functionality
    const targetingTab = sidePanel.querySelector('#ugs-tab-targeting');
    const contentTab = sidePanel.querySelector('#ugs-tab-content');
    const targetingContent = sidePanel.querySelector('#ugs-tab-targeting-content');
    const contentContent = sidePanel.querySelector('#ugs-tab-content-content');
    
    if (!targetingTab || !contentTab || !targetingContent || !contentContent) {
      console.error('UGS Validator: Missing tab elements', {
        targetingTab: !!targetingTab,
        contentTab: !!contentTab,
        targetingContent: !!targetingContent,
        contentContent: !!contentContent
      });
      return;
    }
    
    // Auto-detect which tab to show based on UGS page state
    function detectActiveTab() {
      // Look for the H2 element with text "Content" in the UGS page
      // This indicates we're in the Content view
      const contentH2 = Array.from(document.querySelectorAll('h2.MuiTypography-h2, h2')).find(h2 => {
        const text = h2.textContent.trim();
        return text === 'Content';
      });
      
      // Also check for the specific div structure
      const contentDiv = document.querySelector('div[data-testid="stepper-title"] h2');
      const isContentView = contentH2 !== undefined || 
                          (contentDiv && contentDiv.textContent.trim() === 'Content');
      
      if (isContentView) {
        console.log('UGS Validator: Detected Content view, switching to Content tab');
        switchToContentTab();
      } else {
        console.log('UGS Validator: Detected Targeting view, switching to Targeting tab');
        switchToTargetingTab(); // Default to targeting
      }
    }
    
    function switchToTargetingTab() {
      targetingTab.style.borderBottomColor = '#FF4E21';
      targetingTab.style.color = '#FF4E21';
      targetingTab.style.fontWeight = '500'; // Poppins Medium
      contentTab.style.borderBottomColor = 'transparent';
      contentTab.style.color = '#6b7280';
      contentTab.style.fontWeight = '400'; // Poppins Regular
      targetingContent.style.display = 'block';
      contentContent.style.display = 'none';
    }
    
    function switchToContentTab() {
      contentTab.style.borderBottomColor = '#FF4E21';
      contentTab.style.color = '#FF4E21';
      contentTab.style.fontWeight = '500'; // Poppins Medium
      targetingTab.style.borderBottomColor = 'transparent';
      targetingTab.style.color = '#6b7280';
      targetingTab.style.fontWeight = '400'; // Poppins Regular
      contentContent.style.display = 'block';
      targetingContent.style.display = 'none';
    }
    
    targetingTab.addEventListener('click', switchToTargetingTab);
    contentTab.addEventListener('click', switchToContentTab);
    
    // Auto-detect tab on panel open
    detectActiveTab();
    
    // Monitor for changes to detect when user navigates between Content and Targeting views
    const observer = new MutationObserver(() => {
      if (panelVisible) {
        detectActiveTab();
      }
    });
    
    // Observe changes to the document body to detect when user navigates
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also check periodically when panel is visible (in case MutationObserver misses it)
    let tabCheckInterval = null;
    function startTabCheck() {
      if (tabCheckInterval) return;
      tabCheckInterval = setInterval(() => {
        if (panelVisible) {
          detectActiveTab();
        }
      }, 1000); // Check every second
    }
    
    function stopTabCheck() {
      if (tabCheckInterval) {
        clearInterval(tabCheckInterval);
        tabCheckInterval = null;
      }
    }
    
    // Store functions globally so showSidePanel/hideSidePanel can use them
    window.ugsTabCheckStart = startTabCheck;
    window.ugsTabCheckStop = stopTabCheck;
    
    // Get all panel elements with error handling
    const productReq = sidePanel.querySelector('#ugs-product-req');
    if (!productReq) {
      console.error('UGS Validator: Could not find #ugs-product-req element');
      return;
    }
    const aiOutputContainer = sidePanel.querySelector('#ugs-ai-output-container');
    const aiOutput = sidePanel.querySelector('#ugs-ai-output');
    
    // Auto-resize AI output textarea and validate when user edits it
    if (aiOutput) {
      aiOutput.addEventListener('input', () => {
        aiOutput.style.height = 'auto';
        aiOutput.style.height = Math.min(aiOutput.scrollHeight, 300) + 'px';
        
        // Validate AI output when user edits it
        if (aiOutput.value.trim().length > 0) {
          validateJEXLInPanel(aiOutput.value.trim());
        } else {
          currentValidJEXL = null;
          updateButtonStates();
        }
        updateButtonStates();
      });
    }
    
    // When main input changes, don't validate if AI output exists (prioritize AI output)
    productReq.addEventListener('input', () => {
      productReq.style.height = 'auto';
      productReq.style.height = Math.min(productReq.scrollHeight, 300) + 'px';
      
      // Only validate main input if there's no AI output
      // If AI output exists, keep validating that instead
      const hasAiOutput = aiOutput && aiOutput.value.trim().length > 0;
      if (!hasAiOutput) {
        // Clear results when typing in main input (only if no AI output)
        validationResult.style.display = 'none';
        convertResult.style.display = 'none';
        currentValidJEXL = null;
      }
      
      // Update button states
      updateButtonStates();
    });
    const convertBtn = sidePanel.querySelector('#ugs-convert-btn');
    const convertResult = sidePanel.querySelector('#ugs-convert-result');
    const validationResult = sidePanel.querySelector('#ugs-validation-result');
    const injectBtn = sidePanel.querySelector('#ugs-inject-btn');
    const injectResult = sidePanel.querySelector('#ugs-inject-result');
    const closeBtn = sidePanel.querySelector('#ugs-panel-close');
    const remoteConfigInput = sidePanel.querySelector('#ugs-remote-config');
    const configStatus = sidePanel.querySelector('#ugs-config-status');
    const saveConfigBtn = sidePanel.querySelector('#ugs-save-config-btn');
    const validateBtn = sidePanel.querySelector('#ugs-validate-btn');
    const geminiApiKeyInput = sidePanel.querySelector('#ugs-gemini-api-key');
    
    // Add copy button functionality for all copy buttons
    const copyButtons = sidePanel.querySelectorAll('.ugs-copy-btn');
    copyButtons.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        const targetElement = sidePanel.querySelector(`#${targetId}`);
        if (targetElement) {
          const textToCopy = targetElement.value || targetElement.textContent || '';
          if (!textToCopy.trim()) {
            btn.setAttribute('title', 'Nothing to copy');
            setTimeout(() => {
              btn.setAttribute('title', 'Copy to clipboard');
            }, 1500);
            return;
          }
          try {
            await navigator.clipboard.writeText(textToCopy);
            // Visual feedback
            const originalTitle = btn.getAttribute('title');
            btn.setAttribute('title', 'Copied!');
            btn.style.background = '#FF4E21';
            const svg = btn.querySelector('svg');
            if (svg) svg.style.color = 'white';
            setTimeout(() => {
              btn.setAttribute('title', originalTitle);
              btn.style.background = '';
              if (svg) svg.style.color = '#6b7280';
            }, 2000);
          } catch (err) {
            console.error('Failed to copy:', err);
            btn.setAttribute('title', 'Failed to copy');
            setTimeout(() => {
              btn.setAttribute('title', 'Copy to clipboard');
            }, 2000);
          }
        }
      });
    });
    
    // Track if AI is currently generating
    let isAIGenerating = false;
    
    // Store remote config for type validation
    let remoteConfigData = null;
    
    // Load Gemini API key from storage and show/hide input
    const geminiApiKeyContainer = sidePanel.querySelector('#ugs-gemini-api-key-container');
    function loadGeminiApiKey() {
      chrome.storage.local.get(['ugs_gemini_api_key'], (result) => {
        if (result.ugs_gemini_api_key && result.ugs_gemini_api_key.trim().length > 0) {
          geminiApiKeyInput.value = result.ugs_gemini_api_key;
          // Hide the input if key is set
          if (geminiApiKeyContainer) {
            geminiApiKeyContainer.style.display = 'none';
          }
        } else {
          // Show the input if key is not set
          if (geminiApiKeyContainer) {
            geminiApiKeyContainer.style.display = 'block';
          }
        }
      });
    }
    
    // Load on init
    loadGeminiApiKey();
    
    // Save Gemini API key to storage and update button state
    geminiApiKeyInput.addEventListener('input', () => {
      const apiKey = geminiApiKeyInput.value.trim();
      updateButtonStates();
      if (apiKey) {
        chrome.storage.local.set({ ugs_gemini_api_key: apiKey }, () => {
          console.log('UGS Validator: Gemini API key saved');
          // Hide the input after saving
          if (geminiApiKeyContainer) {
            geminiApiKeyContainer.style.display = 'none';
          }
        });
      } else {
        // Show the input if key is cleared
        if (geminiApiKeyContainer) {
          geminiApiKeyContainer.style.display = 'block';
        }
      }
    });
    
    geminiApiKeyInput.addEventListener('blur', () => {
      const apiKey = geminiApiKeyInput.value.trim();
      if (apiKey) {
        chrome.storage.local.set({ ugs_gemini_api_key: apiKey }, () => {
          console.log('UGS Validator: Gemini API key saved');
          // Hide the input after saving
          if (geminiApiKeyContainer) {
            geminiApiKeyContainer.style.display = 'none';
          }
        });
      } else {
        // Show the input if key is cleared
        if (geminiApiKeyContainer) {
          geminiApiKeyContainer.style.display = 'block';
        }
      }
    });
    
    // Load API key on panel open
    loadGeminiApiKey();
    
    // Update button states after loading API key
    setTimeout(() => {
      updateButtonStates();
      updateSaveConfigButton();
    }, 100);
    
    // Get project ID from URL for caching
    function getProjectId() {
      const url = window.location.href;
      const match = url.match(/projects\/([a-f0-9-]+)/i);
      return match ? match[1] : 'default';
    }
    
    // Load cached remote config on panel open
    function loadCachedRemoteConfig() {
      const projectId = getProjectId();
      chrome.storage.local.get([`ugs_remote_config_${projectId}`], (result) => {
        const cachedConfig = result[`ugs_remote_config_${projectId}`];
        if (cachedConfig) {
          remoteConfigInput.value = cachedConfig;
          // Parse and update global cache
          try {
            const config = JSON.parse(cachedConfig);
            if (config.attributes) {
              remoteConfigData = config.attributes;
              globalCachedRemoteConfig = config.attributes;
            }
          } catch (e) {
            console.error('UGS Validator: Error parsing cached config:', e);
          }
          // Trigger validation
          const event = new Event('input', { bubbles: true });
          remoteConfigInput.dispatchEvent(event);
          updateSaveConfigButton(); // Update button state when config is loaded
          configStatus.style.display = 'block';
          configStatus.style.background = 'transparent';
          configStatus.style.border = 'none';
          configStatus.style.color = '#6b7280';
          configStatus.textContent = 'Loaded cached config for this project';
          console.log('UGS Validator: Loaded cached remote config for project:', projectId);
        } else {
          updateSaveConfigButton(); // Update button state if no cached config
        }
      });
    }
    
    // Save remote config to cache
    function saveRemoteConfigToCache() {
      const configText = remoteConfigInput.value.trim();
      if (!configText) {
        configStatus.style.display = 'block';
        configStatus.style.background = 'transparent';
        configStatus.style.border = 'none';
        configStatus.style.color = '#6b7280';
        configStatus.textContent = '❌ No config to save';
        return;
      }
      
      try {
        const config = JSON.parse(configText);
        if (config.attributes) {
          const projectId = getProjectId();
          chrome.storage.local.set({
            [`ugs_remote_config_${projectId}`]: configText
          }, () => {
            // Update global cached config
            globalCachedRemoteConfig = config.attributes;
            configStatus.style.display = 'block';
            configStatus.style.background = 'transparent';
            configStatus.style.border = 'none';
            configStatus.style.color = '#6b7280';
            configStatus.textContent = `✓ Config saved for project ${projectId.substring(0, 8)}...`;
            console.log('UGS Validator: Saved remote config for project:', projectId);
          });
        } else {
          throw new Error('Invalid config format');
        }
      } catch (e) {
        configStatus.style.display = 'block';
        configStatus.style.background = 'transparent';
        configStatus.style.border = 'none';
        configStatus.style.color = '#6b7280';
        configStatus.textContent = '❌ Invalid JSON format - cannot save';
      }
    }
    
    // Update Save Config button state
    function updateSaveConfigButton() {
      const hasConfig = remoteConfigInput.value.trim().length > 0;
      saveConfigBtn.disabled = !hasConfig;
      if (hasConfig) {
        saveConfigBtn.style.background = '#ffffff';
        saveConfigBtn.style.color = '#FF4E21';
        saveConfigBtn.style.borderColor = '#FF4E21';
        saveConfigBtn.style.opacity = '1';
        saveConfigBtn.style.cursor = 'pointer';
      } else {
        saveConfigBtn.style.background = '#ffffff';
        saveConfigBtn.style.color = '#9ca3af';
        saveConfigBtn.style.borderColor = '#9ca3af';
        saveConfigBtn.style.opacity = '0.5';
        saveConfigBtn.style.cursor = 'not-allowed';
      }
    }
    
    // Save button click handler
    saveConfigBtn.addEventListener('click', saveRemoteConfigToCache);
    
    // Parse remote config on input
    remoteConfigInput.addEventListener('input', () => {
      updateSaveConfigButton();
      const configText = remoteConfigInput.value.trim();
      if (!configText) {
        configStatus.style.display = 'none';
        remoteConfigData = null;
        globalCachedRemoteConfig = null;
        return;
      }
      
      try {
        const config = JSON.parse(configText);
        if (config.attributes) {
          remoteConfigData = config.attributes;
          globalCachedRemoteConfig = config.attributes; // Update global cache
          configStatus.style.display = 'block';
          configStatus.style.background = 'transparent';
          configStatus.style.border = 'none';
          configStatus.style.color = '#6b7280';
          configStatus.textContent = '✓ Remote config loaded - type validation enabled';
          console.log('UGS Validator: Remote config loaded:', remoteConfigData);
        } else {
          throw new Error('Invalid config format');
        }
      } catch (e) {
        configStatus.style.display = 'block';
        configStatus.style.background = 'transparent';
        configStatus.style.border = 'none';
        configStatus.style.color = '#6b7280';
        configStatus.textContent = '❌ Invalid JSON format';
        remoteConfigData = null;
        globalCachedRemoteConfig = null;
      }
    });
    
    // Load cached config when panel opens
    loadCachedRemoteConfig();
    
    // Close button
    closeBtn.addEventListener('click', () => {
      hideSidePanel();
    });
    
    // Extract parameters from Remote Config JSON
    function extractParametersFromRemoteConfig() {
      const configText = remoteConfigInput.value.trim();
      if (!configText) {
        return '';
      }
      
      try {
        const config = JSON.parse(configText);
        if (!config.attributes) {
          return '';
        }
        
        const params = [];
        const attributes = config.attributes;
        
        // Extract user parameters
        if (attributes.user) {
          Object.keys(attributes.user).forEach(key => {
            const value = attributes.user[key];
            const valueType = typeof value;
            let example = '';
            
            if (valueType === 'string') {
              example = `user.${key} == '${value}'`;
            } else if (valueType === 'number') {
              example = `user.${key} == ${value}`;
            } else if (valueType === 'boolean') {
              example = `user.${key} == ${value}`;
            } else if (value === null) {
              example = `user.${key} == null`;
            } else {
              example = `user.${key} == ${JSON.stringify(value)}`;
            }
            
            params.push(`user.${key}\t${valueType === 'string' ? 'String value' : valueType === 'number' ? 'Numeric value' : valueType === 'boolean' ? 'Boolean value' : 'Value'}\t${example}`);
          });
        }
        
        // Extract app parameters
        if (attributes.app) {
          Object.keys(attributes.app).forEach(key => {
            const value = attributes.app[key];
            const valueType = typeof value;
            let example = '';
            
            if (valueType === 'string') {
              example = `app.${key} == '${value}'`;
            } else if (valueType === 'number') {
              example = `app.${key} == ${value}`;
            } else if (valueType === 'boolean') {
              example = `app.${key} == ${value}`;
            } else if (value === null) {
              example = `app.${key} == null`;
            } else {
              example = `app.${key} == ${JSON.stringify(value)}`;
            }
            
            params.push(`app.${key}\t${valueType === 'string' ? 'String value' : valueType === 'number' ? 'Numeric value' : valueType === 'boolean' ? 'Boolean value' : 'Value'}\t${example}`);
          });
        }
        
        // Extract unity parameters
        if (attributes.unity) {
          Object.keys(attributes.unity).forEach(key => {
            const value = attributes.unity[key];
            const valueType = typeof value;
            let example = '';
            
            if (valueType === 'string') {
              example = `unity.${key} == '${value}'`;
            } else if (valueType === 'number') {
              example = `unity.${key} == ${value}`;
            } else if (valueType === 'boolean') {
              example = `unity.${key} == ${value}`;
            } else if (value === null) {
              example = `unity.${key} == null`;
            } else {
              example = `unity.${key} == ${JSON.stringify(value)}`;
            }
            
            params.push(`unity.${key}\t${valueType === 'string' ? 'String value' : valueType === 'number' ? 'Numeric value' : valueType === 'boolean' ? 'Boolean value' : 'Value'}\t${example}`);
          });
        }
        
        if (params.length === 0) {
          return '';
        }
        
        return `\nContext from Remote Config (Example of valid parameters):\nID\tExplanation\tExample\n${params.join('\n')}\n`;
      } catch (e) {
        console.error('UGS Validator: Error parsing remote config for prompt:', e);
        return '';
      }
    }
    
    // Call Gemini API to convert product requirement to JEXL
    async function convertRequirementToJEXLWithGemini(requirement) {
      const apiKey = geminiApiKeyInput.value.trim();
      
      if (!apiKey) {
        throw new Error('Please enter your Gemini API key to use AI generate');
      }
      
      // Build the prompt
      const basePrompt = `Act as an expert Unity Game Services (UGS) developer. Your task is to generate JEXL conditions for Game Overrides based strictly on the context provided below.

Rules:
Schema Adherence: Only use parameters found in the 'ID' column of the provided context.

Naming Convention: Maintain the exact prefix provided (e.g., user., app., unity., or custom.).

Logic: Use standard JEXL operators: ==, !=, >, <, >=, <=, &&, ||, and =~ (for regex).

Strings: Always wrap string values in single quotes (e.g., 'Android').

No Hallucinations: If a requested metric (like 'country') is not in the context list, inform me instead of guessing.

Context List:`;

      // Extract parameters from Remote Config
      const remoteConfigContext = extractParametersFromRemoteConfig();
      
      // Static context list
      const staticContext = `
ID	Explanation	Example
user.sw_total_revenue	Total revenue from all sources.	user.sw_total_revenue > 0
user.sw_iap_ltv	Lifetime value from in-app purchases.	user.sw_iap_ltv > 0
user.sw_ads_ltv	Lifetime value from ads.	user.sw_ads_ltv > 0
user.sw_total_iap_revenue	Total IAP revenue.	user.sw_total_iap_revenue > 0
user.sw_total_iap_transactions	Total IAP transactions.	user.sw_total_iap_transactions > 0
user.sw_avg_last_3_iap_revenue	Avg revenue from last 3 IAPs.	user.sw_avg_last_3_iap_revenue > 0
user.sw_avg_last_7_iap_revenue	Avg revenue from last 7 IAPs.	user.sw_avg_last_7_iap_revenue > 0
user.sw_total_last_14d_iap_revenue	Total IAP revenue in last 14 days.	user.sw_total_last_14d_iap_revenue > 0
user.sw_total_last_14d_iap_transactions	Total IAP transactions in last 14 days.	user.sw_total_last_14d_iap_transactions > 0
user.sw_avg_last_3_iap_refunds	Avg refunds from last 3 IAPs.	user.sw_avg_last_3_iap_refunds > 0
user.sw_avg_last_7_iap_refunds	Avg refunds from last 7 IAPs.	user.sw_avg_last_7_iap_refunds > 0
user.sw_total_last_14d_iap_refunds	Total refunds in last 14 days.	user.sw_total_last_14d_iap_refunds > 0
user.sw_total_last_14d_iap_refund_transactions	Total refund transactions in last 14 days.	user.sw_total_last_14d_iap_refund_transactions > 0
user.sw_main_level	Main level (custom game attribute).	user.sw_main_level == 0
user.sw_secondary_level	Secondary level (custom game attribute).	user.sw_secondary_level == 1
app.sw_user_bucket	User bucket for segmentation.	app.sw_user_bucket == 3
user.sw_session_counter	Number of sessions.	user.sw_session_counter >= 3
user.sw_mega_playtime	Mega playtime (custom game metric).	user.sw_mega_playtime > 50
user.sw_total_neto_playtime	Total net playtime.	user.sw_total_neto_playtime > 100
user.sw_game_session_duration_netto	Net duration of a game session.	user.sw_game_session_duration_netto == 21
user.sw_acquisition_channel	User acquisition channel.	user.sw_acquisition_channel == 'Empty'
user.sw_acquisition_campaign_id	User acquisition campaign ID.	user.sw_acquisition_campaign_id == 'Empty'
user.sw_acquisition_network	Acquisition network.	user.sw_acquisition_network == 'Empty'
user.sw_acquisition_campaign_name	Campaign name.	user.sw_acquisition_campaign_name == 'Empty'
user.sw_acquisition_campaign_type	Campaign type.	user.sw_acquisition_campaign_type == 'Empty'
app.isTriggered	Whether an app event was triggered.	app.isTriggered == true
user.sw_balance_hc	Hard currency balance.	user.sw_balance_hc == 0
user.sw_balance_soft_a	Soft currency A balance.	user.sw_balance_soft_a == 0
user.sw_balance_soft_b	Soft currency B balance.	user.sw_balance_soft_b == 0
user.sw_balance_soft_c	Soft currency C balance.	user.sw_balance_soft_c == 0
user.sw_age	User age.	user.sw_age == 0
user.sw_mega_session_counter	Mega session counter.	user.sw_mega_session_counter >= 3
user.sw_total_ltv_game_failure	Total LTV from game failures.	user.sw_total_ltv_game_failure == 0
user.sw_total_ltv_game_session	Total LTV from game sessions.	user.sw_total_ltv_game_session == 3
user.sw_session_in_mega_counter	Number of sessions in mega mode.	user.sw_session_in_mega_counter == 2
user.sw_game_session_duration_brutto	Brutto duration of a game session.	user.sw_game_session_duration_brutto == 21
user.sw_days_since_last_purchase	Days since last purchase.	user.sw_days_since_last_purchase == -1
user.sw_acquisition_cost	User acquisition cost.	user.sw_acquisition_cost > 0
user.sw_acquisition_cost_currency	Acquisition cost currency.	user.sw_acquisition_cost_currency == 'Empty'
unity.appVersion	The version of the application as defined in Player Settings.	unity.appVersion == '1.0.0'
user.appVersion	The version of the application.	unity.appVersion == '1.0.0'
unity.appBuildVersion	The build version of the application.	unity.appBuildVersion == '1234'
app.sw_install_app_version	App version at install.	app.sw_install_app_version == '8.8.8'
app.sw_install_date	Date when app was installed.	app.sw_install_date == '2025-08-12'
app.sw_active_day	Number of days since app active.	app.sw_active_day >= 1
user.sw_days_since_install	Days since app was installed.	user.sw_days_since_install == 0
unity.appInstallMode	How the app was installed.	unity.appInstallMode == 'Store'
unity.appInstallStore	Name of the install store.	unity.appInstallStore == 'com.google.android.packageinstaller'
custom	Custom keys defined by the developer.	custom.myKey == 'custom_value'
app.segment_app_attribute	Custom segment attribute for app.	app.segment_app_attribute == 0
user.segment_user_attribute	Custom segment attribute for user.	user.segment_user_attribute == 3
unity.rootedJailbroken	Whether the device is rooted/jailbroken.	unity.rootedJailbroken == false
unity.deviceModel	The model of the device running the application.	unity.deviceModel == 'iPhone10,1'
unity.model	Device model and manufacturer.	unity.model == 'Google/Pixel 8/shiba'
unity.deviceType	The type of device.	unity.deviceType == 'Handheld'
unity.deviceName	The name of the device.	unity.deviceName == "John's iPhone"
unity.cpu	The CPU type of the device.	unity.cpu == 'ARM64'
unity.cpu	The CPU type and features.	unity.cpu == 'ARM64'
unity.cpuCount	Number of CPU cores.	unity.cpuCount >= 8
unity.cpuFrequency	CPU frequency in MHz.	unity.cpuFrequency >= 2000
unity.totalMemory	The total memory of the device in MB.	unity.totalMemory > 2048
unity.systemMemorySize	The size of the system memory in MB.	unity.systemMemorySize >= 4096
unity.ram	Total RAM in MB.	unity.ram >= 4000
unity.graphicsMemorySize	The size of the graphics memory in MB.	unity.graphicsMemorySize >= 256
unity.vram	Total VRAM in MB.	unity.vram >= 4000
unity.screen	Screen resolution and refresh rate.	unity.screen == '1080 x 2400 @ 60Hz'
unity.dpi	Device screen DPI.	unity.dpi >= 300
unity.platform	The platform the application is running on.	0
unity.operatingSystemFamily	The OS family.	unity.operatingSystemFamily == 'MacOS'
unity.osVersion	The version of the operating system.	unity.osVersion == 'iOS 14.4'
unity.osVersion	The OS version of the device.	unity.osVersion == 'iOS 14.4'
unity.graphicsDeviceName	The name of the graphics device.	unity.graphicsDeviceName == 'NVIDIA GeForce GTX 1080'
unity.graphicsName	Graphics device name.	unity.graphicsName == 'Mali-G715'
unity.appName	Application package name.	unity.appName == 'com.montanastudios.blastmosaic'
unity.graphicsDeviceType	The type of graphics device.	unity.graphicsDeviceType == 'Direct3D11'
unity.graphicsDeviceId	Graphics device ID.	unity.graphicsDeviceId == -1197342720
unity.graphicsDeviceVendorId	Graphics vendor ID.	unity.graphicsDeviceVendorId == 5045
unity.graphicsDeviceVendor	Graphics vendor name.	unity.graphicsDeviceVendor == 'ARM'
unity.deviceUniqueIdentifier	A unique identifier for the device.	unity.deviceUniqueIdentifier == 'abc123xyz'
unity.userId	The user identifier (if set by developer).	unity.userId == 'user_001'
unity.language	The language the application is running in.	unity.language == 'en'
unity.language	Device language.	unity.language == 'en'
unity.graphicsVersion	Graphics API version.	unity.graphicsVersion == 'Vulkan 1.1.0 [53.0.0 (0x0d400000)]'
unity.graphicsShader	Graphics shader version.	unity.graphicsShader == 50
unity.maxTextureSize	Maximum supported texture size (pixels).	unity.maxTextureSize >= 4096
user.momentum_sdk_version	Version of Momentum SDK (if present).	user.momentum_sdk_version == null
user.sw_acquisition_creative_id	User acquisition creative ID.	user.sw_acquisition_creative_id == 'Empty'`;

      // Combine all parts
      const prompt = `${basePrompt}${remoteConfigContext}${staticContext}

IMPORTANT: You MUST only use parameters from the two context lists above (Remote Config context and Static context). Do not use any parameters that are not listed in these contexts.

The Task:
Convert the following natural language intent into a single-line JEXL condition: 'Target users with ${requirement}'

Return ONLY the JEXL expression, nothing else. No explanations, no markdown, just the JEXL condition.`;

      // Use gemini-1.5-flash for faster responses, or gemini-1.5-pro for better quality
      const modelName = 'gemini-2.5-flash'; // Can be changed to 'gemini-1.5-pro' for better quality
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const jexlExpression = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!jexlExpression) {
        throw new Error('No JEXL expression returned from Gemini');
      }
      
      // Clean up the response - remove markdown code blocks if present
      return jexlExpression.replace(/^```[\w]*\n?/g, '').replace(/\n?```$/g, '').trim();
    }
    
    // Convert product requirement to JEXL
    convertBtn.addEventListener('click', async () => {
      const requirement = productReq.value.trim();
      if (!requirement) {
        convertResult.style.display = 'block';
        convertResult.className = 'result error';
        convertResult.style.background = '#f8d7da';
        convertResult.style.color = '#721c24';
        convertResult.textContent = 'Please enter a product requirement';
        return;
      }

      // Show loading state with colorful border animation
      if (convertBtn.classList.contains('ugs-convert-btn-animating')) return; // Prevent double click
      
      // Set AI generating flag
      isAIGenerating = true;
      
      // Update button states to show disabled state with gray styling
      updateButtonStates();
      
      convertBtn.classList.add('ugs-convert-btn-animating');
      convertBtn.innerHTML = '<span>Generating...</span>';
      convertResult.style.display = 'none'; // Hide the blue notifier
      
      try {
        const jexl = await convertRequirementToJEXLWithGemini(requirement);
        
        convertResult.style.background = 'transparent';
        convertResult.style.border = 'none';
        convertResult.style.color = '#6b7280';
        convertResult.innerHTML = `✓ Converted to JEXL`;
        
        // Show AI output container and populate it (don't override main input)
        aiOutputContainer.style.display = 'block';
        aiOutput.value = jexl;
        aiOutput.style.height = 'auto';
        aiOutput.style.height = Math.min(aiOutput.scrollHeight, 300) + 'px';
        
        // Validate the AI output
        validateJEXLInPanel(jexl);
      } catch (error) {
        console.error('UGS Validator: Gemini conversion error:', error);
        convertResult.style.background = 'transparent';
        convertResult.style.border = 'none';
        convertResult.style.color = '#6b7280';
        convertResult.textContent = `❌ Error: ${error.message}`;
        
        // Fallback to simple conversion if API fails
        const fallbackJexl = convertRequirementToJEXL(requirement);
        if (fallbackJexl) {
          convertResult.innerHTML += `<br><br>💡 Fallback result`;
          
          // Show AI output container and populate it (don't override main input)
          aiOutputContainer.style.display = 'block';
          aiOutput.value = fallbackJexl;
          aiOutput.style.height = 'auto';
          aiOutput.style.height = Math.min(aiOutput.scrollHeight, 300) + 'px';
          
          // Don't call updateButtonStates here - wait until finally block
          validateJEXLInPanel(fallbackJexl);
        }
      } finally {
        // Clear AI generating flag
        isAIGenerating = false;
        
        convertBtn.classList.remove('ugs-convert-btn-animating');
        const starImg = document.createElement('img');
        starImg.id = 'ugs-ai-star';
        starImg.src = chrome.runtime.getURL('assets/ai_icon.svg');
        starImg.alt = 'AI';
        // Icon filter will be set by updateButtonStates() based on disabled state
        starImg.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; transition: transform 0.2s; filter: brightness(0) saturate(100%);';
        const span = document.createElement('span');
        span.textContent = 'AI Generate';
        convertBtn.innerHTML = '';
        convertBtn.appendChild(starImg);
        convertBtn.appendChild(span);
        
        // Re-enable all buttons - restore their proper states
        updateButtonStates(); // This will handle the disabled state properly based on current conditions
        
        // Re-attach hover event for transform (no spin animation)
        convertBtn.onmouseover = function() {
          if(!this.disabled) {
            this.style.background = '#000000';
            this.style.color = 'white';
            this.style.borderColor = '#000000';
            this.style.transform = 'translateY(-2px)';
            const icon = this.querySelector('#ugs-ai-star');
            if (icon) icon.style.filter = 'brightness(0) saturate(100%) invert(100%)'; // White icon on black background
          } else {
            this.style.cursor = 'not-allowed';
          }
        };
        convertBtn.onmouseout = function() {
          if(!this.disabled) {
            this.style.background = '#ffffff';
            this.style.color = '#000000';
            this.style.borderColor = '#000000';
            this.style.transform = 'translateY(0)';
            const icon = this.querySelector('#ugs-ai-star');
            if (icon) icon.style.filter = 'brightness(0) saturate(100%)'; // Black icon on white background
          } else {
            this.style.cursor = 'not-allowed';
          }
        };
      }
    });

    // Track current valid JEXL expression for injection
    let currentValidJEXL = null;
    
    // Update button states
    function updateButtonStates() {
      const hasInput = productReq.value.trim().length > 0;
      const hasAiOutput = aiOutput && aiOutput.value.trim().length > 0;
      const hasApiKey = geminiApiKeyInput.value.trim().length > 0;
      
      // Update Validate button - keep disabled if AI is generating
      if (isAIGenerating) {
        validateBtn.disabled = true;
        validateBtn.style.setProperty('background', '#ffffff', 'important');
        validateBtn.style.setProperty('color', '#9ca3af', 'important');
        validateBtn.style.setProperty('border-color', '#9ca3af', 'important');
        validateBtn.style.setProperty('opacity', '0.5', 'important');
        validateBtn.style.setProperty('cursor', 'not-allowed', 'important');
        // Remove hover handlers when disabled
        validateBtn.onmouseover = null;
        validateBtn.onmouseout = null;
      } else {
        // Enable validate if there's input in either main textarea or AI output
        const hasAnyInput = hasInput || hasAiOutput;
        validateBtn.disabled = !hasAnyInput;
        if (hasAnyInput) {
          validateBtn.style.setProperty('background', '#ffffff', 'important');
          validateBtn.style.setProperty('color', '#FF4E21', 'important');
          validateBtn.style.setProperty('border-color', '#FF4E21', 'important');
          validateBtn.style.setProperty('opacity', '1', 'important');
          validateBtn.style.setProperty('cursor', 'pointer', 'important');
          // Add hover handlers when enabled
          validateBtn.onmouseover = function() {
            if(!this.disabled) {
              this.style.setProperty('background', '#FF4E21', 'important');
              this.style.setProperty('color', 'white', 'important');
              this.style.setProperty('border-color', '#FF4E21', 'important');
              this.style.setProperty('transform', 'translateY(-2px)', 'important');
            } else {
              this.style.setProperty('cursor', 'not-allowed', 'important');
            }
          };
          validateBtn.onmouseout = function() {
            if(!this.disabled) {
              this.style.setProperty('background', '#ffffff', 'important');
              this.style.setProperty('color', '#FF4E21', 'important');
              this.style.setProperty('border-color', '#FF4E21', 'important');
              this.style.setProperty('transform', 'translateY(0)', 'important');
            } else {
              this.style.setProperty('cursor', 'not-allowed', 'important');
            }
          };
        } else {
          validateBtn.style.setProperty('background', '#ffffff', 'important');
          validateBtn.style.setProperty('color', '#9ca3af', 'important');
          validateBtn.style.setProperty('border-color', '#9ca3af', 'important');
          validateBtn.style.setProperty('opacity', '0.5', 'important');
          validateBtn.style.setProperty('cursor', 'not-allowed', 'important');
          // Remove hover handlers when disabled
          validateBtn.onmouseover = null;
          validateBtn.onmouseout = null;
        }
      }
      
      // Update AI Generate button (disabled if no API key OR no input OR currently generating)
      const canUseAI = hasApiKey && hasInput && !isAIGenerating;
      convertBtn.disabled = !canUseAI;
      const icon = convertBtn.querySelector('#ugs-ai-star');
      if (canUseAI) {
        convertBtn.style.opacity = '1';
        convertBtn.style.cursor = 'pointer';
        convertBtn.style.background = '#ffffff';
        convertBtn.style.color = '#000000';
        convertBtn.style.borderColor = '#000000';
        convertBtn.style.borderWidth = '2px';
        if (icon) icon.style.filter = 'brightness(0) saturate(100%)'; // Black icon to match black text
      } else {
        convertBtn.style.opacity = '0.5';
        convertBtn.style.cursor = 'not-allowed';
        convertBtn.style.background = '#ffffff';
        convertBtn.style.color = '#9ca3af';
        convertBtn.style.borderColor = '#9ca3af';
        convertBtn.style.borderWidth = '2px';
        if (icon) icon.style.filter = 'brightness(0) saturate(100%) opacity(0.6)'; // Gray icon to match gray text (#9ca3af)
      }
      
      // Update Inject button (only enabled if there's valid JEXL)
      if (currentValidJEXL && currentValidJEXL.trim().length > 0) {
        injectBtn.disabled = false;
        injectBtn.style.background = '#FF4E21';
        injectBtn.style.color = 'white';
        injectBtn.style.borderColor = '#FF4E21';
        injectBtn.style.cursor = 'pointer';
        injectBtn.style.opacity = '1';
      } else {
        injectBtn.disabled = true;
        injectBtn.style.background = '#ffffff';
        injectBtn.style.color = '#1a1a1a';
        injectBtn.style.borderColor = '#9ca3af';
        injectBtn.style.cursor = 'not-allowed';
        injectBtn.style.opacity = '0.5';
      }
      
      // Update Content tab AI Generate button (disabled if no API key OR no input OR currently generating)
      updateContentAIButtonState();
    }
    
    // Function to update Content tab AI button state
    function updateContentAIButtonState() {
      if (contentConvertBtn && contentReq) {
        const hasContentInput = contentReq.value.trim().length > 0;
        const hasContentApiKey = contentGeminiApiKeyInput ? contentGeminiApiKeyInput.value.trim().length > 0 : false;
        // Also check storage for API key
        chrome.storage.local.get(['geminiApiKey', 'ugs_gemini_api_key'], (result) => {
          const storedApiKey = result.geminiApiKey || result.ugs_gemini_api_key || '';
          const canUseContentAI = (hasContentApiKey || storedApiKey) && hasContentInput && !isContentAIGenerating;
          contentConvertBtn.disabled = !canUseContentAI;
          if (canUseContentAI) {
            contentConvertBtn.style.opacity = '1';
            contentConvertBtn.style.cursor = 'pointer';
            contentConvertBtn.style.background = '#ffffff';
            contentConvertBtn.style.color = '#000000';
            contentConvertBtn.style.borderColor = '#000000';
            contentConvertBtn.style.borderWidth = '2px';
            const icon = contentConvertBtn.querySelector('#ugs-content-ai-star');
            if (icon) icon.style.filter = 'brightness(0) saturate(100%)'; // Black icon to match black text
          } else {
            contentConvertBtn.style.opacity = '0.5';
            contentConvertBtn.style.cursor = 'not-allowed';
            contentConvertBtn.style.background = '#ffffff';
            contentConvertBtn.style.color = '#9ca3af';
            contentConvertBtn.style.borderColor = '#9ca3af';
            contentConvertBtn.style.borderWidth = '2px';
            const icon = contentConvertBtn.querySelector('#ugs-content-ai-star');
            if (icon) icon.style.filter = 'brightness(0) saturate(100%) opacity(0.6)'; // Gray icon to match gray text (#9ca3af)
          }
        });
      }
    }
    
    // Auto-resize textarea is handled above in the aiOutput setup section
    
    // Content tab elements
    const contentReq = sidePanel.querySelector('#ugs-content-req');
    const contentAiOutputContainer = sidePanel.querySelector('#ugs-content-ai-output-container');
    const contentAiOutput = sidePanel.querySelector('#ugs-content-ai-output');
    const contentConfigKey = sidePanel.querySelector('#ugs-content-config-key');
    const contentConvertBtn = sidePanel.querySelector('#ugs-content-convert-btn');
    const contentConvertResult = sidePanel.querySelector('#ugs-content-convert-result');
    const contentInjectBtn = sidePanel.querySelector('#ugs-content-inject-btn');
    const contentInjectResult = sidePanel.querySelector('#ugs-content-inject-result');
    const contentGeminiApiKeyInput = sidePanel.querySelector('#ugs-content-gemini-api-key');
    const contentGeminiApiKeyContainer = sidePanel.querySelector('#ugs-content-gemini-api-key-container');
    
    // Track if Content AI is generating
    let isContentAIGenerating = false;
    
    // Call Gemini API to convert content requirement to JSON config
    async function convertContentRequirementToJSON(requirement) {
      // Get API key from storage or input
      let apiKey = contentGeminiApiKeyInput ? contentGeminiApiKeyInput.value.trim() : '';
      if (!apiKey) {
        // Try to get from storage
        const stored = await new Promise((resolve) => {
          chrome.storage.local.get(['geminiApiKey', 'ugs_gemini_api_key'], (result) => {
            resolve(result.geminiApiKey || result.ugs_gemini_api_key || '');
          });
        });
        apiKey = stored;
      }
      
      if (!apiKey) {
        // Show the input if key is not set
        if (contentGeminiApiKeyContainer) {
          contentGeminiApiKeyContainer.style.display = 'block';
        }
        throw new Error('Please enter your Gemini API key to use AI generate');
      }
      
      // Build the prompt for Content tab with both features
      const prompt = `You are a configuration generator for a game feature system.

Goal:
Convert the user's free-text request into a single feature-config entry. Based on the user's request, determine which feature they want to configure and generate the appropriate JSON.

Available Features:

1. Extra Hole Feature
   - Config key: "addHoleConfig"
   - Value schema (object):
     - enabled: boolean (required)
     - boosterPrice: number (required)
   - Examples:
     - {"addHoleConfig": {"enabled": false, "boosterPrice": 65}}
     - {"addHoleConfig": {"enabled": true, "boosterPrice": 160}}

2. Boxes Sale Feature
   - Config key: "boxesSaleConfig"
   - Value schema (object):
     - enabled: boolean (required)
     - startDate: string (required, format: "YYYY-MM-DD")
     - endDate: string (required, format: "YYYY-MM-DD")
     - eventStartTime: string (required, format: "HH:MM")
     - eventEndTime: string (required, format: "HH:MM")
     - timerDuration: string (required, format: "HH:MM")
     - priceConfiguration: object (required)
       - oldPrice: number (required)
       - newPrice: number (required)
       - discountValue: number (required)
     - durationOfPurchasedBoxes: string (required, format: "HH:MM")
     - availableClaims: number (required)
     - cooldown: number (required, in minutes)
     - enableLevel: number (required)
   - Examples:
     - {"boxesSaleConfig": {"enabled": false, "startDate": "2025-08-03", "endDate": "2025-08-31", "eventStartTime": "06:00", "eventEndTime": "22:00", "timerDuration": "01:00", "priceConfiguration": {"oldPrice": 400, "newPrice": 300, "discountValue": 25}, "durationOfPurchasedBoxes": "10:00", "availableClaims": 3, "cooldown": 60, "enableLevel": 4}}
     - {"boxesSaleConfig": {"enabled": true, "startDate": "2025-09-02", "endDate": "2025-09-02", "eventStartTime": "06:00", "eventEndTime": "22:00", "timerDuration": "01:00", "priceConfiguration": {"oldPrice": 400, "newPrice": 300, "discountValue": 25}, "durationOfPurchasedBoxes": "10:00", "availableClaims": 3, "cooldown": 60, "enableLevel": 4}}

Rules:
1) Output MUST be valid JSON only. No markdown, no explanations.
2) Output MUST include exactly one top-level key: either "addHoleConfig" or "boxesSaleConfig".
3) Determine which feature based on keywords:
   - "hole", "extra hole", "add hole" => use "addHoleConfig"
   - "box", "boxes", "sale", "boxes sale" => use "boxesSaleConfig"
   - If unclear, default to "addHoleConfig" and set "needsClarification": true
4) For addHoleConfig:
   - Determine "enabled": enable/turn on/activate/show/available => true, disable/turn off/not available/remove => false
   - Determine "boosterPrice": use mentioned price, or defaults (enabled=false => 65, enabled=true => 160)
5) For boxesSaleConfig:
   - Determine "enabled" same as above
   - Extract dates, times, prices, and other parameters from user text
   - Use reasonable defaults if not specified:
     - startDate/endDate: Use the ACTUAL CURRENT DATE when the user says "today", "starting today", "from today", etc. Do NOT use your training date. If user says "next week", calculate 7 days from current date. Format: "YYYY-MM-DD"
     - eventStartTime: "06:00", eventEndTime: "22:00"
     - timerDuration: "01:00"
     - priceConfiguration: oldPrice=400, newPrice=300, discountValue=25 (or extract from text)
     - durationOfPurchasedBoxes: "10:00"
     - availableClaims: 3 (or extract from text if mentioned)
     - cooldown: Number in MINUTES (required). User input is in minutes or hours, so convert: "1 hour" = 60 minutes, "75 minutes" = 75 minutes, "60 minutes" = 60 minutes. Default: 60 minutes if not specified.
     - enableLevel: Number representing the minimum level from which this feature is available. If user says "from level 6" or "level 6 and above", use 6. If user says "level 4", use 4. Default: 4 if not specified.
6) If ambiguity exists (conflicting instructions or missing enable/disable intent), add "needsClarification": true and "clarificationQuestion" with one question. Otherwise do NOT include those keys.

IMPORTANT NOTES:
- Current date: ${new Date().toISOString().split('T')[0]} (use this when user says "today", "starting today", "from today")
- cooldown: The value in the schema is in MINUTES. User input may be in minutes or hours, so convert accordingly. Examples: "1 hour" = 60 minutes, "75 minutes" = 75 minutes, "60 minutes" = 60 minutes. Do NOT convert to seconds.
- enableLevel: This represents the minimum level from which the feature is available. If user says "from level 6" or "level 6 and above", the value should be 6. If user says "level 4", use 4.

Input (free text): ${requirement}

Output format: Return ONLY a JSON object with exactly one top-level key (either "addHoleConfig" or "boxesSaleConfig") and its value object.`;

      // Use gemini-2.5-flash for faster responses
      const modelName = 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const jsonConfig = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!jsonConfig) {
        throw new Error('No JSON config returned from Gemini');
      }
      
      console.log('UGS Validator: Raw Gemini response:', jsonConfig);
      
      // Clean up the response - remove markdown code blocks if present
      // Handle both ```json and ``` formats, and remove leading/trailing whitespace
      let cleaned = jsonConfig.trim();
      
      // Remove markdown code blocks - handle multiple formats
      if (cleaned.startsWith('```')) {
        // Remove opening ```json or ```
        cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '');
        // Remove closing ```
        cleaned = cleaned.replace(/\s*```\s*$/, '');
      }
      
      cleaned = cleaned.trim();
      
      console.log('UGS Validator: Cleaned response (first 200 chars):', cleaned.substring(0, 200));
      
      // Try to parse and validate JSON
      try {
        const parsed = JSON.parse(cleaned);
        console.log('UGS Validator: Parsed JSON:', parsed);
        
        // Extract the key name and value separately
        let configKey = null;
        let configValue = null;
        
        if (parsed.addHoleConfig) {
          configKey = 'addHoleConfig';
          configValue = parsed.addHoleConfig;
        } else if (parsed.boxesSaleConfig) {
          configKey = 'boxesSaleConfig';
          configValue = parsed.boxesSaleConfig;
        } else {
          // Fallback: return the whole object
          console.warn('UGS Validator: No recognized config key found, returning full object');
          return {
            key: null,
            value: JSON.stringify(parsed, null, 2),
            full: JSON.stringify(parsed, null, 2)
          };
        }
        
        console.log('UGS Validator: Extracted key:', configKey, 'value:', configValue);
        
        // Return object with key, value, and full JSON
        return {
          key: configKey,
          value: JSON.stringify(configValue, null, 2),
          full: JSON.stringify(parsed, null, 2)
        };
      } catch (e) {
        console.error('UGS Validator: Error parsing JSON:', e, 'Cleaned text:', cleaned);
        // If parsing fails, return the cleaned text anyway
        return {
          key: null,
          value: cleaned,
          full: cleaned
        };
      }
    }
    
    // Load cached Gemini API key for Content tab
    if (contentGeminiApiKeyInput) {
      chrome.storage.local.get(['geminiApiKey'], (result) => {
        if (result.geminiApiKey) {
          contentGeminiApiKeyInput.value = result.geminiApiKey;
        }
      });
      
      // Save Gemini API key for Content tab
      contentGeminiApiKeyInput.addEventListener('input', () => {
        const apiKey = contentGeminiApiKeyInput.value.trim();
        if (apiKey) {
          chrome.storage.local.set({ geminiApiKey: apiKey });
        }
      });
    }
    
    // Content tab: AI Generate button
    if (contentConvertBtn && contentReq) {
      contentConvertBtn.addEventListener('click', async () => {
        const requirement = contentReq.value.trim();
        if (!requirement) {
          contentConvertResult.style.display = 'block';
          contentConvertResult.style.background = 'transparent';
          contentConvertResult.style.border = 'none';
          contentConvertResult.style.color = '#6b7280';
          contentConvertResult.textContent = 'Please enter a content requirement';
          return;
        }
        
        if (contentConvertBtn.classList.contains('ugs-convert-btn-animating')) return;
        
        isContentAIGenerating = true;
        contentConvertBtn.classList.add('ugs-convert-btn-animating');
        contentConvertBtn.innerHTML = '<span>Generating...</span>';
        contentConvertResult.style.display = 'none';
        updateContentAIButtonState(); // Update button state to disabled
        
        try {
          const result = await convertContentRequirementToJSON(requirement);
          
          contentConvertResult.style.background = 'transparent';
          contentConvertResult.style.border = 'none';
          contentConvertResult.style.color = '#6b7280';
          contentConvertResult.innerHTML = `✓ Generated JSON config`;
          
          // Show AI output container and populate it
          if (contentAiOutputContainer) {
            contentAiOutputContainer.style.display = 'block';
          }
          
          console.log('UGS Validator: Content conversion result:', result);
          
          // Set the config key name
          if (contentConfigKey) {
            if (result && result.key) {
              contentConfigKey.value = result.key;
              console.log('UGS Validator: Set config key to:', result.key);
            } else {
              console.warn('UGS Validator: No config key in result', result);
              contentConfigKey.value = '';
            }
          } else {
            console.error('UGS Validator: contentConfigKey element not found');
          }
          
          // Set the config value (just the value object, not the full JSON with key)
          if (contentAiOutput) {
            const valueToSet = (result && result.value) ? result.value : (result && result.full ? result.full : '');
            contentAiOutput.value = valueToSet;
            contentAiOutput.style.height = 'auto';
            contentAiOutput.style.height = Math.min(contentAiOutput.scrollHeight, 300) + 'px';
            console.log('UGS Validator: Set config value, length:', valueToSet.length, 'preview:', valueToSet.substring(0, 100));
          } else {
            console.error('UGS Validator: contentAiOutput element not found');
          }
          
          // Store the full JSON for injection
          if (contentAiOutput && result && result.full) {
            contentAiOutput.dataset.fullJson = result.full;
          }
          
          // Enable inject button only if we have both key and value
          if (contentInjectBtn) {
            const hasKey = contentConfigKey && contentConfigKey.value.trim().length > 0;
            const hasValue = contentAiOutput && contentAiOutput.value.trim().length > 0;
            
            if (hasKey && hasValue) {
              contentInjectBtn.disabled = false;
              contentInjectBtn.style.background = '#FF4E21';
              contentInjectBtn.style.color = 'white';
              contentInjectBtn.style.borderColor = '#FF4E21';
              contentInjectBtn.style.opacity = '1';
              contentInjectBtn.style.cursor = 'pointer';
              console.log('UGS Validator: Inject button enabled');
            } else {
              console.warn('UGS Validator: Cannot enable inject button - missing key or value', { hasKey, hasValue });
              contentInjectBtn.disabled = true;
              contentInjectBtn.style.background = '#ffffff';
              contentInjectBtn.style.color = '#1a1a1a';
              contentInjectBtn.style.borderColor = '#9ca3af';
              contentInjectBtn.style.opacity = '0.5';
              contentInjectBtn.style.cursor = 'not-allowed';
            }
          }
        } catch (error) {
          console.error('UGS Validator: Content Gemini conversion error:', error);
          contentConvertResult.style.background = 'transparent';
          contentConvertResult.style.border = 'none';
          contentConvertResult.style.color = '#6b7280';
          contentConvertResult.textContent = `❌ Error: ${error.message}`;
        } finally {
          isContentAIGenerating = false;
          contentConvertBtn.classList.remove('ugs-convert-btn-animating');
          const contentStarImg = document.createElement('img');
          contentStarImg.id = 'ugs-content-ai-star';
          contentStarImg.src = chrome.runtime.getURL('assets/ai_icon.svg');
          contentStarImg.alt = 'AI';
          // Icon filter will be set by updateContentAIButtonState() after appending
          contentStarImg.style.cssText = 'width: 16px; height: 16px; flex-shrink: 0; transition: transform 0.2s; filter: brightness(0) saturate(100%);';
          const contentSpan = document.createElement('span');
          contentSpan.textContent = 'AI Generate';
          contentConvertBtn.innerHTML = '';
          contentConvertBtn.appendChild(contentStarImg);
          contentConvertBtn.appendChild(contentSpan);
          // Update button state and icon filter after appending to ensure it's set correctly
          updateContentAIButtonState();
          
          // Re-attach hover event (no spin animation)
          contentConvertBtn.onmouseover = function() {
            if(!this.disabled) {
              this.style.background = '#000000';
              this.style.color = 'white';
              this.style.borderColor = '#000000';
              this.style.transform = 'translateY(-2px)';
              const icon = this.querySelector('#ugs-content-ai-star');
              if (icon) icon.style.filter = 'brightness(0) saturate(100%) invert(100%)'; // White icon on black background
            } else {
              this.style.cursor = 'not-allowed';
            }
          };
          contentConvertBtn.onmouseout = function() {
            if(!this.disabled) {
              this.style.background = '#ffffff';
              this.style.color = '#000000';
              this.style.borderColor = '#000000';
              this.style.transform = 'translateY(0)';
              const icon = this.querySelector('#ugs-content-ai-star');
              if (icon) icon.style.filter = 'brightness(0) saturate(100%)'; // Black icon on white background
            } else {
              this.style.cursor = 'not-allowed';
            }
          };
        }
      });
    }
    
    // Content tab: Auto-resize AI output textarea
    if (contentAiOutput) {
      contentAiOutput.addEventListener('input', () => {
        contentAiOutput.style.height = 'auto';
        contentAiOutput.style.height = Math.min(contentAiOutput.scrollHeight, 300) + 'px';
      });
    }
    
    // Content tab: Inject button
    if (contentInjectBtn && contentAiOutput && contentConfigKey) {
      contentInjectBtn.addEventListener('click', () => {
        const configKey = contentConfigKey.value.trim();
        const configValue = contentAiOutput.value.trim();
        
        if (!configKey || !configValue) {
          contentInjectResult.style.display = 'block';
          contentInjectResult.style.background = 'transparent';
          contentInjectResult.style.border = 'none';
          contentInjectResult.style.color = '#6b7280';
          contentInjectResult.textContent = '❌ Please generate a config first';
          return;
        }
        
        // Try to parse the value to ensure it's valid JSON
        let valueObj;
        try {
          valueObj = JSON.parse(configValue);
        } catch (e) {
          contentInjectResult.style.display = 'block';
          contentInjectResult.style.background = 'transparent';
          contentInjectResult.style.border = 'none';
          contentInjectResult.style.color = '#6b7280';
          contentInjectResult.textContent = `❌ Invalid JSON in config value: ${e.message}`;
          return;
        }
        
        // Build the full JSON with the key
        const fullJson = JSON.stringify({ [configKey]: valueObj }, null, 2);
        
        // Copy to clipboard and show message
        navigator.clipboard.writeText(fullJson).then(() => {
          contentInjectResult.style.display = 'block';
          contentInjectResult.style.background = 'transparent';
          contentInjectResult.style.border = 'none';
          contentInjectResult.style.color = '#6b7280';
          contentInjectResult.textContent = `✓ JSON config (${configKey}) copied to clipboard. Paste it into the Content field.`;
        }).catch(err => {
          contentInjectResult.style.display = 'block';
          contentInjectResult.style.background = 'transparent';
          contentInjectResult.style.border = 'none';
          contentInjectResult.style.color = '#6b7280';
          contentInjectResult.textContent = `❌ Error copying to clipboard: ${err.message}`;
        });
      });
    }
    
    // Load cached Gemini API key for Content tab
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      if (result.geminiApiKey) {
        contentGeminiApiKeyInput.value = result.geminiApiKey;
      }
    });
    
    // Save Gemini API key for Content tab and update button state
    if (contentGeminiApiKeyInput) {
      contentGeminiApiKeyInput.addEventListener('input', () => {
        const apiKey = contentGeminiApiKeyInput.value.trim();
        if (apiKey) {
          chrome.storage.local.set({ geminiApiKey: apiKey, ugs_gemini_api_key: apiKey });
        }
        updateContentAIButtonState();
      });
      
      contentGeminiApiKeyInput.addEventListener('blur', () => {
        const apiKey = contentGeminiApiKeyInput.value.trim();
        if (apiKey) {
          chrome.storage.local.set({ geminiApiKey: apiKey, ugs_gemini_api_key: apiKey });
        }
        updateContentAIButtonState();
      });
    }
    
    // Update Content tab AI button state when input changes
    if (contentReq) {
      contentReq.addEventListener('input', () => {
        updateContentAIButtonState();
      });
    }
    
    // Initial state update for Content tab AI button
    updateContentAIButtonState();
    
    // Content tab: Auto-resize AI output textarea
    if (contentAiOutput) {
      contentAiOutput.addEventListener('input', () => {
        contentAiOutput.style.height = 'auto';
        contentAiOutput.style.height = Math.min(contentAiOutput.scrollHeight, 300) + 'px';
      });
    }
    
    // Content tab: Inject button
    contentInjectBtn.addEventListener('click', () => {
      const jsonConfig = contentAiOutput.value.trim() || contentReq.value.trim();
      if (jsonConfig) {
        // Try to inject JSON config into the page
        // For now, just copy to clipboard and show message
        navigator.clipboard.writeText(jsonConfig).then(() => {
          contentInjectResult.style.display = 'block';
          contentInjectResult.style.background = 'transparent';
          contentInjectResult.style.border = 'none';
          contentInjectResult.style.color = '#6b7280';
          contentInjectResult.textContent = '✓ JSON config copied to clipboard. Paste it into the Content field.';
        }).catch(err => {
          contentInjectResult.style.display = 'block';
          contentInjectResult.style.background = 'transparent';
          contentInjectResult.style.border = 'none';
          contentInjectResult.style.color = '#6b7280';
          contentInjectResult.textContent = `❌ Error copying to clipboard: ${err.message}`;
        });
      }
    });
    
    // Initialize button states
    updateButtonStates();
    
    // Validate button click (check AI output first, then main input)
    validateBtn.addEventListener('click', () => {
      const expression = (aiOutput && aiOutput.value.trim()) || productReq.value.trim();
      if (expression) {
        validateJEXLInPanel(expression);
      } else {
        validationResult.style.display = 'block';
        validationResult.style.background = 'transparent';
        validationResult.style.border = 'none';
        validationResult.style.color = '#6b7280';
        validationResult.textContent = 'Please enter a JEXL expression first';
      }
    });
    

    // Validate JEXL in panel with type checking - same logic as span validation
    function validateJEXLInPanel(expression) {
      const result = validateJEXLExpression(expression);
      
      validationResult.style.display = 'block';
      validationResult.style.background = 'transparent';
      validationResult.style.border = 'none';
      
      // Update inject button based on validation
      if (!result.valid || result.errors.length > 0) {
        validationResult.style.color = '#6b7280';
        validationResult.innerHTML = `❌ ${result.errors[0]?.message || 'Invalid JEXL'}`;
        // Disable inject button
        currentValidJEXL = null;
        updateButtonStates();
      } else if (result.warnings.length > 0) {
        validationResult.style.color = '#6b7280';
        validationResult.innerHTML = `⚠️ ${result.warnings[0]?.message}`;
        // Disable inject button when there are warnings
        currentValidJEXL = null;
        updateButtonStates();
      } else {
        validationResult.style.color = '#10B981';
        validationResult.innerHTML = `<span style="color: #10B981; font-weight: 600;">✓ Valid expression</span>`;
        // Enable button only when no errors and no warnings
        currentValidJEXL = expression;
        updateButtonStates();
      }
    }
    

    // Inject into JEXL field - only if valid (use AI output if available)
    injectBtn.addEventListener('click', () => {
      const expression = (aiOutput && aiOutput.value.trim()) || currentValidJEXL || productReq.value.trim();
      if (!expression) {
        injectResult.style.display = 'block';
        injectResult.style.background = 'transparent';
        injectResult.style.border = 'none';
        injectResult.style.color = '#6b7280';
        injectResult.textContent = 'Please enter a valid JEXL expression first';
        return;
      }

      // Validate expression before injection
      const result = validateJEXLExpression(expression);
      
      // Get remote config for type validation if available
      let remoteConfigData = null;
      try {
        if (remoteConfigInput.value) {
          const config = JSON.parse(remoteConfigInput.value);
          if (config.attributes) {
            remoteConfigData = config.attributes;
          }
        }
      } catch (e) {
        // Config not loaded or invalid
      }
      
      // Use global cached config if not in input
      if (!remoteConfigData) {
        remoteConfigData = globalCachedRemoteConfig;
      }
      
      // Add type validation if remote config is available
      if (remoteConfigData) {
        const typeErrors = validateTypesAgainstConfig(expression, remoteConfigData);
        if (typeErrors.length > 0) {
          result.errors.push(...typeErrors);
          result.valid = false;
        }
      }
      
      attemptInjection(expression, result);
    });
    
    function attemptInjection(expression, validationResult) {
      // Only inject if valid
      if (!validationResult.valid || validationResult.errors.length > 0) {
        injectResult.style.display = 'block';
        injectResult.style.background = 'transparent';
        injectResult.style.border = 'none';
        injectResult.style.color = '#6b7280';
        injectResult.textContent = `❌ Cannot inject: ${validationResult.errors[0]?.message || 'Invalid JEXL expression'}`;
        return;
      }

      const success = injectIntoJEXLField(expression);
      
      injectResult.style.display = 'block';
      injectResult.style.background = 'transparent';
      injectResult.style.border = 'none';
      if (success) {
        injectResult.style.color = '#6b7280';
        injectResult.textContent = '✓ Injected into JEXL Condition field!';
        setTimeout(() => {
          injectResult.style.display = 'none';
        }, 3000);
      } else {
        injectResult.style.color = '#6b7280';
        injectResult.textContent = '❌ Could not find JEXL Condition field. Please make sure you are on a UGS configuration page.';
      }
    }
    
    // Convert requirement helper
    function convertRequirementToJEXL(requirement) {
      const lower = requirement.toLowerCase();
      let jexl = '';
      
      if (/revenue|ltv|iap.*revenue/i.test(requirement)) {
        const match = requirement.match(/(?:greater|more|above|>|>=)\s*(\d+)|(?:less|below|<|<=)\s*(\d+)|(?:equal|==)\s*(\d+)/i);
        const value = match ? (match[1] || match[2] || match[3]) : '0';
        const op = /greater|more|above|>/.test(requirement) ? '>' : 
                   /less|below|</.test(requirement) ? '<' : '==';
        
        if (/total.*revenue/i.test(requirement)) {
          jexl = `user.sw_total_revenue ${op} ${value}`;
        } else if (/iap.*revenue/i.test(requirement)) {
          jexl = `user.sw_total_iap_revenue ${op} ${value}`;
        } else if (/ltv/i.test(requirement)) {
          jexl = `user.sw_iap_ltv ${op} ${value}`;
        }
      }
      
      if (/level|main.*level/i.test(requirement)) {
        const match = requirement.match(/(?:equal|==|is)\s*(\d+)|(?:greater|>|>=)\s*(\d+)|(?:less|<|<=)\s*(\d+)/i);
        const value = match ? (match[1] || match[2] || match[3]) : '0';
        const op = /equal|==|is/.test(requirement) ? '==' : 
                   /greater|>/.test(requirement) ? '>' : '<';
        jexl = `user.sw_main_level ${op} ${value}`;
      }
      
      if (/session/i.test(requirement)) {
        const match = requirement.match(/(?:greater|>|>=|more)\s*(\d+)/i);
        const value = match ? match[1] : '0';
        jexl = `user.sw_session_counter >= ${value}`;
      }
      
      if (/and|&&/i.test(requirement) && jexl) {
        const parts = requirement.split(/and|&&/i);
        if (parts.length > 1) {
          const secondJEXL = convertRequirementToJEXL(parts[1]);
          if (secondJEXL) {
            jexl = `${jexl} && ${secondJEXL}`;
          }
        }
      }
      
      return jexl || null;
    }
  }
  
  // Get cached remote config for current project
  function getCachedRemoteConfig() {
    return new Promise((resolve) => {
      const url = window.location.href;
      const match = url.match(/projects\/([a-f0-9-]+)/i);
      const projectId = match ? match[1] : 'default';
      
      chrome.storage.local.get([`ugs_remote_config_${projectId}`], (result) => {
        resolve(result[`ugs_remote_config_${projectId}`] || null);
      });
    });
  }
  
  // Unified JEXL validation function - used by both panel and span validation
  function validateJEXLExpression(expression) {
    // Get remote config data for parameter validation
    let remoteConfigData = null;
    try {
      const configInput = document.querySelector('#ugs-remote-config');
      if (configInput && configInput.value) {
        const config = JSON.parse(configInput.value);
        if (config.attributes) {
          remoteConfigData = config.attributes;
        }
      }
    } catch (e) {
      // Config not loaded or invalid
    }
    
    // If no config in input, use global cached config
    if (!remoteConfigData) {
      remoteConfigData = globalCachedRemoteConfig;
    }
    
    // Pass remote config to validator for parameter checking
    const result = validator.validate(expression, remoteConfigData);
    
    // Check if it contains UGS parameters (user., app., unity.) - must be exact match
    const hasUGSParameters = /\b(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/.test(expression);
    
    // If expression has content but no UGS parameters, add error
    if (expression.trim().length > 0 && !hasUGSParameters) {
      // Check for common invalid patterns like "us=="
      const invalidPatterns = [
        /^us\s*[=!<>]/i,  // "us==" or "us >" etc
        /^app\s*[=!<>]/i, // "app==" without dot
        /^user\s*[=!<>]/i, // "user==" without dot
      ];
      
      let invalidPattern = false;
      for (const pattern of invalidPatterns) {
        if (pattern.test(expression.trim())) {
          invalidPattern = true;
          break;
        }
      }
      
      result.errors.push({
        type: 'parameter',
        message: invalidPattern 
          ? 'Expression must use full parameter names (user., app., or unity.) followed by a dot. Example: user.sw_main_level == 4'
          : 'Expression must reference UGS/Wisdom parameters (user., app., or unity.)'
      });
      result.valid = false;
    }
    
    // Also validate simple values like "true", "false", numbers, etc.
    const trimmedExpr = expression.trim();
    if (trimmedExpr && !hasUGSParameters) {
      const isSimpleValue = /^(true|false|\d+(\.\d+)?|'[^']*'|"[^"]*")$/i.test(trimmedExpr);
      if (isSimpleValue) {
        result.errors.push({
          type: 'parameter',
          message: `"${trimmedExpr}" is not a valid JEXL expression. It must reference UGS/Wisdom parameters (e.g., user.sw_main_level == 4)`
        });
        result.valid = false;
      }
    }
    
    // Check for invalid tokens that aren't parameters, operators, or valid values
    // First, check for invalid single & or | (should be && or ||)
    // Check for single & that's not part of &&
    const singleAmpersandMatch = expression.match(/([^&]|^)&([^&]|$)/);
    if (singleAmpersandMatch && !expression.includes('&&')) {
      result.errors.push({
        type: 'syntax',
        message: `Invalid operator '&'. Use '&&' for logical AND`,
        position: expression.indexOf('&')
      });
      result.valid = false;
    }
    // Check for single | that's not part of ||
    const singlePipeMatch = expression.match(/([^|]|^)\|([^|]|$)/);
    if (singlePipeMatch && !expression.includes('||')) {
      result.errors.push({
        type: 'syntax',
        message: `Invalid operator '|'. Use '||' for logical OR`,
        position: expression.indexOf('|')
      });
      result.valid = false;
    }
    
    // Extract all identifiers (words that aren't operators or values)
    const validOperators = ['&&', '||', '==', '!=', '>=', '<=', '>', '<'];
    const validValuePattern = /^(true|false|null|\d+(\.\d+)?|'[^']*'|"[^"]*")$/i;
    const paramPattern = /^(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)$/;
    
    // Find all word-like identifiers in the expression (not inside quotes)
    const identifierPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const identifierMatches = [...expression.matchAll(identifierPattern)];
    
    // Check each identifier
    identifierMatches.forEach(match => {
      const identifier = match[0];
      const position = match.index;
      
      // Skip if it's inside quotes
      const beforeMatch = expression.substring(0, position);
      const singleQuotesBefore = (beforeMatch.match(/'/g) || []).length;
      const doubleQuotesBefore = (beforeMatch.match(/"/g) || []).length;
      if (singleQuotesBefore % 2 !== 0 || doubleQuotesBefore % 2 !== 0) {
        return; // Inside quotes, skip
      }
      
      // Skip if it's part of a valid parameter (user.param, app.param, unity.param)
      // Check if this identifier is part of a parameter by looking at context
      const contextStart = Math.max(0, position - 20);
      const contextEnd = Math.min(expression.length, position + identifier.length + 20);
      const context = expression.substring(contextStart, contextEnd);
      
      // Check if identifier is part of a parameter pattern (user.param)
      const paramContextPattern = new RegExp(`\\b(user|app|unity)\\.${identifier}\\b`);
      if (paramContextPattern.test(context)) {
        return; // It's part of a valid parameter
      }
      
      // Check if identifier is the level part (user, app, unity) followed by a dot
      if (['user', 'app', 'unity'].includes(identifier.toLowerCase())) {
        const afterIdentifier = expression.substring(position + identifier.length, position + identifier.length + 1);
        if (afterIdentifier === '.') {
          return; // Valid level prefix
        }
      }
      
      // Skip operators (but these shouldn't match the identifier pattern anyway)
      if (validOperators.includes(identifier)) return;
      
      // Skip valid boolean/null values
      if (validValuePattern.test(identifier)) return;
      
      // If we get here, it's an invalid identifier
      result.errors.push({
        type: 'parameter',
        message: `Invalid identifier "${identifier}" - must be a UGS/Wisdom parameter (user., app., or unity.), operator, or valid value`,
        position: position
      });
      result.valid = false;
    });
    
    // Get remote config for type validation
    let configData = null;
    try {
      const configInput = document.querySelector('#ugs-remote-config');
      if (configInput && configInput.value) {
        const config = JSON.parse(configInput.value);
        if (config.attributes) {
          configData = config.attributes;
        }
      }
    } catch (e) {
      // Config not loaded
    }
    
    if (!configData) {
      configData = globalCachedRemoteConfig;
    }
    
    // Add type validation if remote config is available
    if (configData) {
      const typeErrors = validateTypesAgainstConfig(expression, configData);
      if (typeErrors.length > 0) {
        result.errors.push(...typeErrors);
        result.valid = false;
      }
    }
    
    return result;
  }
  
  // Validate types against remote config (used in validation)
  function validateTypesAgainstConfig(expression, config) {
    const errors = [];
    const paramPattern = /\b(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|!=|>=|<=|>|<)\s*([^&\|\)\s]+)/g;
    const matches = [...expression.matchAll(paramPattern)];
    
    matches.forEach(match => {
      const [fullMatch, level, paramName, operator, value] = match;
      
      // Get the actual value from config
      let actualValue = null;
      if (level === 'user' && config.user) {
        actualValue = config.user[paramName];
      } else if (level === 'app' && config.app) {
        actualValue = config.app[paramName];
      } else if (level === 'unity' && config.unity) {
        actualValue = config.unity[paramName];
      }
      
      if (actualValue !== null && actualValue !== undefined) {
        const actualType = typeof actualValue;
        const valueStr = value.trim().replace(/['"]/g, '');
        const isQuoted = /^['"]/.test(value.trim());
        const isNumber = !isNaN(valueStr) && valueStr !== '';
        
        // Check type mismatch
        if (actualType === 'number' && isQuoted) {
          errors.push({
            type: 'type',
            message: `Type error: ${fullMatch} - ${paramName} is a number, but you're comparing with a string. Use: ${level}.${paramName} ${operator} ${valueStr}`,
            position: match.index
          });
        } else if (actualType === 'string' && !isQuoted && isNumber) {
          // If it's a string but value looks like a number without quotes
          errors.push({
            type: 'type',
            message: `Type error: ${fullMatch} - ${paramName} is a string, but you're comparing with a number. Use: ${level}.${paramName} ${operator} "${valueStr}"`,
            position: match.index
          });
        } else if (actualType === 'boolean' && valueStr !== 'true' && valueStr !== 'false') {
          errors.push({
            type: 'type',
            message: `Type error: ${fullMatch} - ${paramName} is a boolean, use true or false`,
            position: match.index
          });
        } else if (actualValue === null && valueStr !== 'null') {
          errors.push({
            type: 'type',
            message: `Type error: ${fullMatch} - ${paramName} is null, use == null or != null`,
            position: match.index
          });
        }
      }
    });
    
    return errors;
  }
  
  function showSidePanel() {
    if (!sidePanel) createSidePanel();
    
    // Store original widths if not already stored
    if (!sidePanel.dataset.originalRootWidth) {
      const root = document.getElementById('root');
      const header = document.querySelector('header, [class*="header"], [id*="header"]');
      
      if (root) {
        sidePanel.dataset.originalRootWidth = root.style.width || '';
        sidePanel.dataset.originalRootMaxWidth = root.style.maxWidth || '';
      }
      if (header) {
        sidePanel.dataset.originalHeaderWidth = header.style.width || '';
        sidePanel.dataset.originalHeaderMaxWidth = header.style.maxWidth || '';
      }
      sidePanel.dataset.originalBodyMargin = document.body.style.marginRight || '';
      sidePanel.dataset.originalHtmlMargin = document.documentElement.style.marginRight || '';
    }
    
    sidePanel.style.display = 'block';
    const panelWidth = 400;
    const panelWidthPx = `${panelWidth}px`;
    
    // Shrink root div by exactly 400px (panel width)
    const root = document.getElementById('root');
    if (root) {
      // Get computed width (not offsetWidth which includes padding/border)
      const computedStyle = getComputedStyle(root);
      const currentWidth = parseFloat(computedStyle.width) || root.offsetWidth || root.clientWidth;
      
      if (currentWidth > 0 && !isNaN(currentWidth)) {
        const newWidth = Math.max(0, currentWidth - panelWidth);
        root.style.width = `${newWidth}px`;
        root.style.maxWidth = `${newWidth}px`;
        root.style.boxSizing = 'border-box';
        console.log(`UGS Validator: Root width: ${currentWidth}px -> ${newWidth}px (shrunk by ${panelWidth}px)`);
      } else {
        // Fallback: use calc
        root.style.width = `calc(100% - ${panelWidthPx})`;
        root.style.maxWidth = `calc(100% - ${panelWidthPx})`;
        root.style.boxSizing = 'border-box';
        console.log(`UGS Validator: Root width set to calc(100% - ${panelWidthPx})`);
      }
    }
    
    // Shrink header by exactly 400px - ensure it shrinks from the right, not moves
    const header = document.querySelector('header, [class*="header"], [id*="header"]');
    if (header) {
      // Store original positioning
      if (!sidePanel.dataset.originalHeaderPosition) {
        sidePanel.dataset.originalHeaderPosition = getComputedStyle(header).position || '';
        sidePanel.dataset.originalHeaderLeft = header.style.left || '';
        sidePanel.dataset.originalHeaderRight = header.style.right || '';
      }
      
      // Ensure header stays on the left and shrinks from the right
      const headerComputedStyle = getComputedStyle(header);
      const currentWidth = parseFloat(headerComputedStyle.width) || header.offsetWidth || header.clientWidth;
      
      if (currentWidth > 0 && !isNaN(currentWidth)) {
        const newWidth = Math.max(0, currentWidth - panelWidth);
        header.style.width = `${newWidth}px`;
        header.style.maxWidth = `${newWidth}px`;
        header.style.boxSizing = 'border-box';
        // Ensure it doesn't move to the right - keep left position
        if (headerComputedStyle.position === 'fixed' || headerComputedStyle.position === 'absolute') {
          header.style.left = header.style.left || '0';
          header.style.right = 'auto';
        }
        console.log(`UGS Validator: Header width: ${currentWidth}px -> ${newWidth}px (shrunk by ${panelWidth}px)`);
      } else {
        // Fallback: use calc and ensure left alignment
        header.style.width = `calc(100% - ${panelWidthPx})`;
        header.style.maxWidth = `calc(100% - ${panelWidthPx})`;
        header.style.boxSizing = 'border-box';
        if (headerComputedStyle.position === 'fixed' || headerComputedStyle.position === 'absolute') {
          header.style.left = header.style.left || '0';
          header.style.right = 'auto';
        }
        console.log(`UGS Validator: Header width set to calc(100% - ${panelWidthPx})`);
      }
    }
    
    // Also set body margin as backup
    document.body.style.marginRight = panelWidthPx;
    document.documentElement.style.marginRight = panelWidthPx;
    
    panelVisible = true;
    console.log('UGS Validator: Side panel shown, root and header shrunk by', panelWidthPx);
    
    // Start checking for tab changes
    if (window.ugsTabCheckStart) {
      window.ugsTabCheckStart();
    }
    
    // Detect which tab to show immediately based on H2 "Content" element
    setTimeout(() => {
      const targetingTab = sidePanel.querySelector('#ugs-tab-targeting');
      const contentTab = sidePanel.querySelector('#ugs-tab-content');
      const targetingContent = sidePanel.querySelector('#ugs-tab-targeting-content');
      const contentContent = sidePanel.querySelector('#ugs-tab-content-content');
      
      if (targetingTab && contentTab && targetingContent && contentContent) {
        // Look for the H2 element with text "Content"
        const contentH2 = Array.from(document.querySelectorAll('h2.MuiTypography-h2, h2')).find(h2 => {
          const text = h2.textContent.trim();
          return text === 'Content';
        });
        
        const contentDiv = document.querySelector('div[data-testid="stepper-title"] h2');
        const isContentView = contentH2 !== undefined || 
                            (contentDiv && contentDiv.textContent.trim() === 'Content');
        
        if (isContentView) {
          contentTab.style.borderBottomColor = '#FF4E21';
          contentTab.style.color = '#FF4E21';
          contentTab.style.fontWeight = '600';
          targetingTab.style.borderBottomColor = 'transparent';
          targetingTab.style.color = '#6b7280';
          targetingTab.style.fontWeight = '500';
          contentContent.style.display = 'block';
          targetingContent.style.display = 'none';
        } else {
          targetingTab.style.borderBottomColor = '#FF4E21';
          targetingTab.style.color = '#FF4E21';
          targetingTab.style.fontWeight = '600';
          contentTab.style.borderBottomColor = 'transparent';
          contentTab.style.color = '#6b7280';
          contentTab.style.fontWeight = '500';
          targetingContent.style.display = 'block';
          contentContent.style.display = 'none';
        }
      }
    }, 100);
  }
  
  function hideSidePanel() {
    if (sidePanel) {
      sidePanel.style.display = 'none';
      
      // Stop checking for tab changes
      if (window.ugsTabCheckStop) {
        window.ugsTabCheckStop();
      }
      
      // Restore root div
      const root = document.getElementById('root');
      if (root) {
        root.style.width = sidePanel.dataset.originalRootWidth || '';
        root.style.maxWidth = sidePanel.dataset.originalRootMaxWidth || '';
        root.style.boxSizing = '';
      }
      
      // Restore header
      const header = document.querySelector('header, [class*="header"], [id*="header"]');
      if (header) {
        header.style.width = sidePanel.dataset.originalHeaderWidth || '';
        header.style.maxWidth = sidePanel.dataset.originalHeaderMaxWidth || '';
        header.style.boxSizing = '';
        // Restore original positioning
        if (sidePanel.dataset.originalHeaderPosition) {
          header.style.position = sidePanel.dataset.originalHeaderPosition;
          header.style.left = sidePanel.dataset.originalHeaderLeft || '';
          header.style.right = sidePanel.dataset.originalHeaderRight || '';
        }
      }
      
      // Restore body/html margins
      document.body.style.marginRight = sidePanel.dataset.originalBodyMargin || '';
      document.documentElement.style.marginRight = sidePanel.dataset.originalHtmlMargin || '';
      
      panelVisible = false;
      console.log('UGS Validator: Side panel hidden, widths restored');
    }
  }
  
  function toggleSidePanel() {
    if (panelVisible) {
      hideSidePanel();
    } else {
      showSidePanel();
    }
  }
  
  // Listen for messages from background and panel
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === 'togglePanel') {
        toggleSidePanel();
        sendResponse({ success: true, visible: panelVisible });
      } else if (request.action === 'validateJEXL') {
        const expression = request.expression || '';
        const result = validator.validate(expression);
        sendResponse({ success: true, result: result });
      } else if (request.action === 'injectJEXL') {
        const expression = request.expression || '';
        const success = injectIntoJEXLField(expression);
        sendResponse({ success: success, error: success ? null : 'Could not find JEXL Condition field' });
      } else if (request.action === 'showUI') {
        showSidePanel();
        sendResponse({ success: true, visible: true });
      } else if (request.action === 'hideUI') {
        hideSidePanel();
        sendResponse({ success: true, visible: false });
      } else if (request.action === 'checkUI') {
        sendResponse({ visible: panelVisible });
      }
    } catch (error) {
      console.error('UGS Validator: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep channel open for async response
  });
  
  // Listen for postMessage from panel iframe
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'UGS_VALIDATOR_INJECT') {
      const success = injectIntoJEXLField(event.data.expression);
      if (success) {
        console.log('UGS Validator: Successfully injected via panel');
      }
    }
  });
  
  // Helper function to set Monaco editor value using executeEdits
  function setMonacoValue(expression, monacoContainer = null, targetSpan = null) {
    const monaco = window.monaco;
    if (!monaco?.editor) {
      console.log('UGS Validator: Monaco editor not available');
      return false;
    }

    try {
      const editors = monaco.editor.getEditors?.() ?? [];
      console.log('UGS Validator: Found', editors.length, 'Monaco editor(s)');
      
      let editor = null;
      
      // Strategy 1: If container is provided, try to find editor matching that container
      if (monacoContainer) {
        editor = editors.find(e => {
          try {
            const container = e.getContainerDomNode();
            return container === monacoContainer || container?.contains(monacoContainer) || monacoContainer.contains(container);
          } catch (err) {
            return false;
          }
        });
        if (editor) {
          console.log('UGS Validator: Found editor by container match');
        }
      }
      
      // Strategy 2: If targetSpan is provided, try to find editor that contains it
      if (!editor && targetSpan) {
        editor = editors.find(e => {
          try {
            const container = e.getContainerDomNode();
            return container && container.contains(targetSpan);
          } catch (err) {
            return false;
          }
        });
        if (editor) {
          console.log('UGS Validator: Found editor by span containment');
        }
      }
      
      // Strategy 3: Try to find by checking if any editor's DOM contains our target
      if (!editor && targetSpan) {
        editor = editors.find(e => {
          try {
            const container = e.getContainerDomNode();
            if (!container) return false;
            // Check if the span is within this editor's DOM
            const viewLines = container.querySelector('.view-lines');
            return viewLines && viewLines.contains(targetSpan);
          } catch (err) {
            return false;
          }
        });
        if (editor) {
          console.log('UGS Validator: Found editor by view-lines containment');
        }
      }
      
      // Strategy 4: Fallback to focused editor or first editor
      if (!editor) {
        editor = monaco.editor.getFocusedEditor?.();
        if (editor) {
          console.log('UGS Validator: Using focused editor');
        } else if (editors.length > 0) {
          editor = editors[0];
          console.log('UGS Validator: Using first available editor');
        }
      }
      
      if (!editor) {
        console.log('UGS Validator: No Monaco editor instance found');
        return false;
      }

      const model = editor.getModel();
      if (!model) {
        console.log('UGS Validator: Editor has no model');
        return false;
      }
      
      console.log('UGS Validator: Updating Monaco editor model. Current value:', model.getValue().substring(0, 50));
      
      // Use executeEdits to update the model
      editor.executeEdits('UGSValidator', [
        {
          range: model.getFullModelRange(),
          text: expression
        }
      ]);
      
      // Verify the update worked
      const newValue = model.getValue();
      console.log('UGS Validator: Monaco editor updated. New value:', newValue.substring(0, 50));
      
      if (newValue !== expression) {
        console.warn('UGS Validator: Monaco editor value mismatch! Expected:', expression.substring(0, 50), 'Got:', newValue.substring(0, 50));
        // Try setValue as fallback
        if (typeof editor.setValue === 'function') {
          editor.setValue(expression);
          console.log('UGS Validator: Used setValue as fallback');
        }
      }
      
      // Move cursor to end
      try {
        editor.setPosition(model.getPositionAt(expression.length));
      } catch (e) {
        // Ignore cursor positioning errors
      }
      
      // Trigger change events to notify Monaco
      if (editor.trigger && typeof editor.trigger === 'function') {
        editor.trigger('change', {});
      }
      
      return true;
    } catch (e) {
      console.error('UGS Validator: Error in setMonacoValue:', e);
      return false;
    }
  }
  
  // Inject JEXL into the field
  function injectIntoJEXLField(expression) {
    const inputs = findJEXLInputs();
    if (inputs.length === 0) {
      console.log('UGS Validator: No JEXL fields found for injection');
      return false;
    }
    
    const field = inputs[0];
    const editable = findEditableElement(field);
    
    console.log('UGS Validator: Injecting into field:', editable, 'tag:', editable.tagName);
    
    // Try different methods to set the value
    if (editable.tagName === 'INPUT' || editable.tagName === 'TEXTAREA') {
      editable.value = expression;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      editable.dispatchEvent(new Event('change', { bubbles: true }));
      editable.focus();
      return true;
    } else if (editable.contentEditable === 'true') {
      editable.textContent = expression;
      editable.dispatchEvent(new Event('input', { bubbles: true }));
      editable.focus();
      return true;
      } else {
        // For Monaco editor or code editor spans - TRY MONACO API FIRST, then DOM fallback
        const spans = editable.querySelectorAll('span.mtk1, span[class*="mtk"]');
        if (spans.length > 0) {
          console.log('UGS Validator: Found code editor spans, attempting Monaco API update first...');
          
          // Find the first span.mtk1 that contains the JEXL expression
          // Replace its textContent, don't remove the span
          const targetSpan = Array.from(spans).find(span => {
            const context = (span.closest('div, section')?.textContent || '').toLowerCase();
            return /jexl\s*condition/i.test(context);
          }) || spans[0]; // Fallback to first span
          
          // FIRST: Try to update Monaco editor model via API (before DOM manipulation)
          const monacoContainer = editable.closest('.monaco-editor');
          if (monacoContainer) {
            console.log('UGS Validator: Attempting to update Monaco editor model FIRST...');
            const monacoSuccess = setMonacoValue(expression, monacoContainer, targetSpan);
            if (monacoSuccess) {
              console.log('UGS Validator: Monaco editor model updated successfully, waiting for DOM sync...');
              // Wait for Monaco to update the DOM, then trigger validation
              setTimeout(() => {
                targetSpan.dispatchEvent(new Event('input', { bubbles: true }));
                targetSpan.dispatchEvent(new Event('change', { bubbles: true }));
              }, 100);
              return true; // Success - Monaco will update the DOM itself
            } else {
              console.log('UGS Validator: Monaco API update failed, trying clipboard paste method...');
              
              // Try clipboard paste method as fallback
              try {
                // Copy to clipboard
                navigator.clipboard.writeText(expression).then(() => {
                  console.log('UGS Validator: Copied to clipboard, attempting paste...');
                  
                  // Focus the target span or its container
                  const focusTarget = targetSpan.closest('.view-line') || targetSpan;
                  if (focusTarget) {
                    focusTarget.focus();
                    
                    // Select all existing content
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(focusTarget);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    
                    // Simulate paste event
                    setTimeout(() => {
                      const pasteEvent = new ClipboardEvent('paste', {
                        bubbles: true,
                        cancelable: true,
                        clipboardData: new DataTransfer()
                      });
                      pasteEvent.clipboardData.setData('text/plain', expression);
                      focusTarget.dispatchEvent(pasteEvent);
                      
                      // Also try keyboard shortcut
                      const ctrlV = new KeyboardEvent('keydown', {
                        bubbles: true,
                        cancelable: true,
                        key: 'v',
                        code: 'KeyV',
                        ctrlKey: true,
                        metaKey: true // For Mac
                      });
                      focusTarget.dispatchEvent(ctrlV);
                      
                      // Trigger input events
                      focusTarget.dispatchEvent(new Event('input', { bubbles: true }));
                      focusTarget.dispatchEvent(new Event('change', { bubbles: true }));
                      
                      console.log('UGS Validator: Paste event dispatched');
                    }, 50);
                  }
                }).catch(err => {
                  console.log('UGS Validator: Clipboard write failed:', err);
                });
              } catch (e) {
                console.log('UGS Validator: Clipboard paste method failed:', e);
              }
            }
          }
          
          // FALLBACK: Update DOM if Monaco API didn't work
          console.log('UGS Validator: Updating DOM as fallback...');
          
          // Replace text content in the span - preserve the span structure
          // Clear all child nodes first to remove any error indicators and text nodes
          const nodesToRemove = [];
          for (let i = 0; i < targetSpan.childNodes.length; i++) {
            const node = targetSpan.childNodes[i];
            // Keep only error indicator spans, remove everything else
            if (node.nodeType === Node.TEXT_NODE || 
                !node.dataset || 
                !node.dataset.errorIndicator) {
              nodesToRemove.push(node);
            }
          }
          nodesToRemove.forEach(node => node.remove());
          
          // Create a new text node and insert it before any error indicators
          const textNode = document.createTextNode(expression);
          if (targetSpan.firstChild && targetSpan.firstChild.dataset && targetSpan.firstChild.dataset.errorIndicator) {
            targetSpan.insertBefore(textNode, targetSpan.firstChild);
          } else {
            targetSpan.appendChild(textNode);
          }
          
          // Also set textContent as fallback to ensure Monaco editor sees it
          const currentText = targetSpan.textContent || '';
          if (!currentText.includes(expression)) {
            targetSpan.textContent = expression + (targetSpan.textContent.replace(expression, '') || '');
          }
          
          // Also update other spans if they're part of the same expression
          const allText = Array.from(spans).map(s => {
            // Get text content excluding error indicators
            return Array.from(s.childNodes)
              .filter(n => n.nodeType === Node.TEXT_NODE || !n.dataset || !n.dataset.errorIndicator)
              .map(n => n.textContent || n.nodeValue || '')
              .join('');
          }).join('');
          
          if (allText.length > 0 && spans.length > 1) {
            // Clear other spans and keep only the first one with new content
            spans.forEach((span, idx) => {
              if (idx === 0) {
                // Clear and set new content
                while (span.firstChild) {
                  if (!span.firstChild.dataset || !span.firstChild.dataset.errorIndicator) {
                    span.removeChild(span.firstChild);
                  } else {
                    break;
                  }
                }
                span.textContent = expression;
              } else {
                // Clear other spans
                while (span.firstChild) {
                  if (!span.firstChild.dataset || !span.firstChild.dataset.errorIndicator) {
                    span.removeChild(span.firstChild);
                  } else {
                    break;
                  }
                }
                span.textContent = '';
              }
            });
          }
          
          // Trigger validation after injection - find the validation function for this span
          setTimeout(() => {
            // Find all attached validators and trigger validation
            const allIndicators = document.querySelectorAll('.ugs-validator-inline-error');
            allIndicators.forEach(indicator => {
              const spanParent = indicator.parentElement;
              if (spanParent && spanParent.contains(targetSpan)) {
                // Trigger input event to re-validate
                targetSpan.dispatchEvent(new Event('input', { bubbles: true }));
                targetSpan.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          }, 100);
          
          // Note: Monaco API update was already attempted earlier (before DOM manipulation)
          // If we reach here, it means Monaco API update failed and we've done DOM manipulation as fallback
          
          // Simulate user input to update Monaco's model
          // This is more reliable than just setting textContent
          if (monacoContainer) {
            // Try to simulate a paste event which Monaco handles better
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              clipboardData: new DataTransfer()
            });
            pasteEvent.clipboardData.setData('text/plain', expression);
            
            // Focus the editor first
            const focusTarget = targetSpan.closest('.view-line') || targetSpan;
            if (focusTarget) {
              focusTarget.focus();
              
              // Select all existing content
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(focusTarget);
              selection.removeAllRanges();
              selection.addRange(range);
              
              // Dispatch paste event
              focusTarget.dispatchEvent(pasteEvent);
              
              // Also try input event
              focusTarget.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              focusTarget.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            }
          }
          
          // Trigger events on the span and its parents
          targetSpan.dispatchEvent(new Event('input', { bubbles: true }));
          targetSpan.dispatchEvent(new Event('change', { bubbles: true }));
          targetSpan.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
          
          // Also trigger on parent containers
          let container = targetSpan.parentElement;
          for (let i = 0; i < 5; i++) {
            if (container) {
              container.dispatchEvent(new Event('input', { bubbles: true }));
              container.dispatchEvent(new Event('change', { bubbles: true }));
            }
            container = container.parentElement;
            if (!container) break;
          }
          
          return true;
        }
        
        // Strategy 2: Find view-lines container (Monaco editor structure)
        const viewLines = editable.querySelector('.view-lines, .view-line, [class*="view"]');
        const monacoEditor = editable.closest('.monaco-editor');
        
        if (viewLines) {
          console.log('UGS Validator: Found view-lines, updating...');
          viewLines.innerHTML = '';
          const lines = expression.split('\n');
          lines.forEach((line) => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'view-line';
            const span = document.createElement('span');
            span.className = 'mtk1';
            span.textContent = line;
            lineDiv.appendChild(span);
            viewLines.appendChild(lineDiv);
          });
          
          editable.dispatchEvent(new Event('input', { bubbles: true }));
          editable.dispatchEvent(new Event('change', { bubbles: true }));
          
          if (monacoEditor) {
            monacoEditor.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          return true;
        }
        
        // Strategy 3: Direct textContent
        if (editable.textContent !== undefined) {
          console.log('UGS Validator: Setting textContent directly...');
          editable.textContent = expression;
          editable.dispatchEvent(new Event('input', { bubbles: true }));
          editable.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }
    
    return false;
  }

  // Initialize on page load
  function init() {
    console.log('UGS Validator: Initializing...');
    createValidationUI();
    // Don't show overlay automatically - wait for user to click extension icon
    // createValidationOverlay(); // Create but don't show

    // Still attach validation to fields, but don't show UI

    // Find and attach to existing inputs - try multiple times as page loads
    const tryAttach = (attempt = 1) => {
      const inputs = findJEXLInputs();
      console.log(`UGS Validator: Attempt ${attempt} - Found ${inputs.length} potential JEXL input fields`);
      inputs.forEach(attachValidation);
      
      if (inputs.length === 0 && attempt < 5) {
        // Try again after a delay (page might still be loading)
        setTimeout(() => tryAttach(attempt + 1), 2000);
      } else       if (inputs.length > 0) {
        // Found inputs, update overlay and highlight (only if visible)
        highlightJEXLField();
        if (validationOverlay && overlayVisible) {
          const statusEl = validationOverlay.querySelector('#ugs-validator-status');
          const jexlField = activeJEXLField ? ' (JEXL field highlighted)' : '';
          statusEl.innerHTML = `<span>✅ UGS Validator Active - Monitoring ${inputs.length} field(s)${jexlField}</span>`;
        }
      } else {
        // Show message that we're ready but no fields found yet (only if overlay is visible)
        if (validationOverlay && overlayVisible) {
          const statusEl = validationOverlay.querySelector('#ugs-validator-status');
          statusEl.innerHTML = '<span>✅ UGS Validator Ready - Type JEXL in any input field</span>';
          const errorsEl = validationOverlay.querySelector('#ugs-validator-errors');
          errorsEl.innerHTML = '<div style="padding: 8px; color: #666; font-size: 12px;">Start typing a JEXL expression (e.g., user.sw_total_revenue > 0) in any input field to see validation.</div>';
        }
      }
    };
    
    // Start trying immediately, then again after delays
    // Note: Validation still works even if overlay is hidden
    tryAttach(1);
    setTimeout(() => tryAttach(2), 2000);
    setTimeout(() => tryAttach(3), 5000);
    
    // Create overlay but keep it hidden until user clicks extension icon
    createValidationOverlay();

    // Watch for dynamically added inputs
    const observer = new MutationObserver(() => {
      const newInputs = findJEXLInputs().filter(input => input.dataset.ugsValidatorAttached !== 'true');
      if (newInputs.length > 0) {
        console.log(`UGS Validator: Found ${newInputs.length} new JEXL input fields`);
        newInputs.forEach(attachValidation);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
