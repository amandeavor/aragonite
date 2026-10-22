# Feature: Input recording in the debug panel

## Happy paths

- Record, type two letters, Stop: the section says how many steps it holds and whether text was kept; Send saves the file through the app server's `/test/recordings` route into `recordings-inbox/`, and the saved file starts from the loaded document and ends on the last letter's splice.

## Edge cases

- Send with the dev route missing (a production build, the deployed demo): the recording downloads instead, the section says why, and a recording made without text holds no initial source.

## Error cases

- A POST to the dev route in a format the build doesn't read answers 400 with the reader's plain message.
