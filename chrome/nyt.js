"use strict";

// constants from NYT's crossword CSS/HTML

const puzzleClass = "app-appWrapper--2PSLL";

const titleClass = "PuzzleDetails-title--iv1IG";
const dateClass = "PuzzleDetails-date--1HNzj";
const bylineClass = "PuzzleDetails-byline--16J5w";

const clueListWrapperClass = "ClueList-wrapper--3m-kd";
const clueListTitleClass = "ClueList-title--1-3oW";
const clueClass = "Clue-li--1JoPu";
const clueLabelClass = "Clue-label--2IdMY";
const clueTextClass = "Clue-text--3lZl7";
const clueSelectedClass = "Clue-selected--1ta_-";

const veilClass = "Veil-veil--3oKaF";
const cellClass = "Cell-cell--1p4gH";
const blockClass = "Cell-block--1oNaD";
const selectedClass = "Cell-selected--2PAbF";
const revealedClass = "Shame-revealed--3jDzk";
const checkedClass = "Shame-checked--3E9GW";
const confirmedClass = "Shame-confirmed--32ADK";
const congratsClass = "CongratsModal-congratsModalContent--19hpv";

// per-page constants
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

// get basic info that we need to determine a storage key

const getPuzzleTitle = (puzzle) => {
  return puzzle.querySelector(`.${titleClass}`)?.textContent;
}

const getPuzzleDate = (puzzle) => {
  return puzzle.querySelector(`.${dateClass}`)?.textContent;
}

const getPuzzleByline = (puzzle) => {
  // byline info is in one or more sub-spans
  const bylineElem = puzzle.querySelector(`.${bylineClass}`);
  if (bylineElem) {
    return Array.from(bylineElem.children).map(x => x.textContent).join(" - ");
  }
}

