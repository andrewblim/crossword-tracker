"use strict";

const svgNS = "http://www.w3.org/2000/svg";

// We do puzzle animations by adding <set> children to elements to control when
// they appear and disappear (typically toggling either "visibility" or
// "display"). These are helper functions for that.

const beginSetChild = function(elem, attributeName, to, begin) {
  const newSet = document.createElementNS(svgNS, "set");
  newSet.setAttribute("attributeName", attributeName);
  newSet.setAttribute("to", to);
  newSet.setAttribute("begin", begin);
  elem.append(newSet);
}

const endSetChild = function(elem, end) {
  for (const child of elem.children) {
    if (child.nodeName === "set" && child.getAttribute("end") === null) {
      child.setAttribute("end", end);
    }
  }
}

const createSolveAnimation = function(record, imageCallback) {
  chrome.storage.local.get(
    [
      "imageWidth",
      "imageHeight",
      "imageMargin",
      "imageBackgroundColor",
      "imageGridColor",
      "imageFillableColor",
      "imageUnfillableColor",
      "imageSelectedColor",
      "imageHighlightedColor",
      "imageCheckColor",
      "imageRevealColor",
      "imageAnimationSpeed",
    ],
    (settings) => {
      const imageElem = createSolveAnimationWithSettings(record, settings);
      imageCallback(imageElem);
      imageElem.remove();
    }
  );
}

