"use strict";

import {
  downloadRecord,
} from "./common.js";

// Minor amounts of current user settings displayed at top
chrome.storage.sync.get(
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
        eventLogLevelElem.textContent = "Logging basic events + full navigation";
        break;
      case "selection":
        eventLogLevelElem.textContent = "Logging basic events + square selection";
        break;
      default:
        eventLogLevelElem.textContent = "Logging basic events only";
    }
});

const updateStatusBar = (message) => {
  document.getElementById("status-bar").textContent = message;
}

document.getElementById("preferences-link").addEventListener("click", async () => {
  chrome.runtime.openOptionsPage();
})

// Popup interactions with active tab
// In general, these all take the form of sending a message to the current tab,
// and then expecting a response with a "success" true/false field, based on
// which it updates the status bar.

document.getElementById("log-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "logRecord" },
      ({ success }) => {
        if (success) {
          updateStatusBar("Logged record to console");
        } else {
          updateStatusBar("Failed to log record to console");
        }
      },
    );
  });
});

document.getElementById("store-record").addEventListener("click", async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "storeRecord" },
      ({ success }) => {
        if (success) {
          updateStatusBar("Stored record to browser storage");
        } else {
          updateStatusBar("Failed to store record to browser storage");
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
          updateStatusBar("Cleared record from browser storage");
        } else {
          updateStatusBar("Failed to clear record from browser storage");
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
        if (success) {
          downloadRecord(record, { filename: defaultFilename });
          updateStatusBar("Record download successfully requested");
        } else {
          updateStatusBar("Unable to download record");
        }
      },
    );
  });
});
