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

// Synchronously called SHA1 of a record - useful for identifiers and storage
// keys. Thanks to https://jameshfisher.com/2017/10/30/web-cryptography-api-hello-world/
// for very helpful examples of how to use crypto.subtle.

const sha1Object = async function(obj) {
  const buf = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder("utf-8").encode(JSON.stringify(obj)),
  );
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, "0")).join("");
}

const recordStorageKey = function(title, date, byline) {
  return "record-" + sha1Object({ title, date, byline });
}

// Suggested filenames for download functionality
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
