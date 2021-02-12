"use strict";

const createSolveAnimation = function(record) {
  const svgNS = "http://www.w3.org/2000/svg";

  // TODO: make these settable and validated
  const width = 500;
  const height = 750;
  const margin = 50;
  const backgroundColor = "lightgray";
  const gridColor = "gray";
  const fillableColor = "white";
  const unfillableColor = "black";
  const selectedColor = "yellow";
  const animationSpeed = 1.0;

  document.getElementById("solve-animation")?.remove();

  let svg = document.createElementNS(svgNS, "svg");
  svg.id = "solve-animation";
  svg.setAttribute("version", "1.1");
  svg.setAttribute("baseProfile", "full");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("xmlns", svgNS);

  let bg = document.createElementNS(svgNS, "rect");
  bg.setAttribute("width", width);
  bg.setAttribute("height", height);
  bg.setAttribute("fill", backgroundColor);

  // Info above puzzle (title, date, byline, solver)

  const titleAndDateFontSize = 0.02 * height;
  let titleAndDate = document.createElementNS(svgNS, "text");
  titleAndDate.setAttribute("x", margin);
  titleAndDate.setAttribute("y", margin);
  titleAndDate.setAttribute("dominant-baseline", "hanging");
  titleAndDate.setAttribute("style", `font-size: ${titleAndDateFontSize}px; font-family: sans-serif`);
  let title = document.createElementNS(svgNS, "tspan");
  title.setAttribute("style", "font-weight: bold");
  title.textContent = record.title;
  let separatorAndDate = document.createElementNS(svgNS, "tspan");
  separatorAndDate.textContent = ` - ${record.date}`;
  titleAndDate.append(title);
  titleAndDate.append(separatorAndDate);

  const bylineFontSize = 0.8 * titleAndDateFontSize;
  let byline = document.createElementNS(svgNS, "text");
  byline.setAttribute("x", margin);
  byline.setAttribute("y", margin);
  byline.setAttribute("dominant-baseline", "hanging");
  byline.setAttribute("dy", titleAndDateFontSize * 1.3);
  byline.setAttribute("style", `font-size: ${bylineFontSize}px; font-family: sans-serif`);
  byline.textContent = record.byline;

  const solverFontSize = bylineFontSize;
  let solver = document.createElementNS(svgNS, "text");
  solver.setAttribute("x", margin);
  solver.setAttribute("y", margin);
  solver.setAttribute("dominant-baseline", "hanging");
  solver.setAttribute("dy", (titleAndDateFontSize + bylineFontSize) * 1.3);
  solver.setAttribute("style", `font-size: ${solverFontSize}px; font-family: sans-serif`);
  solver.textContent = `Solver: ${record.solverName}`;

  // Info below puzzle (timer, complete indicator)

  const progressFontSize = (width - 2 * margin) * 0.0375;
  let complete = document.createElementNS(svgNS, "text");
  complete.setAttribute("x", width - margin);
  complete.setAttribute("y", height - margin);
  complete.setAttribute("text-anchor", "end");
  complete.setAttribute("style", `font-size: ${progressFontSize}px; font-family: sans-serif; font-weight: bold`);
  complete.setAttribute("visibility", "hidden");
  complete.textContent = "Complete!";

  const timer = document.createElementNS(svgNS, "text");
  timer.setAttribute("x", margin);
  timer.setAttribute("y", height - margin);
  timer.setAttribute("style", `font-size: ${progressFontSize}px; font-family: sans-serif; font-weight: bold`);
  timer.textContent = "00:00";
  // TODO: make an animation out of this

  // Puzzle itself (grid, current clue)

  // Figure out max puzzle width (dependent on width and margins) and max
  // puzzle height (dependent on height and having enough room for everything
  // else). Set square size based on the lesser of those two

  const topOffset = (titleAndDateFontSize + bylineFontSize) * 1.3 + solverFontSize * 2.0;
  const bottomOffset = progressFontSize * 2;

  const nCols = Array.from(record["initialState"])
    .map(sq => sq.x).reduce((x1, x2) => Math.max(x1, x2)) + 1;
  const nRows = Array.from(record["initialState"])
    .map(sq => sq.y).reduce((y1, y2) => Math.max(y1, y2)) + 1;
  const maxGridWidth = width - 2 * margin;
  const maxGridHeight = height - 2 * margin - topOffset - bottomOffset;
  const sqSize = Math.min(maxGridWidth / nCols, maxGridHeight / nRows);

  const squaresG = document.createElementNS(svgNS, "g");
  squaresG.setAttribute("stroke", gridColor);
  const labelsFontSize = sqSize * 0.2;
  const labelsG = document.createElementNS(svgNS, "g");
  labelsG.setAttribute("style", `font-size: ${labelsFontSize}px; font-family: sans-serif`);
  labelsG.setAttribute("dominant-baseline", "hanging");
  const fillFontSize = sqSize * 0.6;
  const fillG = document.createElementNS(svgNS, "g");
  fillG.setAttribute("style", `font-size: ${fillFontSize}px; font-family: sans-serif`);
  fillG.setAttribute("text-anchor", "middle");
  fillG.setAttribute("visibility", "hidden");

  const squaresByPosition = {}
  const fillByPosition = {}
  const positionsByLabel = {}
  for (const sq of record["initialState"]) {
    const square = document.createElementNS(svgNS, "rect");
    const squareX = margin + sq.x * sqSize;
    const squareY = margin + topOffset + sq.y * sqSize;
    const posKey = `${sq.x}-${sq.y}`
    square.setAttribute("width", sqSize);
    square.setAttribute("height", sqSize);
    square.setAttribute("x", squareX);
    square.setAttribute("y", squareY);
    squaresByPosition[posKey] = square;
    if (sq.fill !== null) {
      square.setAttribute("fill", fillableColor);
      if (sq.fill !== "") {
        const fill = document.createElementNS(svgNS, "text");
        fill.setAttribute("x", squareX + 0.5 * sqSize);
        fill.setAttribute("y", squareY + 0.8 * sqSize);
        fill.textContent = sq.fill;
        const newSet = document.createElementNS(svgNS, "set");
        newSet.setAttribute("attributeName", "visibility");
        newSet.setAttribute("to", "visible");
        newSet.setAttribute("begin", 0);
        fill.append(newSet);
        fillG.append(fill);
        fillByPosition[posKey] = fill;
      }
    } else {
      square.setAttribute("fill", unfillableColor);
    }
    squaresG.append(square);
    if (sq.label) {
      const label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", squareX + 0.1 * sqSize);
      label.setAttribute("y", squareY + 0.1 * sqSize);
      label.textContent = sq.label;
      labelsG.append(label);
      positionsByLabel[sq.label] = posKey;
    }
  }

  // Clues - add as hidden text, and during animation we reveal whatever is
  // currently selected

  const cluesFontSize = (nRows * sqSize) * 0.05;
  const cluesG = document.createElementNS(svgNS, "g");
  cluesG.setAttribute("style", `font-size: ${cluesFontSize}px; font-family: sans-serif`);
  cluesG.setAttribute("text-anchor", "middle");
  cluesG.setAttribute("dominant-baseline", "hanging");
  cluesG.setAttribute("visibility", "hidden");
  const cluesByLabel = {}
  for (const clueSection of Object.keys(record.clueSections)) {
    for (const clueInfo of record.clueSections[clueSection]) {
      const clue = document.createElementNS(svgNS, "text");
      clue.setAttribute("x", width / 2);
      clue.setAttribute("y", margin + topOffset + sqSize * nRows + cluesFontSize * 2);
      clue.textContent = `${clueInfo.label}. ${clueInfo.text}`
      // TODO: adjust sizing on long clues
      cluesG.append(clue);
      if (cluesByLabel[clueSection] === undefined) {
        cluesByLabel[clueSection] = {};
      }
      cluesByLabel[clueSection][clueInfo.label] = clue;
    }
  }

  // Animations for puzzle

  let currentlySelected, currentlySelectedClue;
  if (record.events.length > 0) {
    const startTime = record.events[0].timestamp;
    for (const event of record.events) {
      const time = `${(event.timestamp - startTime) / animationSpeed}ms`;
      let posKey;
      switch (event.type) {
        case "update":
          posKey = `${event.x}-${event.y}`;
          if (fillByPosition[posKey] !== undefined) {
            // make existing fill invisible
            fillByPosition[posKey].setAttribute("end", time);
          }
          delete fillByPosition[posKey];
          if (event.fill !== "") {
            const fill = document.createElementNS(svgNS, "text");
            const squareX = margin + event.x * sqSize;
            const squareY = margin + topOffset + event.y * sqSize;
            fill.setAttribute("x", squareX + 0.5 * sqSize);
            fill.setAttribute("y", squareY + 0.8 * sqSize);
            fill.textContent = event.fill;
            const newUpdateSet = document.createElementNS(svgNS, "set");
            newUpdateSet.setAttribute("attributeName", "visibility");
            newUpdateSet.setAttribute("to", "visible");
            newUpdateSet.setAttribute("begin", time);
            fill.append(newUpdateSet);
            fillG.append(fill);
            fillByPosition[posKey] = fill;
          }
          break;
        case "select":
          if (currentlySelected) {
            squaresByPosition[currentlySelected]
              .children[squaresByPosition[currentlySelected].children.length - 1]
              .setAttribute("end", time);
          }
          posKey = `${event.x}-${event.y}`;
          const newSelectSet = document.createElementNS(svgNS, "set");
          newSelectSet.setAttribute("attributeName", "fill");
          newSelectSet.setAttribute("to", selectedColor);
          newSelectSet.setAttribute("begin", time);
          squaresByPosition[posKey].append(newSelectSet);
          currentlySelected = posKey;
          break;
        case "selectClue":
          if (currentlySelectedClue) {
            currentlySelectedClue.children[currentlySelectedClue.children.length - 1]
              .setAttribute("end", time);
          }
          const newSelectClueSet = document.createElementNS(svgNS, "set");
          newSelectClueSet.setAttribute("attributeName", "visibility");
          newSelectClueSet.setAttribute("to", "visible");
          newSelectClueSet.setAttribute("begin", time);
          cluesByLabel[event.clueSection][event.clueLabel].append(newSelectClueSet);
          currentlySelectedClue = cluesByLabel[event.clueSection][event.clueLabel];
          break;
        case "submit":
          if (event.success) {
            const newSubmitSet = document.createElementNS(svgNS, "set");
            newSubmitSet.setAttribute("attributeName", "visibility");
            newSubmitSet.setAttribute("to", "visible");
            newSubmitSet.setAttribute("begin", time);
            complete.append(newSubmitSet);
            break;
          }
      }
    }
  }

  // TODO: just appending for now, but eventually don't, instead download
  svg.append(bg);
  svg.append(titleAndDate);
  svg.append(byline);
  svg.append(solver);
  svg.append(timer);
  svg.append(complete);
  svg.append(squaresG);
  svg.append(cluesG);
  svg.append(labelsG);
  svg.append(fillG);
  document.getElementById("container").append(svg);
}
