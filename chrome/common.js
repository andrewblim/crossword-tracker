"use strict";

export const userSettings = {
  solverName: {
    default: "",
    description: "Solver's name",
  },
  eventLogLevel: {
    default: "select",
    description: "How much logging to do. Can be \"basic\", which logs only " +
      "game events and square updates, \"select\", which also logs the " +
      "currently selected square, or \"full\", which also logs any " +
      "currently highlighted squares (such as other squares in the clue). " +
      "The more detailed logs are naturally larger.",
  },
  logUserAgent: {
    default: false,
    description: "Whether to log user-agent information when creating a " +
      "record. This carries operating and browser system information. It " +
      "can be informative, for example reflecting mobile vs. computer.",
  }
};

export const siteSpecificSettings = {
  nyt: {
    eventFlushFrequency: {
      default: 30,
      description: "When recording, every this-many events, save the data " +
        "to browser storage."
    },
  },
};

export const downloadRecord = (record, opts = {}) => {
  chrome.downloads.download({
    url: URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
    ),
    saveAs: true,
    ...opts
  });
};

export const deleteRecordByKey = (key) => {
  chrome.storage.sync.remove(key, () => {
    if (chrome.runtime.lastError) {
      console.log(`Failed to remove key ${key}: ${chrome.runtime.lastError}`);
    } else {
      console.log(`Removed key ${key}`);
    }
  });
}

export const humanizedRecordName = function(record) {
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

export const suggestedRecordFilename = function(record) {
  let url = new URL(record.url);
  if (url.hostname == "www.nytimes.com") {
    let stub = url.pathname.replace(/^\/crosswords\/game\//, "").replace(/\//g, "-");
    return `nyt-${stub}.json`;
  } else {
    let stub = url.pathname.replace(/\//g, "-");
    return `${stub}.json`;
  }
}
