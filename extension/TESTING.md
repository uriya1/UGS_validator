# How to Test UGS Validator

## Quick Test Steps

1. **Load the Extension**
   - Go to `chrome://extensions/`
   - Make sure "UGS Validator" is enabled

2. **Open a Unity Gaming Services Page**
   - Go to: https://dashboard.unity3d.com/ or https://operate.dashboard.unity3d.com/
   - Or any Unity Gaming Services page where you configure A/B tests or remote config

3. **Look for the Validation Overlay**
   - You should see a floating box in the top-right corner
   - It will say "UGS Validator Ready" or "Looking for JEXL fields"

4. **Test Validation**
   - Find any input field or textarea on the page
   - Type a JEXL expression, for example:
     - `user.sw_total_revenue > 0`
     - `user.sw_iap_ltv > 100`
     - `app.sw_user_bucket == 3`
     - `unity.language == 'en'`

5. **See Validation Feedback**
   - **Valid expressions**: Green border on input, overlay shows "✓ Valid JEXL Expression"
   - **Invalid syntax**: Red border, error message appears
   - **Warnings**: Yellow border, warning about unknown parameters or suggestions

## What to Look For

### Visual Indicators:
- **Floating overlay** (top-right corner) - Shows validation status
- **Input field borders** - Change color based on validation:
  - 🟢 Green = Valid
  - 🔴 Red = Error
  - 🟡 Yellow = Warning
- **Inline tooltips** - Appear below input fields with error/warning messages

### Test Cases:

**Valid JEXL:**
```
user.sw_total_revenue > 0
user.sw_session_counter >= 3
app.sw_user_bucket == 3
unity.language == 'en'
```

**Invalid JEXL (should show errors):**
```
user.sw_total_revenue > 0)  // Unbalanced parenthesis
user.unknown_parameter > 0   // Unknown parameter warning
user.sw_total_revenue >     // Incomplete expression
```

## Troubleshooting

**Don't see the overlay?**
- Open browser console (F12) and check for errors
- Make sure you're on a Unity domain (*.unity.com, *.unity3d.com, *.cloud.unity.com)
- Try refreshing the page

**Not detecting input fields?**
- The extension attaches to textareas and text inputs
- Try typing in any input field - it should work even if not specifically JEXL
- Check console for "UGS Validator: Found X input fields"

**Validation not working?**
- Check console for JavaScript errors
- Make sure all scripts loaded (check Network tab)
- Try a simple expression first: `user.sw_total_revenue > 0`

## Debug Mode

Open browser console (F12) and you should see:
- "UGS Validator: Initializing..."
- "UGS Validator: Found X input fields"

If you see errors, share them and we can fix!
