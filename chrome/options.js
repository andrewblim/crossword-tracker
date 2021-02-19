"use strict";

// assumes settings.js is run first

// Add inputs for each setting, add save buttons
for (const info of appSettingsInfo) {
  const optionsSection = document.createElement("div");
  optionsSection.id = info.storageKey;
  optionsSection.classList.add("options-section");
  const header = document.createElement("h2");
  header.textContent = info.name;
  optionsSection.append(header);
  const optionsSet = document.createElement("div");
  optionsSet.id = `${info.storageKey}-options`;
  optionsSet.classList.add("options-set");
  optionsSection.append(optionsSet);

  for (const setting of info.settings) {
    const label = document.createElement("label");
    label.setAttribute("for", `${info.storageKey}-${setting.settingKey}`);
    label.textContent = setting.name;
    const inputSection = document.createElement("div");
    if (setting.type === "boolean") {
      const input = document.createElement("input");
      input.id = `${info.storageKey}-${setting.settingKey}`;
      input.setAttribute("type", "checkbox");
      inputSection.append(input);
    } else if (setting.options !== undefined) {
      const select = document.createElement("select");
      select.id = `${info.storageKey}-${setting.settingKey}`;
      for (const x of setting.options) {
        const selectOption = document.createElement("option");
        selectOption.setAttribute("value", x.value);
        selectOption.textContent = x.name;
        select.append(selectOption);
      }
      select.setAttribute("type", "text");
      inputSection.append(select);
    } else {
      const input = document.createElement("input");
      input.id = `${info.storageKey}-${setting.settingKey}`;
      input.setAttribute("type", "text");
      inputSection.append(input);
    }
    const inputDescription = document.createElement("div");
    if (setting.description !== undefined) {
      inputDescription.textContent = setting.description;
    }

    optionsSet.append(label);
    optionsSet.append(inputSection);
    optionsSet.append(inputDescription);
  }

  const saveSection = document.createElement("div");
  saveSection.classList.add("options-set");
  const buttonSection = document.createElement("div");
  const button = document.createElement("button");
  button.id = `${info.storageKey}-options-save`;
  button.textContent = "Save";
  buttonSection.append(button);
  const messageSection = document.createElement("div");
  messageSection.id = `${info.storageKey}-options-save-message`;
  saveSection.append(buttonSection);
  saveSection.append(messageSection);
  optionsSection.append(saveSection);
  document.getElementById("preferences").append(optionsSection);

  // Save button
  document.getElementById(`${info.storageKey}-options-save`).addEventListener("click", () => {
    const update = {};
    for (const setting of info.settings) {
      let value;
      switch (setting.type) {
        case "boolean":
          value = document.getElementById(`${info.storageKey}-${setting.settingKey}`).checked;
          break;
        case "number":
          value = Number(document.getElementById(`${info.storageKey}-${setting.settingKey}`).value);
          break;
        default:
          value = document.getElementById(`${info.storageKey}-${setting.settingKey}`).value;
          break;
      }
      update[setting.settingKey] = value;
    }
    let errors = [];
    if (info.validate !== undefined) {
      errors = info.validate(update);
    }
    if (errors.length == 0) {
      chrome.storage.local.set({ [info.storageKey]: update }, () => {
        let msg;
        if (chrome.runtime.lastError) {
          msg = `Failed to save settings: ${chrome.runtime.lastError}`;
        } else {
          msg = "Settings saved";
        }
        document.getElementById(`${info.storageKey}-options-save-message`).textContent = msg;
        console.log(msg);
      });
    } else {
      let msg = "Settings not saved: " + errors.join("; ");
      document.getElementById(`${info.storageKey}-options-save-message`).textContent = msg;
      console.log(msg);
    }
  });

  // reset the save message if there are any changes in the section
  document.getElementById(`${info.storageKey}-options`).querySelectorAll("input, select").forEach((elem) => {
    elem.addEventListener("change", () => {
      document.getElementById(`${info.storageKey}-options-save-message`).textContent = "";
    });
  });
}

// Populate and save settings
chrome.storage.local.get(appSettingsInfo.map(x => x.storageKey), (result) => {
  for (const info of appSettingsInfo) {
    for (const setting of info.settings) {
      if (result[info.storageKey] && result[info.storageKey][setting.settingKey]) {
        const value = result[info.storageKey][setting.settingKey];
        if (setting.type === "boolean") {
          document.getElementById(`${info.storageKey}-${setting.settingKey}`).checked = value;
        } else {
          document.getElementById(`${info.storageKey}-${setting.settingKey}`).value = value;
        }
      }
    }
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
  recordDownloadButton.textContent = "Save JSON";
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
  recordDownloadImageButton.textContent = "Save SVG";
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
  const recordKeys = Object.keys(result).filter(key => key.startsWith("record-"));
  // sort in reverse chronological
  recordKeys.sort((a, b) => {
    let aLast = result[a].events[result[a].events.length - 1]?.timestamp;
    let bLast = result[b].events[result[b].events.length - 1]?.timestamp;
    if ((aLast === undefined && bLast !== undefined) || (aLast < bLast)) {
      return 1;
    } else if ((aLast !== undefined && bLast === undefined) || (aLast > bLast)) {
      return -1;
    }
    return 0;
  })
  for (const key of recordKeys) {
    if (key.startsWith("record-")) { addOrUpdateRow(key, result[key]); }
  }
});

chrome.storage.onChanged.addListener((changes, _namespace) => {
  for (const key of Object.keys(changes).filter(key => key.startsWith("record-"))) {
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
