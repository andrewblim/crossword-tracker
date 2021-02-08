"use strict";

// Functions to populate and save settings

chrome.storage.sync.get(
  ["solverName", "eventLogLevel", "logUserAgent"],
  ({ solverName, eventLogLevel, logUserAgent }) => {
    document.getElementById("solverName").value = (solverName || "");
    document.getElementById("eventLogLevel").value = (eventLogLevel || "");
    document.getElementById("logUserAgent").checked = (logUserAgent || false);
  },
);

chrome.storage.sync.get(
  ["nytSettings"],
  ({ nytSettings }) => {
    document.getElementById("nyt-eventFlushFrequency").value = (
      nytSettings?.eventFlushFrequency || ""
    );
  }
)

const saveNyt = async (callback) => {
  const eventFlushFrequency = parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null;
  if (eventFlushFrequency && eventFlushFrequency < 0) {
    document.getElementById("general-options-save-message").textContent = "";
  }
  chrome.storage.sync.set(
    {
      nytSettings: {
        eventFlushFrequency: parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null,
      },
    },
    callback,
  );
};

document.getElementById("general-options").addEventListener("change", () => {
  document.getElementById("general-options-save-message").textContent = "";
});

document.getElementById("general-options-save").addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      solverName: document.getElementById("solverName").value,
      eventLogLevel: document.getElementById("eventLogLevel").value,
      logUserAgent: document.getElementById("logUserAgent").checked,
    },
    () => {
      if (chrome.runtime.lastError) {
        const msg = `Failed to save settings: ${chrome.runtime.lastError}`;
        document.getElementById("general-options-save-message").textContent = msg;
        console.log(msg);
      } else {
        const msg = "Settings saved";
        document.getElementById("general-options-save-message").textContent = msg;
        console.log(msg);
      }
    },
  );
});

document.getElementById("nyt-options").addEventListener("change", () => {
  document.getElementById("nyt-options-save-message").textContent = "";
});

document.getElementById("nyt-options-save").addEventListener("click", () => {
  const eventFlushFrequency = parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null;
  if (eventFlushFrequency && eventFlushFrequency <= 0) {
    const msg = "Flush frequency must be parseable to a positive integer, or blank"
    document.getElementById("nyt-options-save-message").textContent = msg;
  } else {
    chrome.storage.sync.set(
      {
        nytSettings: {
          eventFlushFrequency: parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null,
        },
      },
      () => {
        if (chrome.runtime.lastError) {
          const msg = `Failed to save settings: ${chrome.runtime.lastError}`;
          document.getElementById("nyt-options-save-message").textContent = msg;
          console.log(msg);
        } else {
          const msg = "Settings saved";
          document.getElementById("nyt-options-save-message").textContent = msg;
          console.log(msg);
        }
      },
    );
  }
});

// Build and update rows in the table of records

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

  const recordVersion = document.createElement("td");
  recordVersion.textContent = record.version || "";
  row.append(recordVersion);

  const recordStatus = document.createElement("td");
  if (currentlySolved(record)) {
    recordStatus.textContent = "solved";
  } else if (currentlyUnstarted(record)) {
    recordStatus.textContent = "unstarted";
  } else {
    recordStatus.textContent = "in progress";
  }
  row.append(recordStatus);

  const recordLastUpdate = document.createElement("td");
  if (!currentlyUnstarted(record)) {
    recordLastUpdate.textContent = new Date(record.events[record.events.length - 1].timestamp);
  } else {
    recordLastUpdate.textContent = 0;
  }
  row.append(recordLastUpdate);

  const recordManagement = document.createElement("td");
  const recordDownloadButton = document.createElement("button");
  recordDownloadButton.textContent = "Download";
  recordDownloadButton.addEventListener("click", () => {
    chrome.storage.sync.get(rowId, (result) => {
      if (result[rowId]) {
        downloadRecord(result[rowId], { filename: suggestedRecordFilename(result[rowId]) });
      }
    });
  });
  const recordDeleteButton = document.createElement("button");
  recordDeleteButton.textContent = "Delete";
  recordDeleteButton.addEventListener("click", () => {
    let verify = confirm(`Are you sure you want to delete "${linktext}"? This cannot be undone.`);
    if (verify) {
      chrome.storage.sync.remove(rowId, () => {
        if (chrome.runtime.lastError) {
          msg = `Failed to remove key ${rowId}: ${chrome.runtime.lastError}`
          console.log(msg);
        } else {
          msg = `Removed ${linktext}`
          console.log(msg);
        }
      });
    }
  });
  recordManagement.append(recordDownloadButton);
  recordManagement.append(recordDeleteButton);
  row.append(recordManagement);

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

  const recordVersion = row.children[1];
  recordVersion.textContent = record.version || "";

  const recordStatus = row.children[2];
  if (currentlySolved(record)) {
    recordStatus.textContent = "solved";
  } else if (currentlyUnstarted(record)) {
    recordStatus.textContent = "unstarted";
  } else {
    recordStatus.textContent = "in progress";
  }

  const recordLastUpdate = row.children[3];
  if (!currentlyUnstarted(record)) {
    recordLastUpdate.textContent = new Date(record.events[record.events.length - 1].timestamp);
  } else {
    recordLastUpdate.textContent = "";
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
