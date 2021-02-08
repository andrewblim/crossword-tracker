"use strict";

// Default preferences to set on initial install

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    [
      "solverName",
      "eventLogLevel",
      "logUserAgent",
      "nytSettings",
    ],
    (results) => {
      const update = Object.assign(
        {
          "solverName": "",
          "eventLogLevel": "full",
          "logUserAgent": false,
          "nytSettings": {
            "eventFlushFrequency": 30,
          },
        },
        results,
      )
      chrome.storage.sync.set(update);
    },
  );
});

// Messages sent from tabs

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.action) {
    case "storeRecord":
      if (request.key !== undefined && request.record !== undefined) {
        chrome.storage.sync.set({ [request.key]: request.record }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError });
          } else {
            sendResponse({ success: true });
          }
        });
      } else {
        console.log(`Invalid ${request.action}, key or record undefined. Full request:`);
        console.log(request);
        sendResponse({ success: false });
      }
      break;
    case "clearRecord":
      if (request.key !== undefined) {
        chrome.storage.sync.remove(request.key, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError });
          } else {
            sendResponse({ success: true });
          }
        });
      } else {
        console.log(`Invalid ${request.action}, key undefined. Full request:`);
        console.log(request);
        sendResponse({ success: false });
      }
      break;
    case "setBadgeRecording":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.action.setBadgeBackgroundColor({ tabId: tabs[0].id, color: "red" });
        chrome.action.setBadgeText({ tabId: tabs[0].id, text: "REC" });
        sendResponse({ success: true });
      });
      break;
    case "setBadgeSolved":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.action.setBadgeBackgroundColor({ tabId: tabs[0].id, color: "green" });
        chrome.action.setBadgeText({ tabId: tabs[0].id, text: "✓" });
        sendResponse({ success: true });
      });
      break;
    case "clearBadge":
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.action.setBadgeText(tabs[0].id, null);
        sendResponse({ success: true });
      });
      break;
    default:
      console.log(`Unrecognized request action ${request.action}. Full request:`);
      console.log(request);
      sendResponse({ success: false });
  }
  // force synchronous, otherwise calling sendResponse in the callbacks
  // seems to cause problems
  return true;
});
