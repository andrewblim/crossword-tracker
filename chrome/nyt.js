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
const getXYForCell = (rectElem) => {
  return {
    x: (rectElem.getAttribute("x") - xOffset) / xSize,
    y: (rectElem.getAttribute("y") - yOffset) / ySize,
  };
}

// given a sibling to a "cell-id-" element, get the "cell-id-" element
const getCellSibling = (siblingElem) => {
  return Array.from(siblingElem.parentElement.children)
    .find(elem => elem.id?.startsWith("cell-id-"));
}

// iterate through cells
const forEachCell = (f) => {
  let i = 0;
  let cell = document.getElementById(`cell-id-${i}`);
  while (cell !== null) {
    f(i, cell);
    i += 1;
    cell = document.getElementById(`cell-id-${i}`);
  }
}

// Extract clue sections from the puzzle
const getClueSections = (puzzle) => {
  let clueSections = {};
  for (const wrapperElem of puzzle.querySelectorAll(`.${clueListWrapperClass}`)) {
    const title = wrapperElem.querySelector(`.${clueListTitleClass}`)?.textContent || "";
    const clueElems = wrapperElem.querySelectorAll(`.${clueClass}`);
    clueSections[title] = Array.from(clueElems)
      .filter(elem => elem.nodeName === "LI" && elem.classList.contains(clueClass))
      .map((clueElem) => {
        let children = Array.from(clueElem.children);
        let clueLabel = children.find(x => x.classList.contains(clueLabelClass))?.textContent || "";
        let clueText = children.find(x => x.classList.contains(clueTextClass))?.textContent || "";
        return { label: clueLabel, text: clueText };
      });
  }
  return clueSections;
}

// Extract board state from the puzzle - note that this relies on the ids of
// cell elements, so we don't end up passing the puzzle element as an argument
const getBoardState = () => {
  const boardState = [];
  forEachCell((_, cell) => {
    let x, y, label, fill, hasCircle = false;
    ({ x, y } = getXYForCell(cell));
    if (cell.classList.contains(cellClass)) {
      // fillable cell - may have label, existing fill, and extra shapes
      let labelElem = cell.parentElement.querySelector("[text-anchor=start]");
      if (labelElem !== null) {
        label = Array.from(labelElem.childNodes).find(x => x.nodeType === 3)?.data;
      }
      let fillElem = cell.parentElement.querySelector("[text-anchor=middle]");
      if (fillElem !== null) {
        fill = Array.from(fillElem.childNodes).find(x => x.nodeType === 3)?.data;
      }
      hasCircle = cell.parentElement.querySelector("circle") !== null;
    } else if (cell.classList.contains(blockClass)) {
      // non-fillable cell
      fill = null;
    }
    let cellState = { x, y, fill };
    if (label !== undefined) { cellState.label = label; }
    if (hasCircle) { cellState.extraShape = "circle"; }
    boardState.push(cellState);
  });
  return boardState;
};

// Update record with metadata from the DOM and from supplied user info
const updateRecordMetadata = (record, userInfo, puzzle) => {
  record.version = "0.1";
  record.url = window.location.href;
  const title = puzzle.querySelector(`.${titleClass}`)?.textContent;
  if (title !== undefined) { record.title = title; }
  const date = puzzle.querySelector(`.${dateClass}`)?.textContent;
  if (date !== undefined) { record.date = date; }

  // byline info is in one or more sub-spans
  const bylineElem = puzzle.querySelector(`.${bylineClass}`);
  if (bylineElem) {
    record.byline = Array.from(bylineElem.children).map(x => x.textContent).join(" - ");
  }

  // Actively remove solverName and userAgent if not supplied in userInfo but
  // present in the supplied record
  if (userInfo.solverName !== undefined) {
    record.solverName = userInfo.solverName;
  } else {
    delete record.solverName;
  }
  if (userInfo.userAgent !== undefined) {
    record.userAgent = userInfo.userAgent;
  } else {
    delete record.userAgent;
  }
}

