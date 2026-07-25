import "@testing-library/jest-dom";

// jsdom doesn't implement scrollIntoView — the packages form calls it after
// opening, so stub it out to avoid crashing effect-driven tests.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
