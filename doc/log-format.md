# Log format

The crossword log file consists of a JSON object with the keys described below. The behavior of

## `version`

**Mandatory.** This is a string representing the version number for the format of this log file. Currently fixed at `"0.1"`, but in the future, if we want to make breaking changes to this log format, we'll lean on this field.

## `url`

**Optional.** The URL at which this puzzle can be found.

## `title`, `byline`, `date`

**Optional.** These are the title, byline, and publication date of the puzzle, respectively. If present, each of these maps to a string. There are no other restrictions; for example, the `date` field can be in any format at all, or could technically even be something other than a date, although obviously it's advised to use these for their indicated purposes.

## `solver`

**Optional.** This is the name of the person who generated this log file. If present, it maps to a string.

## `clueSections`

**Mandatory.** This contains information about puzzle clues. It is a JSON object that in turn maps the names of clue sections to arrays of objects `{ label, text }`, each representing an individual clue:

- `label`: (string, mandatory) the clue number
- `text`: (string, mandatory) the text of the clue

There is no restriction against unusual labels or labels that would be considered inconsistent in a standard crossword. Each clue section's clues are not guaranteed to be in any particular order.

Although presumably having two clue sections `"Across"` and `"Down"` will be common, there is no restriction on how many clue sections there are. An empty object `{}` is legal here, and in fact would be a perfectly fine way to generate a log that has no clue information.

## `initialState`

**Mandatory.** Represents the initial state of the board. This contains information both about the shape of the grid and any squares that were already filled when logging started (which would happen, for example, if you started a log partway into a solve).

It maps to an array of JSON objects `{ fill, label, x, y }`, each representing a square of the puzzle:

- `fill`: (string or null, mandatory) The contents of this square. A blank but fillable square should have the empty string `""`. A non-fillable square should have `null`.
- `label`: (string, optional) The clue number labeling this square, if one exists. Technically there are no further restrictions. But a standard crossword would have `label`s consistent the grid shape and correspondent to entries in `clueSections`, and would not have a `label` field on any non-fillable square.
- `x`, `y`: (non-negative integer, mandatory) The (x,y) position of this square. (0,0) is the upper-left corner of the crossword, the x-coordinate increases going right, and the y-coordinate increases going down. There should be at most one entry for a given (x,y).

## `events`

**Mandatory.** Represents the events that occurred when solving this puzzle. This maps to an array of JSON objects that can have a variety of formats, but each of which must contain at least `{ type, timestamp }`:

- `type`: (string, mandatory) The type of event this represents. This determines what keys other than `type` and `timestamp` may appear, see below.
- `timestamp`: (integer, mandatory) The time of each event, represented by milliseconds since the Unix epoch.

The following event types are recognized as having particular meaning:

- `start`: The solver has started working on the puzzle. No additional fields are expected.
- `stop`: The solver has stopped working on the puzzle. No additional fields are expected.
- `update`: The solver has updated a square. There will be three additional fields:
  - `x`, `y`: (strings, mandatory) The (x,y) position of the updated square.
  - `fill`: (string, mandatory) The updated fill value of the square. Entering a letter would be represented by a length-1 string; a rebus entry would be a longer string; deleting an entry would be an empty string.
- `submit`: The solver has submitted the puzzle. There will be an additional field `success` with a boolean value true/false if the puzzle was completely correct or not.

### Unrecognized event types / extra even attributes

It is permissible to have events with `type` other than one of those enumerated above, but no special meaning is attached to them, and there is no restriction or expectation on what keys it might have other than `type` and `timestamp`.

It is also permissible for any event of recognized type to carry _additional_ fields other than the ones described above. However, again, no special meaning is attached to them.

### Other restrictions on `events`

The `events` array must be sorted by `timestamp` (ties can be broken arbitrarily).

The first event in `events` _must_ be a `start` event. From there, there cannot be another `start` event until there has been a `stop` event. Once there has been a `stop` event, there cannot be any other kind of event except another `start` event.

A `submit` event that has `success` true cannot be followed by any other event - it represents the completion of the puzzle.