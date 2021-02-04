const solverNameInput = document.getElementById("solver-name");
const eventFlushFrequencyInput = document.getElementById("event-flush-frequency");

chrome.storage.sync.get(
  ["solverName", "eventFlushFrequency"],
  ({ solverName, eventFlushFrequency }) => {
    solverNameInput.value = solverName;
    eventFlushFrequencyInput.value = eventFlushFrequency;
  },
);

const printableName = function(record) {
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
  let row = document.getElementById(key);
  if (row) {
    // update fields that might be different
    const recordName = row.children[0];
    recordName.textContent = "";
    if (record.url) {
      const recordLink = document.createElement("a");
      recordLink.setAttribute("target", "_blank");
      recordLink.setAttribute("href", record.url);
      recordLink.textContent = printableName(record);
      recordName.append(recordLink);
    } else {
      recordName.textContent = printableName(record);
    }
  } else {
    // add new row
    row = document.createElement("tr");
    row.id = key;
    const recordName = document.createElement("td");
    if (record.url) {
      const recordLink = document.createElement("a");
      recordLink.setAttribute("target", "_blank");
      recordLink.setAttribute("href", record.url);
      recordLink.textContent = printableName(record);
      recordName.append(recordLink);
    } else {
      recordName.textContent = printableName(record);
    }
    row.append(recordName);

    // TODO - add download/delete functionality
    const recordDownload = document.createElement("td");
    recordDownload.textContent = "[ ]";
    row.append(recordDownload);
    const recordDelete = document.createElement("td");
    recordDelete.textContent = "[ ]";
    row.append(recordDelete);
    recordEntriesElem.append(row);
  }
}

chrome.storage.sync.get(
  null,
  (result) => {
    for (key of Object.keys(result)) {
      if (key.startsWith("record-")) { addOrUpdateRow(key, result[key]); }
    }
  }
)

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
  if (confirm("Are you sure you want to delete all records? This cannot be undone.")) {
    // TODO - actually do stuff
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
