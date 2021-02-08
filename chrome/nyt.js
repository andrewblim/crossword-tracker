"use strict";

// magic constants (from NYT's crossword CSS/HTML)

const puzzleClass = "app-appWrapper--2PSLL";

const titleClass = "PuzzleDetails-title--iv1IG";
const dateClass = "PuzzleDetails-date--1HNzj";
const bylineClass = "PuzzleDetails-byline--16J5w";

const clueListWrapperClass = "ClueList-wrapper--3m-kd";
const clueListTitleClass = "ClueList-title--1-3oW";
const clueClass = "Clue-li--1JoPu";
const clueLabelClass = "Clue-label--2IdMY";
const clueTextClass = "Clue-text--3lZl7";

const veilClass = "Veil-veil--3oKaF";
const cellClass = "Cell-cell--1p4gH";
const blockClass = "Cell-block--1oNaD";
const selectedClass = "Cell-selected--2PAbF";
const revealedClass = "Shame-revealed--3jDzk";
const checkedClass = "Shame-checked--3E9GW";
const congratsClass = "CongratsModal-congratsModalContent--19hpv";

// other constants, not user-configurable

const storageKey = `record-${window.location.href}`;

// Variables for user-configurable options

let eventFlushFrequency, eventLogLevel;
chrome.storage.sync.get(
  ["eventLogLevel", "nytSettings"],
  (result) => {
    // TODO: reference centralized defaults
    eventLogLevel = result.eventLogLevel || "basic";
    eventFlushFrequency = result.nytSettings?.eventFlushFrequency || 9999;
  }
);

const puzzle = document.querySelector(`div.${puzzleClass}`);
const firstCell = document.getElementById("cell-id-0");
const xSize = firstCell?.getAttribute("width");
const ySize = firstCell?.getAttribute("height");
const xOffset = firstCell?.getAttribute("x");
const yOffset = firstCell?.getAttribute("y");

// given a "cell-id-" element, get its (x,y)
const getXYForCell = function(rectElem) {
  return {
    x: (rectElem.getAttribute("x") - xOffset) / xSize,
    y: (rectElem.getAttribute("y") - yOffset) / ySize,
  };
}

// given a sibling to a "cell-id-" element, get the "cell-id-" element
const getCellSibling = function(siblingElem) {
  return Array.from(siblingElem.parentElement.children)
    .find(elem => elem.id?.startsWith("cell-id-"));
}

// iterate through cells
const forEachCell = function (f) {
  let i = 0;
  let cell = document.getElementById(`cell-id-${i}`);
  while (cell !== null) {
    f(i, cell);
    i += 1;
    cell = document.getElementById(`cell-id-${i}`);
  }
}

let record, observer;

// Update record with metadata from the DOM and from supplied user info

const updateRecordMetadata = function (record, userInfo, puzzle) {
  // Version info not yet used, but reserved for the future, in case we want to
  // make breaking changes to the format.
  record.version = "0.1";

  record.url = window.location.href;
  if (puzzle) {
    const title = puzzle.querySelector(`.${titleClass}`)?.textContent;
    if (title !== undefined) { record.title = title; }
    const date = puzzle.querySelector(`.${dateClass}`)?.textContent;
    if (date !== undefined) { record.date = date; }
    // byline info is in one or more sub-spans
    const bylineElem = puzzle.querySelector(`.${bylineClass}`);
    if (bylineElem) {
    record.byline = Array.from(bylineElem.children)
      .map(x => x.textContent)
      .join(" - ");
    }
  }

  // Actively remove solverName and userAgent if not supplied in userInfo but
  // present in the supplied record
  if (userInfo.solverName) {
    record.solverName = userInfo.solverName;
  } else {
    delete record.solverName;
  }
  if (userInfo.userAgent) {
    record.userAgent = userInfo.userAgent;
  } else {
    delete record.userAgent;
  }

  record.clueSections = {};
  for (const wrapperElem of puzzle.querySelectorAll(`.${clueListWrapperClass}`)) {
    const title = wrapperElem.querySelector(`.${clueListTitleClass}`)?.textContent || "";
    const clueElems = wrapperElem.querySelectorAll(`.${clueClass}`);
    record.clueSections[title] = Array.from(clueElems)
      .filter(elem => elem.nodeName === "LI" && elem.classList.contains(clueClass))
      .map((clueElem) => {
        let children = Array.from(clueElem.children);
        let clueLabel = children.find(x => x.classList.contains(clueLabelClass))?.textContent || "";
        let clueText = children.find(x => x.classList.contains(clueTextClass))?.textContent || "";
        return { label: clueLabel, text: clueText };
      });
  }

  // For initialState/events, defer to existing values in the record, but add
  // them if they do not exist
  if (!record.initialState) { record.initialState = captureBoardState(); }
  if (!record.events) { record.events = []; }
}

