function updateNetworkStatusBar() {
  const statusBar = document.getElementById("network-status-bar");

  if (!statusBar) {
    return;
  }

  const isOffline = navigator.onLine === false;

  statusBar.hidden = !isOffline;
  document.body.classList.toggle("is-offline", isOffline);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch(function (error) {
        console.warn("Service worker registration failed", error);
      });
  });
}

window.addEventListener("DOMContentLoaded", updateNetworkStatusBar);
window.addEventListener("online", updateNetworkStatusBar);
window.addEventListener("offline", updateNetworkStatusBar);
