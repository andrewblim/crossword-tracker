const trackingEnabledInput = document.getElementById("tracking-enabled");

chrome.storage.local.get("trackingEnabled", ({ trackingEnabled }) => {
  trackingEnabledInput.checked = Boolean(trackingEnabled);
});

trackingEnabledInput.addEventListener("click", async () => {
  chrome.storage.local.set({ "trackingEnabled": trackingEnabledInput.checked });
});

document.getElementById("log-record").addEventListener("click", async () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "logRecord" });
  });
});

document.getElementById("store-record").addEventListener("click", async () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "storeRecord" });
  });
});

document.getElementById("clear-record").addEventListener("click", async () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "clearRecord" });
  });
});

document.getElementById("save-record").addEventListener("click", async () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "saveRecord" },
      ({ record, defaultFilename }) => {
        chrome.downloads.download({
          url: URL.createObjectURL(
            new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
          ),
          filename: defaultFilename,
          saveAs: true
        });
      }
    );
  });
});
