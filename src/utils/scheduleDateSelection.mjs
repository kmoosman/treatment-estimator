// Calendar indices include empty cells before the first day of the month.
export function selectDateRectangle({
  selectedDates,
  calendarDates,
  startIndex,
  endIndex,
  remove,
  minimumDate,
  maxDates = 31,
}) {
  const selected = new Set(selectedDates);
  const firstRow = Math.min(
    Math.floor(startIndex / 7),
    Math.floor(endIndex / 7)
  );
  const lastRow = Math.max(
    Math.floor(startIndex / 7),
    Math.floor(endIndex / 7)
  );
  const firstColumn = Math.min(startIndex % 7, endIndex % 7);
  const lastColumn = Math.max(startIndex % 7, endIndex % 7);

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const date = calendarDates[row * 7 + column];
      if (!date || date < minimumDate) continue;
      if (remove) selected.delete(date);
      else if (selected.size < maxDates) selected.add(date);
    }
  }

  return [...selected].sort();
}
