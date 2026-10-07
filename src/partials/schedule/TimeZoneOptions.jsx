import React, { useMemo } from "react";
import { getTimeZoneGroups } from "../../utils/scheduleTimezones.mjs";

export default function TimeZoneOptions({ selectedZone, detectedZone }) {
  const groups = useMemo(
    () => getTimeZoneGroups([selectedZone, detectedZone]),
    [selectedZone, detectedZone]
  );
  return groups.map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.options.map((zone) => (
        <option key={zone.value} value={zone.value}>
          {zone.label}
        </option>
      ))}
    </optgroup>
  ));
}
