import React, { useEffect, useId, useRef, useState } from "react";
import {
  appendInviteEmails,
  formatInviteEmails,
  getInviteEmails,
  makeMeetingMessage,
} from "../../utils/scheduleMessages.mjs";
import "../../css/schedule-message.css";

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

function useEmailSeparator(value, onChange) {
  const [local, setLocal] = useState("comma");
  const separator = (value ?? local) === "newline" ? "newline" : "comma";
  return [
    separator,
    (next) => {
      setLocal(next);
      onChange?.(next);
    },
  ];
}

function CopyOptions({ children, label = "Copy options" }) {
  return (
    <details
      className="schedule-message-options"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.currentTarget.open = false;
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={label} title={label}>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="schedule-message-options-panel">{children}</div>
    </details>
  );
}

function SeparatorSelect({ value, onChange }) {
  return (
    <label>
      Email format
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="comma">Comma-separated</option>
        <option value="newline">One per line</option>
      </select>
    </label>
  );
}

function CopyFallback({ text, label }) {
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [text]);
  return (
    <div className="schedule-message-fallback">
      <p>Copy the selected text using your device’s copy command.</p>
      <textarea
        ref={input}
        readOnly
        value={text}
        aria-label={label}
        rows={4}
        onFocus={(event) => event.target.select()}
      />
    </div>
  );
}

function MessageDraft({
  event,
  meeting,
  timezone,
  emailSeparator,
  onEmailSeparatorChange,
}) {
  // null means untouched: fresh counts update the default without replacing edits.
  const [editedMessage, setEditedMessage] = useState(null);
  const message = editedMessage ?? makeMeetingMessage(event, meeting, timezone);
  const [separator, setSeparator] = useEmailSeparator(
    emailSeparator,
    onEmailSeparatorChange
  );
  const [copyMode, setCopyMode] = useState("message");
  const [feedback, setFeedback] = useState("");
  const [fallback, setFallback] = useState(null);
  const [copying, setCopying] = useState(false);
  const inputRef = useRef(null);
  const inputId = useId();
  const emailCount = getInviteEmails(event.participants).length;
  useEffect(() => {
    setFeedback("");
    setFallback(null);
  }, [message, separator, copyMode]);

  async function copy() {
    if (copying || !message.trim()) return;
    setCopying(true);
    setFeedback("");
    setFallback(null);
    const includesEmails = copyMode === "emails" && emailCount > 0;
    const text = includesEmails
      ? appendInviteEmails(message, event.participants, separator)
      : message;
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(
        includesEmails ? "Message and emails copied." : "Message copied."
      );
    } catch {
      if (includesEmails) setFallback(text);
      else {
        inputRef.current?.focus();
        inputRef.current?.select();
        setFeedback("Message selected. Use your device’s copy command.");
      }
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="schedule-meeting-message">
      <label htmlFor={inputId} className="schedule-message-label">
        Invitation message
      </label>
      <textarea
        id={inputId}
        ref={inputRef}
        className="schedule-message-draft"
        value={message}
        onChange={(event) => setEditedMessage(event.target.value)}
        rows={7}
      />
      <div className="schedule-message-copybar">
        <button
          type="button"
          className="schedule-message-copy"
          onClick={copy}
          disabled={copying || !message.trim()}
        >
          <CopyIcon />
          {copying
            ? "Copying…"
            : copyMode === "emails" && emailCount
            ? "Copy message + emails"
            : "Copy message"}
        </button>
        <CopyOptions>
          <label>
            Copy
            <select
              value={copyMode}
              onChange={(event) => setCopyMode(event.target.value)}
            >
              <option value="message">Message only</option>
              <option value="emails" disabled={!emailCount}>
                Message + emails
              </option>
            </select>
          </label>
          <SeparatorSelect value={separator} onChange={setSeparator} />
          <p>
            {emailCount
              ? `Includes all ${emailCount} submitted ${
                  emailCount === 1 ? "email address" : "email addresses"
                }.`
              : "No email addresses added yet."}
          </p>
        </CopyOptions>
      </div>
      {feedback && (
        <p className="schedule-message-feedback" role="status">
          {feedback}
        </p>
      )}
      {fallback && (
        <CopyFallback text={fallback} label="Message and emails to copy" />
      )}
    </div>
  );
}

export default function MeetingMessage(props) {
  if (!props.meeting) return null;
  const key = `${props.event.id || ""}|${
    props.meeting.instant ?? `${props.meeting.date}@${props.meeting.startTime}`
  }|${props.timezone}`;
  return <MessageDraft key={key} {...props} />;
}

export function EmailCopyButton({
  participants = [],
  separator: controlledSeparator,
  onSeparatorChange,
}) {
  const [separator, setSeparator] = useEmailSeparator(
    controlledSeparator,
    onSeparatorChange
  );
  const [feedback, setFeedback] = useState("");
  const [fallback, setFallback] = useState(null);
  const [copying, setCopying] = useState(false);
  const text = formatInviteEmails(participants, separator);
  const count = getInviteEmails(participants).length;
  useEffect(() => {
    setFeedback("");
    setFallback(null);
  }, [text]);

  async function copy() {
    if (copying || !text) return;
    setCopying(true);
    setFeedback("");
    setFallback(null);
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(
        `${count} ${count === 1 ? "email copied" : "emails copied"}.`
      );
    } catch {
      setFallback(text);
    } finally {
      setCopying(false);
    }
  }

  if (!count) return null;
  return (
    <div className="schedule-email-copy">
      <div className="schedule-message-copybar">
        <button
          type="button"
          className="schedule-message-copy schedule-email-copy-button"
          onClick={copy}
          disabled={copying}
          aria-label={`Copy all ${count} email addresses`}
          title="Copy all email addresses"
        >
          <CopyIcon />
        </button>
        <CopyOptions label="Email copy options">
          <SeparatorSelect value={separator} onChange={setSeparator} />
          <p>
            Copy all {count} submitted{" "}
            {count === 1 ? "email address" : "email addresses"}.
          </p>
        </CopyOptions>
      </div>
      {feedback && (
        <p className="schedule-message-feedback" role="status">
          {feedback}
        </p>
      )}
      {fallback && (
        <CopyFallback text={fallback} label="Email addresses to copy" />
      )}
    </div>
  );
}
