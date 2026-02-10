/**
 * JEXL Validator Engine
 * Validates JEXL expressions with UGS-specific parameter knowledge
 */

class JEXLValidator {
  constructor(ugsParameters) {
    this.ugsParameters = ugsParameters;
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Main validation method
   * @param {string} expression - JEXL expression to validate
   * @param {Object} remoteConfigData - Optional remote config data for parameter validation
   * @returns {Object} Validation result with errors, warnings, and suggestions
   */
  validate(expression, remoteConfigData = null) {
    this.errors = [];
    this.warnings = [];
    
    if (!expression || expression.trim() === '') {
      return {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };
    }

    // Check if expression contains UGS/Wisdom parameters
    const hasUGSParameters = /\b(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/.test(expression);
    
    // Allow "true" and "false" as valid boolean literals in JEXL
    const trimmedExpression = expression.trim();
    const isBooleanLiteral = /^(true|false)$/i.test(trimmedExpression);
    
    if (isBooleanLiteral) {
      // "true" and "false" are valid JEXL boolean literals
      return {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };
    }
    
    // If expression doesn't contain any UGS parameters, it's invalid
    if (!hasUGSParameters) {
      // Check if it's just a simple value (like "uriya", numbers, strings)
      const isSimpleValue = /^(\d+|'[^']*'|"[^"]*"|uriya|[\w]+)$/i.test(trimmedExpression);
      
      if (isSimpleValue) {
        this.errors.push({
          type: 'parameter',
          message: `Expression "${trimmedExpression}" is not a valid JEXL expression. It must reference UGS/Wisdom parameters (e.g., user.sw_main_level == 4)`,
          position: 0
        });
        return {
          valid: false,
          errors: this.errors,
          warnings: this.warnings,
          suggestions: []
        };
      }
    }

    // Check if expression is a complete JEXL expression (has operator and value)
    if (hasUGSParameters) {
      const trimmedExpr = expression.trim();
      // Check if it's just a parameter without operator and value
      const isJustParameter = /^(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\s*$/.test(trimmedExpr);
      
      if (isJustParameter) {
        this.errors.push({
          type: 'syntax',
          message: `Incomplete expression: "${trimmedExpr}" is just a parameter. A valid JEXL expression requires an operator and value (e.g., ${trimmedExpr} == 4)`,
          position: 0
        });
        return {
          valid: false,
          errors: this.errors,
          warnings: this.warnings,
          suggestions: []
        };
      }
      
      // Check if expression has a parameter but missing operator (e.g., "user.sw_main_level  4")
      // Valid operators: ==, !=, >, <, >=, <=, &&, ||, in, matches
      const hasOperator = /(==|!=|>=|<=|>|<|&&|\|\||\bin\b|\bmatches\b)/.test(expression);
      
      if (!hasOperator) {
        // Check if there are multiple tokens (parameter and value) but no operator
        const tokens = trimmedExpr.split(/\s+/).filter(t => t.trim());
        if (tokens.length >= 2) {
          // Has parameter and something else, but no operator
          this.errors.push({
            type: 'syntax',
            message: `Missing operator: "${trimmedExpr}" has a parameter and value but no comparison operator. Use ==, !=, >, <, >=, or <= (e.g., ${tokens[0]} == ${tokens[1]})`,
            position: tokens[0].length
          });
          return {
            valid: false,
            errors: this.errors,
            warnings: this.warnings,
            suggestions: []
          };
        }
      }
    }

    // 1. Basic syntax validation
    this.validateSyntax(expression);
    
    // 2. Parameter validation (only if we have parameters)
    if (hasUGSParameters) {
      this.validateParameters(expression, remoteConfigData);
    }
    
    // 3. Intent validation (common patterns)
    this.validateIntent(expression);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.generateSuggestions(expression)
    };
  }

  /**
   * Basic JEXL syntax validation
   */
  validateSyntax(expression) {
    // Check for invalid assignment (JEXL doesn't use = for assignment, only == for comparison)
    if (/[^=!<>]=[^=]/.test(expression) && !/==|!=|<=|>=/.test(expression)) {
      // Check if it's a single = that's not part of ==, !=, <=, >=
      const singleEquals = expression.match(/(?<!==|!=|<=|>=|<=|>=)[^=!<>]=[^=]/);
      if (singleEquals) {
        this.errors.push({
          type: 'syntax',
          message: `Invalid assignment operator '='. Use '==' for comparison in JEXL`,
          position: expression.indexOf(singleEquals[0])
        });
      }
    }
    
    // Check for balanced parentheses
    const openParens = (expression.match(/\(/g) || []).length;
    const closeParens = (expression.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      this.errors.push({
        type: 'syntax',
        message: `Unbalanced parentheses: ${openParens} opening, ${closeParens} closing`,
        position: expression.length
      });
    }

    // Check for balanced brackets
    const openBrackets = (expression.match(/\[/g) || []).length;
    const closeBrackets = (expression.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      this.errors.push({
        type: 'syntax',
        message: `Unbalanced brackets: ${openBrackets} opening, ${closeBrackets} closing`,
        position: expression.length
      });
    }

    // Check for balanced quotes
    const singleQuotes = (expression.match(/'/g) || []).length;
    const doubleQuotes = (expression.match(/"/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      this.errors.push({
        type: 'syntax',
        message: 'Unbalanced single quotes',
        position: expression.indexOf("'")
      });
    }
    if (doubleQuotes % 2 !== 0) {
      this.errors.push({
        type: 'syntax',
        message: 'Unbalanced double quotes',
        position: expression.indexOf('"')
      });
    }

    // Check for invalid operators
    const invalidOperators = expression.match(/[<>=!]{3,}/g);
    if (invalidOperators) {
      this.errors.push({
        type: 'syntax',
        message: `Invalid operator sequence: ${invalidOperators[0]}`,
        position: expression.indexOf(invalidOperators[0])
      });
    }
  }

  /**
   * Validate UGS/Wisdom parameters referenced in expression
   */
  validateParameters(expression, remoteConfigData = null) {
    // Extract parameter references (user.param, app.param, unity.param)
    const paramPattern = /\b(user|app|unity)\.([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const matches = [...expression.matchAll(paramPattern)];
    
    matches.forEach(match => {
      const [fullMatch, level, paramName] = match;
      const paramKey = `${level}.${paramName}`;
      
      // First check static UGS parameters
      let param;
      if (typeof ParameterUtils !== 'undefined') {
        param = ParameterUtils.findParameter(paramKey);
      } else {
        param = this.ugsParameters.find(p => 
          p.id === paramKey || p.id === paramName || p.id.endsWith('.' + paramName)
        );
      }
      
      // If not found in static list, check remote config data
      if (!param && remoteConfigData) {
        const levelData = remoteConfigData[level];
        if (levelData && levelData.hasOwnProperty(paramName)) {
          // Parameter exists in remote config - it's valid
          param = { id: paramKey, level: level, exists: true };
        }
      }
      
      if (!param) {
        this.warnings.push({
          type: 'parameter',
          message: `Unknown parameter: ${fullMatch}. This may not exist in UGS/Wisdom.`,
          parameter: fullMatch,
          position: match.index,
          suggestions: this.getParameterSuggestions(paramName)
        });
      } else if (param.level && param.level !== level && param.platform !== level) {
        // Only validate parameter level matches if param has level info (from static list)
        // Remote config params don't have level info, so skip this check
        if (param.level !== level && param.platform !== level) {
          this.warnings.push({
            type: 'parameter',
            message: `Parameter ${paramName} is typically at ${param.level} level, not ${level}`,
            parameter: fullMatch,
            position: match.index
          });
        }
      }
    });
  }
  
  /**
   * Get parameter suggestions for unknown parameters
   */
  getParameterSuggestions(paramName) {
    if (typeof ParameterUtils !== 'undefined') {
      return ParameterUtils.getSuggestions(paramName).slice(0, 3);
    }
    return this.ugsParameters
      .filter(p => p.id.toLowerCase().includes(paramName.toLowerCase()))
      .slice(0, 3);
  }

  /**
   * Validate intent - check for common logical errors
   */
  validateIntent(expression) {
    // Check for common comparison mistakes
    if (expression.includes('== null') || expression.includes('== null')) {
      this.warnings.push({
        type: 'intent',
        message: 'Consider using "== null" or "!= null" for null checks in JEXL',
        position: expression.indexOf('== null')
      });
    }

    // Check for string comparisons that might need quotes
    const stringComparePattern = /==\s*[a-zA-Z_][a-zA-Z0-9_]*\b(?!['"])/g;
    const stringMatches = [...expression.matchAll(stringComparePattern)];
    stringMatches.forEach(match => {
      if (!this.ugsParameters.some(p => p.id === match[0].split('==')[1].trim())) {
        this.warnings.push({
          type: 'intent',
          message: `String comparison may need quotes: ${match[0]}`,
          position: match.index
        });
      }
    });
  }

  /**
   * Generate suggestions for fixing errors
   */
  generateSuggestions(expression) {
    const suggestions = [];
    
    // If there are parameter warnings, suggest similar parameters
    this.warnings.filter(w => w.type === 'parameter').forEach(warning => {
      const paramName = warning.parameter.split('.')[1] || warning.parameter;
      
      // Use suggestions from warning if available
      if (warning.suggestions && warning.suggestions.length > 0) {
        suggestions.push({
          type: 'parameter_suggestion',
          message: `Did you mean: ${warning.suggestions.map(s => s.id).join(', ')}?`,
          original: warning.parameter,
          alternatives: warning.suggestions.map(s => s.id),
          examples: warning.suggestions.map(s => s.example).filter(e => e)
        });
      } else {
        // Fallback to manual search
        let similar;
        if (typeof ParameterUtils !== 'undefined') {
          similar = ParameterUtils.getSuggestions(paramName).slice(0, 3);
        } else {
          similar = this.ugsParameters.filter(p => 
            p.id.includes(paramName) || p.id.toLowerCase().includes(paramName.toLowerCase())
          ).slice(0, 3);
        }
        
        if (similar.length > 0) {
          suggestions.push({
            type: 'parameter_suggestion',
            message: `Did you mean: ${similar.map(s => s.id).join(', ')}?`,
            original: warning.parameter,
            alternatives: similar.map(s => s.id),
            examples: similar.map(s => s.example).filter(e => e)
          });
        }
      }
    });

    return suggestions;
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.JEXLValidator = JEXLValidator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JEXLValidator;
}