const updateRecordingStatus = (record, observer) => {
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

// Record a batch of events

const recordEventBatch = (record, events, storageKey, observer) => {
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
  if (autosaveFrequency > 0) {
    eventsSinceLastSave += events.length;
    enoughEventsToRecord = eventsSinceLastSave >= autosaveFrequency;
  }
  if (hasStoppage || hasSuccessfulSubmit || enoughEventsToRecord) {
    console.log(`Saving to browser storage (stoppage: ${hasStoppage}, ` +
                `successful submit: ${hasSuccessfulSubmit}, ` +
                `enough events: ${enoughEventsToRecord})`)
    chrome.runtime.sendMessage(
      { action: "cacheRecord", key: storageKey, record },
      (result) => {
        if (result && result.success) { eventsSinceLastSave = 0; }
      },
    );
  }
  if (hasSuccessfulSubmit) {
    observer.disconnect();
    chrome.runtime.sendMessage({ action: "setBadgeSolved" });
  }
};

const initializeTracking = async () => {
  const boardState = getBoardState(puzzle);
  const clueSections = getClueSections(puzzle);
  const storageKey = await computedPuzzleId(boardState, clueSections);

  chrome.storage.local.get(
    [storageKey, "general", "nyt"],
    (result) => {
      // Get event-logging settings
      eventLogLevel = result.general.eventLogLevel || "full";
      autosaveFrequency = result.nyt?.autosaveFrequency || 0;

      // Set up a new record variable or get an existing one from storage, then
      // either way, update with latest info
      let record = result[storageKey] || {};
      const userInfo = {
        solverName: result.general.solverName,
        userAgent: result.general.logUserAgent,
      };
      updateRecordMetadata(record, userInfo, puzzle);

      // For clues, initial state, and events, defer to anything that's already
      // been recorded, but initialize anything that's not there.
      if (!record.clueSections) { record.clueSections = clueSections; }
      if (!record.initialState) { record.initialState = boardState; }
      if (!record.events) { record.events = []; }

      // Main callback that monitors the puzzle
      const puzzleCallback = (mutationsList, observer) => {
        const newEvents = [];
        const timestamp = new Date().getTime();
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
        recordEventBatch(record, newEvents, storageKey, observer);
      };

      const observer = new MutationObserver(puzzleCallback);
      updateRecordingStatus(record, observer);

      // If we navigate away/close tab, and there has been at least one event,
      // record a stop event if we aren't already stopped, and cache the record
      // so that we don't lose progress.
      window.onbeforeunload = () => {
        if (!currentlyStopped(record) && !currentlyUnstarted(record)) {
          recordEventBatch(
            record,
            [{ type: "stop", timestamp: new Date().getTime() }],
            storageKey,
            observer,
          );
          chrome.runtime.sendMessage(
            { action: "cacheRecord", key: storageKey, record: record },
          );
        }
      };

      // Allow interaction with popup. This generally happens synchronously,
      // we don't need these to run quickly/in parallel and we would like to
      // give the user feedback about whether what they did worked or not.
      chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
        switch (request.action) {
          case "ping":
            sendResponse({ success: true });
            break;
          case "getRecord":
            sendResponse({ success: true, record });
            break;
          case "logRecord":
            console.log(record);
            sendResponse({ success: true });
            break;
          case "cacheRecord":
            chrome.runtime.sendMessage(
              { action: "cacheRecord", key: storageKey, record: record },
              (result) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError });
                } else {
                  sendResponse(result);
                  if (result.success) { eventsSinceLastSave = 0; }
                }
                return true; // force synchronous
              },
            );
            break;
          case "clearAndResetRecord":
            chrome.runtime.sendMessage(
              { action: "clearRecord", key: storageKey },
              (result) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ success: false, error: chrome.runtime.lastError });
                } else {
                  sendResponse(result);
                  if (result.success) {
                    record = {};
                    const userInfo = {
                      solverName: result.general.solverName,
                      userAgent: result.general.logUserAgent,
                    };
                    updateRecordMetadata(record, userInfo, puzzle);
                    record.clueSections = getClueSections(puzzle);
                    record.initialState = getBoardState(puzzle);
                    record.events = [];
                    updateRecordingStatus(record, observer);
                  }
                }
                return true; // force synchronous
              },
            );
            break;
        }
        return true; // force synchronous
      });
    },
  );
};

// Only do anything if we were able to find the puzzle element.

let autosaveFrequency, eventLogLevel;
let eventsSinceLastSave = 0;

if (puzzle) { initializeTracking(); }
