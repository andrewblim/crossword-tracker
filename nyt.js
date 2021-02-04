// magic constants (from NYT's crossword CSS/HTML)

const appWrapperClass = "app-appWrapper--2PSLL";
const layoutClass = "Layout-unveilable--3OmrG";

const infoClass = "PuzzleDetails-details--1WqAl";
const titleClass = "PuzzleDetails-title--iv1IG";
const dateClass = "PuzzleDetails-date--1HNzj";
const bylineClass = "PuzzleDetails-byline--16J5w";

const clueListWrapperClass = "ClueList-wrapper--3m-kd";
const clueListTitleClass = "ClueList-title--1-3oW";
const clueListClass = "ClueList-list--2dD5-";
const clueClass = "Clue-li--1JoPu";
const clueLabelClass = "Clue-label--2IdMY";
const clueTextClass = "Clue-text--3lZl7";

const veilClass = "Veil-veil--3oKaF";
const cellClass = "Cell-cell--1p4gH";
const blockClass = "Cell-block--1oNaD";
const hiddenClass = "Cell-hidden--3xQI1";
const revealedClass = "Shame-revealed--3jDzk";
const checkedClass = "Shame-checked--3E9GW";
const modifiedClass = "Shame-modified--2Mbw4";
const congratsClass = "CongratsModal-congratsModalContent--19hpv";

// other constants, not user-configurable

const storageKey = `record-${window.location.href}`;

// Things that we eventually want to make user-configurable options
// TODO: options page

const storeFrequency = 20;

// important basic elements we expect to find in the DOM
const appWrapper = document.querySelector(`div.${appWrapperClass}`);
const layout = appWrapper?.querySelector(`div.${layoutClass}`);

// get cell size - assumes there's at least 1 cell and that all cells
// are the same size
let xSize, ySize, xOffset, yOffset;
const firstCell = document.getElementById("cell-id-0");
if (firstCell !== null) {
  xOffset = firstCell.getAttribute("x");
  yOffset = firstCell.getAttribute("y");
  xSize = firstCell.getAttribute("width");
  ySize = firstCell.getAttribute("height");
}

// given a <rect>, get its (x,y)
const getXYForCell = function(rectElem) {
  return {
    x: (rectElem.getAttribute("x") - xOffset) / xSize,
    y: (rectElem.getAttribute("y") - yOffset) / ySize
  };
}

// given a sibling element to a <rect>, get its (x,y)
const getXYForCellSibling = function(siblingElem) {
  for (const elem of siblingElem.parentElement.children) {
    if (elem.nodeName === "rect") { return getXYForCell(elem); }
  }
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

// If for whatever reason we can't find the puzzle layout,
// nothing happens at all - record and observerData should
// remain undefined, and there will be no observation of
// updates or logging
if (layout !== null && layout !== undefined) {
  chrome.storage.sync.get(storageKey, (result) => {
    // TODO: versioning check here, if stored result format needs an upgrade
    if (result[storageKey] !== undefined) {
      record = result[storageKey];
    } else {
      record = {}
    }
    updateRecordMetadata();
    observerData = [];
    createObservers();
    startObservers();
  });
}

// Update record with metadata from the DOM, capture initial
// state if it is not already present
const updateRecordMetadata = function () {
  const puzInfo = appWrapper.querySelector(`.${infoClass}`);

  const title = puzInfo?.querySelector(`.${titleClass}`)?.textContent;
  if (title !== undefined) { record.title = title; }
  const date = puzInfo?.querySelector(`.${dateClass}`)?.textContent;
  if (date !== undefined) { record.date = date; }

  // byline info is in one or more sub-spans
  const bylineElem = puzInfo?.querySelector(`.${bylineClass}`) || undefined;
  if (bylineElem !== undefined) {
    record.byline = Array.from(bylineElem.children)
      .map(x => x.textContent)
      .join(" - ");
  }

  record.clueSections = {};
  for (clueListWrapperElem of layout.querySelectorAll(`.${clueListWrapperClass}`)) {
    const titleElem = clueListWrapperElem.querySelector(`.${clueListTitleClass}`);
    const title = titleElem?.textContent || "";
    const listElem = clueListWrapperElem.querySelector(`.${clueListClass}`);
    let sectionClues = [];
    if (listElem !== null) {
      sectionClues = Array.from(listElem.children)
        .filter(elem => elem.nodeName === "LI" && elem.classList.contains(clueClass))
        .map((clueElem) => {
          let clueLabel = null, clueText = null;
          for (clueSubElem of clueElem.children) {
            if (clueSubElem.classList.contains(clueLabelClass)) {
              clueLabel = clueSubElem.textContent;
            } else if (clueSubElem.classList.contains(clueTextClass)) {
              clueText = clueSubElem.textContent;
            }
          }
          return { label: clueLabel, text: clueText };
        });
    }
    record.clueSections[title] = sectionClues;
  }

  // for initialState/events we defer to existing values
  if (record.initialState === undefined) {
    record.initialState = captureBoardState();
  }
  if (record.events === undefined) {
    record.events = [];
  }
}

const createObservers = function () {
  // Observe the layout to detect whether a start/stop event
  // has occurred (addition of a "veil" element). Only needs
  // to observe childList.
  observerData.push({
    observer: new MutationObserver(startStopCallback),
    target: layout,
    options: { childList: true },
  });

  // Observe app wrapper, to detect the congrats modal, which
  // we treat as a successful submit. Only needs to observe
  // childList.
  observerData.push({
    observer: new MutationObserver((mutationsList, _observer) => {
      if (mutationsList.find(x => x.target.querySelector(`.${congratsClass}`))) {
        recordEvent("submit", { success: true });
      }
    }),
    target: appWrapper,
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
          attributeFilter: ["class"],
        },
      });
    }
  });
}

