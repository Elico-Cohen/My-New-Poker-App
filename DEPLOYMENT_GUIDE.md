# 📱 Poker App Deployment & Update Guide

## Quick Reference for Managing Your App

---

## 🔄 How to Update Your App After Making Changes

### For Regular Updates (Code, UI, Bug Fixes)
```bash
npx eas update --branch preview
```
- Users get the update automatically next time they open the app
- **No reinstall needed**
- Takes 1-2 minutes

### For Major Updates (New Packages, Native Changes)
```bash
npx eas build --platform android --profile preview
```
- Creates a new APK
- Takes 15-20 minutes
- Need to reinstall the new APK

---

## 🏗️ Building a New Version

### Full Build Process:
```bash
# 1. Make sure all changes are committed
git add .
git commit -m "Your changes"
git push

# 2. Build the app
npx eas build --platform android --profile preview

# 3. Wait for the build to complete (15-20 minutes)
# You'll get a download link when done
```

### Installing on Your Phone:
1. Open the download link on your Android phone
2. Download the APK file
3. Install it (allow "Install from unknown sources" if prompted)
4. Done!

---

## 📊 Checking Build Status

### In Terminal:
The build will show progress messages

### In Browser:
Visit: https://expo.dev/accounts/elico-cohen/projects/MyNewPokerApp/builds

---

## 🔧 Build Profiles

Your app has 3 build profiles configured:

### **preview** (What you're using now)
- Creates APK for direct installation
- Perfect for testing and personal use
- Command: `--profile preview`

### **production**
- For Google Play Store publishing
- Creates AAB (Android App Bundle)
- Command: `--profile production`

### **development**
- For development with live reloading
- Command: `--profile development`

---

## 📝 Version Management

### Update Version Number:
Edit `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",  // Change this
    ...
  }
}
```

### When to Bump Version:
- **Patch (1.0.0 → 1.0.1)**: Bug fixes, small changes
- **Minor (1.0.0 → 1.1.0)**: New features, improvements
- **Major (1.0.0 → 2.0.0)**: Breaking changes, major updates

---

## 🚨 Troubleshooting

### "Build Failed"
1. Check the build logs at expo.dev
2. Make sure all dependencies are installed: `npm install`
3. Try cleaning and rebuilding

### "Update Not Working"
1. Make sure you're using the same build profile (preview)
2. Users need to restart the app to get updates
3. OTA updates only work for JavaScript/React code changes

### "Can't Install APK"
1. Enable "Install from unknown sources" in phone settings
2. Make sure you're downloading the correct APK
3. Uninstall old version first if needed

---

## 📱 App Information

- **Package Name**: com.elicohen.mynewpokerapp
- **Owner**: elico-cohen
- **Expo Project**: https://expo.dev/accounts/elico-cohen/projects/MyNewPokerApp

---

## 💡 Tips

1. **Always commit your changes** before building
2. **Test locally first** with `npx expo start`
3. **Use OTA updates** for quick fixes (no reinstall needed)
4. **Keep your keystore safe** - Expo manages it for you on their servers
5. **Document your changes** in commit messages

---

## 🔗 Useful Links

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Update Docs**: https://docs.expo.dev/eas-update/introduction/
- **Your Expo Dashboard**: https://expo.dev/accounts/elico-cohen
- **GitHub Repository**: https://github.com/Elico-Cohen/My-New-Poker-App

---

## 📋 Next Session TODO

Items to review and work on:
- [ ] Authentication system review
- [ ] User permissions setup
- [ ] Other minor improvements and changes

---

**Last Updated**: October 30, 2025
**App Version**: 1.0.0
**Build Profile**: preview
