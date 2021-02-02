// magic constants (from NYT's crossword CSS/HTML)

const infoClass = "PuzzleDetails-details--1WqAl";
const titleClass = "PuzzleDetails-title--iv1IG";
const dateClass = "PuzzleDetails-date--1HNzj";
const bylineClass = "PuzzleDetails-byline--16J5w";

const layoutClass = "Layout-unveilable--3OmrG";

const clueSectionClass = "ClueList-wrapper--3m-kd";
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

const appWrapperClass = "app-appWrapper--2PSLL";
const congratsClass = "CongratsModal-congratsModalContent--19hpv";

// get metadata

const puzzleInfoElem = document.querySelector(`div.${infoClass}`);
const titleElem = puzzleInfoElem.querySelector(`div.${titleClass}`);
const title = titleElem === null ? null : titleElem.textContent;
const dateElem = puzzleInfoElem.querySelector(`div.${dateClass}`);
const date = dateElem === null ? null : dateElem.textContent;
const bylineElem = puzzleInfoElem.querySelector(`div.${bylineClass}`);
// byline info is in one or more sub-spans
const byline = bylineElem === null ? null : Array.from(bylineElem.children).map(x => x.textContent).join(" - ");

// get clues

const clueSectionsElem = document.querySelectorAll(`div.${clueSectionClass}`);
let clueSections = {};
for (clueSectionElem of clueSectionsElem) {
  let sectionClues = [];
  const titleElem = clueSectionElem.querySelector(`.${clueListTitleClass}`);
  const title = titleElem === null ? null : titleElem.textContent;
  const listElem = clueSectionElem.querySelector(`.${clueListClass}`);
  if (listElem !== null) {
    for (clueElem of listElem.children) {
      let clueLabel = null, clueText = null;
      if (clueElem.nodeName === "LI" && clueElem.classList.contains(clueClass)) {
        for (clueSubElem of clueElem.children) {
          if (clueSubElem.classList.contains(clueLabelClass)) {
            clueLabel = clueSubElem.textContent;
          }
          else if (clueSubElem.classList.contains(clueTextClass)) {
            clueText = clueSubElem.textContent;
          }
        }
      }
      sectionClues.push({ label: clueLabel, text: clueText });
    }
  }
  clueSections[title] = sectionClues;
}

// get cell size - assumes there's at least 1 cell and that all cells
// are the same size

let xSize, ySize, xOffset, yOffset;
let firstCell = document.getElementById("cell-id-0");
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

let eventLog = [];

const captureBoardState = function () {
  let boardState = [];
  let x, y, fill;
  let i = 0;
  let cell = document.getElementById(`cell-id-${i}`);
  while (cell !== null) {
    ({ x, y } = getXYForCell(cell));
    if (cell.classList.contains(cellClass)) {
      let elem = cell.nextElementSibling;
      while (elem.nodeName !== "text" || elem.getAttribute("text-anchor") !== "middle") {
        elem = elem.nextElementSibling;
      }
      // fish out the text content only
      for (const elemChild of elem.childNodes) {
        if (elemChild.nodeType === 3) {
          fill = elemChild.data;
        }
      }
    }
    else if (cell.classList.contains(blockClass)) {
      fill = null;
    }
    boardState.push({ x, y, fill });
    i += 1;
    cell = document.getElementById(`cell-id-${i}`);
  }
  return boardState;
};

const generateEvent = function (type, info = {}) {
  return {
    type: type,
    timestamp: new Date().getTime(),
    ...info
  };
};

const veilCallback = function (mutationsList, _observer) {
  let start = false, stop = false;
  for (const mutation of mutationsList) {
    for (addition of mutation.addedNodes) {
      if (addition.classList.contains(veilClass)) {
        stop = true;
      }
    }
    for (addition of mutation.removedNodes) {
      if (addition.classList.contains(veilClass)) {
        start = true;
      }
    }
  }

  if (start && eventLog.length === 0) {
    eventLog.push(generateEvent("start", { boardState: captureBoardState() }));
  }
  else if (start) {
    eventLog.push(generateEvent("start")); // only generate board state if first event
  }
  else if (stop) {
    eventLog.push(generateEvent("stop"));
  }
};

const cellCallback = function (mutationsList, _observer) {
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
      eventLog.push(generateEvent("reveal", { x, y, fill }));
    }
    else if (check) {
      eventLog.push(generateEvent("check", { x, y }));
    }
    else {
      eventLog.push(generateEvent("update", { x, y, fill }));
    }
  }
};

// TODO: enable/disable observed based on trackingEnabled

// observe veil, to log start/stop events
const layout = document.querySelector(`div.${layoutClass}`);
const layoutObserver = new MutationObserver(veilCallback);
layoutObserver.observe(layout, { childList: true });

// observe each square in the puzzle
const cells = layout.querySelectorAll(`rect.${cellClass}`);
for (const cell of cells) {
  field = cell.parentElement;
  const observer = new MutationObserver(cellCallback);
  observer.observe(
    field,
    {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: ["class"],
    }
  );
}

// observe app wrapper, to detect the congrats modal
const appWrapper = document.querySelector(`div.${appWrapperClass}`);
const appWrapperObserver = new MutationObserver((mutationsList, _observer) => {
  for (const mutation of mutationsList) {
    if (mutation.target.querySelector(`.${congratsClass}`) !== null) {
      eventLog.push(generateEvent("submit", { success: true }));
      break;
    }
  }
});
appWrapperObserver.observe(appWrapper, { childList: true });

// interaction with popup

chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.action === "logEvents") {
      console.log({
        title: title,
        date: date,
        byline: byline,
        clueSections: clueSections,
        events: eventLog,
      });
    }
    else if (request.action === "saveEvents") {
      // can't download from a content script, foist this off to sender
      let defaultFilename = window.location.pathname;
      defaultFilename = defaultFilename.replace(/^\/crosswords\/game\//, "");
      defaultFilename = defaultFilename.replace(/\//g, "-");
      defaultFilename = "nyt-" + defaultFilename + ".json";
      sendResponse({
        data: {
          title: title,
          date: date,
          byline: byline,
          clueSections: clueSections,
          events: eventLog,
        },
        defaultFilename: defaultFilename,
      });
    }
  }
);
