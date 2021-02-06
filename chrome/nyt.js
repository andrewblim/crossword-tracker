"use strict";

// magic constants (from NYT's crossword CSS/HTML)

const puzzleClass = "app-appWrapper--2PSLL";
const layoutClass = "Layout-unveilable--3OmrG";

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
const hiddenClass = "Cell-hidden--3xQI1";
const selectedClass = "Cell-selected--2PAbF";
const highlightedClass = "Cell-highlighted--2YbzJ";
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
const layout = puzzle?.querySelector(`div.${layoutClass}`);
const firstCell = document.getElementById("cell-id-0");
const xSize = firstCell?.width;
const ySize = firstCell?.height;
const xOffset = firstCell?.x;
const yOffset = firstCell?.y;

// given a "cell-id-" element, get its (x,y)
const getXYForCell = function(rectElem) {
  return {
    x: (rectElem.x - xOffset) / xSize,
    y: (rectElem.y - yOffset) / ySize,
  };
}

// given a sibling element to a "cell-id-" element, get its (x,y)
const getXYForCellSibling = function(siblingElem) {
  const cell = Array(siblingElem.parentElement.children)
    .find(elem => elem.id?.startsWith("cell-id-"));
  if (cell) { return getXYForCell(elem); }
  return { x: null, y: null };
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

let record, observerData;

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

const createObservers = function () {
  let observerData = [];

  // Observe the layout to detect whether a start/stop event
  // has occurred (addition of a "veil" element). Only needs
  // to observe childList.
  observerData.push({
    observer: new MutationObserver(startStopCallback),
    target: layout,
    options: { childList: true },
  });

  // Observe puzzle, to detect the congrats modal, which
  // we treat as a successful submit. Only needs to observe
  // childList.
  observerData.push({
    observer: new MutationObserver((mutationsList, _observer) => {
      if (mutationsList.find(x => x.target.querySelector(`.${congratsClass}`))) {
        recordEvent("submit", new Date().getTime(), { success: true });
      }
    }),
    target: puzzle,
    options: { childList: true },
  });

  // Observe each square in the puzzle to detect updates, reveals,
  // and checks. Needs to check childList, subtree, characterData,
  // and attributes (for "class" only).
  forEachCell((_, cell) => {
    if (cell.classList.contains(cellClass)) {
      observerData.push({
        observer: new MutationObserver(cellCallback),
        target: cell.parentElement,
        options: {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true,
          attributeOldValue: true,
          attributeFilter: ["class"],
        },
      });
    }
  });

  return observerData;
}

const enableObservers = function() {
  for (const data of observerData) {
    data.observer.observe(data.target, data.options)
  }
}

const disableObservers = function() {
  for (const data of observerData) {
    data.observer.disconnect();
  }
}

const updateBadgeAndObservers = function(record) {
  if (currentlySolved(record)) {
    disableObservers();
    chrome.runtime.sendMessage({ action: "setBadgeSolved" });
  } else {
    enableObservers();
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
        label = Array.from(labelElem.childNodes).find(x => x.nodeType == 3)?.data;
      }
      let fillElem = cell.parentElement.querySelector("[text-anchor=middle]");
      if (fillElem !== null) {
        fill = Array.from(fillElem.childNodes).find(x => x.nodeType == 3)?.data;
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

const recordEvent = function (type, timestamp, info = {}) {
  record.events.push({ type, timestamp, ...info });
  let successfulSubmit = type === "submit" && info.success;
  let timeToRecord;
  if (eventFlushFrequency) {
    timeToRecord = record.events.length % eventFlushFrequency === 0;
  }
  if (successfulSubmit || timeToRecord) {
    chrome.runtime.sendMessage({
      action: "storeRecord",
      key: storageKey,
      record: record,
    });
  }
  if (successfulSubmit) {
    // NOTE - once you've solved a puzzle, we won't keep logging anything.
    // So if you clear the puzzle and start again, we won't log anything new
    // unless you clear out the event log from storage manually. Seemed
    // reasonable (instead of accidentally logging extra stuff), but maybe
    // an option to toggle in the future, if people like clearing and
    // restarting more than I realize they do
    disableObservers();
    chrome.runtime.sendMessage({ action: "setBadgeSolved" });
  }
};

const startStopCallback = function (mutationsList, _observer) {
  let start = false, stop = false;
  for (const mutation of mutationsList) {
    if (Array.from(mutation.addedNodes).find(x => x.classList.contains(veilClass))) {
      stop = true;
    }
    if (Array.from(mutation.removedNodes).find(x => x.classList.contains(veilClass))) {
      start = true;
    }
  }
  if (start) {
    recordEvent("start", new Date().getTime());
  } else if (stop) {
    recordEvent("stop", new Date().getTime());
  }
};

const cellCallback = function (mutationsList, _observer) {
  // don't update any cells if we are currently in stopped state
  // this prevents us from re-adding already-solved cells as events
  // if we partially solve, then navigate away
  if (currentlyStopped(record)) {
    return;
  }

  // record timestamp now, to ensure that if we record multiple events
  // on this callback, they are recorded with the same timestamp
  let timestamp = new Date().getTime();

  for (const mutation of mutationsList) {
    if (mutation.type == "characterData") {
      // ignore changes in the "hidden" elements
      if (mutation.target.parentElement.classList.contains(hiddenClass)) {
        continue;
      }
      let eventData = getXYForCellSibling(mutation.target);
      eventData.fill = mutation.target.data;
      recordEvent("update", timestamp, eventData);
    }
    else if (mutation.type == "childList") {
      // ignore changes in the "hidden" elements
      if (mutation.target.classList.contains(hiddenClass)) {
        continue;
      }
      for (const addition of mutation.addedNodes) {
        if (addition.classList.contains(revealedClass)) {
          recordEvent("reveal", timestamp, getXYForCellSibling(addition));
          break;
        } else if (addition.classList.contains(checkedClass)) {
          recordEvent("check", timestamp, getXYForCellSibling(addition));
          break;
        }
        // ignore addition of other nodes, such as the <use> element
        // that appears when you check/reveal
      }
      // note that other changes are possible; we ignore node removal,
      // which can happen if you have <use> elements but then you
      // reset the puzzle
    }
    else if (mutation.type === "attributes" && mutation.target.nodeName === "use") {
      // ignore anything other than modifications to the <use> object
      // that appears and persists once you check/reveal
      if (mutation.target.classList.contains(revealedClass)) {
        recordEvent("reveal", timestamp, getXYForCellSibling(mutation.target));
        break;
      } else if (mutation.target.classList.contains(checkedClass)) {
        recordEvent("check", timestamp, getXYForCellSibling(mutation.target));
        break;
      }
    } else if (mutation.type === "attributes" && mutation.target.nodeName === "rect") {
      // selection/highlight logging
      // this can generate multiple events (i.e. both a selection and a highlight)
      if ((eventLogLevel === "selection" || eventLogLevel === "full") &&
          mutation.target.classList.contains(selectedClass)) {
        recordEvent("select", timestamp, getXYForCellSibling(mutation.target));
      }
      if (eventLogLevel === "full" &&
          mutation.target.classList.contains(highlightedClass) &&
          (mutation.oldValue === undefined || !mutation.oldValue.split(" ").includes(highlightedClass))) {
        recordEvent("highlight", timestamp, getXYForCellSibling(mutation.target));
      } else if (eventLogLevel === "full" &&
                 !mutation.target.classList.contains(highlightedClass) &&
                 (mutation.oldValue && mutation.oldValue.split(" ").includes(highlightedClass))) {
        recordEvent("unhighlight", timestamp, getXYForCellSibling(mutation.target));
      }
    }
  }
};

// if we navigate away/close tab, record a stop event if
// we aren't already stopped, and write the record out
window.onbeforeunload = () => {
  if (!currentlyStopped(record)) { recordEvent("stop"); }
  chrome.runtime.sendMessage({
    action: "storeRecord",
    key: storageKey,
    record: record,
  });
};

// interaction with popup

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
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
        updateBadgeAndObservers(record, observerData);
      });
    } else if (request.action === "downloadRecord") {
      let defaultStub = window.location.pathname
        .replace(/^\/crosswords\/game\//, "")
        .replace(/\//g, "-");
      sendResponse({
        success: true,
        record: record,
        defaultFilename: `nyt-${defaultStub}.json`,
      });
    }
    // force synchronous, otherwise calling sendResponse in the callbacks
    // seems to cause problems
    return true;
  }
);

// MAIN

// If for whatever reason we can't find the puzzle layout,
// nothing happens at all - record and observerData should
// remain undefined, and there will be no observation of
// updates or logging
if (layout !== null && layout !== undefined) {
  chrome.storage.sync.get([storageKey, "solverName", "logUserAgent"], (result) => {
    record = result[storageKey] || {};
    let userInfo = {};
    if (result.solverName) { userInfo.solverName = result.solverName }
    if (result.logUserAgent) { userInfo.userAgent = navigator.userAgent }
    updateRecordMetadata(record, userInfo, puzzle);
    observerData = createObservers();
    updateBadgeAndObservers(record, observerData);
  });
}
