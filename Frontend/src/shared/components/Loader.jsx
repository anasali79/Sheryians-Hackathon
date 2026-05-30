import { useLocation } from "react-router";
import { SiOpslevel } from "react-icons/si";
import { getLoaderPageLabel } from "../../lib/loaderLabels";

const Loader = ({ label, description, compact = false }) => {
  const { pathname } = useLocation();
  const displayLabel = label ?? getLoaderPageLabel(pathname);

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-2.5 text-text-muted"
        role="status"
        aria-live="polite"
        aria-label={displayLabel}>
        <span className="relative flex h-6 w-6 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <SiOpslevel className="relative text-[10px] text-primary" aria-hidden />
        </span>
        <span className="text-xs font-semibold">{displayLabel}</span>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-full w-full flex-1 items-center justify-center px-4"
      role="status"
      aria-live="polite"
      aria-label={displayLabel}>
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <span className="relative flex h-11 w-11 items-center justify-center">
          <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-bg-surface border border-border">
            <SiOpslevel className="text-base text-primary" aria-hidden />
          </span>
        </span>

        <div>
          <p className="text-sm font-bold text-text">{displayLabel}</p>
          {description && (
            <p className="mt-1 text-xs text-text-muted max-w-[220px]">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Loader;
