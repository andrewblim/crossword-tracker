"use strict";

// Minor amounts of current user settings displayed at top
chrome.storage.local.get(
  ["solverName", "eventLogLevel"],
  ({ solverName, eventLogLevel }) => {
    const solvingAsElem = document.getElementById("solving-as");
    if (solverName && solverName !== "") {
      solvingAsElem.textContent = `Solving as: ${solverName}`;
    } else {
      solvingAsElem.textContent = "Anonymous solver (set name in preferences)";
    }
    const eventLogLevelElem = document.getElementById("event-log-level");
    switch (eventLogLevel) {
      case "full":
        eventLogLevelElem.textContent = "Logging events + navigation";
        break;
      default:
        eventLogLevelElem.textContent = "Logging events only";
    }
});

document.getElementById("preferences-link").addEventListener("click", async () => {
  chrome.runtime.openOptionsPage();
})

// Popup interactions with active tab
// In general, these all take the form of sending a message to the current tab,
// and then expecting a response with a "success" true/false field, based on
// which it updates the status bar.

const updateStatusBar = (message) => {
  document.getElementById("status-bar").textContent = message;
}

document.getElementById("log-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "logRecord" },
      (result) => {
        if (result?.success) {
          const msg = "Logged record to console";
          updateStatusBar(msg);
          console.log(msg);
        } else if (result?.error) {
          const msg = `Failed to log record to console. Error: ${result.error}`;
          updateStatusBar(msg);
          console.log(msg);
        } else {
          const msg = "Failed to log record to console, unspecified error";
          updateStatusBar(msg);
          console.log(msg);
        }
      },
    );
  });
});

document.getElementById("cache-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "cacheRecord" },
      (result) => {
        if (result?.success) {
          const msg = "Cached record to browser storage";
          updateStatusBar(msg);
          console.log(msg);
        } else if (result?.error) {
          const msg = `Failed to cache to browser storage. Error: ${result.error}`;
          updateStatusBar(msg);
          console.log(msg);
        } else {
          const msg = "Failed to cache to browser storage, unspecified error";
          updateStatusBar(msg);
          console.log(msg);
        }
      },
    );
  });
});

document.getElementById("clear-and-reset-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const verify = confirm(
      "Are you sure you want to clear and reset this record? This will clear " +
      "your event history and treat the current state of the puzzle as the " +
      "new initial state.",
    )
    if (verify) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "clearAndResetRecord" },
        (result) => {
          if (result?.success) {
            const msg = "Cleared record from browser storage and reset tracking";
            updateStatusBar(msg);
            console.log(msg);
          } else if (result?.error) {
            const msg = `Failed to clear from browser storage and reset tracking. Error: ${result.error}`;
            updateStatusBar(msg);
            console.log(msg);
          } else {
            const msg = "Failed to clear from browser storage and reset tracking, unspecified error";
            updateStatusBar(msg);
            console.log(msg);
          }
        },
      );
    }
  });
});

document.getElementById("download-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "getRecord" },
      (result) => {
        if (result?.success) {
          downloadRecord(result.record, {
            filename: suggestedRecordFilename(result.record, "json"),
          });
          const msg = "Record download successfully requested";
          updateStatusBar(msg);
          console.log(msg);
        } else if (result?.error) {
          const msg = `Failed to download record. Error: ${result.error}`;
          updateStatusBar(msg);
          console.log(msg);
        } else {
          const msg = "Failed to download record, unspecified error";
          updateStatusBar(msg);
          console.log(msg);
        }
      },
    );
  });
});

// Only show the buttons if

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(
    tabs[0].id,
    { action: "ping" },
    (result) => {
      chrome.runtime.lastError; // prevent "Unchecked runtime.lastError" from showing in logs
      if (result?.success) {
        document.getElementById("interactions").style.display = "block";
        document.getElementById("no-puzzle-message").style.display = "none";
      } else {
        document.getElementById("interactions").style.display = "none";
        document.getElementById("no-puzzle-message").style.display = "block";
      }
    },
  );
})
