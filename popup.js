const trackingEnabledInput = document.getElementById("tracking-enabled");
const logEventsButton = document.getElementById("log-record");
const saveEventsButton = document.getElementById("save-record");

chrome.storage.local.get("trackingEnabled", ({ trackingEnabled }) => {
  trackingEnabledInput.checked = Boolean(trackingEnabled);
});

trackingEnabledInput.addEventListener("click", async () => {
  chrome.storage.local.set({ "trackingEnabled": trackingEnabledInput.checked });
});

logEventsButton.addEventListener("click", async () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { action: "logEvents" });
  });
})

saveEventsButton.addEventListener("click", async () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "saveEvents" },
      ({ data, defaultFilename }) => {
        chrome.downloads.download({
          url: URL.createObjectURL(
            new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
          ),
          filename: defaultFilename,
          saveAs: true
        });
      }
    );
  });
})
