"use client";

import { useState } from "react";
import { fieldClass } from "@/components/formStyles";

export function AdmissionFields({ event }) {
  const [admissionType, setAdmissionType] = useState(event?.admission_type || "seated");

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="admissionType" className="text-sm font-medium">
          Admission
        </label>
        <select
          id="admissionType"
          name="admissionType"
          value={admissionType}
          onChange={(event) => setAdmissionType(event.target.value)}
          className={fieldClass}
        >
          <option value="seated">Seated event</option>
          <option value="general">General admission</option>
        </select>
        <p className="mt-1 text-xs text-muted">
          Seated events use the seat map. General admission has no seat map. Customers reserve a number of tickets.
        </p>
      </div>
      <div>
        <label htmlFor="audienceCapacity" className="text-sm font-medium">
          Audience capacity
        </label>
        <input
          id="audienceCapacity"
          name="audienceCapacity"
          inputMode="numeric"
          required
          min={1}
          max={2000}
          defaultValue={event?.audience_capacity || 80}
          className={fieldClass}
        />
      </div>
      {admissionType === "general" ? (
        <div>
          <label htmlFor="ticketPrice" className="text-sm font-medium">
            Ticket price (PHP)
          </label>
          <input
            id="ticketPrice"
            name="ticketPrice"
            inputMode="decimal"
            required
            min={0}
            defaultValue={event?.ticket_price ?? ""}
            className={fieldClass}
          />
        </div>
      ) : null}
    </div>
  );
}