const updateRecordingStatus = function(record) {
  if (currentlySolved(record)) {
    observer.disconnect();
    chrome.runtime.sendMessage({ action: "setBadgeSolved" });
  } else {
    observer.observe(puzzle, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeOldValue: true,
      attributeFilter: ["class"],
    });
    chrome.runtime.sendMessage({ action: "setBadgeRecording" });
  }
}

const captureBoardState = function () {
  let boardState = [];
  forEachCell((_, cell) => {
    let x, y, label, fill;
    ({ x, y } = getXYForCell(cell));
    if (cell.classList.contains(cellClass)) {
      let labelElem = cell.parentElement.querySelector("[text-anchor=start]");
      if (labelElem !== null) {
        label = Array.from(labelElem.childNodes).find(x => x.nodeType === 3)?.data;
      }
      let fillElem = cell.parentElement.querySelector("[text-anchor=middle]");
      if (fillElem !== null) {
        fill = Array.from(fillElem.childNodes).find(x => x.nodeType === 3)?.data;
      }
    } else if (cell.classList.contains(blockClass)) {
      label = undefined;
      fill = null; // denotes that it is a non-fillable cell
    }
    let cellState = { x, y, fill };
    if (label !== undefined) { cellState.label = label; }
    boardState.push(cellState);
  });
  return boardState;
};

const recordEventBatch = function (events, timestamp) {
  if (!timestamp) { timestamp = new Date().getTime(); }

  // Ensure events are added in a consistent order, so that, for example, we
  // don't leave the log in an inconsistent state with fill happening after
  // a submit.
  const eventPriority = {
    start: 0,
    reveal: 1,
    check: 2,
    update: 3,
    select: 4,
    highlight: 5,
    stop: 9,
    submit: 99,
  }
  events.sort((a, b) => ((eventPriority[a] || 0) - (eventPriority[b] || 0)))

  // Don't record anything if we are stopped, unless there is a start event
  // in the event batch. This prevents us from incorrectly creating events
  // if we load a puzzle that already has fill.
  if (currentlyStopped(record) && events.length > 0 && events[0].type !== "start") {
    return;
  }

  for (const event of events) {
    record.events.push({ timestamp, ...event });
    let successfulSubmit = event.type === "submit" && event.success;
    let timeToRecord;
    if (eventFlushFrequency) {
      timeToRecord = record.events.length % eventFlushFrequency === 0;
    }
    if (successfulSubmit || timeToRecord) {
      chrome.runtime.sendMessage({ action: "storeRecord", key: storageKey, record: record });
    }
    if (successfulSubmit) {
      observer.disconnect();
      chrome.runtime.sendMessage({ action: "setBadgeSolved" });
    }
  }
};

