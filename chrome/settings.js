const appSettingsInfo = [
  {
    storageKey: "general",
    name: "General",
    settings: [
      {
        settingKey: "solverName",
        name: "Your name",
        type: "string",
        default: "",
        description: "Your name, as you would like it recorded on the log."
      },
      {
        settingKey: "eventLogLevel",
        name: "Log level",
        type: "string",
        options: [
          { value: "basic", name: "Events only"},
          { value: "full", name: "Events and navigation"},
        ],
        default: "full",
        description: "Amount of detail to log. \"Events only\" only captures basic game events. \"Events and navigation\" also captures your navigation around the grid and clues."
      },
      {
        settingKey: "logUserAgent",
        name: "Log user agent",
        type: "boolean",
        default: true,
        description: "Whether or not to log user-agent info on the log."
      },
    ],
  },
  {
    storageKey: "nyt",
    name: "New York Times",
    settings: [
      {
        settingKey: "autosaveFrequency",
        name: "Auto-save frequency",
        default: 30,
        type: "number",
        description: "The frequency with which to auto-save event logs to browser storage while solving. (This is purely precautionary, because event logs are also automatically saved when completing or navigating away from a puzzle.) Every this-many events, we will save. Set to 0 for no auto-save."
      },
    ],
    validate: (settings) => {
      let errors = [];
      if (settings.autosaveFrequency < 0) { errors.push("Autosave frequency must be >= 0"); }
      return errors;
    },
  },
  {
    storageKey: "image",
    name: "Image generation",
    settings: [
      {
        settingKey: "width",
        name: "Width (px)",
        type: "number",
        default: 500,
      },
      {
        settingKey: "height",
        name: "Height (px)",
        type: "number",
        default: 700,
      },
      {
        settingKey: "margin",
        name: "Margin around the image (px)",
        type: "number",
        default: 50,
      },
      {
        settingKey: "backgroundColor",
        name: "Background color",
        type: "string",
        default: "lightgray",
      },
      {
        settingKey: "gridColor",
        name: "Grid line color",
        type: "string",
        default: "gray",
      },
      {
        settingKey: "fillableColor",
        name: "Color of fillable squares",
        type: "string",
        default: "white",
      },
      {
        settingKey: "unfillableColor",
        name: "Color of unfillable squares",
        type: "string",
        default: "black",
      },
      {
        settingKey: "selectedColor",
        name: "Color of selected square",
        type: "string",
        default: "yellow",
      },
      {
        settingKey: "highlightedColor",
        name: "Color of highlighted squares",
        type: "string",
        default: "lightblue",
      },
      {
        settingKey: "checkColor",
        name: "Color of checked-square indicator",
        type: "string",
        default: "orange",
      },
      {
        settingKey: "revealColor",
        name: "Color of revealed-square indicator",
        default: "red",
        type: "string",
      },
      {
        settingKey: "animationSpeed",
        name: "Animation speed",
        default: 1.0,
        type: "number",
        description: "The factor by which to speed up or slow down the animation. 1 is real time, > 1 is sped up, < 1 is slowed down."
      },
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
]
