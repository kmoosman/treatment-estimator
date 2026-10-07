import React, { useEffect, useId, useRef, useState } from "react";
import { selectDateRectangle } from "../../utils/scheduleDateSelection.mjs";
import "../../css/schedule-datepicker.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function Chevron({ direction }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "m14 7-5 5 5 5" : "m10 7 5 5-5 5"} />
    </svg>
  );
}

export default function DatePicker({
  selectedDates = [],
  onChange,
  maxDates = 31,
}) {
  const headingId = useId();
  const summaryId = useId();
  const instructionsId = useId();
  const gridRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const today = new Date();
  const todayKey = dateKey(today);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const firstDate = [...selectedDates].sort()[0];
    const initialDate =
      firstDate && firstDate >= todayKey ? localDate(firstDate) : today;
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12);
  });
  const monthLabel = visibleMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const monthStartOffset = (visibleMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
    12
  ).getDate();
  const selectedSet = new Set(selectedDates);
  const atLimit = selectedSet.size >= maxDates;
  const calendarDates = [
    ...Array(monthStartOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) =>
      dateKey(
        new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth(),
          index + 1,
          12
        )
      )
    ),
  ];

  function finishDrag(restore = false) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    setIsDragging(false);
    if (restore) onChange(drag.selectedDates);
    if (gridRef.current?.hasPointerCapture(drag.pointerId)) {
      gridRef.current.releasePointerCapture(drag.pointerId);
    }
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && dragRef.current) {
        event.preventDefault();
        finishDrag(true);
      }
    }
    function handleWindowBlur() {
      finishDrag(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [onChange]);

  function startDrag(event, index, key) {
    if (event.button !== 0 || event.isPrimary === false || dragRef.current)
      return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    suppressClickRef.current = true;
    const drag = {
      pointerId: event.pointerId,
      selectedDates: [...selectedDates],
      calendarDates,
      startIndex: index,
      endIndex: index,
      remove: selectedSet.has(key),
      minimumDate: todayKey,
      maxDates,
    };
    dragRef.current = drag;
    gridRef.current.setPointerCapture(event.pointerId);
    setIsDragging(true);
    onChange(selectDateRectangle(drag));
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const grid = gridRef.current;
    const bounds = grid.getBoundingClientRect();
    const styles = window.getComputedStyle(grid);
    const columnGap = parseFloat(styles.columnGap) || 0;
    const rowGap = parseFloat(styles.rowGap) || 0;
    const rows = Math.ceil(drag.calendarDates.length / 7);
    const columnWidth = (bounds.width + columnGap) / 7;
    const rowHeight = (bounds.height + rowGap) / rows;
    const column = Math.max(
      0,
      Math.min(6, Math.floor((event.clientX - bounds.left) / columnWidth))
    );
    const row = Math.max(
      0,
      Math.min(rows - 1, Math.floor((event.clientY - bounds.top) / rowHeight))
    );
    const endIndex = row * 7 + column;
    if (drag.endIndex === endIndex) return;
    drag.endIndex = endIndex;
    onChange(selectDateRectangle(drag));
  }

  function changeMonth(offset) {
    setVisibleMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1, 12)
    );
  }

  function toggleDate(key) {
    if (selectedSet.has(key)) {
      onChange(selectedDates.filter((date) => date !== key));
    } else if (!atLimit && key >= todayKey) {
      onChange([...selectedDates, key].sort());
    }
  }

  function selectWeekdays() {
    const dates = [];
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12
    );
    while (dates.length < Math.min(5, maxDates)) {
      if (date.getDay() !== 0 && date.getDay() !== 6) dates.push(dateKey(date));
      date.setDate(date.getDate() + 1);
    }
    onChange(dates);
    const firstDate = dates.length ? localDate(dates[0]) : today;
    setVisibleMonth(
      new Date(firstDate.getFullYear(), firstDate.getMonth(), 1, 12)
    );
  }

  return (
    <div className="schedule-datepicker">
      <div className="schedule-datepicker__header">
        <h3
          id={headingId}
          className="schedule-datepicker__month"
          aria-live="polite"
        >
          {monthLabel}
        </h3>
        <div className="schedule-datepicker__navigation">
          <button
            type="button"
            className="schedule-datepicker__arrow"
            onClick={() => changeMonth(-1)}
            disabled={visibleMonth <= currentMonth}
            aria-label="Previous month"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            className="schedule-datepicker__arrow"
            onClick={() => changeMonth(1)}
            aria-label="Next month"
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <p id={instructionsId} className="schedule-datepicker__instructions">
        Click or drag to select dates. Drag selected dates to clear them.
        <span className="sr-only">
          {" "}
          Press Escape to cancel a drag. Use Tab to move between dates and Space
          or Enter to toggle a date.
        </span>
      </p>

      <div className="schedule-datepicker__weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        className={`schedule-datepicker__days${
          isDragging ? " schedule-datepicker__days--dragging" : ""
        }`}
        role="group"
        aria-labelledby={headingId}
        aria-describedby={`${instructionsId} ${summaryId}`}
        onPointerMove={moveDrag}
        onPointerUp={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) finishDrag();
        }}
        onPointerCancel={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) finishDrag(true);
        }}
        onLostPointerCapture={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) finishDrag(true);
        }}
        onClickCapture={(event) => {
          if (suppressClickRef.current && event.detail !== 0) {
            suppressClickRef.current = false;
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {Array.from({ length: monthStartOffset }, (_, index) => (
          <span key={`empty-${index}`} aria-hidden="true" />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth(),
            index + 1,
            12
          );
          const key = dateKey(date);
          const isSelected = selectedSet.has(key);
          const isToday = key === todayKey;
          const label = date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
          return (
            <button
              key={key}
              type="button"
              className={`schedule-datepicker__day${
                isSelected ? " schedule-datepicker__day--selected" : ""
              }`}
              aria-label={label}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-disabled={atLimit && !isSelected ? true : undefined}
              disabled={key < todayKey}
              onPointerDown={(event) =>
                startDrag(event, monthStartOffset + index, key)
              }
              onClick={() => toggleDate(key)}
            >
              {index + 1}
              {isToday && (
                <span
                  className="schedule-datepicker__today"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="schedule-datepicker__footer">
        <button
          type="button"
          className="schedule-datepicker__shortcut"
          onClick={selectWeekdays}
          title="Select the next five weekdays, including today if it is a weekday"
          disabled={maxDates < 1}
        >
          Select weekdays
        </button>
        <button
          type="button"
          className="schedule-datepicker__clear"
          onClick={() => onChange([])}
          disabled={selectedSet.size === 0}
        >
          Clear
        </button>
      </div>
      <p
        id={summaryId}
        className="schedule-datepicker__summary"
        aria-live="polite"
        aria-atomic="true"
      >
        {selectedSet.size} {selectedSet.size === 1 ? "date" : "dates"} selected
        {atLimit && <span> · Maximum {maxDates} dates</span>}
      </p>
    </div>
  );
}
