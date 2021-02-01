let trackingEnabledInput = document.getElementById("tracking-enabled");

chrome.storage.local.get("trackingEnabled", ({ trackingEnabled }) => {
  trackingEnabledInput.checked = Boolean(trackingEnabled);
});

trackingEnabledInput.addEventListener("click", async () => {
  chrome.storage.local.set({ "trackingEnabled": trackingEnabledInput.checked });
});
