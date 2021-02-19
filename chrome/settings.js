const appSettings = {
  general: {
    solverName: { default: "", type: "string" },
    eventLogLevel: { default: "full", type: "string" },
    logUserAgent: { default: false, type: "boolean" },
  },
  image: {
    width: { default: 500, type: "number" },
    height: { default: 750, type: "number" },
    margin: { default: 50, type: "number" },
    backgroundColor: { default: "lightgray", type: "string" },
    gridColor: { default: "gray", type: "string" },
    fillableColor: { default: "white", type: "string" },
    unfillableColor: { default: "black", type: "string" },
    selectedColor: { default: "yellow", type: "string" },
    highlightedColor: { default: "lightblue", type: "string" },
    checkColor: { default: "orange", type: "string" },
    revealColor: { default: "red", type: "string" },
    animationSpeed: { default: 1.0, type: "number" },
  },
  nyt: {
    autosaveFrequency: { default: 30, type: "number" },
  },
}

const appSettingsValidation = {
  image: (settings) => {
    let errors = [];
    if (settings.width <= 0) { errors.push("Width must be > 0"); }
    if (settings.height <= 0) { errors.push("Height must be > 0"); }
    if (settings.margin <= 0) { errors.push("Margin must be > 0"); }
    if (settings.margin > settings.width || settings.margin > settings.height) {
      errors.push("Image width must be > width or height");
    }
    if (settings.height <= 0) { errors.push("Animation speed must be > 0"); }
    return errors;
  },
  nyt: (settings) => {
    let errors = [];
    if (settings.autosaveFrequency <= 0) { errors.push("Autosave frequency must be > 0"); }
  }
}
