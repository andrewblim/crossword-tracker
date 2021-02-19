const appSettingsInfo = [
  {
    storageKey: "general",
    name: "General",
    settings: [
      { settingKey: "solverName", default: "", type: "string" },
      { settingKey: "eventLogLevel", default: "full", type: "string" },
      { settingKey: "logUserAgent", default: false, type: "boolean" },
    ],
  },
  {
    storageKey: "image",
    name: "Image generation",
    settings: [
      { settingKey: "width", default: 500, type: "number" },
      { settingKey: "height", default: 750, type: "number" },
      { settingKey: "margin", default: 50, type: "number" },
      { settingKey: "backgroundColor", default: "lightgray", type: "string" },
      { settingKey: "gridColor", default: "gray", type: "string" },
      { settingKey: "fillableColor", default: "white", type: "string" },
      { settingKey: "unfillableColor", default: "black", type: "string" },
      { settingKey: "selectedColor", default: "yellow", type: "string" },
      { settingKey: "highlightedColor", default: "lightblue", type: "string" },
      { settingKey: "checkColor", default: "orange", type: "string" },
      { settingKey: "revealColor", default: "red", type: "string" },
      { settingKey: "animationSpeed", default: 1.0, type: "number" },
    ],
    validate: (settings) => {
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
  },
  {
    storageKey: "nyt",
    name: "New York Times",
    settings: [
      { settingKey: "autosaveFrequency", default: 30, type: "number" },
    ],
    validate: (settings) => {
      let errors = [];
      if (settings.autosaveFrequency <= 0) { errors.push("Autosave frequency must be > 0"); }
      return errors;
    },
  }
]
