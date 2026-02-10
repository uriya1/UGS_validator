/**
 * UGS/Wisdom Parameter Schema
 * Based on the Google Sheet reference: https://docs.google.com/spreadsheets/d/1Qhunq_rUjORRKphsOfPOHoVfz4h0usPYeayza0_rlmc
 * Comprehensive parameter database for validation and autocomplete
 */

const UGS_PARAMETERS = [
  // Wisdom User-level Top Priority Parameters
  { id: 'user.sw_total_revenue', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total revenue from all sources', example: 'user.sw_total_revenue > 0' },
  { id: 'user.sw_iap_ltv', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Lifetime value from in-app purchases', example: 'user.sw_iap_ltv > 100' },
  { id: 'user.sw_ads_ltv', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Lifetime value from ads', example: 'user.sw_ads_ltv > 0' },
  { id: 'user.sw_total_iap_revenue', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total IAP revenue', example: 'user.sw_total_iap_revenue > 0' },
  { id: 'user.sw_total_iap_transactions', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total IAP transactions', example: 'user.sw_total_iap_transactions > 0' },
  { id: 'user.sw_avg_last_3_iap_revenue', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Avg revenue from last 3 IAPs', example: 'user.sw_avg_last_3_iap_revenue > 0' },
  { id: 'user.sw_avg_last_7_iap_revenue', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Avg revenue from last 7 IAPs', example: 'user.sw_avg_last_7_iap_revenue > 0' },
  { id: 'user.sw_total_last_14d_iap_revenue', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total IAP revenue in last 14 days', example: 'user.sw_total_last_14d_iap_revenue > 0' },
  { id: 'user.sw_total_last_14d_iap_transactions', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total IAP transactions in last 14 days', example: 'user.sw_total_last_14d_iap_transactions > 0' },
  { id: 'user.sw_avg_last_3_iap_refunds', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Avg refunds from last 3 IAPs', example: 'user.sw_avg_last_3_iap_refunds > 0' },
  { id: 'user.sw_avg_last_7_iap_refunds', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Avg refunds from last 7 IAPs', example: 'user.sw_avg_last_7_iap_refunds > 0' },
  { id: 'user.sw_total_last_14d_iap_refunds', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total refunds in last 14 days', example: 'user.sw_total_last_14d_iap_refunds > 0' },
  { id: 'user.sw_total_last_14d_iap_refund_transactions', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total refund transactions in last 14 days', example: 'user.sw_total_last_14d_iap_refund_transactions > 0' },
  { id: 'user.sw_main_level', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Main level (custom game attribute)', example: 'user.sw_main_level == 0' },
  { id: 'user.sw_secondary_level', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Secondary level (custom game attribute)', example: 'user.sw_secondary_level == 1' },
  { id: 'user.sw_session_counter', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Number of sessions', example: 'user.sw_session_counter >= 3' },
  { id: 'user.sw_mega_playtime', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Mega playtime (custom game metric)', example: 'user.sw_mega_playtime > 50' },
  { id: 'user.sw_total_neto_playtime', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Total net playtime', example: 'user.sw_total_neto_playtime > 100' },
  { id: 'user.sw_game_session_duration_netto', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'Net duration of a game session', example: 'user.sw_game_session_duration_netto == 21' },
  { id: 'user.sw_acquisition_channel', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'User acquisition channel', example: "user.sw_acquisition_channel == 'Empty'" },
  { id: 'user.sw_acquisition_campaign_id', level: 'user', platform: 'Wisdom', priority: 'Top', description: 'User acquisition campaign ID', example: "user.sw_acquisition_campaign_id == 'campaign_123'" },
  
  // Wisdom App-level Parameters
  { id: 'app.sw_user_bucket', level: 'app', platform: 'Wisdom', priority: 'Top', description: 'User bucket for segmentation', example: 'app.sw_user_bucket == 3' },
  
  // UGS Unity-level Parameters (Third Priority)
  { id: 'unity.graphicsDeviceVendor', level: 'unity', platform: 'UGS', priority: 'Third', description: 'Graphics vendor name', example: "unity.graphicsDeviceVendor == 'ARM'" },
  { id: 'unity.deviceUniqueIdentifier', level: 'unity', platform: 'UGS', priority: 'Third', description: 'A unique identifier for the device', example: "unity.deviceUniqueIdentifier == 'abc123xyz'" },
  { id: 'unity.userId', level: 'unity', platform: 'UGS', priority: 'Third', description: 'The user identifier (if set by developer)', example: "unity.userId == 'user_001'" },
  { id: 'unity.language', level: 'unity', platform: 'UGS', priority: 'Third', description: 'The language the application is running in', example: "unity.language == 'en'" },
  { id: 'unity.graphicsVersion', level: 'unity', platform: 'UGS', priority: 'Third', description: 'Graphics API version', example: "unity.graphicsVersion == 'Vulkan 1.1.0'" },
  { id: 'unity.graphicsShader', level: 'unity', platform: 'UGS', priority: 'Third', description: 'Graphics shader version', example: 'unity.graphicsShader == 50' },
  { id: 'unity.maxTextureSize', level: 'unity', platform: 'UGS', priority: 'Third', description: 'Maximum supported texture size (pixels)', example: 'unity.maxTextureSize >= 4096' },
  
  // Wisdom Third Priority Parameters
  { id: 'user.momentum_sdk_version', level: 'user', platform: 'Wisdom', priority: 'Third', description: 'Version of Momentum SDK (if present)', example: 'user.momentum_sdk_version == null' },
  { id: 'user.sw_acquisition_creative_id', level: 'user', platform: 'Wisdom', priority: 'Third', description: 'User acquisition creative ID', example: "user.sw_acquisition_creative_id == 'Empty'" },
];

/**
 * Parameter lookup utilities
 */
const ParameterUtils = {
  /**
   * Find parameter by ID (supports partial matching)
   */
  findParameter(paramId) {
    // Try exact match first
    let param = UGS_PARAMETERS.find(p => p.id === paramId);
    if (param) return param;
    
    // Try partial match (e.g., "sw_total_revenue" matches "user.sw_total_revenue")
    const paramName = paramId.split('.').pop();
    param = UGS_PARAMETERS.find(p => p.id.endsWith('.' + paramName) || p.id === paramName);
    return param;
  },
  
  /**
   * Get all parameters for a specific level
   */
  getByLevel(level) {
    return UGS_PARAMETERS.filter(p => p.level === level);
  },
  
  /**
   * Get all parameters for a platform
   */
  getByPlatform(platform) {
    return UGS_PARAMETERS.filter(p => p.platform === platform);
  },
  
  /**
   * Search parameters by name/description
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return UGS_PARAMETERS.filter(p => 
      p.id.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );
  },
  
  /**
   * Get parameter suggestions for autocomplete
   */
  getSuggestions(partial) {
    if (!partial || partial.length < 2) return [];
    
    const lowerPartial = partial.toLowerCase();
    return UGS_PARAMETERS
      .filter(p => p.id.toLowerCase().includes(lowerPartial))
      .slice(0, 10) // Limit to 10 suggestions
      .sort((a, b) => {
        // Prioritize exact matches and matches at the start
        const aStarts = a.id.toLowerCase().startsWith(lowerPartial);
        const bStarts = b.id.toLowerCase().startsWith(lowerPartial);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.id.localeCompare(b.id);
      });
  }
};

// Export for use in content script
if (typeof window !== 'undefined') {
  window.UGS_PARAMETERS = UGS_PARAMETERS;
  window.ParameterUtils = ParameterUtils;
}