const createSolveAnimationWithSettings = function(record, settings) {
  const width = settings.imageWidth;
  const height = settings.imageHeight;
  const margin = settings.imageMargin;
  const backgroundColor = settings.imageBackgroundColor;
  const gridColor = settings.imageGridColor;
  const fillableColor = settings.imageFillableColor;
  const unfillableColor = settings.imageUnfillableColor;
  const selectedColor = settings.imageSelectedColor;
  const highlightedColor = settings.imageHighlightedColor;
  const checkColor = settings.imageCheckColor;
  const revealColor = settings.imageRevealColor;
  const animationSpeed = settings.imageAnimationSpeed;

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

  // Puzzle-complete indicator below puzzle

  const progressFontSize = (width - 2 * margin) * 0.05;
  let complete = document.createElementNS(svgNS, "text");
  complete.setAttribute("x", width - margin);
  complete.setAttribute("y", height - margin);
  complete.setAttribute("text-anchor", "end");
  complete.setAttribute("style", `font-size: ${progressFontSize}px; font-family: sans-serif; font-weight: bold`);
  complete.setAttribute("visibility", "hidden");
  complete.textContent = "Complete!";

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
        beginSetChild(fill, "visibility", "visible", 0);
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
      positionsByLabel[sq.label] = { x: sq.x, y: sq.y };
    }
  }

  // Clues - add as hidden text, and during animation we reveal whatever is
  // currently selected

  const cluesFontSize = (nRows * sqSize) * 0.05;
  const cluesG = document.createElementNS(svgNS, "g");
  const acrossClueSection = "Across";
  const downClueSection = "Down";
  cluesG.setAttribute("style", `font-size: ${cluesFontSize}px; font-family: sans-serif`);
  cluesG.setAttribute("text-anchor", "middle");
  cluesG.setAttribute("dominant-baseline", "hanging");
  cluesG.setAttribute("visibility", "hidden");
  const cluesByLabel = {};
  const positionsByClue = {};
  for (const clueSection of Object.keys(record.clueSections)) {
    positionsByClue[clueSection] = {};
    for (const clueInfo of record.clueSections[clueSection]) {
      // add clue text
      const clue = document.createElementNS(svgNS, "text");
      clue.setAttribute("x", width / 2);
      clue.setAttribute("y", margin + topOffset + sqSize * nRows + cluesFontSize * 2);
      const clueText = document.createElementNS(svgNS, "tspan");
      clueText.textContent = `${clueInfo.label}. ${clueInfo.text}`
      clue.append(clueText);
      cluesG.append(clue);
      if (cluesByLabel[clueSection] === undefined) {
        cluesByLabel[clueSection] = {};
      }
      cluesByLabel[clueSection][clueInfo.label] = clue;

      // add positions associated with each clue, which we'll refer to later
      // when highlighting selected clues
      const positions = [];
      let { x, y } = positionsByLabel[clueInfo.label];
      if (clueSection === acrossClueSection) {
        let sq = squaresByPosition[`${x}-${y}`];
        while (x < nCols && sq.getAttribute("fill") !== unfillableColor) {
          positions.push({ x, y });
          x += 1;
          sq = squaresByPosition[`${x}-${y}`];
        }
      } else if (clueSection === downClueSection) {
        let sq = squaresByPosition[`${x}-${y}`];
        while (y < nRows && sq.getAttribute("fill") !== unfillableColor) {
          positions.push({ x, y });
          y += 1;
          sq = squaresByPosition[`${x}-${y}`];
        }
      }
      positionsByClue[clueSection][clueInfo.label] = positions;
    }
  }

  // Empty graphical groups to which we add triangles if there are any check or
  // reveal events

  const checkG = document.createElementNS(svgNS, "g");
  checkG.setAttribute("visibility", "hidden");
  checkG.setAttribute("stroke", gridColor);
  const checkByPosition = {};
  const revealG = document.createElementNS(svgNS, "g");
  revealG.setAttribute("visibility", "hidden");
  revealG.setAttribute("stroke", gridColor);
  const revealByPosition = {};

  // Animations for puzzle

  let timer;
  let selectedSquare, selectedClue, highlightedSquares;
  if (record.events.length > 0) {
    const startTime = record.events[0].timestamp;
    let lastStoppedTime = 0, currentlyStopped = true, cumulativeStopped = 0;
    for (const event of record.events) {
      // ignore everything but a start if we are stopped
      if (currentlyStopped && event.type != "start") {
        continue;
      }
      const time = (event.timestamp - startTime - cumulativeStopped) / animationSpeed;
      const timeMS = `${time}ms`;
      let posKey;
      switch (event.type) {
        case "update":
          posKey = `${event.x}-${event.y}`;
          if (fillByPosition[posKey] !== undefined) {
            // make any existing fill invisible starting now
            endSetChild(fillByPosition[posKey], timeMS);
          }
          delete fillByPosition[posKey];
          if (event.fill !== "") {
            // add new fill and make it visible starting now
            const fill = document.createElementNS(svgNS, "text");
            const squareX = margin + event.x * sqSize;
            const squareY = margin + topOffset + event.y * sqSize;
            fill.setAttribute("x", squareX + 0.5 * sqSize);
            fill.setAttribute("y", squareY + 0.8 * sqSize);
            fill.textContent = event.fill;
            beginSetChild(fill, "visibility", "visible", timeMS);
            fillG.append(fill);
            fillByPosition[posKey] = fill;
          }
          break;
        case "select":
          if (selectedSquare) {
            endSetChild(selectedSquare, timeMS);
            // switch it to the highlight color if it was deselected but should
            // still be highlighted
            for (const { x, y } of (highlightedSquares || [])) {
              if (squaresByPosition[`${x}-${y}`] === selectedSquare) {
                beginSetChild(selectedSquare, "fill", highlightedColor, timeMS);
                break;
              }
            }
          }
          posKey = `${event.x}-${event.y}`;
          endSetChild(squaresByPosition[posKey], timeMS);
          beginSetChild(squaresByPosition[posKey], "fill", selectedColor, timeMS);
          selectedSquare = squaresByPosition[posKey];
          break;
        case "selectClue":
          // display new clue
          if (selectedClue) {
            endSetChild(selectedClue, timeMS);
          }
          beginSetChild(cluesByLabel[event.clueSection][event.clueLabel],
                      "visibility", "visible", timeMS);
          selectedClue = cluesByLabel[event.clueSection][event.clueLabel];

          // change square highlighting
          for (const { x, y } of highlightedSquares || []) {
            const posKey = `${x}-${y}`;
            if (squaresByPosition[posKey] !== selectedSquare) {
              endSetChild(squaresByPosition[posKey], timeMS);
            }
          }
          for (const { x, y } of positionsByClue[event.clueSection][event.clueLabel]) {
            const posKey = `${x}-${y}`;
            if (squaresByPosition[posKey] !== selectedSquare) {
              beginSetChild(squaresByPosition[posKey], "fill", highlightedColor, timeMS);
            }
          }
          highlightedSquares = positionsByClue[event.clueSection][event.clueLabel];
          break;
        case "check":
          posKey = `${event.x}-${event.y}`;
          let checkMarker = checkByPosition[posKey];
          if (checkMarker !== null) {
            checkMarker = document.createElementNS(svgNS, "polygon")
            let sqX = parseInt(squaresByPosition[posKey].getAttribute("x"));
            let sqY = parseInt(squaresByPosition[posKey].getAttribute("y"));
            checkMarker.setAttribute("points", [
              `${sqX + 0.75 * sqSize},${sqY}`,
              `${sqX + sqSize},${sqY}`,
              `${sqX + sqSize},${sqY + 0.25*sqSize}`,
            ].join(" "));
            beginSetChild(checkMarker, "visibility", "visible", timeMS);
            beginSetChild(checkMarker, "fill", checkColor, timeMS);
            checkG.append(checkMarker);
            checkByPosition[posKey] = checkMarker;
          }
          break;
        case "reveal":
          posKey = `${event.x}-${event.y}`;
          let revealMarker = revealByPosition[posKey];
          if (revealMarker !== null) {
            revealMarker = document.createElementNS(svgNS, "polygon")
            let sqX = parseInt(squaresByPosition[posKey].getAttribute("x"));
            let sqY = parseInt(squaresByPosition[posKey].getAttribute("y"));
            revealMarker.setAttribute("points", [
              `${sqX + 0.75 * sqSize},${sqY}`,
              `${sqX + sqSize},${sqY}`,
              `${sqX + sqSize},${sqY + 0.25*sqSize}`,
            ].join(" "));
            beginSetChild(revealMarker, "visibility", "visible", timeMS);
            beginSetChild(revealMarker, "fill", revealColor, timeMS);
            revealG.append(revealMarker);
            revealByPosition[posKey] = revealMarker;
          }
          break;
        case "stop":
          currentlyStopped = true;
          lastStoppedTime = time;
        case "start":
          currentlyStopped = false;
          cumulativeStopped += time - lastStoppedTime;
        case "submit":
          if (event.success) {
            beginSetChild(complete, "visibility", "visible", timeMS);
            break;
          }
      }

      // Timer below puzzle. This is super janky; I don't think I can make
      // <text> or <tspan> content change with pure SVG, so we create all
      // possible minute and hour text boxes and make them visible and not as
      // needed. (Use display: none/inline for visibility so that the hidden
      // times don't take up space.)

      timer = document.createElementNS(svgNS, "text");
      timer.setAttribute("style", `font-size: ${progressFontSize}px; font-family: sans-serif; font-weight: bold`);
      timer.setAttribute("x", margin);
      timer.setAttribute("y", height - margin);

      const lastTime = record.events[record.events.length - 1].timestamp;
      const totalTime = lastTime - startTime - cumulativeStopped;
      const maxMinutes = Math.round(totalTime / 60000);
      const maxSeconds = Math.min(Math.round(totalTime / 1000), 59);

      let minutes = [];
      for (let i = 0; i <= maxMinutes; i++) {
        const minute = document.createElementNS(svgNS, "tspan");
        minute.setAttribute("display", "none");
        minute.textContent = `${i}`;
        timer.append(minute);
        minutes.push(minute);
      }

      const msSeparator = document.createElementNS(svgNS, "tspan");
      msSeparator.textContent = ":";
      timer.append(msSeparator);

      let seconds = [];
      for (let i = 0; i <= maxSeconds; i++) {
        const second = document.createElementNS(svgNS, "tspan");
        second.setAttribute("display", "none");
        if (i < 10) {
          second.textContent = `0${i}`;
        } else {
          second.textContent = `${i}`;
        }
        timer.append(second);
        seconds.push(second);
      }

      for (let i = 0; i <= totalTime / 1000; i++) {
        const tickMS = `${i * 1000 / animationSpeed}ms`;
        if (i % 60 === 0) {
          if (i > 0) {
            endSetChild(minutes[Math.round(i / 60) - 1], tickMS);
          }
          const minute = minutes[Math.round(i / 60)];
          beginSetChild(minute, "display", "inline", tickMS);
        }

        if (i > 0) {
          endSetChild(seconds[(i - 1) % 60], tickMS);
        }
        const second = seconds[i % 60];
        beginSetChild(second, "display", "inline", tickMS);
      }
    }
  }

  svg.append(bg);
  svg.append(titleAndDate);
  svg.append(byline);
  svg.append(solver);
  if (timer !== undefined) { svg.append(timer); }
  svg.append(complete);
  svg.append(squaresG);
  svg.append(cluesG);
  svg.append(labelsG);
  svg.append(fillG);
  svg.append(checkG);
  svg.append(revealG); // must go after checkG so that it appears on top

  // We must append the svg to the body for the next section, which relies on
  // computed text lengths, to work. At this point it becomes visible.
  document.getElementsByTagName("BODY")[0].append(svg);

  // Resize long clues - this can only happen after appending the SVG to the
  // document, otherwise getComputedTextLength() returns 0. This would not be
  // necessary if SVG had word wrapping, which has been proposed for future
  // versions of the standard.

  const maxClueWidth = width - margin * 2;
  for (const clue of cluesG.children) {
    // If clue text is too long:
    //
    // - Create a hidden text node
    // - Split the clue text by spaces and chunk it into lines, where each line
    //   is as long as possible before its computed length extends past the
    //   witdth of the puzzle
    // - Remove the hidden node
    // - Remove the original tspan with the too-long clue, and add in tspans
    //   for the lines

    if (clue.getComputedTextLength() > maxClueWidth) {
      // test node must be styled the same way as clues, otherwise the computed
      // lengths will be inaccurate
      const testText = document.createElementNS(svgNS, "text");
      testText.setAttribute("style", `font-size: ${cluesFontSize}px; font-family: sans-serif`);
      testText.setAttribute("text-anchor", "middle");
      testText.setAttribute("dominant-baseline", "hanging");
      testText.setAttribute("visibility", "hidden");
      svg.append(testText);

      const lines = [];
      const words = clue.textContent.split(" ");
      let currentLine = words[0];
      for (const word of words.slice(1)) {
        const lineNode = document.createElementNS(svgNS, "tspan");
        lineNode.textContent = `${currentLine} ${word}`;
        testText.append(lineNode);
        if (lineNode.getComputedTextLength() <= maxClueWidth) {
          currentLine = lineNode.textContent;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      testText.remove();
      Array.from(clue.children).filter(x => x.nodeName === "tspan").forEach(x => x.remove());
      for (let i = lines.length - 1; i >= 0; i--) {
        const lineNode = document.createElementNS(svgNS, "tspan");
        lineNode.setAttribute("x", clue.getAttribute("x"));
        lineNode.setAttribute("dy", `${1.2 * i}em`);
        lineNode.textContent = lines[i];
        clue.prepend(lineNode);
      }
    }
  }

  return svg;
}
