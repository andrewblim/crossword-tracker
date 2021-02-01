// magic constants (from NYT's crossword CSS/HTML)
const layoutClass = "Layout-unveilable--3OmrG";
const veilClass = "Veil-veil--3oKaF";
const cellClass = "Cell-cell--1p4gH";
const blockClass = "Cell-block--1oNaD";
const hiddenClass = "Cell-hidden--3xQI1";
const revealedClass = "Shame-revealed--3jDzk";
const checkedClass = "Shame-checked--3E9GW";
const modifiedClass = "Shame-modified--2Mbw4";
const xSize = 33;
const ySize = 33;
const xCellOffset = 3;
const yCellOffset = 3;
const xFillOffset = 19.5;
const yFillOffset = 33.25;

const captureBoardState = function () {
  let boardState = [];
  let x, y, fill;
  let i = 0;
  let cell = document.getElementById(`cell-id-${i}`);
  while (cell !== null) {
    x = (cell.getAttribute("x") - xCellOffset) / xSize;
    y = (cell.getAttribute("y") - yCellOffset) / ySize;
    if (cell.classList.contains(cellClass)) {
      let elem = cell.nextElementSibling;
      while (elem.nodeName !== "text" || elem.getAttribute("text-anchor") !== "middle") {
        elem = elem.nextElementSibling;
      }
      for (const elemChild of elem.childNodes) {
        if (elemChild.nodeType === 3) {
          fill = elemChild.data;
        }
      }
    }
    else if (cell.classList.contains(blockClass)) {
      fill = null;
    }
    boardState.push({x, y, fill});
    i += 1;
    cell = document.getElementById(`cell-id-${i}`);
  }
  return boardState;
}

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
  if (start) {
    console.log("start");
    boardState = captureBoardState();
    console.log(boardState);
  } else if (stop) {
    console.log("stop");
  }
};

const cellCallback = function (mutationsList, _observer) {
  let x, y, update;
  let reveal = false, check = false;
  for (const mutation of mutationsList) {
    if (mutation.type == "characterData") {
      // ignore changes in the "hidden" elements
      if (mutation.target.parentElement.classList.contains(hiddenClass)) {
        continue;
      }
      update = mutation.target.data;
      x = (mutation.target.parentElement.getAttribute("x") - xFillOffset) / xSize;
      y = (mutation.target.parentElement.getAttribute("y") - yFillOffset) / ySize;
    }
    else if (mutation.type == "childList") {
      // ignore changes in the "hidden" elements
      if (mutation.target.classList.contains(hiddenClass)) {
        continue;
      }
      for (const addition of mutation.addedNodes) {
        if (addition.classList.contains(revealedClass)) {
          reveal = true;
          x = addition.getAttribute("x") / xSize;
          y = addition.getAttribute("y") / ySize;
        }
        else if (addition.classList.contains(checkedClass)) {
          check = true;
          x = addition.getAttribute("x") / xSize;
          y = addition.getAttribute("y") / ySize;
        }
      }
    }
    else if (mutation.type == "attributes") {
      // ignore anything other than modifications to the <use> object
      // that appears and persists once you check/reveal
      if (mutation.target.nodeName !== "use") {
        continue;
      }
      if (mutation.target.classList.contains(revealedClass)) {
        reveal = true;
        x = mutation.target.getAttribute("x") / xSize;
        y = mutation.target.getAttribute("y") / ySize;
      }
      else if (mutation.target.classList.contains(checkedClass)) {
        check = true;
        x = mutation.target.getAttribute("x") / xSize;
        y = mutation.target.getAttribute("y") / ySize;
      }
    }
  }

  // nothing to trigger unless we've found an (x,y) to update
  if (x !== undefined && y !== undefined) {
    if (reveal) {
      console.log(`Reveal (${x},${y}) with ${update}`);
    }
    else if (check) {
      console.log(`Check (${x},${y})`);
    }
    else {
      console.log(`Update (${x},${y}) with ${update}`);
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
