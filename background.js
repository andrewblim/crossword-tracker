// Set some default preference values if they are not set.
// See options page for all preferences.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    ["solverName", "eventFlushFrequency"],
    (results) => {
      const update = Object.assign(
        {
          "solverName": "",
          "eventFlushFrequency": 20,
        },
        results,
      )
      chrome.storage.sync.set(results);
    },
  );
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "storeRecord") {
    if (request.key !== undefined && request.record !== undefined) {
      chrome.storage.sync.set({ [request.key]: request.record }, () => {
        if (chrome.runtime.lastError) {
          console.log(`Failed to store record to ${request.key}: ${chrome.runtime.lastError}`);
          sendResponse({ success: false });
        } else {
          console.log(`Stored record to key ${request.key}`);
          sendResponse({ success: true });
        }
      });
    } else {
      console.log(`Invalid ${request.action}, key or record undefined. Full request:`);
      console.log(request);
      sendResponse({ success: false });
    }
  } else if (request.action === "clearRecord") {
    if (request.key !== undefined) {
      chrome.storage.sync.remove(request.key, () => {
        if (chrome.runtime.lastError) {
          console.log(`Failed to remove key ${request.key}: ${chrome.runtime.lastError}`);
          sendResponse({ success: false });
        } else {
          console.log(`Removed key ${request.key}`);
          sendResponse({ success: true });
        }
      });
    } else {
      console.log(`Invalid ${request.action}, key undefined. Full request:`);
      console.log(request);
      sendResponse({ success: false });
    }
  } else if (request.action === "setBadgeRecording") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.action.setBadgeBackgroundColor({ tabId: tabs[0].id, color: "red" });
      chrome.action.setBadgeText({ tabId: tabs[0].id, text: "REC" });
    });
  } else if (request.action === "setBadgeSolved") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.action.setBadgeBackgroundColor({ tabId: tabs[0].id, color: "green" });
      chrome.action.setBadgeText({ tabId: tabs[0].id, text: "✓" });
    });
  } else if (request.action === "clearBadge") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.action.setBadgeText(tabs[0].id, null);
    });
  } else {
    console.log(`Unrecognized request action ${request.action}. Full request:`);
    console.log(request);
    sendResponse({ success: false });
  }
  // force synchronous, otherwise calling sendResponse in the callbacks
  // seems to cause problems
  return true;
});
