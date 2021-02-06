"use strict";

import {
  downloadRecord,
  humanizedRecordName,
  suggestedRecordFilename,
} from "./common.js";

// Functions to populate and save settings

// load user settings based on stored values
chrome.storage.sync.get(
  ["solverName", "eventLogLevel", "logUserAgent"],
  ({ solverName, eventLogLevel, logUserAgent }) => {
    document.getElementById("solverName").value = (solverName || "");
    document.getElementById("eventLogLevel").value = (eventLogLevel || "");
    document.getElementById("logUserAgent").checked = (logUserAgent || false);
  },
);

// load site-specific settings based on stored values
chrome.storage.sync.get(
  ["nytSettings"],
  ({ nytSettings }) => {
    document.getElementById("nyt-eventFlushFrequency").value = (
      nytSettings?.eventFlushFrequency || ""
    );
  }
)

const saveGeneral = async (callback) => {
  chrome.storage.sync.set(
    {
      solverName: document.getElementById("solverName").value,
      eventLogLevel: document.getElementById("eventLogLevel").value,
      logUserAgent: document.getElementById("logUserAgent").checked,
    },
    callback,
  );
};

const saveNyt = async (callback) => {
  chrome.storage.sync.set(
    {
      nytSettings: {
        eventFlushFrequency: parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null,
      },
    },
    callback,
  );
};

document.getElementById("save-general").addEventListener("click", () => {
  saveGeneral(() => {
    if (chrome.runtime.lastError) {
      console.log("Failed to save general settings");
    } else {
      console.log("General settings saved");
    }
  });
});

document.getElementById("save-nyt").addEventListener("click", () => {
  saveNyt(() => {
    if (chrome.runtime.lastError) {
      console.log("Failed to save New York Times settings");
    } else {
      console.log("New York Times settings saved");
    }
  });
});

// Functions for building and updating rows in the table of records

const buildRow = (rowId, record) => {
  let row = document.createElement("tr");
  row.id = rowId;

  const recordName = document.createElement("td");
  const linktext = humanizedRecordName(record);
  if (record.url) {
    const recordLink = document.createElement("a");
    recordLink.setAttribute("target", "_blank");
    recordLink.setAttribute("href", record.url);
    recordLink.textContent = linktext;
    recordName.append(recordLink);
  } else {
    recordName.textContent = linktext;
  }
  row.append(recordName);

  const recordDownload = document.createElement("td");
  const recordDownloadButton = document.createElement("button");
  recordDownloadButton.textContent = "Download";
  recordDownloadButton.addEventListener("click", () => {
    chrome.storage.sync.get(rowId, (result) => {
      if (result[rowId]) {
        downloadRecord(result[rowId], { filename: suggestedRecordFilename(result[rowId]) });
      }
    });
  });
  recordDownload.append(recordDownloadButton);
  row.append(recordDownload);

  const recordDelete = document.createElement("td");
  const recordDeleteButton = document.createElement("button");
  recordDeleteButton.textContent = "Delete";
  recordDeleteButton.addEventListener("click", () => {
    let verify = confirm(`Are you sure you want to delete "${linktext}"? This cannot be undone.`);
    if (verify) {
      chrome.storage.sync.remove(rowId, () => {
        if (chrome.runtime.lastError) {
          console.log(`Failed to remove key ${rowId}: ${chrome.runtime.lastError}`);
        } else {
          console.log(`Removed key ${rowId}`);
        }
      });
    }
  });
  recordDelete.append(recordDeleteButton);
  row.append(recordDelete);

  return row;
}

const updateRow = (row, record) => {
  const recordName = row.children[0];
  recordName.textContent = "";
  const linktext = humanizedRecordName(record);
  if (record.url) {
    const recordLink = document.createElement("a");
    recordLink.setAttribute("target", "_blank");
    recordLink.setAttribute("href", record.url);
    recordLink.textContent = linktext;
    recordName.append(recordLink);
  } else {
    recordName.textContent = linktext;
  }
}

const addOrUpdateRow = (rowId, record) => {
  let row = document.getElementById(rowId);
  if (row) {
    updateRow(row, record);
  } else {
    document.getElementById("record-entries").append(buildRow(rowId, record));
  }
}

// Build the table, and add a listener to keep it in sync wth any changes
// from recording activity

chrome.storage.sync.get(null, (result) => {
  for (const key of Object.keys(result)) {
    if (key.startsWith("record-")) { addOrUpdateRow(key, result[key]); }
  }
});

chrome.storage.onChanged.addListener((changes, _namespace) => {
  for (const key of Object.keys(changes).filter(x => x.startsWith("record-"))) {
    if (changes[key].newValue) {
      addOrUpdateRow(key, changes[key].newValue)
    } else if (changes[key].oldValue) {
      document.getElementById(key)?.remove();
    }
  }
});

document.getElementById("delete-all-records").addEventListener("click", () => {
  let verify = confirm("Are you sure you want to delete all stored records? This cannot be undone.");
  if (verify) {
    chrome.storage.sync.get(null, (result) => {
      let recordKeys = Object.keys(result).filter(k => k.startsWith("record-"));
      chrome.storage.sync.remove(recordKeys, () => {
        if (chrome.runtime.lastError) {
          console.log(`Failed to remove keys ${recordKeys}: ${chrome.runtime.lastError}`);
        } else {
          console.log(`Removed key ${recordKeys}`);
        }
      });
    });
  }
});