const puzzleCallback = function (mutationsList, _observer) {
  // record timestamp now, to ensure that all events generated from each call
  // are generated with the same timestamp
  let newEvents = [];
  let timestamp = new Date().getTime();

  for (const mutation of mutationsList) {
    switch (mutation.type) {
      case "characterData":
        // square update
        if (mutation.target.parentElement?.getAttribute("text-anchor") === "middle") {
          let fill = mutation.target.data;
          let cell = getCellSibling(mutation.target.parentElement);
          if (cell) {
            newEvents.push({ type: "update", ...getXYForCell(cell), fill });
          }
        }
        break;
      case "childList":
        // - submit (solve) occurs via insertion of a fresh modal at the puzzle
        //   level that if successful contains a congratulatory sub-element
        // - start/stop occurs via removal/addition of a "veil" modal
        // - initial reveal/check for a given square inserts a <use> element
        for (const node of mutation.addedNodes) {
          if (mutation.target === puzzle && node.querySelector(`.${congratsClass}`)) {
            newEvents.push({ type: "submit", success: true });
          } else if (node.classList?.contains(veilClass)) {
            newEvents.push({ type: "stop" });
          } else if (node.classList?.contains(revealedClass)) {
            let cell = getCellSibling(node);
            if (cell) { newEvents.push({ type: "reveal", ...getXYForCell(cell) }); }
          } else if (node.classList?.contains(checkedClass)) {
            let cell = getCellSibling(node);
            if (cell) { newEvents.push({ type: "check", ...getXYForCell(cell) }); }
          }
        }
        for (const node of mutation.removedNodes) {
          if (node.classList?.contains(veilClass)) {
            newEvents.push({ type: "start" });
          }
        }
        break;
      case "attributes":
        // subsequent reveal/check (<use> element already there and gets modified)
        if (mutation.target.classList?.contains(revealedClass)) {
          let cell = getCellSibling(mutation.target);
          if (cell) { newEvents.push({ type: "reveal", ...getXYForCell(cell) }); }
        } else if (mutation.target.classList?.contains(checkedClass)) {
          let cell = getCellSibling(mutation.target);
          if (cell) { newEvents.push({ type: "check", ...getXYForCell(cell) }); }
        } else if (mutation.target.classList?.contains(selectedClass)) {
          // TODO: make loglevel work again
          let cell = getCellSibling(mutation.target);
          if (cell) { newEvents.push({ type: "select", ...getXYForCell(cell) }); }
        }
        break;
    }
  }
  recordEventBatch(newEvents, timestamp);
};

// If we navigate away/close tab, record a stop event if we aren't already
// stopped and write the record out, so that navigating away doesn't result in
// a loss of recorded info.

window.onbeforeunload = () => {
  if (!currentlyStopped(record)) { recordEventBatch([{ type: "stop" }]); }
  chrome.runtime.sendMessage({ action: "storeRecord", key: storageKey, record: record });
};

// Interaction with popup

chrome.runtime.onMessage.addListener(
  function (request, _sender, sendResponse) {
    if (request.action === "logRecord") {
      console.log(record);
      sendResponse({ success: true });
    } else if (request.action === "storeRecord") {
      // service worker manages storage
      chrome.runtime.sendMessage(
        { action: "storeRecord", key: storageKey, record: record },
        sendResponse,
      );
    } else if (request.action === "clearRecord") {
      // service worker manages storage
      chrome.runtime.sendMessage(
        { action: "clearRecord", key: storageKey },
        sendResponse,
      );
      record = {};
      chrome.storage.sync.get(["solverName", "logUserAgent"], (result) => {
        let userInfo = {};
        if (result.solverName) { userInfo.solverName = result.solverName }
        if (result.logUserAgent) { userInfo.userAgent = navigator.userAgent }
        updateRecordMetadata(record, userInfo, puzzle);
        updateRecordingStatus(record);
      });
    } else if (request.action === "downloadRecord") {
      sendResponse({ success: true, record });
    }
    // force synchronous, otherwise calling sendResponse in the callbacks
    // seems to cause problems
    return true;
  }
);

// MAIN

if (puzzle) {
  chrome.storage.sync.get([storageKey, "solverName", "logUserAgent"], (result) => {
    record = result[storageKey] || {};
    let userInfo = {};
    if (result.solverName) { userInfo.solverName = result.solverName }
    if (result.logUserAgent) { userInfo.userAgent = navigator.userAgent }
    updateRecordMetadata(record, userInfo, puzzle);

    observer = new MutationObserver(puzzleCallback);
    updateRecordingStatus(record);
  });
}
