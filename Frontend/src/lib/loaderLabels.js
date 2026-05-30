/** Dynamic loader copy from the current route. */
export function getLoaderPageLabel(pathname = "") {
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";

  if (/\/incidents\/[^/]+/.test(path)) {
    return "Opening Incident…";
  }
  if (path.endsWith("/incidents")) {
    return "Opening Incidents…";
  }
  if (path.includes("/dashboard")) {
    return "Opening Dashboard…";
  }
  if (path.includes("/status")) {
    return "Opening Status Page…";
  }
  if (path.includes("/team")) {
    return "Opening Team…";
  }
  if (path.includes("/company")) {
    return "Opening Company…";
  }
  if (path.includes("/profile")) {
    return "Opening Profile…";
  }
  if (path.includes("/login")) {
    return "Opening Login…";
  }
  if (path.includes("/signup")) {
    return "Opening Sign Up…";
  }

  return "Loading…";
}
