/**
 * AdMob for the Android wrap only.
 * Banner on title / menus. Hidden during a live stand-off so it never covers the gun.
 * Interstitials between streets, frequency-capped.
 */
(function (root) {
  const LIVE = {
    appId: "ca-app-pub-0970861679884235~4548340358",
    banner: "ca-app-pub-0970861679884235/4436659719",
    interstitial: "ca-app-pub-0970861679884235/9609095344",
  };

  const CAP_MS = 2.5 * 60 * 1000;
  const BANNER_FALLBACK = 56;

  let initialized = false;
  let allowed = true;
  let lastInterstitial = 0;
  let interstitialReady = false;
  let bannerWanted = false;

  function isNative() {
    return !!(root.Capacitor && typeof root.Capacitor.isNativePlatform === "function" && root.Capacitor.isNativePlatform());
  }

  function plugin() {
    if (!isNative()) return null;
    return (root.Capacitor.Plugins && root.Capacitor.Plugins.AdMob) || null;
  }

  function setPad(px) {
    const n = Math.max(0, Math.round(px || 0));
    document.documentElement.style.setProperty("--ad-height", n + "px");
  }

  function ids() {
    return LIVE;
  }

  const Ads = {
    get allowed() {
      return allowed;
    },

    async initialize() {
      if (initialized) return;
      const AdMob = plugin();
      if (!AdMob) {
        initialized = true;
        setPad(0);
        return;
      }
      try {
        await AdMob.initialize({
          initializeForTesting: false,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: false,
        });
        try {
          if (typeof AdMob.requestConsentInfo === "function") {
            let info = await AdMob.requestConsentInfo();
            if (info && info.isConsentFormAvailable && info.status === "REQUIRED" && typeof AdMob.showConsentForm === "function") {
              info = await AdMob.showConsentForm();
            }
            if (info && info.status === "OBTAINED" && info.canRequestAds === false) {
              allowed = false;
            }
          }
        } catch (err) {
          console.log("[BjangoAds] consent", err);
        }
        if (AdMob.addListener) {
          AdMob.addListener("onAdSize", function (info) {
            if (bannerWanted && info && info.height) setPad(info.height);
          });
          AdMob.addListener("bannerAdSizeChanged", function (info) {
            if (bannerWanted && info && info.height) setPad(info.height);
          });
        }
      } catch (err) {
        console.warn("[BjangoAds] init", err);
      }
      initialized = true;
      if (allowed) Ads.preloadInterstitial();
    },

    async showBanner() {
      if (!allowed) return;
      bannerWanted = true;
      const AdMob = plugin();
      if (!AdMob) return;
      try {
        await AdMob.showBanner({
          adId: ids().banner,
          adSize: "ADAPTIVE_BANNER",
          position: "BOTTOM_CENTER",
          margin: 0,
          isTesting: false,
        });
        setPad(BANNER_FALLBACK);
      } catch (err) {
        console.warn("[BjangoAds] banner", err);
      }
    },

    async hideBanner() {
      bannerWanted = false;
      const AdMob = plugin();
      setPad(0);
      if (!AdMob) return;
      try {
        await AdMob.hideBanner();
      } catch (err) {
        /* already hidden */
      }
    },

    async resumeBanner() {
      if (!allowed) return;
      bannerWanted = true;
      const AdMob = plugin();
      if (!AdMob) return;
      try {
        if (typeof AdMob.resumeBanner === "function") {
          await AdMob.resumeBanner();
          setPad(BANNER_FALLBACK);
          return;
        }
      } catch (_) {}
      await Ads.showBanner();
    },

    async preloadInterstitial() {
      if (!allowed) return;
      const AdMob = plugin();
      if (!AdMob) return;
      try {
        await AdMob.prepareInterstitial({
          adId: ids().interstitial,
          isTesting: false,
        });
        interstitialReady = true;
      } catch (err) {
        interstitialReady = false;
        console.log("[BjangoAds] preload", err);
      }
    },

    async showInterstitial() {
      if (!allowed) return false;
      const now = Date.now();
      if (now - lastInterstitial < CAP_MS) return false;
      const AdMob = plugin();
      if (!AdMob) return false;
      try {
        if (!interstitialReady) {
          await AdMob.prepareInterstitial({
            adId: ids().interstitial,
            isTesting: false,
          });
        }
        await AdMob.showInterstitial();
        lastInterstitial = Date.now();
        interstitialReady = false;
        setTimeout(function () {
          Ads.preloadInterstitial();
        }, 4000);
        return true;
      } catch (err) {
        console.log("[BjangoAds] interstitial skipped", err);
        Ads.preloadInterstitial();
        return false;
      }
    },
  };

  root.BjangoAds = Ads;
})(typeof window !== "undefined" ? window : globalThis);
