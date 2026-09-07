/**
 * Capacitor / Play Store shell. No-ops in the browser PWA.
 */
(function () {
  const cap = window.Capacitor;
  const native = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  window.BJANGO_NATIVE = native;
  if (!native) return;

  document.documentElement.classList.add("native");

  const plugins = (cap.Plugins || {});
  const StatusBar = plugins.StatusBar;
  const App = plugins.App;
  const Share = plugins.Share;

  if (window.BjangoAds && typeof window.BjangoAds.initialize === "function") {
    window.BjangoAds.initialize();
  }

  if (StatusBar) {
    Promise.resolve()
      .then(function () {
        return StatusBar.setOverlaysWebView({ overlay: true });
      })
      .then(function () {
        return StatusBar.setBackgroundColor({ color: "#100a07" });
      })
      .then(function () {
        return StatusBar.setStyle({ style: "DARK" });
      })
      .catch(function () {});
  }

  window.BJANGO_SHARE = function (payload) {
    if (Share && typeof Share.share === "function") {
      return Share.share(payload);
    }
    return Promise.reject(new Error("share unavailable"));
  };

  if (App && typeof App.addListener === "function") {
    App.addListener("backButton", function () {
      const how = document.getElementById("overlay-how");
      if (how && !how.hidden) {
        const close = document.getElementById("btn-how-close");
        if (close) close.click();
        return;
      }
      const menu = document.getElementById("menu");
      if (menu && !menu.hidden) {
        const btn = document.getElementById("btn-menu");
        if (btn) btn.click();
        return;
      }
      const end = document.getElementById("overlay-end");
      if (end && !end.hidden) return;
      const home = document.getElementById("btn-home");
      if (home && !home.hidden) {
        home.click();
        return;
      }
      if (App.exitApp) App.exitApp();
    });
  }
})();
