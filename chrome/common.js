"use strict";

const userSettings = {
  solverName: {
    default: "",
    description: "Solver's name",
  },
  eventLogLevel: {
    default: "full",
    description: "How much logging to do. Can be \"basic\", which logs only " +
      "game events and square updates, or \"full\", which also logs any " +
      "currently highlighted clues."
  },
  logUserAgent: {
    default: false,
    description: "Whether to log user-agent information when creating a " +
      "record. This carries operating and browser system information. It " +
      "can be informative, for example reflecting mobile vs. computer.",
  }
};

const siteSpecificSettings = {
  nyt: {
    eventFlushFrequency: {
      default: 30,
      description: "When recording, every this-many events, save the data " +
        "to browser storage."
    },
  },
};

const downloadRecord = (record, opts = {}) => {
  chrome.downloads.download({
    url: URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
    ),
    saveAs: true,
    ...opts
  });
};

const humanizedRecordName = function(record) {
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

const suggestedRecordFilename = function(record) {
  let url = new URL(record.url);
  if (url.hostname == "www.nytimes.com") {
    let stub = url.pathname.replace(/^\/crosswords\/game\//, "").replace(/\//g, "-");
    return `nyt-${stub}.json`;
  } else {
    let stub = url.pathname.replace(/\//g, "-");
    return `${stub}.json`;
  }
}

// Detect if we're in an unstarted state
const currentlyUnstarted = function(record) {
  return record.events.length === 0;
}

// Detect if we're in a "stopped" state after having started. Useful to
// ensure that we don't record more events without starting
const currentlyStopped = function(record) {
  return (
    currentlyUnstarted(record) ||
    record.events[record.events.length - 1].type === "stop" ||
    currentlySolved(record)
  );
}

// Detect if we're in a "solved" state. Useful to ensure that we don't record
// any events so long as we are in this state, and to control badges.
const currentlySolved = function(record) {
  return (
    !currentlyUnstarted(record) &&
    record.events[record.events.length - 1].type === "submit" &&
    record.events[record.events.length - 1].success
  );
}
