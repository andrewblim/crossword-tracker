// magic constants (from NYT's crossword CSS/HTML)
const cellClass = "Cell-cell--1p4gH";
const hiddenClass = "Cell-hidden--3xQI1";
const revealedClass = "Shame-revealed--3jDzk";
const checkedClass = "Shame-checked--3E9GW";
const modifiedClass = "Shame-modified--2Mbw4";
const xSize = 33;
const ySize = 33;
const xFillOffset = 19.5;
const yFillOffset = 33.25;

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

// observe each square in the puzzle (if tracking is enabled)
// TODO: enable/disable this based on trackingEnabled
const cells = document.querySelectorAll(`rect.${cellClass}`);
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
