chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ "trackingEnabled": false });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "storeRecord") {
    storeRecord(request.key, request.record);
  }
  else if (request.action === "clearRecord") {
    clearRecord(request.key);
  }
  else {
    console.log(`Unrecognized request action ${request.action}. Full request:`);
    console.log(request);
  }
});

const storeRecord = function (key, record) {
  if (key !== undefined && record !== undefined) {
    chrome.storage.local.set({ [key]: record }, () => {
      // TODO - check for failure, blank record
      console.log(`Recorded to key ${key}`);
    });
  }
};

const clearRecord = function (key) {
  if (key !== undefined) {
    chrome.storage.local.remove(key, () => {
      // TODO - check for failure
      console.log(`Removed data at ${key}`);
    });
  }
};
