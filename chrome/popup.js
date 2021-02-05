const solvingAs = document.getElementById("solving-as");
const statusBar = document.getElementById("status-bar");

chrome.storage.sync.get("solverName", ({ solverName }) => {
  if (solverName && solverName !== "") {
    solvingAs.textContent = `Solving as: ${solverName}`;
  } else {
    solvingAs.textContent = "Anonymous solver (set name in preferences)";
  }
});

document.getElementById("preferences-link").addEventListener("click", async () => {
  chrome.runtime.openOptionsPage();
})

document.getElementById("log-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "logRecord" });
    statusBar.textContent = "Logged record to console";
  });
});

document.getElementById("store-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "storeRecord" },
      ({ success }) => {
        if (success) {
          statusBar.textContent = "Stored record to browser storage";
        } else {
          statusBar.textContent = "Failed to store record to browser storage";
        }
      },
    );
  });
});

document.getElementById("clear-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "clearRecord" },
      ({ success }) => {
        if (success) {
          statusBar.textContent = "Cleared record from browser storage";
        } else {
          statusBar.textContent = "Failed to clear record from browser storage";
        }
      },
    );
  });
});

document.getElementById("download-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "downloadRecord" },
      ({ success, record, defaultFilename }) => {
        if (success && record) {
          chrome.downloads.download({
            url: URL.createObjectURL(
              new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
            ),
            filename: defaultFilename,
            saveAs: true,
          });
          statusBar.textContent = "Record download successfully requested";
        } else {
          statusBar.textContent = "Unable to download record";
        }
      },
    );
  });
});
