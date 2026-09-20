/**
 * Whether a click on a dialog's scrim is a press on the scrim, or the tail of a
 * drag that started inside the sheet.
 *
 * A slider dragged past the sheet's edge releases over the scrim, and the click
 * that follows a drag targets wherever the pointer came up — so click target
 * alone closes the sheet under the hand halfway through setting a value.
 */
export function closesDialog(
  down: EventTarget | null,
  click: EventTarget | null,
  scrim: EventTarget | null,
): boolean {
  return down !== null && down === scrim && click === scrim
}