// Update record with metadata from the DOM and from supplied user info
const updateRecordMetadata = function (record, userInfo, puzzle) {
  // Version info not yet used, but reserved for the future, in case we want to
  // make breaking changes to the format.
  record.version = "0.1";

  record.url = window.location.href;
  if (puzzle) {
    const title = getPuzzleTitle(puzzle);
    if (title !== undefined) { record.title = title; }
    const date = getPuzzleDate(puzzle);
    if (date !== undefined) { record.date = date; }
    const byline = getPuzzleByline(puzzle);
    if (byline !== undefined) { record.byline = byline; }
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

// Record a batch of events

const recordEventBatch = function (events, storageKey) {
  // Don't record anything if we are stopped, unless there is a start event
  // in the event batch. This prevents us from incorrectly creating events
  // if we load a puzzle that already has fill.
  if (currentlyStopped(record) && !currentlyUnstarted(record) &&
      events.find(x => x.type === "start") === undefined) {
    return;
  }

  // Add each event into the appropriate place in record.events. While this
  // is often at the end, we want to make sure concurrent events are placed in
  // the order indicated by compareEvents, and we also want this to be robust
  // to event batches arriving out of order.
  let hasStoppage = false, hasSuccessfulSubmit = false;
  for (const event of events) {
    let i = record.events.length;
    if (event.type === "stop") {
      hasStoppage = true;
    } else if (event.type === "submit" && event.success) {
      hasSuccessfulSubmit = true;
    }
    while (i > 0 && compareEvents(record.events[i - 1], event) >= 0) { i--; }
    record.events.splice(i, 0, event);
  }

  // cache the record on stoppages, submits, or just if it's been a while
  let enoughEventsToRecord = false;
  if (eventFlushFrequency) {
    eventsSinceLastFlush += events.length;
    enoughEventsToRecord = eventsSinceLastFlush >= eventFlushFrequency;
  }
  if (hasStoppage || hasSuccessfulSubmit || enoughEventsToRecord) {
    console.log(`Saving to browser storage (stoppage: ${hasStoppage}, ` +
                `successful submit: ${hasSuccessfulSubmit}, ` +
                `enough events: ${enoughEventsToRecord})`)
    chrome.runtime.sendMessage(
      { action: "cacheRecord", key: storageKey, record },
      (result) => {
        if (result && result.success) { eventsSinceLastFlush = 0; }
      },
    );
  }
  if (hasSuccessfulSubmit) {
    observer.disconnect();
    chrome.runtime.sendMessage({ action: "setBadgeSolved" });
  }
};

let record, observer;
let eventFlushFrequency, eventLogLevel;
let eventsSinceLastFlush = 0;

// Only do anything if we were able to find the puzzle element.

if (puzzle) {
  // We need enough info from the puzzle to determine the storage key to check
  // for an existing record
  const title = getPuzzleTitle(puzzle);
  const date = getPuzzleDate(puzzle);
  const byline = getPuzzleByline(puzzle);
  const storageKey = recordStorageKey(title, date, byline);

  chrome.storage.local.get(
    [storageKey, "solverName", "eventLogLevel", "logUserAgent", "nytSettings"],
    (result) => {
      // Get event-logging settings
      eventLogLevel = result.eventLogLevel || "full";
      eventFlushFrequency = result.nytSettings?.eventFlushFrequency;

      // Set up a new record variable or get an existing one from storage, then
      // either way, update with latest info
      record = result[storageKey] || {};
      let userInfo = {};
      if (result.solverName) { userInfo.solverName = result.solverName }
      if (result.logUserAgent) { userInfo.userAgent = navigator.userAgent }
      updateRecordMetadata(record, userInfo, puzzle);

      // If we navigate away/close tab, and there has been at least one event,
      // record a stop event if we aren't already stopped and cache the record
      // so that we don't lose progress.
      window.onbeforeunload = () => {
        if (!currentlyStopped(record) && !currentlyUnstarted(record)) {
          recordEventBatch(
            [{ type: "stop", timestamp: new Date().getTime() }],
            storageKey,
          );
          chrome.runtime.sendMessage(
            { action: "cacheRecord", key: storageKey, record: record },
          );
        }
      };

      // Create and start observer with callback
      const puzzleCallback = (mutationsList, _observer) => {
        // record timestamp now, to ensure that all events generated from a
        // single callback call have the same timestamp
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
                  newEvents.push({ type: "update", timestamp, ...getXYForCell(cell), fill });
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
                  newEvents.push({ type: "submit", timestamp, success: true });
                } else if (node.classList?.contains(veilClass)) {
                  newEvents.push({ type: "stop", timestamp });
                } else if (node.classList?.contains(revealedClass)) {
                  let cell = getCellSibling(node);
                  if (cell) { newEvents.push({ type: "reveal", timestamp, ...getXYForCell(cell) }); }
                } else if (node.classList?.contains(checkedClass)) {
                  let cell = getCellSibling(node);
                  if (cell) { newEvents.push({ type: "check", timestamp, ...getXYForCell(cell) }); }
                }
              }
              for (const node of mutation.removedNodes) {
                if (node.classList?.contains(veilClass)) {
                  newEvents.push({ type: "start", timestamp });
                }
              }
              break;
            case "attributes":
              // subsequent reveal/check
              // either <use> element already there and gets modified
              // or the <rect> is highlighted as "confirmed", if you check or
              // reveal a correct square, which we treat as a "check" event
              if (mutation.target.classList?.contains(revealedClass)) {
                let cell = getCellSibling(mutation.target);
                if (cell) { newEvents.push({ type: "reveal", timestamp, ...getXYForCell(cell) }); }
              } else if (mutation.target.classList?.contains(checkedClass) ||
                         mutation.target.classList?.contains(confirmedClass)) {
                let cell = getCellSibling(mutation.target);
                if (cell) { newEvents.push({ type: "check", timestamp, ...getXYForCell(cell) }); }
              } else if (eventLogLevel === "full" &&
                         mutation.target.classList?.contains(selectedClass) &&
                         !(mutation.oldValue.split(" ").includes(selectedClass))) {
                let cell = getCellSibling(mutation.target);
                if (cell) { newEvents.push({ type: "select", timestamp, ...getXYForCell(cell) }); }
              } else if (eventLogLevel === "full" &&
                         mutation.target.classList?.contains(clueSelectedClass) &&
                         !(mutation.oldValue.split(" ").includes(clueSelectedClass))) {
                let clueSection =
                  Array.from(mutation.target.parentElement?.parentElement?.children || [])
                  .find(elem => elem.classList?.contains(clueListTitleClass))
                  ?.textContent || null;
                let clueLabel =
                  Array.from(mutation.target.children || [])
                  .find(elem => elem.classList?.contains(clueLabelClass))
                  ?.textContent || null;
                if (clueSection && clueLabelClass) {
                  newEvents.push({ type: "selectClue", timestamp, clueSection, clueLabel });
                }
              }
              break;
          }
        }
        recordEventBatch(newEvents, storageKey);
      };

      observer = new MutationObserver(puzzleCallback);
      updateRecordingStatus(record);

      // Allow interaction with popup. This generally happens synchronously,
      // we don't need these to run quickly/in parallel and we would like to
      // give the user feedback about whether what they did worked or not.
      chrome.runtime.onMessage.addListener(
        function (request, _sender, sendResponse) {
          if (request.action === "ping") {
            sendResponse({ success: true });
          } else if (request.action === "getRecord") {
            sendResponse({ success: true, record });
          } else if (request.action === "logRecord") {
            console.log(record);
            sendResponse({ success: true });
          } else if (request.action === "cacheRecord") {
            chrome.runtime.sendMessage(
              { action: "cacheRecord", key: storageKey, record: record },
              (result) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError });
                } else if (result.success) {
                  sendResponse(result);
                  eventsSinceLastFlush = 0;
                } else {
                  sendResponse(result);
                }
                return true; // force synchronous
              },
            );
          } else if (request.action === "clearAndResetRecord") {
            chrome.runtime.sendMessage(
              { action: "clearRecord", key: storageKey },
              (result) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError });
                } else if (result.success) {
                  sendResponse(result);
                  record = {};
                  let userInfo = {};
                  if (result.solverName) { userInfo.solverName = result.solverName }
                  if (result.logUserAgent) { userInfo.userAgent = navigator.userAgent }
                  updateRecordMetadata(record, userInfo, puzzle);
                  updateRecordingStatus(record);
                } else {
                  sendResponse(result);
                }
                return true; // force synchronous
              },
            );
          }
          return true; // force synchronous
        }
      );
    },
  );
}
