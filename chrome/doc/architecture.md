# Architecture

## Basic logging

When visiting a supported crossword page, the extension loads a corresponding content script, as defined by the manifest. For example: visting a New York Times crossword page loads `nyt.js`.

The content script will monitor the progress of the solver in a JSON object corresponding to the standard [log format](../../doc/log-format.md). We call this the _record_. As the solver navigates and fills the puzzle, we append events to the record.

At certain points in time, the script may want to save the record to Chrome storage. It does this by sending a message to a service worker, asynchronously so that it does not block solving activity. The storage key is based on the URL. When visting a supported crossword page, we first check storage and load the record if it is there; otherwise, we create a fresh record on the spot, with a blank event log.

Content scripts will typically save the record to Chrome storage every handful of events. But more importantly, they should also save when:

- the solver successfully solves the crossword
- the solver leaves the page - before unloading, it should save, so that navigating away does not cause us to lose events

Content scripts should stop logging after recording a successful submit event.

## Popup

Content scripts should also have a listener so that the popup menu can interact with it. The popup menu includes some buttons to manage records manually with respect to the active tab.

Clicking on these buttons causes the popup page to send a message to the active tab, which then may in turn result in a tab sending a message for the service worker. Unlike activity that happens when the solver is in the middle of a puzzle, it may be better for these calls to be synchronous. Performance isn't critical, and we may want to block and provide feedback about whether the action completed successfully.

In the case of downloading the record as a JSON file, the tab will (synchronously) respond with a message containing the record, and the popup page will then trigger the download. Content scripts cannot access the Chrome download API.

## Preferences

TODO
