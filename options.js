const solverNameInput = document.getElementById("solver-name");
const eventFlushFrequencyInput = document.getElementById("event-flush-frequency");

chrome.storage.sync.get(
  ["solverName", "eventFlushFrequency"],
  ({ solverName, eventFlushFrequency }) => {
    solverNameInput.value = solverName;
    eventFlushFrequencyInput.value = eventFlushFrequency;
  },
);

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

document.getElementById("save-general").addEventListener("click", async () => {
  saveGeneral(() => {
    if (chrome.runtime.lastError) {
      console.log("Failed to save general settings");
    } else {
      console.log("General settings saved");
    }
  });
});
document.getElementById("save-nyt").addEventListener("click", async() => {
  saveNYT(() => {
    if (chrome.runtime.lastError) {
      console.log("Failed to save NYT settings");
    } else {
      console.log("NYT settings saved");
    }
  });
});
document.getElementById("save-dev").addEventListener("click", async() => {
  saveDev(() => {
    if (chrome.runtime.lastError) {
      console.log("Failed to save developer settings");
    } else {
      console.log("Developer settings saved");
    }
  });
});
