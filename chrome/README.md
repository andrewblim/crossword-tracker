# Crossword Tracker - Chrome extension

Chrome extension for tracking crossword puzzle solving. At the moment, the only website supported is the New York Times puzzle, but in the future more may be added.

## Installation

This is only set up for install via developer mode at the moment. Clone this repo and install this directory in developer mode as an unpacked extension, as per the directions [here](https://developer.chrome.com/docs/extensions/mv3/getstarted/).

This should still at the moment be considered bleeding-edge software, pre-official versioning.

## Use

When this extension is installed and active and you are on a page with a puzzle, the extension will track your activity in the puzzle grid:

- starting and stopping the puzzle
- updating squares
- checking and revealing squares
- submitting an answer (auto-triggered for some websites on completion)
- navigation, showing which square and clue are highlighted (tracking this can be toggled in the preferences)

It does this by tracking updates to the puzzle grid in the [DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction) - it notices when squares are filled, clues are highlighted, etc. and records them with timestamps.

You can leave a puzzle and come back to it. The extension will cache progress in Chrome synced storage.

In either the extension popup menu or the settings page, you can also save cached puzzle records as [JSON](https://www.json.org/json-en.html) files or clear them out of the browser cache.

Once you have the JSON log, do whatever you want with it! For starters, this repo also contains an [image-gen](../image-gen/README.md) project that can convert a JSON log to an animated replay of your solve. I also encourage you to find other interesting applications - for example, if you amassed a large number of logs, from just yourself or from others too, you might be able to run interesting data analysis on solving technique or puzzle difficulty.

## Miscellany

The puzzle state when you start logging is recorded as initial state. Typically you'd open a new puzzle and record a blank grid. However, if you have already started a puzzle but have no logs for it, then whatever you already have will be considered part of initial state. (This can happen with puzzles you started before installing the extension, or if you clear out the cached record partway.

To cleanly restart and re-record a puzzle as if from scratch, reset the puzzle using the puzzle page's functionality, and then clear out and reset the record using the menu.

Don't work on the same puzzle in multiple tabs at the same time, as the different tabs may overwrite the same Chrome storage independently. (There should be no issue solving different puzzles in different tabs.)

The [LICENSE](../LICENSE) file at the root of the parent directory of this repo applies to this project.
