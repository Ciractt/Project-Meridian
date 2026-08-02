export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24">
      <p className="text-sm font-medium text-accent">
        404
      </p>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
        This page isn’t here.
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        The link may be out of date. Start a new search from the home page.
      </p>
      <a
        href="/"
        className="mt-8 inline-block rounded-control bg-ink px-5 py-3 text-sm font-medium text-white"
      >
        Search flights
      </a>
    </div>
  );
}
