import { AdmissionFields } from "@/components/AdmissionFields";
import { buttonClass, fieldClass } from "@/components/formStyles";
import { toManilaInputValue } from "@/lib/eventRules";

export function EventForm({ action, event, submitLabel }) {
  return (
    <form action={action} className="space-y-4">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <div>
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          minLength={3}
          maxLength={120}
          defaultValue={event?.title || ""}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={1}
          maxLength={5000}
          rows={6}
          defaultValue={event?.description || ""}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="venue" className="text-sm font-medium">
          Venue
        </label>
        <input
          id="venue"
          name="venue"
          required
          minLength={2}
          maxLength={200}
          defaultValue={event?.venue || ""}
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="startsAt" className="text-sm font-medium">
          Start date and time (Philippine time)
        </label>
        <input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          required
          defaultValue={event ? toManilaInputValue(event.starts_at) : ""}
          className={fieldClass}
        />
      </div>
      <AdmissionFields event={event} />
      <div>
        <label htmlFor="poster" className="text-sm font-medium">
          Poster (optional JPG, PNG, or WebP, up to 5 MiB)
        </label>
        <input
          id="poster"
          name="poster"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={fieldClass}
        />
      </div>
      {event?.poster_path ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="removePoster" />
          Remove the current poster
        </label>
      ) : null}
      <button type="submit" className={buttonClass}>
        {submitLabel}
      </button>
    </form>
  );
}
