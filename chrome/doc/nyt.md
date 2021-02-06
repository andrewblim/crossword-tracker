# New York Times DOM

## Puzzle info

The entire puzzle should be within a `div` with class `app-appWrapper--2PSLL`. The extension shouldn't need to monitor anything outside of this `div`. This is mandatory, and no logging will occur if the extension cannot find this. All further elements below are assumed to be descendants of this one.

The puzzle title should be in an element with class `PuzzleDetails-title--iv1IG`. If no such element is found, no title will be recorded.

The puzzle date should be in an element with class `PuzzleDetails-date--1HNzj`. If no such element is found, no date will be recorded.

The puzzle byline should be in an element with class `PuzzleDetails-byline--16J5w`. If no such element is found, no byline will be recorded. Unlike title and date, which are just found directly in text content, the byline is found in further `span` sub-children, so we have to do a little extra work here.

The clue sections should be in elements with class `ClueList-wrapper--3m-kd`. (Almost certainly there will be two, one for across and one for down.) Within each clue section, its title should be in an element with class `ClueList-title--1-3oW`, and its clues should be in elements with class `Clue-li--1JoPu`. Within each clue, the clue's label should be in an element with class `Clue-label--2IdMY` and the clue's text should be in an element with class `Clue-text--3lZl7`.

## Board state

The board is stored in an `svg` element with id `xwd-board`. Within this, there is a `g` element labeled with attribute `data-group="cells" role="table"`. This in turn contains several sub-`g` elements (which have no extra attribute information), each of which represents a square on the board.

The sub-`g` elements contain at least one child, and possibly some more:

- A `rect` element representing the square itself. These have ids `cell-id-0`, `cell-id-1`, etc. Fillable squares have class `Cell-nested--x0A1y`. Unfillable squares have class `Cell-block--1oNaD`.
- If this square has a clue label, there will also be a `text` element with attribute `text-anchor="start"`. This contains a text subnode with the label. (It may also contain other subelements related to [ARIA](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA), which we ignore.)
- If this square is fillable, there will also be a `text` element with attribute `text-anchor="middle"`. This contains a text subnode with the fill. (It may also contain other subelements related to ARIA, which we ignore.)
- If you have checked or revealed a square, there will also be a `use` element.
  - Upon checking a square, the `use` element will be created if it doesn't exist and tagged with class `Shame-checked--3E9GW`. After subsequently modifying the square, this class is removed but the `use` element remains, and a subsequent re-check adds this class back to the `use` element.
  - Upon revealing a square, the `use` element will be created if it doesn't exist and tagged with class `Shame-revealed--3jDzk`.

We assume that there is at least one `rect` with `cell-id-0`, and that all the `rect` elements have the same size, such a given `rect`'s (x,y) position in the crossword can be determined from its position in the SVG and the size of `cell-id-0`.

## Game state

There should be a `div` with class `Layout-unveilable--3OmrG`, that may have a child `div` with class `Veil-veil--3oKaF`. If this is present, the solve is in an inactive state. The removal or addition of this `div` denotes start and stop of the puzzle.

A correct solve creates a `div` with class `CongratsModal-congratsModalContent--19hpv` as a child of the top-level app element. So the addition of this `div` denotes a correct submission.

The extension currently only records correct solves. The NYT auto-submits, meaning that the solver doesn't actively take action to submit the puzzle. If the puzzle is full and correct, the congratulatory modal appears automatically. If not, a different modal appears, but then when you acknowledge it, subsequent changes to the grid do not generate any further changes to the puzzle DOM unless you specifically clear out a square and re-enter it.

For example, if you have a puzzle that is full but incorrect in one square, you can repeatedly change that square and not get any further DOM feedback until you fill it correctly, at which point the congratulatory modal appears. Each attempt is technically a submission, but the only DOM feedback occurs when you get it right. Because we drive everything off the DOM, I decided simply not to record any submissions other than the final correct one.

## Navigation away-and-back

I have noticed a mild issue in the NYT puzzle where if you navigate away and back to a puzzle in progress, you may not see the changes you've made since you originally opened the puzzle, but if you refresh the page the changes then appear. If you don't refresh, the log may end up looking inconsistent, for example with the same square filled twice.
