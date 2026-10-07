import React, { useId, useRef, useState } from "react";
import { Dialog } from "@headlessui/react";
import Icon from "./Icon";
import "../../css/schedule-edit-dialog.css";

function tidyName(name) {
  return name.normalize("NFKC").trim().replace(/\s+/gu, " ");
}

function EditResponseForm({
  participant,
  busy = false,
  error,
  onConfirm,
  onClose,
}) {
  const [name, setName] = useState("");
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
    if (!busy && matches) onConfirm(typedName);
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
          <span className="schedule-edit-dialog-icon">
            <Icon name="calendar" size={24} />
          </span>
          <Dialog.Title className="schedule-edit-dialog-title">
            A little schedule shuffle?
          </Dialog.Title>
          <Dialog.Description
            as="div"
            className="schedule-edit-dialog-description"
          >
            <p>
              To update this availability, retype the participant’s name below.
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
              A little calendar courtesy: edit your own times or those of
              someone who asked you to manage theirs.
            </p>
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
                className="schedule-edit-dialog-button schedule-edit-dialog-confirm"
                disabled={!matches || busy}
              >
                {busy ? "Opening times…" : "Edit these times"}
              </button>
            </div>
            <span className="schedule-edit-dialog-sr-only" role="status">
              {busy ? "Opening availability" : ""}
            </span>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

export default function EditResponseDialog(props) {
  if (!props.participant) return null;
  return (
    <EditResponseForm
      key={`${props.participant.id}:${props.participant.name}`}
      {...props}
    />
  );
}
