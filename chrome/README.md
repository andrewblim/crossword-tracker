# Crossword Tracker - Chrome extension

Chrome extension for tracking crossword puzzle solving. At the moment, the only website supported is the New York Times puzzle, but in the future more may be added.

## Installation

This is only set up for install via developer mode at the moment.

1. Clone this repo.
2. Open the Chrome extensions page and enable "Developer mode".
3. Install this directory as an unpacked extension.
4. I suggest you then go straight to its preferences page and indicate your name, so that it's included on any records you generate.

See official directions for installing extensions in developer mode [here](https://developer.chrome.com/docs/extensions/mv3/getstarted/).

## Use

When this extension is installed and active and you are on a page with a puzzle, the extension will track your activity in the puzzle grid:

- starting and stopping the puzzle
- updating squares
- checking and revealing squares
- submitting an answer (auto-triggered for some websites on completion)
- navigation, showing which square and clue are highlighted (tracking this can be toggled in the preferences)

It does this by tracking updates to the puzzle grid in the [DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction) - it notices when squares are filled, clues are highlighted, etc. and records them with timestamps. You can also leave a puzzle and come back to it, as the extension caches progress in Chrome local storage.

In either the extension popup menu or the settings page, you can save cached puzzle records as JSON files, save an animated SVG based on the puzzle record, or clear records out of browser storage. If you want to keep your records permanently, I suggest you download them as JSON files. Don't rely on browser storage as permanent. The JSON is sufficient to generate the SVG, but the reverse is not the case, so don't just download SVGs if you want a true record.

## Miscellany

The puzzle state when you start logging is recorded as initial state. Typically you'd open a new puzzle and record a blank grid. However, if you have already started a puzzle but have no logs for it, then whatever you already have will be considered part of initial state. (This can happen with puzzles you started before installing the extension, or if you clear out the cached record partway.

To cleanly restart and re-record a puzzle as if from scratch, reset the puzzle using the puzzle page's functionality, and then clear out and reset the record using the pop-up menu.

Don't work on the same puzzle in multiple tabs at the same time, as the different tabs may overwrite the same Chrome storage independently. (There should be no issue solving different puzzles in different tabs.)

The [LICENSE](../LICENSE) file at the root of the parent directory of this repo applies to this project.
