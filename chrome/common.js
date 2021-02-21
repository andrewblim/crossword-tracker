"use strict";

const downloadRecord = (record, opts = {}) => {
  chrome.downloads.download({
    url: URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })
    ),
    saveAs: true,
    ...opts
  });
};

const downloadImage = (imageElem, opts = {}) => {
  chrome.downloads.download({
    url: URL.createObjectURL(
      new Blob([imageElem.outerHTML], { type: "image/svg+xml" })
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

// Suggested filenames for file-saving functionality
const suggestedRecordFilename = function(record, suffix) {
  let filename = "";
  let url = new URL(record.url);
  if (url.hostname === "www.nytimes.com") {
    filename = "NYT - ";
  }
  filename += `${record.date || "date unknown"} - ${record.title || "untitled"}`
  if (record.byline) {
    filename += ` - ${record.byline}`;
  }
  filename += `.${suffix}`;
  return filename;
}

// Functions for sorting two events in a well-defined order, so that certain
// events always come first even if they are considered to occur at the same
// time. As a common example, solving a puzzle may be concurrent with a square
// update; this ensures that the submit event happens last.

const eventPriority = {
  start: 0,
  reveal: 1,
  check: 2,
  update: 3,
  select: 4,
  selectClue: 5,
  stop: 98,
  submit: 99,
}

const compareEvents = function(x, y) {
  if (x.timestamp < y.timestamp) {
    return -1;
  } else if (x.timestamp > y.timestamp) {
    return 1;
  } else if (eventPriority[x.type] < eventPriority[y.type]) {
    return -1;
  } else if (eventPriority[x.type] > eventPriority[y.type]) {
    return 1;
  }
  return 0;
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

// Return a puzzle identifier based on the board state array and the mapping of
// clue sections as defined in the standard log format. Relies on
// crypto.subtle's SHA1 functionality, which is asynchronous, so this may need
// to be called with an await.
const computedPuzzleId = async (boardState, clueSections) => {
  const boardArray = Array.from(boardState)
    .filter(({ fill }) => fill !== undefined && fill !== null)
    .map(({ x, y }) => [x, y])
    .sort((a, b) => {
      if (a[0] !== b[0]) { return a[0] - b[0]; }
      return a[1] - b[1];
    });
  const clueSectionHeaders = Object.keys(clueSections).sort();
  const clueSectionArray = [];
  for (const clueSectionHeader of clueSectionHeaders) {
    clueSectionArray.push([
      clueSectionHeader,
      Array.from(clueSections[clueSectionHeader])
        .map(({ label, text }) => [label, text]),
    ]);
  }
  const puzzleRepr = JSON.stringify([boardArray, clueSectionArray]);
  const digestBytes = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(puzzleRepr));
  const digest = Array.prototype.map.call(
    new Uint8Array(digestBytes),
    x => x.toString(16).padStart("0")
  ).join("")
  return `record-${digest}`;
};
