// Tablet range (md–lg, 768–1023px) defaults the sidebar to icon-only;
// desktop (lg+) defaults to fully expanded. Used only as a lazy useState
// initializer — the user's manual toggle wins after that.
export function getDefaultSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  const width = window.innerWidth;
  return width >= 768 && width < 1024;
}
