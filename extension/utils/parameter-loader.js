/**
 * Parameter Loader - Can load parameters from Google Sheet or external source
 * For future enhancement: Load parameters dynamically from the Google Sheet
 */

class ParameterLoader {
  /**
   * Load parameters from Google Sheet (future enhancement)
   * Currently uses static parameter list, but can be extended to fetch from sheet
   */
  static async loadFromGoogleSheet(sheetId) {
    // Future implementation: Use Google Sheets API to load parameters
    // For now, return the static list
    return UGS_PARAMETERS;
  }
  
  /**
   * Validate and add custom parameters
   */
  static addCustomParameter(param) {
    if (!param.id || !param.level || !param.platform) {
      throw new Error('Parameter must have id, level, and platform');
    }
    
    // Check if already exists
    const exists = UGS_PARAMETERS.find(p => p.id === param.id);
    if (exists) {
      console.warn(`Parameter ${param.id} already exists, updating...`);
      Object.assign(exists, param);
    } else {
      UGS_PARAMETERS.push(param);
    }
    
    return param;
  }
  
  /**
   * Get parameter statistics
   */
  static getStats() {
    return {
      total: UGS_PARAMETERS.length,
      byLevel: {
        user: UGS_PARAMETERS.filter(p => p.level === 'user').length,
        app: UGS_PARAMETERS.filter(p => p.level === 'app').length,
        unity: UGS_PARAMETERS.filter(p => p.level === 'unity').length
      },
      byPlatform: {
        Wisdom: UGS_PARAMETERS.filter(p => p.platform === 'Wisdom').length,
        UGS: UGS_PARAMETERS.filter(p => p.platform === 'UGS').length
      },
      byPriority: {
        Top: UGS_PARAMETERS.filter(p => p.priority === 'Top').length,
        Third: UGS_PARAMETERS.filter(p => p.priority === 'Third').length
      }
    };
  }
}

// Export
if (typeof window !== 'undefined') {
  window.ParameterLoader = ParameterLoader;
}
