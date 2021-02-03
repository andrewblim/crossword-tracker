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

// important basic elements we expect to find in the DOM
const appWrapper = document.querySelector(`div.${appWrapperClass}`);
const layout = appWrapper === null ? null : appWrapper.querySelector(`div.${layoutClass}`);

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
    if (elem.nodeName === "rect") {
      return getXYForCell(elem);
    }
  }
  return null;
}

// variable that keeps track of the record of solve
let record = {};

const storageKey = `record-${window.location.href}`;

// If for whatever reason we can't find the puzzle layout,
// skip everything
if (layout !== null) {
  chrome.storage.local.get(storageKey, (result) => {
    // Load the stored record
    if (result[storageKey] !== undefined) {
      record = result[storageKey];
    }

    // Overwrite metadata in the stored record with the latest
    // (current data takes precedence over storage)
    recordMetadata();

    // Attach all observers
    attachObservers();
  });
}

const recordMetadata = function () {
  const puzzleInfoElem = appWrapper.querySelector(`.${infoClass}`);
  if (puzzleInfoElem !== null) {
    const titleElem = puzzleInfoElem.querySelector(`.${titleClass}`);
    const dateElem = puzzleInfoElem.querySelector(`.${dateClass}`);
    const bylineElem = puzzleInfoElem.querySelector(`.${bylineClass}`);
    record.title = titleElem === null ? null : titleElem.textContent;
    record.date = dateElem === null ? null : dateElem.textContent;
    // byline info is in one or more sub-spans
    record.byline = bylineElem === null ? null : Array.from(bylineElem.children).map(x => x.textContent).join(" - ");
  }

  // overwrite clues with the latest
  const clueListWrapperElems = layout.querySelectorAll(`.${clueListWrapperClass}`);
  record.clueSections = {};
  for (clueListWrapperElem of clueListWrapperElems) {
    let sectionClues = [];
    const titleElem = clueListWrapperElem.querySelector(`.${clueListTitleClass}`);
    const title = titleElem === null ? null : titleElem.textContent;
    const listElem = clueListWrapperElem.querySelector(`.${clueListClass}`);
    if (listElem !== null) {
      sectionClues = Array.from(listElem.children)
        .filter(elem => elem.nodeName === "LI" && elem.classList.contains(clueClass))
        .map((clueElem) => {
          let clueLabel = null, clueText = null;
          for (clueSubElem of clueElem.children) {
            if (clueSubElem.classList.contains(clueLabelClass)) {
              clueLabel = clueSubElem.textContent;
            }
            else if (clueSubElem.classList.contains(clueTextClass)) {
              clueText = clueSubElem.textContent;
            }
          }
          return { label: clueLabel, text: clueText };
        });
    }
    record.clueSections[title] = sectionClues;
  }

  // capture initial board state if it doesn't exist
  if (record.initialState === undefined) {
    record.initialState = captureBoardState();
  }

  // add an event log if it doesn't exist
  if (record.events === undefined) {
    record.events = [];
  }
}

let observers = {};

// TODO: enable/disable observed based on trackingEnabled

const attachObservers = function () {
  // Observe the layout to detect whether a start/stop event
  // has occurred (addition of a "veil" element)
  observers.startStop = new MutationObserver(startStopCallback);
  observers.startStop.observe(layout, { childList: true });

  // Observe each square in the puzzle to detect updates, reveals,
  // and checks. Specifically, the parent <g> elements of the <rect>
  // cells, since reveal/check activity shows up as additional
  // siblings elements to the <rect> cells.
  let i = 0;
  let cell = document.getElementById(`cell-id-${i}`);
  while (cell !== null) {
    if (cell.classList.contains(cellClass)) {
      observers[cell.id] = new MutationObserver(cellCallback);
      observers[cell.id].observe(
        cell.parentElement,
        {
          attributes: true,
          childList: true,
          subtree: true,
          characterData: true,
          attributeFilter: ["class"],
        }
      );
    }
    i += 1;
    cell = document.getElementById(`cell-id-${i}`);
  }

  // Observe app wrapper, to detect the congrats modal, which
  // we treat as a submit event
  observers.submit = new MutationObserver((mutationsList, _observer) => {
    for (const mutation of mutationsList) {
      if (mutation.target.querySelector(`.${congratsClass}`) !== null) {
        recordEvent("submit", { success: true });
        break;
      }
    }
  });
  observers.submit.observe(appWrapper, { childList: true });
}

