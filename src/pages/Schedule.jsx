import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../partials/Header";
import DatePicker from "../partials/schedule/DatePicker";
import AvailabilityGrid from "../partials/schedule/AvailabilityGrid";
import EditResponseDialog from "../partials/schedule/EditResponseDialog";
import MeetingMessage, {
  EmailCopyButton,
} from "../partials/schedule/MeetingMessage";
import Icon from "../partials/schedule/Icon";
import {
  buildSlots,
  formatTime,
  getBestTimes,
  displaySlot,
  displayMeeting,
} from "../utils/schedule.mjs";
import {
  createEvent,
  getEvent,
  saveResponse,
  requestEditAccess,
  readStored,
  writeStored,
  identityKey,
  recentEvents,
  rememberEvent,
  removeRecentEvent,
  clearRecentEvents,
  rememberedIdentities,
  rememberIdentity,
  selectIdentity,
} from "../utils/scheduleApi";
import "../css/schedule.css";

const dateLabel = (date, options = {}) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...options,
  });
const zoneLabel = (zone) => zone.replaceAll("_", " ");
const meetingLengths = [
  15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300, 360, 420, 480,
];
function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [
    hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
    remainder ? `${remainder} ${remainder === 1 ? "minute" : "minutes"}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
const timeOptions = Array.from(
  { length: 97 },
  (_, i) =>
    `${String(Math.floor(i / 4)).padStart(2, "0")}:${String(
      (i % 4) * 15
    ).padStart(2, "0")}`
);
function timezones() {
  const current = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [
          "America/New_York",
          "America/Chicago",
          "America/Denver",
          "America/Los_Angeles",
          "Europe/London",
          "Europe/Paris",
          "Asia/Kolkata",
          "Asia/Tokyo",
          "Australia/Sydney",
        ];
  return [...new Set([current, "UTC", ...zones])];
}
const zones = timezones();

function ErrorMessage({ children }) {
  return children ? (
    <div className="schedule-error" role="alert">
      {children}
    </div>
  ) : null;
}

function CreateSchedule() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dates, setDates] = useState([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState(zones[0]);
  const [durationChoice, setDurationChoice] = useState("60");
  const [customDuration, setCustomDuration] = useState("");
  const duration = Number(
    durationChoice === "custom" ? customDuration : durationChoice
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recents, setRecents] = useState(recentEvents);
  const [recentNotice, setRecentNotice] = useState("");
  const [recentError, setRecentError] = useState("");

  useEffect(() => {
    const refreshRecents = () => setRecents(recentEvents());
    window.addEventListener("storage", refreshRecents);
    window.addEventListener("focus", refreshRecents);
    return () => {
      window.removeEventListener("storage", refreshRecents);
      window.removeEventListener("focus", refreshRecents);
    };
  }, []);

  function clearHistory(event) {
    const saved = event ? removeRecentEvent(event.id) : clearRecentEvents();
    setRecentError("");
    setRecentNotice("");
    if (!saved) {
      setRecentError(
        "Couldn’t update this device’s history. Please try again."
      );
      return;
    }
    setRecents(recentEvents());
    setRecentNotice(
      event
        ? `“${event.title}” removed from recently opened.`
        : "Recently opened history cleared from this device."
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setError("Give your event a name to get started.");
      return;
    }
    if (!dates.length) {
      setError("Choose at least one possible date.");
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      setError("Enter a meeting length between 1 and 1,440 whole minutes.");
      return;
    }
    const minutes = (time) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (minutes(endTime) - minutes(startTime) < duration) {
      setError("Choose a time window long enough for your meeting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await createEvent({
        title: title.trim(),
        description: description.trim(),
        dates: [...dates].sort(),
        startTime,
        endTime,
        timezone,
        duration,
      });
      rememberEvent(created);
      navigate(`/schedule/${created.id}`, { state: { created: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="schedule-page-heading">
        <div>
          <h1>Schedule</h1>
          <p>Find a time that works for everyone.</p>
        </div>
        <span className="schedule-heading-note">
          <Icon name="people" size={17} /> A little less back-and-forth
        </span>
      </div>
      <div className="schedule-intro">
        <div className="schedule-intro-icon">
          <Icon name="calendar" size={25} />
        </div>
        <div>
          <h2>Bring everyone to the same table.</h2>
          <p>
            Choose a few dates, share one link, and let everyone add their
            availability.
          </p>
        </div>
        <span className="schedule-intro-tag">No account needed</span>
      </div>
      <ol className="schedule-steps" aria-label="How scheduling works">
        <li className="is-current">
          <span>1</span>
          <div>
            Create an event<small>Pick your dates and times</small>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            Share the link<small>Everyone adds their name</small>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            Find your overlap<small>See what works for the group</small>
          </div>
        </li>
      </ol>
      <form onSubmit={submit} className="schedule-create-form">
        <div className="schedule-create-columns">
          <section className="schedule-card schedule-details-card">
            <div className="schedule-section-heading">
              <Icon name="calendar" />
              <h2>What are you planning?</h2>
            </div>
            <p className="schedule-card-description">
              Start with a name everyone will recognize.
            </p>
            <label className="schedule-label" htmlFor="event-title">
              Event name <span>*</span>
            </label>
            <input
              id="event-title"
              className="schedule-input"
              placeholder="e.g. Research team catch-up"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
            />
            <label className="schedule-label" htmlFor="event-description">
              A little context <small>optional</small>
            </label>
            <textarea
              id="event-description"
              className="schedule-input schedule-textarea"
              placeholder="What’s the plan? Add a location, agenda, or anything helpful."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />
            <label className="schedule-label" htmlFor="event-duration">
              Meeting length
            </label>
            <select
              id="event-duration"
              className="schedule-input"
              value={durationChoice}
              onChange={(e) => setDurationChoice(e.target.value)}
            >
              {meetingLengths.map((length) => (
                <option key={length} value={length}>
                  {durationLabel(length)}
                </option>
              ))}
              <option value="custom">Custom length…</option>
            </select>
            {durationChoice === "custom" && (
              <div className="schedule-custom-duration">
                <label className="schedule-label" htmlFor="custom-duration">
                  Custom length <small>in minutes</small>
                </label>
                <input
                  id="custom-duration"
                  className="schedule-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  step={1}
                  required
                  placeholder="e.g. 20"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  aria-describedby="duration-help"
                />
              </div>
            )}
            <p className="schedule-field-help" id="duration-help">
              We’ll use this to find the best times for your group.
            </p>
          </section>
          <section className="schedule-card schedule-dates-card">
            <div className="schedule-section-heading">
              <Icon name="calendar" />
              <h2>Which dates could work?</h2>
            </div>
            <p className="schedule-card-description">
              Select a few options. Everyone can weigh in later.
            </p>
            <DatePicker selectedDates={dates} onChange={setDates} />
          </section>
        </div>
        <section className="schedule-time-window">
          <div className="schedule-window-title">
            <Icon name="clock" size={23} />
            <div>
              <h2>Set a time window</h2>
              <p>Guests will see these times in their own time zone.</p>
            </div>
          </div>
          <div className="schedule-window-fields">
            <label>
              From
              <select
                aria-label="Earliest time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {timeOptions.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </label>
            <span className="schedule-time-dash">–</span>
            <label>
              To
              <select
                aria-label="Latest time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              >
                {timeOptions.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {t === "24:00" ? "Midnight (end of day)" : formatTime(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="schedule-zone-label">
              Your time zone
              <select
                aria-label="Your time zone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zoneLabel(zone)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <ErrorMessage>{error}</ErrorMessage>
        <div className="schedule-create-footer">
          <p>
            <Icon name="link" size={16} /> One shared link. Guests just enter
            their name.
          </p>
          <button
            className="schedule-button schedule-primary"
            disabled={busy}
            type="submit"
          >
            {busy ? "Creating event…" : "Create event"}
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </form>
      {(recents.length > 0 || recentNotice || recentError) && (
        <section className="schedule-recents">
          <div className="schedule-section-heading">
            <Icon name="clock" size={18} />
            <h2>Recently opened</h2>
            <span>On this device</span>
            {recents.length > 0 && (
              <button
                type="button"
                className="schedule-clear-recents"
                aria-label="Clear all recently opened events"
                title="Clear this device’s history. Shared events stay available."
                onClick={() => clearHistory()}
              >
                Clear all
              </button>
            )}
          </div>
          <p className="schedule-recent-notice" role="status">
            {recentNotice}
          </p>
          <ErrorMessage>{recentError}</ErrorMessage>
          <div className="schedule-recent-list">
            {recents.map((event) => (
              <article key={event.id} className="schedule-recent-card">
                <Link to={`/schedule/${event.id}`}>
                  <Icon name="calendar" />
                  <div>
                    <strong>{event.title}</strong>
                    <small>
                      {event.dates?.length
                        ? `${dateLabel(event.dates[0])} · ${
                            event.dates.length
                          } possible ${
                            event.dates.length === 1 ? "date" : "dates"
                          }`
                        : "View event"}
                    </small>
                  </div>
                  <Icon name="arrow" size={17} />
                </Link>
                <button
                  type="button"
                  className="schedule-remove-recent"
                  aria-label={`Remove ${event.title} from recently opened`}
                  title="Remove from recently opened"
                  onClick={() => clearHistory(event)}
                >
                  <Icon name="close" size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ShareLink({ eventId }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const input = useRef(null);
  const url = `${window.location.origin}/schedule/${eventId}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFallback(false);
    } catch {
      setFallback(true);
      input.current?.focus();
      input.current?.select();
    }
  }
  useEffect(() => {
    if (copied) {
      const id = setTimeout(() => setCopied(false), 2500);
      return () => clearTimeout(id);
    }
  }, [copied]);
  return (
    <div className="schedule-share">
      <div className="schedule-share-copy">
        <Icon name="link" />
        <div>
          <strong>Invite your group</strong>
          <p>Anyone with this link can view responses and shared emails.</p>
        </div>
      </div>
      <div className="schedule-share-control">
        <input
          ref={input}
          value={url}
          readOnly
          aria-label="Shareable event link"
          onFocus={(e) => e.target.select()}
        />
        <button
          className="schedule-button schedule-primary"
          type="button"
          onClick={copy}
        >
          <Icon name={copied ? "check" : "link"} size={17} />
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <span className="schedule-sr-only" role="status">
        {copied ? "Event link copied" : ""}
      </span>
      {fallback && (
        <small className="schedule-copy-help" role="status">
          Link selected. Copy it from the field above.
        </small>
      )}
    </div>
  );
}

