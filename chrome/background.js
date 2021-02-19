"use strict";

importScripts("settings.js");

// Default preferences to set on initial install

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    Object.keys(appSettings),
    (result) => {
      const update = {};
      for (const groupKey of Object.keys(appSettings)) {
        update[groupKey] = {};
        for (const settingKey of Object.keys(appSettings[groupKey])) {
          if (result[groupKey] && result[groupKey][settingKey]) {
            update[groupKey][settingKey] = result[groupKey][settingKey];
          } else {
            update[groupKey][settingKey] = appSettings[groupKey][settingKey].default;
          }
        }
      }
      chrome.storage.local.set(update);
    },
  );
});

// Messages sent from tabs

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.action) {
    case "cacheRecord":
      if (request.key !== undefined && request.record !== undefined) {
        chrome.storage.local.set({ [request.key]: request.record }, () => {
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
        chrome.storage.local.remove(request.key, () => {
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
