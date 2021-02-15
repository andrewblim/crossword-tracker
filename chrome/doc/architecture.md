# Architecture
## Basic logging (content scripts)

When visiting a supported crossword page, the extension loads a corresponding content script, as defined by the manifest. For example: visting a New York Times crossword page loads `nyt.js`. As of this writing only the New York Times is supported, but new sites can be developed with new content scripts.

The content script will monitor the progress of the solver in a JSON object corresponding to the standard [log format](../../doc/log-format.md). We call this the _record_. As the solver navigates and fills the puzzle, we append events to the record. We also periodically cache the record in Chrome storage, so that we still have it even if the solver leaves the puzzle page.

When visting a supported crossword page, we first check storage and load the record if it is there; otherwise, we create a fresh record on the spot, with a blank event log.

Content scripts should cache records in Chrome storage at least whenever:

- the solver solves the puzzle successfully
- the solver leaves the page

Content scripts should also stop logging after recording a successful submit event, as records [should not](../../doc/log-format.md) contain any further records after a successful submit.

## Service worker

The service worker `background.js` handles common functionality for all content scripts, in particular maintenance of records in Chrome storage.

The storage key for a given puzzle should be the string `record-` followed by some kind of identifier, which may vary by puzzle website (i.e. different content scripts may implement it differently). The identifier should be a string that can be understood as a DOM id. There is a helper function `recordStorageKey` that turns puzzle name, date, and byline information into a simple integer digest, which is recommended for use.

The service worker accepts messages in the format `{ action, ... }`. The currently supported `action` values are:

- `cacheRecord`: with additional parameters `key` and `record`, caches the record in Chrome storage.
- `clearRecord`: with additional parameter `key`, clears that key from Chrome storage.
- `setBadgeRecording`: updates the extension badge to indicate that it is recording events.
- `setBadgeSolved`: updates the extension badge to indicate that the puzzle is solved.
- `clearBadge`: clears the extension badge.

The service worker will respond to all messages with a message that is either `{ success: true, ... }` or `{ success: false, error: errorMessage, ... }` (where `...` denotes an open-ended number of informational key-values).

## Popup

Content scripts should also have a listener so that the popup menu can interact with it. The popup menu includes some buttons to manage records manually with respect to the active tab.

Clicking on these buttons causes the popup page to send a message to the active tab, which then may in turn result in a tab sending a message for the service worker. Unlike activity that happens when the solver is in the middle of a puzzle, it may be better for these calls to be synchronous. We may want to block and provide feedback about whether the action completed successfully.

Content scripts should accept messages in the format `{ action, ... }`. They should all accept the following `action` values:

- `ping`: simply sends a successful response
- `getRecord`: sends a response that also includes a key `record` with the record. This is used by the popup to save the record as a JSON file - Chrome's download functionality cannot happen in a content script, so the popup fetches the record and does the work itself.
- `logRecord`: logs the current record to the developer console
- `cacheRecord`: caches the record in Chrome storage (should pass on a message to the service worker)
- `clearAndResetRecord`: clears the record from Chrome storage (should pass on a `clearRecord` message to the service worker) and creates a fresh record based on the puzzle's current state.

The content script should respond to all messages with a message that is either `{ success: true, ... }` or `{ success: false, error: errorMessage, ... }` (where `...` denotes an open-ended number of informational key-values).

## Preferences

The preferences page (`options.html` and associated `options.js`) stores settings in Chrome storage and provides a way to see and manage all cached records.

## Common functionality

The script `common.js` contains functionality that is common to all other scripts: the content scripts _and_ the scripts associated with the popup and options page. It should be "included" as follows:

- Content scripts: in the manifest, `common.js` should be listed before any site-specific content scripts.
- Other scripts: in the associated page, a tag `<script src="common.js"></script>` should precede any `<script src="some_other_script_file.js"></script>`.

`common.js` is not a module. Unfortunately I have not found a way to get it to work as a module with content scripts. The "inclusion" is simply the fact that it gets run first before the other scripts.
