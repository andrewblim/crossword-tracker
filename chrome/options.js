"use strict";

// Functions to populate and save settings

chrome.storage.local.get(
  [
    "solverName",
    "eventLogLevel",
    "logUserAgent",
    "imageWidth",
    "imageHeight",
    "imageMargin",
    "imageBackgroundColor",
    "imageGridColor",
    "imageFillableColor",
    "imageUnfillableColor",
    "imageSelectedColor",
    "imageHighlightedColor",
    "imageAnimationSpeed",
    "nytSettings",
  ],
  (result) => {
    document.getElementById("solverName").value = (result.solverName || "");
    document.getElementById("eventLogLevel").value = (result.eventLogLevel || "full");
    document.getElementById("logUserAgent").checked = (result.logUserAgent || false);
    document.getElementById("imageWidth").value = (result.imageWidth || 500);
    document.getElementById("imageHeight").value = (result.imageHeight || 750);
    document.getElementById("imageMargin").value = (result.imageMargin || 50);
    document.getElementById("imageBackgroundColor").value = (result.imageBackgroundColor || "lightgray");
    document.getElementById("imageGridColor").value = (result.imageGridColor || "gray");
    document.getElementById("imageFillableColor").value = (result.imageFillableColor || "white");
    document.getElementById("imageUnfillableColor").value = (result.imageUnfillableColor || "black");
    document.getElementById("imageSelectedColor").value = (result.imageSelectedColor || "yellow");
    document.getElementById("imageHighlightedColor").value = (result.imageHighlightedColor || "lightblue");
    document.getElementById("imageAnimationSpeed").value = (result.imageAnimationSpeed || 1.0);

    document.getElementById("nyt-eventFlushFrequency").value = (
      result.nytSettings?.eventFlushFrequency || 30
    );
  },
);

document.getElementById("general-options").querySelectorAll("input, select").forEach((elem) => {
  elem.addEventListener("change", () => {
    document.getElementById("general-options-save-message").textContent = "";
  });
});

document.getElementById("general-options-save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      solverName: document.getElementById("solverName").value,
      eventLogLevel: document.getElementById("eventLogLevel").value,
      logUserAgent: document.getElementById("logUserAgent").checked,
    },
    () => {
      let msg;
      if (chrome.runtime.lastError) {
        msg = `Failed to save settings: ${chrome.runtime.lastError}`;
      } else {
        msg = "Settings saved";
      }
      document.getElementById("general-options-save-message").textContent = msg;
      console.log(msg);
    },
  );
});

document.getElementById("image-options").querySelectorAll("input, select").forEach((elem) => {
  elem.addEventListener("change", () => {
    document.getElementById("image-options-save-message").textContent = "";
  });
});

document.getElementById("image-options-save").addEventListener("click", () => {
  chrome.storage.local.set(
    {
      imageWidth: document.getElementById("imageWidth").value,
      imageHeight: document.getElementById("imageHeight").value,
      imageBackgroundColor: document.getElementById("imageBackgroundColor").value,
      imageGridColor: document.getElementById("imageGridColor").value,
      imageFillableColor: document.getElementById("imageFillableColor").value,
      imageUnfillableColor: document.getElementById("imageUnfillableColor").value,
      imageSelectedColor: document.getElementById("imageSelectedColor").value,
      imageHighlightedColor: document.getElementById("imageHighlightedColor").value,
      imageAnimationSpeed: document.getElementById("imageAnimationSpeed").value,
    },
    () => {
      let msg;
      if (chrome.runtime.lastError) {
        msg = `Failed to save settings: ${chrome.runtime.lastError}`;
      } else {
        msg = "Settings saved";
      }
      document.getElementById("image-options-save-message").textContent = msg;
      console.log(msg);
    },
  );
});

document.getElementById("nyt-options").querySelectorAll("input, select").forEach((elem) => {
  elem.addEventListener("change", () => {
    document.getElementById("nyt-options-save-message").textContent = "";
  });
});

document.getElementById("nyt-options-save").addEventListener("click", () => {
  const eventFlushFrequency = parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null;
  if (eventFlushFrequency && eventFlushFrequency <= 0) {
    const msg = "Flush frequency must be parseable to a positive integer, or blank"
    document.getElementById("nyt-options-save-message").textContent = msg;
  } else {
    chrome.storage.local.set(
      {
        nytSettings: {
          eventFlushFrequency: parseInt(document.getElementById("nyt-eventFlushFrequency").value) || null,
        },
      },
      () => {
        let msg;
        if (chrome.runtime.lastError) {
          msg = `Failed to save settings: ${chrome.runtime.lastError}`;
        } else {
          msg = "Settings saved";
        }
        document.getElementById("nyt-options-save-message").textContent = msg;
        console.log(msg);
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
  recordDownloadButton.textContent = "Download JSON";
  recordDownloadButton.addEventListener("click", () => {
    chrome.storage.local.get(rowId, (result) => {
      if (result[rowId]) {
        downloadRecord(result[rowId], {
          filename: suggestedRecordFilename(result[rowId], "json"),
        });
      }
    });
  });
  const recordDownloadImageButton = document.createElement("button");
  recordDownloadImageButton.textContent = "Download SVG";
  recordDownloadImageButton.addEventListener("click", () => {
    chrome.storage.local.get(rowId, (result) => {
      if (result[rowId]) {
        createSolveAnimation(result[rowId], (imageElem) => {
          downloadImage(imageElem, {
            filename: suggestedRecordFilename(result[rowId], "svg"),
          });
        });
      }
    });
  });
  const recordDeleteButton = document.createElement("button");
  recordDeleteButton.textContent = "Delete";
  recordDeleteButton.addEventListener("click", () => {
    let verify = confirm(`Are you sure you want to delete "${linktext}"? This cannot be undone.`);
    if (verify) {
      chrome.storage.local.remove(rowId, () => {
        let msg;
        if (chrome.runtime.lastError) {
          msg = `Failed to delete record "${linktext}" ${chrome.runtime.lastError}`
        } else {
          msg = `Delete record "${linktext}"`
        }
        document.getElementById("record-listing-message").textContent = msg;
        console.log(msg);
      });
    }
  });
  recordManagement.append(recordDownloadButton);
  recordManagement.append(recordDownloadImageButton);
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

chrome.storage.local.get(null, (result) => {
  for (const key of Object.keys(result)) {
    if (key.startsWith("record-")) { addOrUpdateRow(key, result[key]); }
  }
});

chrome.storage.onChanged.addListener((changes, _namespace) => {
  for (const key of Object.keys(changes).filter(x => x.startsWith("record-"))) {
    if (changes[key].newValue) {
      addOrUpdateRow(key, changes[key].newValue);
    } else if (changes[key].oldValue) {
      document.getElementById(key)?.remove();
    }
  }
});

document.getElementById("delete-all-records").addEventListener("click", () => {
  let verify = confirm("Are you sure you want to delete all cached records? This cannot be undone.");
  if (verify) {
    chrome.storage.local.get(null, (result) => {
      let recordKeys = Object.keys(result).filter(k => k.startsWith("record-"));
      chrome.storage.local.remove(recordKeys, () => {
        let msg;
        if (chrome.runtime.lastError) {
          msg = `Failed to delete all records: ${chrome.runtime.lastError}`;
        } else {
          msg = "Deleted all records";
        }
        document.getElementById("record-listing-message").textContent = msg;
        console.log(msg);
      });
    });
  }
});
