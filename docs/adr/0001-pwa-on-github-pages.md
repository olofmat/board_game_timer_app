# PWA on GitHub Pages, not a native app

The app is a Progressive Web App deployed to GitHub Pages from `main` by a GitHub Action, installed via "Add to Home Screen". A native Android app was rejected because it wouldn't run on iPhone and each update would need an APK rebuild and reinstall; the PWA is free, works on both platforms, runs offline, and updates by simply pushing to `main`, and also leaves the option of making a change from a phone via Claude when away from the computer.
