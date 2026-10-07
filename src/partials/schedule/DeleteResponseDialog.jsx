import React, { useId, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import Icon from "./Icon";
import "../../css/schedule-edit-dialog.css";
import "../../css/schedule-delete-dialog.css";

function tidyName(name) {
  return name.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function DeleteResponseForm({
  participant,
  busy = false,
  error,
  onConfirm,
  onClose,
}) {
  const [name, setName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const inputRef = useRef(null);
  const inputId = useId();
  const helpId = useId();
  const typedName = tidyName(name);
  const matches =
    Boolean(typedName) &&
    typedName.toLowerCase() === tidyName(participant.name).toLowerCase();

  function close() {
    if (!busy) onClose();
  }

  function submit(event) {
    event.preventDefault();
    if (!busy && matches && confirmed) onConfirm(typedName);
  }

  return (
    <Dialog
      open
      onClose={close}
      initialFocus={inputRef}
      className="schedule-edit-dialog"
    >
      <div className="schedule-edit-dialog-backdrop" aria-hidden="true" />
      <div className="schedule-edit-dialog-positioner">
        <Dialog.Panel className="schedule-edit-dialog-panel" tabIndex={-1}>
          <span className="schedule-edit-dialog-icon schedule-delete-dialog-icon">
            <Icon name="trash" size={24} />
          </span>
          <Dialog.Title className="schedule-edit-dialog-title">
            Delete this entry?
          </Dialog.Title>
          <Dialog.Description
            as="div"
            className="schedule-edit-dialog-description"
          >
            <p>
              This removes this person’s availability and email from the event.
              It can’t be undone.
            </p>
            <strong className="schedule-edit-dialog-name">
              {participant.name}
            </strong>
          </Dialog.Description>
          <form onSubmit={submit} aria-busy={busy}>
            <label className="schedule-edit-dialog-label" htmlFor={inputId}>
              Retype participant’s name
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="schedule-edit-dialog-input"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-describedby={helpId}
              required
            />
            <p id={helpId} className="schedule-edit-dialog-courtesy">
              Only delete your own entry or one someone asked you to manage.
            </p>
            <label className="schedule-delete-dialog-confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={busy}
                required
              />
              <span>
                I understand this permanently deletes {participant.name}’s
                availability and email from this event.
              </span>
            </label>
            {error && (
              <p className="schedule-edit-dialog-error" role="alert">
                {error}
              </p>
            )}
            <div className="schedule-edit-dialog-actions">
              <button
                type="button"
                className="schedule-edit-dialog-button schedule-edit-dialog-cancel"
                onClick={close}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="schedule-edit-dialog-button schedule-delete-dialog-submit"
                disabled={!matches || !confirmed || busy}
              >
                {busy ? "Deleting…" : "Delete entry"}
              </button>
            </div>
            <span className="schedule-edit-dialog-sr-only" role="status">
              {busy ? "Deleting entry" : ""}
            </span>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default function DeleteResponseDialog(props) {
  if (!props.participant) return null;
  return (
    <DeleteResponseForm
      key={`${props.participant.id}:${props.participant.name}`}
      {...props}
    />
  );
}
