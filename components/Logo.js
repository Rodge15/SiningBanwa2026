// The Sining Banwa logo. Put the image file at public/main-logo.jpg so it is
// served at /main-logo.jpg. It is cropped to a circle, which hides the square
// corners of the source image.
export function Logo({ size = 36, withWordmark = true, subtitle = "Albay arts events" }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/main-logo.jpg"
        alt="Sining Banwa logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover ring-1 ring-line"
      />
      {withWordmark ? (
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-semibold text-brand">Sining Banwa</span>
          {subtitle ? <span className="text-xs text-muted">{subtitle}</span> : null}
        </span>
      ) : null}
    </span>
  );
}