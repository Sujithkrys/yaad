/** Row of 16 small segments, the first `on` filled with blue. */
export function StatBar({ on, segments = 16 }: { on: number; segments?: number }) {
  return (
    <div className="bar" aria-hidden="true">
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} className={i < on ? "on" : undefined} />
      ))}
    </div>
  );
}
