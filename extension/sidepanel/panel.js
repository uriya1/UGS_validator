// Side panel script
let currentJEXLExpression = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const productReq = document.getElementById('productReq');
  const convertBtn = document.getElementById('convertBtn');
  const convertResult = document.getElementById('convertResult');
  const jexlInput = document.getElementById('jexlInput');
  const validationResult = document.getElementById('validationResult');
  const injectBtn = document.getElementById('injectBtn');
  const injectResult = document.getElementById('injectResult');
  const status = document.getElementById('status');

  // Check if we're on a relevant UGS page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    
    const url = tabs[0].url;
    const isRelevantPage = /unity\.com|unity3d\.com|cloud\.unity\.com/.test(url) && 
                          (/game.*override|jexl|condition|campaign/i.test(url) || 
                           url.includes('create') || url.includes('edit'));
    
    if (isRelevantPage) {
      status.textContent = '✓ UGS page detected - JEXL validation available';
      status.className = 'status success';
    } else {
      status.textContent = '⚠️ Not on a UGS configuration page';
      status.className = 'status error';
    }
  });

  // Convert product requirement to JEXL
  convertBtn.addEventListener('click', () => {
    const requirement = productReq.value.trim();
    if (!requirement) {
      convertResult.style.display = 'block';
      convertResult.className = 'result error';
      convertResult.textContent = 'Please enter a product requirement';
      return;
    }

    // Simple conversion logic (can be enhanced with AI/NLP)
    const jexl = convertRequirementToJEXL(requirement);
    
    convertResult.style.display = 'block';
    if (jexl) {
      convertResult.className = 'result success';
      convertResult.innerHTML = `✅ Converted to JEXL:<br><code>${jexl}</code>`;
      jexlInput.value = jexl;
      currentJEXLExpression = jexl;
      // Auto-validate the converted expression
      validateJEXL(jexl);
    } else {
      convertResult.className = 'result error';
      convertResult.textContent = 'Could not convert. Please try a more specific requirement.';
    }
  });

  // Real-time JEXL validation
  jexlInput.addEventListener('input', () => {
    const expression = jexlInput.value.trim();
    currentJEXLExpression = expression;
    if (expression) {
      validateJEXL(expression);
    } else {
      validationResult.style.display = 'none';
    }
  });

  // Validate JEXL expression
  function validateJEXL(expression) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'validateJEXL', 
        expression: expression 
      }, (response) => {
        if (chrome.runtime.lastError) {
          validationResult.style.display = 'block';
          validationResult.className = 'result error';
          validationResult.textContent = 'Error: Could not validate. Please refresh the page.';
          return;
        }
        
        if (response && response.result) {
          const result = response.result;
          validationResult.style.display = 'block';
          
          if (!result.valid || result.errors.length > 0) {
            validationResult.className = 'result error';
            validationResult.innerHTML = `❌ ${result.errors[0]?.message || 'Invalid JEXL'}`;
          } else if (result.warnings.length > 0) {
            validationResult.className = 'result warning';
            validationResult.innerHTML = `⚠️ ${result.warnings[0]?.message}`;
          } else {
            validationResult.className = 'result success';
            validationResult.textContent = '✅ Valid JEXL Expression';
          }
        }
      });
    });
  }

  // Inject into JEXL field
  injectBtn.addEventListener('click', () => {
    const expression = jexlInput.value.trim() || currentJEXLExpression;
    if (!expression) {
      injectResult.style.display = 'block';
      injectResult.className = 'result error';
      injectResult.textContent = 'Please enter a JEXL expression first';
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { 
        action: 'injectJEXL', 
        expression: expression 
      }, (response) => {
        if (chrome.runtime.lastError) {
          injectResult.style.display = 'block';
          injectResult.className = 'result error';
          injectResult.textContent = 'Error: Could not inject. Please refresh the page.';
          return;
        }
        
        injectResult.style.display = 'block';
        if (response && response.success) {
          injectResult.className = 'result success';
          injectResult.textContent = '✅ Injected into JEXL Condition field!';
        } else {
          injectResult.className = 'result error';
          injectResult.textContent = response?.error || 'Could not find JEXL Condition field';
        }
      });
    });
  });
});

// Convert product requirement to JEXL (simple rule-based conversion)
function convertRequirementToJEXL(requirement) {
  const lower = requirement.toLowerCase();
  let jexl = '';
  
  // Revenue patterns
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
  
  // Level patterns
  if (/level|main.*level/i.test(requirement)) {
    const match = requirement.match(/(?:equal|==|is)\s*(\d+)|(?:greater|>|>=)\s*(\d+)|(?:less|<|<=)\s*(\d+)/i);
    const value = match ? (match[1] || match[2] || match[3]) : '0';
    const op = /equal|==|is/.test(requirement) ? '==' : 
               /greater|>/.test(requirement) ? '>' : '<';
    jexl = `user.sw_main_level ${op} ${value}`;
  }
  
  // Session patterns
  if (/session/i.test(requirement)) {
    const match = requirement.match(/(?:greater|>|>=|more)\s*(\d+)/i);
    const value = match ? match[1] : '0';
    jexl = `user.sw_session_counter >= ${value}`;
  }
  
  // Combine multiple conditions
  if (/and|&&/i.test(requirement) && jexl) {
    // Try to extract second condition
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
