import React, { useId, useMemo, useRef } from "react";
import {
  buildSlots,
  displaySlot,
  formatDate,
  formatTime,
} from "../../utils/schedule.mjs";
import "../../css/schedule-grid.css";

export default function AvailabilityGrid({
  event,
  selectedSlots = [],
  onChange,
  mode = "edit",
  onInspect,
  inspectedSlot,
  displayTimezone = event.timezone,
}) {
  const helpId = useId();
  const rootRef = useRef(null);
  const dragRef = useRef(null);
  const editing = mode === "edit";
  const slotMinutes = event.slotMinutes === 15 ? 15 : 30;
  const slots = useMemo(
    () =>
      buildSlots(event)
        .map((slot) => displaySlot(slot, event.timezone, displayTimezone))
        .filter(Boolean),
    [
      event.dates,
      event.startTime,
      event.endTime,
      event.slotMinutes,
      event.timezone,
      displayTimezone,
    ]
  );
  const dates = useMemo(
    () => [...new Set(slots.map((slot) => slot.date))].sort(),
    [slots]
  );
  const { rows, cells } = useMemo(() => {
    const rowMap = new Map();
    const cellMap = new Map();
    const repeats = new Map();
    for (const slot of slots) {
      const rowKey = slot.repeated
        ? `${slot.time}~${slot.repeatStartMinute}:${slot.repeatMinutes}`
        : slot.time;
      rowMap.set(rowKey, {
        key: rowKey,
        time: slot.time,
        repeated: slot.repeated,
        repeatMinutes: slot.repeatMinutes,
      });
      cellMap.set(`${slot.date}@${rowKey}`, slot);
      if (slot.repeated)
        repeats.set(`${slot.repeatStartMinute}:${slot.repeatMinutes}`, {
          start: slot.repeatStartMinute,
          duration: slot.repeatMinutes,
        });
    }
    function rowPosition(row) {
      const [hour, minute] = row.time.split(":").map(Number);
      const wallMinute = hour * 60 + minute;
      const insertedMinutes = [...repeats.values()].reduce(
        (total, repeat) =>
          total +
          (wallMinute >= repeat.start + repeat.duration ? repeat.duration : 0),
        0
      );
      return (
        wallMinute + insertedMinutes + (row.repeated ? row.repeatMinutes : 0)
      );
    }
    return {
      rows: [...rowMap.values()].sort(
        (a, b) => rowPosition(a) - rowPosition(b)
      ),
      cells: cellMap,
    };
  }, [slots]);
  const selected = new Set(selectedSlots);
  const participants = event.participants || [];
  const counts = useMemo(() => {
    const result = new Map();
    for (const participant of participants) {
      for (const key of new Set(participant.slots || []))
        result.set(key, (result.get(key) || 0) + 1);
    }
    return result;
  }, [event.participants]);

  function emitSelection(next) {
    onChange?.(
      slots.filter((slot) => next.has(slot.key)).map((slot) => slot.key)
    );
  }

  function toggleSlot(key) {
    const next = new Set(selectedSlots);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    emitSelection(next);
  }

  function paintTo(dayIndex, timeIndex) {
    const drag = dragRef.current;
    if (!drag || (drag.lastDay === dayIndex && drag.lastTime === timeIndex))
      return;
    drag.lastDay = dayIndex;
    drag.lastTime = timeIndex;
    const next = new Set(drag.original);
    for (
      let day = Math.min(dayIndex, drag.day);
      day <= Math.max(dayIndex, drag.day);
      day += 1
    ) {
      for (
        let time = Math.min(timeIndex, drag.time);
        time <= Math.max(timeIndex, drag.time);
        time += 1
      ) {
        const key = cells.get(`${dates[day]}@${rows[time].key}`)?.key;
        if (!key) continue;
        if (drag.adding) next.add(key);
        else next.delete(key);
      }
    }
    emitSelection(next);
  }

  function startDrag(pointerEvent, dayIndex, timeIndex) {
    if (
      !editing ||
      pointerEvent.button !== 0 ||
      pointerEvent.isPrimary === false ||
      pointerEvent.currentTarget.matches(":disabled")
    )
      return;
    pointerEvent.preventDefault();
    pointerEvent.currentTarget.focus({ preventScroll: true });
    const key = cells.get(`${dates[dayIndex]}@${rows[timeIndex].key}`)?.key;
    if (!key) return;
    dragRef.current = {
      day: dayIndex,
      time: timeIndex,
      original: new Set(selectedSlots),
      adding: !selected.has(key),
      pointerId: pointerEvent.pointerId,
    };
    rootRef.current.setPointerCapture(pointerEvent.pointerId);
    paintTo(dayIndex, timeIndex);
  }

  function moveDrag(pointerEvent) {
    if (
      !dragRef.current ||
      dragRef.current.pointerId !== pointerEvent.pointerId
    )
      return;
    const target = document
      .elementFromPoint(pointerEvent.clientX, pointerEvent.clientY)
      ?.closest("[data-schedule-cell]");
    if (target && rootRef.current.contains(target))
      paintTo(Number(target.dataset.day), Number(target.dataset.time));
  }

  function stopDrag(pointerEvent, cancel = false) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerEvent.pointerId) return;
    dragRef.current = null;
    if (cancel) emitSelection(drag.original);
    if (rootRef.current.hasPointerCapture(pointerEvent.pointerId))
      rootRef.current.releasePointerCapture(pointerEvent.pointerId);
  }

  function moveFocus(keyboardEvent, dayIndex, timeIndex) {
    const offsets = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const offset = offsets[keyboardEvent.key];
    if (!offset) return;
    keyboardEvent.preventDefault();
    let day = dayIndex + offset[0];
    let time = timeIndex + offset[1];
    while (day >= 0 && day < dates.length && time >= 0 && time < rows.length) {
      const target = rootRef.current.querySelector(
        `button[data-day="${day}"][data-time="${time}"]`
      );
      if (target && !target.disabled) {
        target.focus();
        return;
      }
      day += offset[0];
      time += offset[1];
    }
  }

  function toggleDay(date) {
    const daySlots = slots.filter((slot) => slot.date === date);
    const allSelected = daySlots.every((slot) => selected.has(slot.key));
    const next = new Set(selectedSlots);
    for (const slot of daySlots) {
      if (allSelected) next.delete(slot.key);
      else next.add(slot.key);
    }
    emitSelection(next);
  }

  if (!slots.length)
    return (
      <p className="schedule-grid-empty">
        Choose dates and a time range to see availability.
      </p>
    );

  return (
    <div className={`schedule-availability schedule-availability--${mode}`}>
      <p id={helpId} className="schedule-grid-sr-only">
        {editing
          ? "Click or drag across times you’re available. Use arrow keys to move and Space to select. Press Escape to cancel a drag."
          : "Select a time to see who’s available."}
      </p>
      <div
        className="schedule-grid-scroll"
        ref={rootRef}
        onPointerMove={moveDrag}
        onPointerUp={(pointerEvent) => stopDrag(pointerEvent)}
        onPointerCancel={(pointerEvent) => stopDrag(pointerEvent, true)}
        onLostPointerCapture={(pointerEvent) => stopDrag(pointerEvent, true)}
        onKeyDown={(keyboardEvent) => {
          if (keyboardEvent.key === "Escape" && dragRef.current) {
            keyboardEvent.preventDefault();
            stopDrag({ pointerId: dragRef.current.pointerId }, true);
          }
        }}
      >
        <table
          className="schedule-grid"
          aria-describedby={helpId}
          style={{ minWidth: Math.max(400, 88 + dates.length * 76) }}
        >
          <caption className="schedule-grid-sr-only">
            {editing ? "Your availability" : "Group availability"} in{" "}
            {displayTimezone}. Each available cell is {slotMinutes} minutes.
            Hatched cells are outside the proposed times.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="schedule-grid-time-heading">
                <span>Time</span>
              </th>
              {dates.map((date) => (
                <th
                  scope="col"
                  key={date}
                  className="schedule-grid-date-heading"
                >
                  <span className="schedule-grid-weekday">
                    {formatDate(date, { weekday: "short" })}
                  </span>
                  <span className="schedule-grid-date">
                    {formatDate(date, { month: "short", day: "numeric" })}
                  </span>
                  {editing && (
                    <button
                      type="button"
                      className="schedule-grid-day-toggle"
                      onClick={() => toggleDay(date)}
                      aria-label={`${
                        slots
                          .filter((slot) => slot.date === date)
                          .every((slot) => selected.has(slot.key))
                          ? "Clear"
                          : "Select"
                      } all times on ${formatDate(date)}`}
                    >
                      {slots
                        .filter((slot) => slot.date === date)
                        .every((slot) => selected.has(slot.key))
                        ? "Clear day"
                        : "Select day"}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, timeIndex) => (
              <tr
                key={row.key}
                className={row.time.endsWith(":00") ? "schedule-grid-hour" : ""}
              >
                <th scope="row" className="schedule-grid-time">
                  {formatTime(row.time)}
                  {row.repeated && (
                    <span className="schedule-grid-repeat">
                      Second occurrence
                    </span>
                  )}
                </th>
                {dates.map((date, dayIndex) => {
                  const slot = cells.get(`${date}@${row.key}`);
                  if (!slot)
                    return (
                      <td
                        key={`${date}@${row.key}`}
                        className="schedule-grid-cell schedule-grid-cell--unavailable"
                        aria-disabled="true"
                        aria-label={`${formatDate(date)}, ${formatTime(
                          row.time
                        )}: outside the proposed times`}
                      >
                        <span
                          className="schedule-grid-slot schedule-grid-slot--unavailable"
                          data-schedule-cell="true"
                          data-day={dayIndex}
                          data-time={timeIndex}
                          aria-hidden="true"
                        />
                      </td>
                    );
                  const key = slot.key;
                  const count = counts.get(key) || 0;
                  const ratio = participants.length
                    ? count / participants.length
                    : 0;
                  const active = editing
                    ? selected.has(key)
                    : inspectedSlot === key;
                  const label = `${formatDate(date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}, ${formatTime(slot.time)} ${slot.zoneLabel}${
                    slot.repeated ? " (second occurrence)" : ""
                  } to ${
                    slot.endDate !== date ? `${formatDate(slot.endDate)} ` : ""
                  }${formatTime(slot.endTime)} ${slot.endZoneLabel}${
                    editing
                      ? ""
                      : `, ${count} of ${participants.length} available`
                  }`;
                  return (
                    <td key={key} className="schedule-grid-cell">
                      <button
                        type="button"
                        className={`schedule-grid-slot${
                          active ? " is-selected" : ""
                        }${!editing && count ? " has-availability" : ""}`}
                        data-schedule-slot={key}
                        data-schedule-cell="true"
                        data-day={dayIndex}
                        data-time={timeIndex}
                        aria-label={label}
                        aria-pressed={active}
                        title={label}
                        style={
                          !editing
                            ? {
                                "--schedule-heat": ratio,
                                color: ratio > 0.55 ? "#ffffff" : "#334155",
                                backgroundColor: count
                                  ? `rgba(59, 130, 246, ${0.12 + ratio * 0.88})`
                                  : "#f8fafc",
                              }
                            : undefined
                        }
                        onPointerDown={(pointerEvent) =>
                          startDrag(pointerEvent, dayIndex, timeIndex)
                        }
                        onClick={(clickEvent) => {
                          if (!editing) onInspect?.(key);
                          else if (clickEvent.detail === 0) toggleSlot(key);
                        }}
                        onKeyDown={(keyboardEvent) =>
                          moveFocus(keyboardEvent, dayIndex, timeIndex)
                        }
                      >
                        {editing ? (
                          active ? (
                            <span
                              aria-hidden="true"
                              className="schedule-grid-check"
                            >
                              ✓
                            </span>
                          ) : null
                        ) : count > 0 ? (
                          <span aria-hidden="true">{count}</span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((row) => row.repeated) && (
        <p className="schedule-grid-dst-note">
          The clock changes on these dates. Repeated times are shown separately.
        </p>
      )}
    </div>
  );
}
