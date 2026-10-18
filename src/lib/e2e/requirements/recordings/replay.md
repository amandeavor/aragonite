# Feature: Replaying checked-in input recordings

Each recording under `src/lib/e2e/recordings/` that isn't `diagnosticOnly` gets one test per browser it names (Chromium when it names none). The test loads the recording's initial document and selection, replays every step through a real input primitive (a key press, inserted text, the shared IME driver, the shared clipboard helper; a pointer step only puts its selection back), and records the replay with the same recorder.

## Happy paths

- `typing-ime-paste` (a click, End, five letters, Enter, a letter, two Backspaces, a か → かん → 漢 composition, a Ctrl+V of ` pasted`): after every step the bytes hash and selection are the step's `expected` entry, and the replay's events match the recorded ones step for step.

## Error cases

- A step that leaves other bytes or another selection fails at that step, naming its family and both splices; later steps don't run, since they'd only cascade.
- A replay whose bytes all match but whose events drift from the recording (the driver changed, not the editor) fails on the event comparison alone.
- `RECORDINGS_BLESS=1` rewrites only `expected`, from the replay, and never fails on a divergence.
