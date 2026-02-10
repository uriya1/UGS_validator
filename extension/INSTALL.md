# Quick Installation Guide

## Install the Extension

1. **Open Chrome Extensions**
   - Go to `chrome://extensions/`
   - Or: Menu → More Tools → Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top right

3. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to and select the `extension` folder
   - The extension should now appear in your extensions list

4. **Test It**
   - Go to any Unity Gaming Services page (unity.com, cloud.unity.com)
   - Start typing a JEXL expression in any input field
   - You should see validation feedback appear

## Icon Placeholders

The extension includes placeholder icon files. For production, replace:
- `assets/icon16.png`
- `assets/icon48.png`  
- `assets/icon128.png`

With actual icons (16x16, 48x48, 128x128 pixels).

## Troubleshooting

- **Not working?** Check the browser console (F12) for errors
- **Not detecting fields?** The extension looks for inputs containing `user.`, `app.`, or `unity.` patterns
- **Permission issues?** Make sure the extension has access to Unity domains
