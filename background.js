chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ "trackingEnabled": true });
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
  } else {
    console.log(`Unrecognized request action ${request.action}. Full request:`);
    console.log(request);
    sendResponse({ success: false });
  }
  // force synchronous, otherwise calling sendResponse in the callbacks
  // seems to cause problems
  return true;
});