function GroupResults({
  event,
  onEdit,
  onEditPerson,
  displayTimezone,
  editingDisabled,
  onAddPerson,
  hasCurrentEntry,
  hasUnsavedChanges,
}) {
  const [inspectedSlot, setInspectedSlot] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [expandedAvailability, setExpandedAvailability] = useState(null);
  const [emailSeparator, setEmailSeparator] = useState("comma");
  const total = event.participants.length;
  const bestTimes = getBestTimes(event).map((time) => ({
    ...time,
    ...displayMeeting(time, event.timezone, displayTimezone),
  }));
  const selected =
    inspectedSlot &&
    displaySlot(
      buildSlots(event).find((slot) => slot.key === inspectedSlot),
      event.timezone,
      displayTimezone
    );
  const available = selected
    ? event.participants.filter((person) => person.slots.includes(selected.key))
    : [];
  return (
    <div className="schedule-results-layout">
      <section className="schedule-card schedule-grid-card">
        <div className="schedule-grid-heading">
          <div>
            <h2>Everyone’s availability</h2>
            <p>
              {total
                ? "Darker blue means more people are available. Select a time for details."
                : "Your group’s availability will appear here as responses come in."}
            </p>
          </div>
          <span className="schedule-count">
            <Icon name="people" size={16} />
            {total} {total === 1 ? "response" : "responses"}
          </span>
        </div>
        <div className="schedule-grid-meta">
          <span>
            <Icon name="globe" size={15} />
            {zoneLabel(displayTimezone)}
          </span>
          <div className="schedule-legend">
            <span>Fewer</span>
            {["#f1f5f9", "#dbeafe", "#93c5fd", "#60a5fa", "#2563eb"].map(
              (color) => (
                <i key={color} style={{ background: color }} />
              )
            )}
            <span>More</span>
          </div>
        </div>
        <AvailabilityGrid
          displayTimezone={displayTimezone}
          event={event}
          mode="group"
          inspectedSlot={inspectedSlot}
          onInspect={setInspectedSlot}
        />
        <p className="schedule-grid-footnote">
          All times are shown in your selected time zone.
        </p>
      </section>
      <aside className="schedule-results-aside">
        <section className="schedule-card schedule-best-times">
          <div className="schedule-section-heading">
            <Icon name="clock" />
            <h2>Best times to meet</h2>
          </div>
          <p className="schedule-card-description">
            Meeting length: {durationLabel(event.duration)}
          </p>
          {bestTimes.length ? (
            <ol>
              {bestTimes.slice(0, 3).map((time, index) => (
                <li key={time.instant}>
                  <span className="schedule-rank">{index + 1}</span>
                  <div>
                    <strong>
                      {dateLabel(time.date, { weekday: "short" })}
                    </strong>
                    <p>
                      {formatTime(time.startTime)} – {formatTime(time.endTime)}
                      {time.endDate &&
                        time.endDate !== time.date &&
                        ` (${dateLabel(time.endDate)})`}
                      {time.zoneLabel !== time.endZoneLabel &&
                        ` (${time.zoneLabel} → ${time.endZoneLabel})`}
                    </p>
                    <button
                      type="button"
                      className={`schedule-availability-toggle ${
                        time.count === total
                          ? "schedule-all-available"
                          : "schedule-partial-available"
                      }`}
                      aria-expanded={expandedAvailability === time.instant}
                      aria-controls={`meeting-availability-${time.instant}`}
                      aria-label={`${
                        time.count === total
                          ? `Everyone available · ${total}`
                          : `${time.count} of ${total} available`
                      }. ${
                        expandedAvailability === time.instant ? "Hide" : "Show"
                      } names available for the full meeting (${durationLabel(
                        event.duration
                      )}).`}
                      onClick={() =>
                        setExpandedAvailability((current) =>
                          current === time.instant ? null : time.instant
                        )
                      }
                    >
                      {time.count === total ? (
                        <Icon name="check" size={13} />
                      ) : (
                        <Icon name="people" size={13} />
                      )}{" "}
                      {time.count === total
                        ? `Everyone available · ${total}`
                        : `${time.count} of ${total} available`}
                      <Icon
                        name={
                          expandedAvailability === time.instant
                            ? "close"
                            : "plus"
                        }
                        size={12}
                      />
                    </button>
                    {expandedAvailability === time.instant && (
                      <div
                        id={`meeting-availability-${time.instant}`}
                        className="schedule-meeting-availability"
                      >
                        <p>
                          Available for the full meeting (
                          {durationLabel(event.duration)}):
                        </p>
                        <ul aria-label="People available for the full meeting">
                          {time.participants.map((person) => (
                            <li key={person.id}>
                              <Icon name="check" size={12} />
                              <span>{person.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <button
                      className="schedule-choose-time"
                      type="button"
                      aria-expanded={selectedMeeting === time.instant}
                      aria-controls={`meeting-message-${index}`}
                      onClick={() =>
                        setSelectedMeeting(
                          selectedMeeting === time.instant ? null : time.instant
                        )
                      }
                    >
                      <Icon
                        name={
                          selectedMeeting === time.instant
                            ? "check"
                            : "calendar"
                        }
                        size={13}
                      />
                      {selectedMeeting === time.instant
                        ? "Hide message"
                        : "Select time"}
                    </button>
                  </div>
                  {selectedMeeting === time.instant && (
                    <div
                      id={`meeting-message-${index}`}
                      className="schedule-message-expand"
                    >
                      <MeetingMessage
                        key={`${time.instant}-${displayTimezone}`}
                        event={event}
                        meeting={time}
                        timezone={displayTimezone}
                        emailSeparator={emailSeparator}
                        onEmailSeparatorChange={setEmailSeparator}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="schedule-empty">
              <Icon name="clock" size={27} />
              <strong>
                {total
                  ? "No meeting-length overlap yet"
                  : "Good times are on their way"}
              </strong>
              <p>
                {total
                  ? "Add more availability to find a time that fits the full meeting."
                  : "Add your availability and share the link to get started."}
              </p>
            </div>
          )}
        </section>
        {selected && (
          <section className="schedule-card schedule-slot-details">
            <h2>{dateLabel(selected.date, { weekday: "short" })}</h2>
            <p>
              {formatTime(selected.time)} – {formatTime(selected.endTime)}
              {selected.endDate !== selected.date &&
                ` (${dateLabel(selected.endDate)})`}
              {selected.zoneLabel !== selected.endZoneLabel &&
                ` (${selected.zoneLabel} → ${selected.endZoneLabel})`}
            </p>
            <strong>
              {available.length} of {total} available
            </strong>
            <ul>
              {event.participants.map((person) => (
                <li key={person.id}>
                  <span
                    className={`schedule-status-dot ${
                      available.some((p) => p.id === person.id)
                        ? "is-available"
                        : ""
                    }`}
                  />
                  {person.name}
                  <small>
                    {available.some((p) => p.id === person.id)
                      ? "Available"
                      : "Unavailable"}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="schedule-card schedule-participants">
          <div className="schedule-section-heading">
            <Icon name="people" />
            <h2>The group</h2>
            <span>{total}</span>
          </div>
          {total > 0 && (
            <p className="schedule-card-description">
              Choose a name to edit, including someone whose schedule you
              manage.
            </p>
          )}
          {total ? (
            <ul>
              {event.participants.map((person) => (
                <li key={person.id}>
                  <button
                    className="schedule-person-edit"
                    disabled={editingDisabled}
                    onClick={() => onEditPerson(person)}
                    aria-label={`Edit ${person.name}'s availability`}
                  >
                    <span className="schedule-avatar">
                      {person.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{person.name}</span>
                    <Icon name="edit" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="schedule-card-description">
              No responses yet. Be the first!
            </p>
          )}
          <EmailCopyButton
            participants={event.participants}
            separator={emailSeparator}
            onSeparatorChange={setEmailSeparator}
          />
          <button
            className="schedule-button schedule-secondary"
            onClick={onEdit}
            disabled={editingDisabled}
          >
            {hasCurrentEntry ? "Edit current entry" : "Add availability"}
            <Icon name="arrow" size={16} />
          </button>
          {hasCurrentEntry && (
            <button
              type="button"
              className="schedule-button schedule-secondary schedule-add-person"
              onClick={onAddPerson}
              disabled={editingDisabled}
            >
              <Icon name="plus" size={16} />
              {hasUnsavedChanges ? "Save & add another" : "Add another person"}
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function EventSchedule({ id }) {
  const [event, setEvent] = useState(null);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savedName, setSavedName] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [ready, setReady] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [managedIdentities, setManagedIdentities] = useState(() =>
    rememberedIdentities(id)
  );
  const [enteredName, setEnteredName] = useState(false);
  const [slots, setSlots] = useState([]);
  const [savedSlots, setSavedSlots] = useState([]);
  const [mode, setMode] = useState("edit");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [reload, setReload] = useState(0);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [editError, setEditError] = useState("");
  const [displayTimezone, setDisplayTimezone] = useState(() => {
    const saved = readStored("schedule:display-timezone");
    return zones.includes(saved) ? saved : zones[0];
  });
  const visibleDateCount = useMemo(
    () =>
      event
        ? new Set(
            buildSlots(event)
              .map(
                (slot) =>
                  displaySlot(slot, event.timezone, displayTimezone)?.date
              )
              .filter(Boolean)
          ).size
        : 0,
    [
      event?.dates,
      event?.startTime,
      event?.endTime,
      event?.timezone,
      event?.slotMinutes,
      displayTimezone,
    ]
  );
  const nameInput = useRef(null);
  const refreshGeneration = useRef(0);
  const savingRef = useRef(false);
  const isDirty =
    ((identity || enteredName) &&
      (name !== savedName || email !== savedEmail)) ||
    slots.length !== savedSlots.length ||
    slots.some((slot) => !savedSlots.includes(slot));
  const hasUnsavedChanges = isDirty || (!identity && Boolean(name || email));

  useEffect(() => {
    let active = true;
    setError("");
    getEvent(id)
      .then((data) => {
        if (!active) return;
        setEvent(data);
        rememberEvent(data);
        const stored = readStored(identityKey(id));
        const participant = data.participants.find(
          (person) =>
            person.id === stored?.id &&
            typeof stored?.editToken === "string" &&
            stored.editToken.length > 0
        );
        if (participant && stored?.editToken) {
          setIdentity(stored);
          setName(participant.name);
          setSavedName(participant.name);
          setEmail(participant.email || "");
          setSavedEmail(participant.email || "");
          setEnteredName(true);
          setSlots(participant.slots);
          setSavedSlots(participant.slots);
        }
        const draft = readStored(`schedule:draft:${id}`);
        if (
          draft &&
          draft.participantId === (participant?.id || null) &&
          typeof draft.name === "string" &&
          Array.isArray(draft.slots)
        ) {
          const validSlots = new Set(buildSlots(data).map((slot) => slot.key));
          setName(draft.name.slice(0, 60));
          if (typeof draft.email === "string")
            setEmail(draft.email.slice(0, 254));
          setSlots(draft.slots.filter((slot) => validSlots.has(slot)));
          setEnteredName(Boolean(draft.enteredName && draft.name.trim()));
        }
        setReady(true);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [id, reload]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    let refreshing = false;
    const refresh = () => {
      if (
        document.visibilityState === "hidden" ||
        savingRef.current ||
        refreshing
      )
        return;
      refreshing = true;
      const generation = refreshGeneration.current;
      getEvent(id)
        .then((data) => {
          if (active && generation === refreshGeneration.current) {
            setEvent(data);
            setRefreshError("");
          }
        })
        .catch(() => {
          if (active && generation === refreshGeneration.current)
            setRefreshError(
              "Updates are temporarily unavailable. Your selections are still here."
            );
        })
        .finally(() => {
          refreshing = false;
        });
    };
    const interval = setInterval(refresh, 12000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [id, ready]);

  useEffect(() => {
    if (!ready) return;
    writeStored(
      `schedule:draft:${id}`,
      hasUnsavedChanges
        ? {
            participantId: identity?.id || null,
            name,
            email,
            slots,
            enteredName,
          }
        : null
    );
  }, [id, ready, name, email, slots, enteredName, identity, hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  function retainIdentity(nextIdentity) {
    setManagedIdentities((current) => [
      ...current.filter((item) => item.id !== nextIdentity.id),
      nextIdentity,
    ]);
    return rememberIdentity(id, nextIdentity);
  }

  function beginNewEntry(message = "") {
    const remembered = selectIdentity(id, null);
    writeStored(`schedule:draft:${id}`, null);
    setIdentity(null);
    setName("");
    setEmail("");
    setSavedName("");
    setSavedEmail("");
    setSlots([]);
    setSavedSlots([]);
    setEnteredName(false);
    setMode("edit");
    setError("");
    setSuccess(
      remembered
        ? message
        : `${message} This browser can’t remember the current entry. Save before leaving.`.trim()
    );
    requestAnimationFrame(() => nameInput.current?.focus());
  }

  function addAnotherPerson() {
    if (savingRef.current || switching) return;
    if (hasUnsavedChanges) {
      setMode("edit");
      save({ addAnother: true });
    } else beginNewEntry();
  }

  async function editPerson(person, fromNameForm = false) {
    if (savingRef.current || switching) return;
    if (person.id === identity?.id) {
      setMode("edit");
      setSuccess("");
      return;
    }
    const matchingNameForm =
      fromNameForm && !identity && !enteredName && !slots.length;
    const enteredEmail = matchingNameForm && email.trim() ? email.trim() : null;
    if (hasUnsavedChanges && !matchingNameForm) {
      setError("Save the current entry before switching to another person.");
      setMode("edit");
      return;
    }
    const knownIdentity =
      managedIdentities.find((item) => item.id === person.id) ||
      rememberedIdentities(id).find((item) => item.id === person.id);
    if (!knownIdentity) {
      setEditingParticipant(person);
      setEditingEmail(enteredEmail);
      setEditError("");
      setError("");
      return;
    }
    setSwitching(true);
    savingRef.current = true;
    refreshGeneration.current += 1;
    setError("");
    try {
      const latest = await getEvent(id);
      const participant = latest.participants.find(
        (item) => item.id === person.id
      );
      if (!participant) throw new Error("This entry could not be found.");
      const remembered = retainIdentity(knownIdentity);
      setEvent(latest);
      setIdentity(knownIdentity);
      setName(participant.name);
      setEmail(enteredEmail ?? participant.email ?? "");
      setSlots(participant.slots);
      setSavedName(participant.name);
      setSavedEmail(participant.email || "");
      setSavedSlots(participant.slots);
      setEnteredName(true);
      setMode("edit");
      setSuccess(
        `${participant.name}’s saved times are ready to update.${
          remembered ? "" : " This browser won’t remember the current entry."
        }`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      savingRef.current = false;
      setSwitching(false);
    }
  }

  function continueToTimes(e) {
    e.preventDefault();
    if (savingRef.current || switching) return;
    if (!name.trim()) {
      setError("Enter a name to continue.");
      return;
    }
    const existingParticipant = event.participants.find(
      (person) =>
        person.name
          .normalize("NFKC")
          .replace(/\s+/g, " ")
          .toLocaleLowerCase("en-US") ===
          name
            .trim()
            .normalize("NFKC")
            .replace(/\s+/g, " ")
            .toLocaleLowerCase("en-US") && person.id !== identity?.id
    );
    if (existingParticipant) {
      editPerson(existingParticipant, true);
      return;
    }
    setName(name.trim());
    setEmail(email.trim());
    setEnteredName(true);
    setError("");
  }

  async function reclaimResponse(typedName) {
    if (savingRef.current || switching || !editingParticipant) return;
    if (isDirty && identity?.id !== editingParticipant.id) {
      setEditError(
        "Save your current changes before switching to another name."
      );
      return;
    }
    const keepDraft = isDirty && identity?.id === editingParticipant.id;
    setSwitching(true);
    savingRef.current = true;
    refreshGeneration.current += 1;
    setEditError("");
    try {
      const result = await requestEditAccess(
        id,
        editingParticipant.id,
        typedName
      );
      const nextIdentity = {
        id: result.participant.id,
        editToken: result.editToken,
      };
      const remembered = retainIdentity(nextIdentity);
      setIdentity(nextIdentity);
      if (!keepDraft) {
        setName(result.participant.name);
        setEmail(editingEmail ?? result.participant.email ?? "");
        setSlots(result.participant.slots);
      }
      setSavedName(result.participant.name);
      setSavedEmail(result.participant.email || "");
      setSavedSlots(result.participant.slots);
      setEnteredName(true);
      setMode("edit");
      setError("");
      setSuccess(
        remembered
          ? `${result.participant.name}’s entry is ready. ${
              keepDraft
                ? "Your unsaved changes are still here."
                : "Your saved times are ready to update."
            }`
          : `Welcome back, ${result.participant.name}. Your times are ready to update. This browser won't remember you, but you can always choose your name again.`
      );
      setEditingParticipant(null);
      setEditingEmail(null);
    } catch (err) {
      setEditError(err.message);
    } finally {
      savingRef.current = false;
      setSwitching(false);
    }
  }

  async function save({ addAnother = false } = {}) {
    if (savingRef.current) return false;
    savingRef.current = true;
    refreshGeneration.current += 1;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await saveResponse(
        id,
        { name, email: email.trim(), slots },
        identity
      );
      let storageSaved = true;
      if (result.editToken) {
        const nextIdentity = {
          id: result.participant.id,
          editToken: result.editToken,
        };
        setIdentity(nextIdentity);
        storageSaved = retainIdentity(nextIdentity);
      }
      setEvent((current) => ({
        ...current,
        participants: [
          ...current.participants.filter(
            (person) => person.id !== result.participant.id
          ),
          result.participant,
        ],
      }));
      setSavedSlots(result.participant.slots);
      setSavedName(result.participant.name);
      setSavedEmail(result.participant.email || "");
      setSlots(result.participant.slots);
      setName(result.participant.name);
      setEmail(result.participant.email || "");
      const message = `${result.participant.name}’s availability is saved.${
        storageSaved
          ? ""
          : " This browser won’t remember this entry; choose the name in the group when you return."
      }`;
      if (addAnother) beginNewEntry(`${message} Add the next person below.`);
      else {
        setSuccess(message);
        setMode("group");
      }
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!event)
    return (
      <div className="schedule-loading">
        <Icon name="calendar" size={32} />
        {error ? (
          <>
            <h1>We couldn’t open this event</h1>
            <ErrorMessage>{error}</ErrorMessage>
            <button
              className="schedule-button schedule-secondary"
              onClick={() => setReload((n) => n + 1)}
            >
              Try again
            </button>
            <Link to="/schedule">Create a new event</Link>
          </>
        ) : (
          <p role="status">Opening your event…</p>
        )}
      </div>
    );

  return (
    <>
      <Link className="schedule-back" to="/schedule">
        <Icon name="back" size={16} />
        Schedule
      </Link>
      <div className="schedule-page-heading schedule-event-heading">
        <div>
          <h1>{event.title}</h1>
          {event.description && (
            <p className="schedule-event-description">{event.description}</p>
          )}
          <div className="schedule-event-meta">
            <span>
              <Icon name="calendar" size={16} />
              {visibleDateCount} possible{" "}
              {visibleDateCount === 1 ? "date" : "dates"}
            </span>
            <span>
              <Icon name="clock" size={16} />
              {durationLabel(event.duration)}
            </span>
            <span>
              <Icon name="globe" size={16} />
              {zoneLabel(displayTimezone)}
            </span>
          </div>
        </div>
        <Link className="schedule-button schedule-secondary" to="/schedule">
          <Icon name="plus" size={16} />
          New event
        </Link>
      </div>
      <ShareLink eventId={id} />
      <div className="schedule-view-timezone">
        <label htmlFor="display-timezone">
          <Icon name="globe" size={16} /> Your time zone
        </label>
        <select
          id="display-timezone"
          value={displayTimezone}
          onChange={(e) => {
            setDisplayTimezone(e.target.value);
            writeStored("schedule:display-timezone", e.target.value);
          }}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zoneLabel(zone)}
            </option>
          ))}
        </select>
        <span>Defaults to your device’s time zone. Change it anytime.</span>
      </div>
      <div
        className="schedule-view-tabs"
        role="tablist"
        aria-label="Availability views"
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
            return;
          e.preventDefault();
          const next =
            e.key === "Home"
              ? "edit"
              : e.key === "End"
              ? "group"
              : mode === "edit"
              ? "group"
              : "edit";
          setMode(next);
          e.currentTarget
            .querySelector(next === "edit" ? "#personal-tab" : "#group-tab")
            .focus();
        }}
      >
        <button
          id="personal-tab"
          role="tab"
          aria-selected={mode === "edit"}
          tabIndex={mode === "edit" ? 0 : -1}
          aria-controls="personal-panel"
          onClick={() => setMode("edit")}
        >
          Your availability
        </button>
        <button
          id="group-tab"
          role="tab"
          aria-selected={mode === "group"}
          tabIndex={mode === "group" ? 0 : -1}
          aria-controls="group-panel"
          onClick={() => setMode("group")}
        >
          Group availability <span>{event.participants.length}</span>
        </button>
        <small>Updates automatically</small>
      </div>
      {success && (
        <div className="schedule-success" role="status">
          <Icon name="check" size={18} />
          {success}
        </div>
      )}
      <ErrorMessage>{error || refreshError}</ErrorMessage>
      {mode === "edit" ? (
        <div id="personal-panel" role="tabpanel" aria-labelledby="personal-tab">
          <div className="schedule-response-steps">
            <span className={!enteredName ? "is-active" : "is-complete"}>
              <i>{enteredName ? <Icon name="check" size={13} /> : "1"}</i>Name
            </span>
            <div />
            <span className={enteredName ? "is-active" : ""}>
              <i>2</i>Select times
            </span>
          </div>
          {!enteredName ? (
            <section className="schedule-card schedule-name-card">
              <div className="schedule-name-form">
                <span className="schedule-name-icon">
                  <Icon name="person" size={25} />
                </span>
                <h2>
                  {identity
                    ? `Details for ${savedName}`
                    : "Who are you adding?"}
                </h2>
                <p>Add yourself or someone whose schedule you manage.</p>
                <form onSubmit={continueToTimes}>
                  <label className="schedule-label" htmlFor="participant-name">
                    Name
                  </label>
                  <input
                    ref={nameInput}
                    id="participant-name"
                    className="schedule-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    maxLength={60}
                    autoComplete="name"
                    required
                    disabled={saving || switching}
                  />
                  <label className="schedule-label" htmlFor="participant-email">
                    Email <small>optional, recommended</small>
                  </label>
                  <input
                    id="participant-email"
                    type="email"
                    className="schedule-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    maxLength={254}
                    autoComplete="email"
                    aria-describedby="participant-email-help"
                    disabled={saving || switching}
                  />
                  <p
                    className="schedule-email-help"
                    id="participant-email-help"
                  >
                    Add an email so the group can send a calendar invite. Shared
                    with people who have this event link.
                  </p>
                  <button
                    className="schedule-button schedule-primary"
                    type="submit"
                    disabled={saving || switching}
                  >
                    Select times
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
                {event.participants.length > 0 && (
                  <button
                    className="schedule-returning-link"
                    type="button"
                    onClick={() => setMode("group")}
                  >
                    Already added? Find the name in the group{" "}
                    <Icon name="arrow" size={14} />
                  </button>
                )}
              </div>
              <div className="schedule-name-guide">
                <div className="schedule-mini-grid" aria-hidden="true">
                  {Array.from({ length: 28 }, (_, i) => (
                    <i
                      key={i}
                      className={
                        [2, 3, 4, 9, 10, 11, 16, 17, 18].includes(i)
                          ? "is-painted"
                          : ""
                      }
                    />
                  ))}
                </div>
                <h3>Availability, at a glance.</h3>
                <p>
                  Paint the times that work for this person.
                  <br />
                  We’ll find the overlap with everyone else.
                </p>
                <span>
                  <Icon name="check" size={14} />
                  One entry per person. Add as many as you need.
                </span>
              </div>
            </section>
          ) : (
            <section className="schedule-card schedule-grid-card">
              <div className="schedule-grid-heading">
                <div>
                  <h2>Availability for {name}</h2>
                  <p>
                    Click or drag across the grid to add times. Select them
                    again to clear.
                  </p>
                </div>
                <button
                  type="button"
                  className="schedule-text-button"
                  disabled={saving || switching}
                  onClick={() => {
                    setEnteredName(false);
                    setSuccess("");
                  }}
                >
                  Edit details
                </button>
              </div>
              <div className="schedule-grid-meta">
                <span>
                  <Icon name="globe" size={15} />
                  All times in {zoneLabel(displayTimezone)}
                </span>
                <div className="schedule-edit-tools">
                  <button
                    className="schedule-text-button"
                    onClick={() =>
                      setSlots(buildSlots(event).map((slot) => slot.key))
                    }
                    disabled={saving || switching}
                  >
                    Select all
                  </button>
                  <button
                    className="schedule-text-button"
                    onClick={() => setSlots([])}
                    disabled={saving || switching || !slots.length}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <fieldset
                disabled={saving || switching}
                className="schedule-grid-fieldset"
              >
                <AvailabilityGrid
                  displayTimezone={displayTimezone}
                  event={event}
                  selectedSlots={slots}
                  onChange={setSlots}
                  mode="edit"
                />
              </fieldset>
              <div className="schedule-save-bar">
                <div>
                  <span className="schedule-selection-dot" />
                  <strong>
                    {slots.length
                      ? `${durationLabel(
                          slots.length * (event.slotMinutes || 30)
                        )} selected`
                      : "No times selected"}
                  </strong>
                  <small>
                    {isDirty
                      ? "Unsaved changes"
                      : identity
                      ? "Your response is saved"
                      : "You can also save with no availability"}
                  </small>
                </div>
                <div className="schedule-save-actions">
                  <button
                    className="schedule-button schedule-primary"
                    onClick={() => save()}
                    disabled={saving || switching}
                  >
                    {saving
                      ? "Saving…"
                      : identity
                      ? "Update availability"
                      : "Save availability"}
                    <Icon name="check" size={18} />
                  </button>
                  <button
                    type="button"
                    className="schedule-button schedule-secondary"
                    onClick={addAnotherPerson}
                    disabled={saving || switching}
                  >
                    <Icon name="plus" size={16} />
                    {hasUnsavedChanges
                      ? "Save & add another"
                      : "Add another person"}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div id="group-panel" role="tabpanel" aria-labelledby="group-tab">
          <GroupResults
            event={event}
            displayTimezone={displayTimezone}
            editingDisabled={saving || switching}
            onEditPerson={editPerson}
            onAddPerson={addAnotherPerson}
            hasCurrentEntry={Boolean(identity || enteredName)}
            hasUnsavedChanges={hasUnsavedChanges}
            onEdit={() => {
              setMode("edit");
              setSuccess("");
            }}
          />
        </div>
      )}
      <EditResponseDialog
        participant={editingParticipant}
        busy={switching}
        error={editError}
        onConfirm={reclaimResponse}
        onClose={() => {
          if (!switching) {
            setEditingParticipant(null);
            setEditingEmail(null);
          }
        }}
      />
    </>
  );
}

export default function Schedule() {
  const { eventId } = useParams();
  return (
    <div className="schedule-shell">
      <Header />
      <main className="schedule-main">
        {eventId ? (
          <EventSchedule id={eventId} key={eventId} />
        ) : (
          <CreateSchedule />
        )}
        <footer className="schedule-footer">
          <span>Make room for time together.</span>
          <Link to="/privacy">Privacy Policy</Link>
        </footer>
      </main>
    </div>
  );
}