const captureBoardState = function () {
  let boardState = [];
  let x, y, label, fill;
  let i = 0;
  let cell = document.getElementById(`cell-id-${i}`);
  while (cell !== null) {
    ({ x, y } = getXYForCell(cell));
    if (cell.classList.contains(cellClass)) {
      label = undefined;
      fill = undefined;
      let labelElem = cell.parentElement.querySelector("[text-anchor=start]");
      if (labelElem !== null) {
        label = Array.from(labelElem.childNodes).find(x => x.nodeType == 3);
        if (label !== undefined) {
          label = label.data;
        }
      }
      let fillElem = cell.parentElement.querySelector("[text-anchor=middle]");
      if (fillElem !== null) {
        fill = Array.from(fillElem.childNodes).find(x => x.nodeType == 3);
        if (fill !== undefined) {
          fill = fill.data;
        }
      }
    }
    else if (cell.classList.contains(blockClass)) {
      label = undefined;
      fill = null; // denotes that it can't be filled
    }
    let cellState = { x, y, fill };
    if (label !== undefined) {
      cellState.label = label
    }
    boardState.push(cellState);
    i += 1;
    cell = document.getElementById(`cell-id-${i}`);
  }
  return boardState;
};

// Automatically store every this many events
const storeFrequency = 20;

const recordEvent = function (type, info = {}) {
  record.events.push({
    type: type,
    timestamp: new Date().getTime(),
    ...info
  });
  if (type === "submit" && info.success) {
    storeRecord(storageKey, record);
    // TODO: trigger save
  }
  else if (record.events.length % storeFrequency === 0) {
    storeRecord(storageKey, record);
  }
};

const startStopCallback = function (mutationsList, _observer) {
  let start = false, stop = false;
  for (const mutation of mutationsList) {
    for (addition of mutation.addedNodes) {
      if (addition.classList.contains(veilClass)) {
        stop = true;
        break;
      }
    }
    for (addition of mutation.removedNodes) {
      if (addition.classList.contains(veilClass)) {
        start = true;
        break;
      }
    }
  }
  if (start) {
    recordEvent("start");
  }
  else if (stop) {
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
        }
        else if (addition.classList.contains(checkedClass)) {
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
    else if (mutation.type == "attributes") {
      // ignore anything other than modifications to the <use> object
      // that appears and persists once you check/reveal
      if (mutation.target.nodeName !== "use") {
        continue;
      }
      if (mutation.target.classList.contains(revealedClass)) {
        reveal = true;
        ({ x, y } = getXYForCellSibling(mutation.target));
        break;
      }
      else if (mutation.target.classList.contains(checkedClass)) {
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
    }
    else if (check) {
      recordEvent("check", { x, y });
    }
    else {
      recordEvent("update", { x, y, fill });
    }
  }
};

// store management

const storeRecord = function (key, record) {
  chrome.storage.local.set({ [key]: record }, () => {
    // TODO - check for failure, blank record
    console.log(`Recorded to key ${key}`);
  });
};

const clearRecord = function (key) {
  chrome.storage.local.remove(key, () => {
    // TODO - check for failure
    console.log(`Removed data at ${key}`);
    record = {};
    recordMetadata();
  });
};

const currentlyStopped = function() {
  return (record.events.length == 0 ||
          record.events[record.events.length - 1].type == "stop");
}

// if we navigate away/close tab, record a stop event if
// we aren't already stopped, and write the record out
// TODO: should I be doing this in a service worker?
window.onbeforeunload = function () {
  if (!currentlyStopped()) {
    recordEvent("stop");
  }
  storeRecord(storageKey, record);
};

// interaction with popup

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.action === "logRecord") {
      console.log(record);
    }
    else if (request.action === "storeRecord") {
      storeRecord(storageKey, record);
    }
    else if (request.action === "clearRecord") {
      clearRecord(storageKey);
    }
    else if (request.action === "saveRecord") {
      let defaultFilename = window.location.pathname;
      defaultFilename = defaultFilename.replace(/^\/crosswords\/game\//, "");
      defaultFilename = defaultFilename.replace(/\//g, "-");
      defaultFilename = "nyt-" + defaultFilename + ".json";
      sendResponse({ record: record, defaultFilename: defaultFilename });
    }
  }
);
