const solverNameInput = document.getElementById("solver-name");
const eventFlushFrequencyInput = document.getElementById("event-flush-frequency");

chrome.storage.sync.get(
  ["solverName", "eventFlushFrequency"],
  ({ solverName, eventFlushFrequency }) => {
    solverNameInput.value = solverName;
    eventFlushFrequencyInput.value = eventFlushFrequency;
  },
);

const humanizedName = function(record) {
  let name = [];
  if (record.title && record.title !== "") {
    name.push(record.title);
  } else {
    name.push("untitled");
  }
  if (record.byline && record.byline !== "") {
    name.push(record.byline);
  }
  if (record.date) {
    name.push(record.date);
  }
  return name.join(" - ");
}

const recordEntriesElem = document.getElementById("record-entries");
const addOrUpdateRow = (id, record) => {
  let row = document.getElementById(id);
  if (row) {
    // update fields that might be different
    const recordName = row.children[0];
    recordName.textContent = "";
    const linktext = humanizedName(record);
    if (record.url) {
      const recordLink = document.createElement("a");
      recordLink.setAttribute("target", "_blank");
      recordLink.setAttribute("href", record.url);
      recordLink.textContent = linktext;
      recordName.append(recordLink);
    } else {
      recordName.textContent = linktext;
    }
  } else {
    // add new row
    row = document.createElement("tr");
    row.id = id;
    const recordName = document.createElement("td");
    const linktext = humanizedName(record);
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

    // TODO - add download/delete functionality
    const recordDownload = document.createElement("td");
    const recordDownloadButton = document.createElement("button");
    recordDownloadButton.textContent = "Download";
    recordDownloadButton.addEventListener("click", () => {
      chrome.storage.sync.get(id, (result) => {
        let record = result[id];
        if (record) {
          chrome.downloads.download({
            url: URL.createObjectURL(
              new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
            ),
            // TODO: default filename
            saveAs: true,
          });
        }
      });
    });
    recordDownload.append(recordDownloadButton);
    row.append(recordDownload);
    const recordDelete = document.createElement("td");
    const recordDeleteButton = document.createElement("button");
    recordDeleteButton.textContent = "Delete";
    recordDeleteButton.addEventListener("click", () => {
      verify = confirm(
        `Are you sure you want to delete "${linktext}"? This cannot be undone.`
      );
      if (verify) {
        chrome.storage.sync.remove(id, () => {
          if (chrome.runtime.lastError) {
            console.log(`Failed to remove key ${id}: ${chrome.runtime.lastError}`);
          } else {
            console.log(`Removed key ${id}`);
          }
        });
      }
    });
    recordDelete.append(recordDeleteButton);
    row.append(recordDelete);
    recordEntriesElem.append(row);
  }
}

chrome.storage.sync.get(null, (result) => {
  for (key of Object.keys(result)) {
    if (key.startsWith("record-")) { addOrUpdateRow(key, result[key]); }
  }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  for (const key of Object.keys(changes)) {
    if (key.startsWith("record-")) {
      const change = changes[key];
      if (change.newValue) {
        addOrUpdateRow(key, change.newValue)
        // if the row's there, update it, else add it
      } else if (change.oldValue) {
        // if the row's there, delete it
        const row = document.getElementById(key);
        if (row) { row.remove(); }
      }
      console.log("Event fired on key " + key);
    }
  }
});

document.getElementById("delete-all-records").addEventListener("click", () => {
  verify = confirm(
    "Are you sure you want to delete all your stored records? This cannot be undone."
  );
  if (verify) {
    chrome.storage.sync.get(null, (result) => {
      let recordKeys = Object.keys(result).filter(k => k.startsWith("record-"));
      chrome.storage.sync.remove(recordKeys, () => {
        if (chrome.runtime.lastError) {
          console.log(`Failed to remove records: ${chrome.runtime.lastError}`);
        } else {
          console.log(`Removed all records`);
        }
      });
    });
  }
});

const saveGeneral = async (callback) => {
  chrome.storage.sync.set(
    {
      solverName: solverNameInput.value,
    },
    callback,
  );
};

const saveDev = async (callback) => {
  chrome.storage.sync.set(
    {
      eventFlushFrequency: parseInt(eventFlushFrequencyInput.value) || null,
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

document.getElementById("save-dev").addEventListener("click", () => {
  saveDev(() => {
    if (chrome.runtime.lastError) {
      console.log("Failed to save developer settings");
    } else {
      console.log("Developer settings saved");
    }
  });
});
