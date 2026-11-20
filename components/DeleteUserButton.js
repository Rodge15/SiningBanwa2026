"use client";

export function DeleteUserButton({ label = "Delete this account" }) {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm("Delete this account permanently? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
    >
      {label}
    </button>
  );
}