const startObservers = function() {
  for (const data of observerData) {
    data.observer.observe(data.target, data.options)
  }
}

const stopObservers = function() {
  for (const observer of observerData) {
    observer.disconnect();
  }
}

const captureBoardState = function () {
  let boardState = [];
  forEachCell( (i, cell) => {
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
    if (label !== undefined) {
      cellState.label = label
    }
    boardState.push(cellState);
  });
  return boardState;
};

const recordEvent = function (type, info = {}) {
  record.events.push({
    type: type,
    timestamp: new Date().getTime(),
    ...info
  });
  let successfulSubmit = type === "submit" && info.success;
  let timeToRecord = record.events.length % storeFrequency === 0;
  if (successfulSubmit || timeToRecord) {
    chrome.runtime.sendMessage({
      action: "storeRecord",
      key: storageKey,
      record: record,
    });
  }
  if (successfulSubmit) {
    // TODO: trigger save
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
    recordEvent("start");
  } else if (stop) {
    recordEvent("stop");
  }
};

const cellCallback = function (mutationsList, _observer) {
  // don't update any cells if we are currently in stopped state
  // this prevents us from re-adding already-solved cells as events
  // if we partially solve, then navigate away
  if (currentlyStopped()) {
    return;
  }

  let x, y, fill;
  let reveal = false, check = false;
  for (const mutation of mutationsList) {
    if (mutation.type == "characterData") {
      // ignore changes in the "hidden" elements
      if (mutation.target.parentElement.classList.contains(hiddenClass)) {
        continue;
      }
      fill = mutation.target.data;
      ({ x, y } = getXYForCellSibling(mutation.target.parentElement));
    }
    else if (mutation.type == "childList") {
      // ignore changes in the "hidden" elements
      if (mutation.target.classList.contains(hiddenClass)) {
        continue;
      }
      for (const addition of mutation.addedNodes) {
        if (addition.classList.contains(revealedClass)) {
          reveal = true;
          ({ x, y } = getXYForCellSibling(addition));
          break;
        } else if (addition.classList.contains(checkedClass)) {
          check = true;
          ({ x, y } = getXYForCellSibling(addition));
          break;
        }
        // ignore addition of other nodes, such as the <use> element
        // that appears when you check/reveal
      }
      // note that other changes are possible; we ignore node removal,
      // which can happen if you have <use> elements but then you
      // reset the puzzle
    }
    else if (mutation.type == "attributes" && mutation.target.nodeName === "use") {
      // ignore anything other than modifications to the <use> object
      // that appears and persists once you check/reveal
      if (mutation.target.classList.contains(revealedClass)) {
        reveal = true;
        ({ x, y } = getXYForCellSibling(mutation.target));
        break;
      } else if (mutation.target.classList.contains(checkedClass)) {
        check = true;
        ({ x, y } = getXYForCellSibling(mutation.target));
        break;
      }
    }
  }

  // nothing to trigger unless we've found an (x,y) to update
  if (x !== undefined && y !== undefined) {
    if (reveal) {
      recordEvent("reveal", { x, y, fill });
    } else if (check) {
      recordEvent("check", { x, y });
    } else {
      recordEvent("update", { x, y, fill });
    }
  }
};

// We should be in a stopped state if and only if the last event
// was a stop event (or there have been no events yet at all)
const currentlyStopped = function() {
  return (record.events.length == 0 ||
          record.events[record.events.length - 1].type == "stop");
}

// if we navigate away/close tab, record a stop event if
// we aren't already stopped, and write the record out
window.onbeforeunload = function () {
  if (!currentlyStopped()) { recordEvent("stop"); }
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
        {
          action: "storeRecord",
          key: storageKey,
          record: record,
        },
        sendResponse,
      );
    } else if (request.action === "clearRecord") {
      // service worker manages storage
      chrome.runtime.sendMessage(
        {
          action: "clearRecord",
          key: storageKey,
        },
        sendResponse,
      );
      record = {};
      updateRecordMetadata();
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
