// Places the film picker so the entire panel is inside the viewport on every open.
// Height and width are explicit: the box cannot grow with its content.
// The film list scrolls inside the panel. Opening the picker does not scroll the page.

export interface FilmPickerPlacement {
  top: number;
  left: number;
  width: number;
  height: number;
  /** Centered when the trigger is off-screen or neither side can hold a panel. */
  centered: boolean;
}

const GAP = 6;
const VIEWPORT_PAD = 12;
const PREFERRED_HEIGHT = 480;
const PREFERRED_WIDTH = 580;
const MIN_ATTACHED_HEIGHT = 160;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function placeFilmPicker(args: {
  trigger: { top: number; bottom: number; left: number };
  viewportWidth: number;
  viewportHeight: number;
  isMobile: boolean;
}): FilmPickerPlacement {
  const { trigger, viewportWidth, viewportHeight, isMobile } = args;
  const maxWidth = Math.max(0, viewportWidth - VIEWPORT_PAD * 2);
  const maxHeight = Math.max(0, viewportHeight - VIEWPORT_PAD * 2);
  const width = Math.min(isMobile ? Math.min(420, maxWidth) : PREFERRED_WIDTH, maxWidth);

  const spaceBelow = viewportHeight - trigger.bottom - GAP - VIEWPORT_PAD;
  const spaceAbove = trigger.top - GAP - VIEWPORT_PAD;
  const triggerInView = trigger.bottom > VIEWPORT_PAD && trigger.top < viewportHeight - VIEWPORT_PAD;
  const canAttach = triggerInView && Math.max(spaceBelow, spaceAbove) >= MIN_ATTACHED_HEIGHT;

  let top: number;
  let left: number;
  let height: number;
  let centered = false;

  if (canAttach && spaceBelow >= spaceAbove) {
    height = Math.min(PREFERRED_HEIGHT, spaceBelow, maxHeight);
    top = trigger.bottom + GAP;
    left = isMobile ? VIEWPORT_PAD : trigger.left;
  } else if (canAttach) {
    height = Math.min(PREFERRED_HEIGHT, spaceAbove, maxHeight);
    top = trigger.top - GAP - height;
    left = isMobile ? VIEWPORT_PAD : trigger.left;
  } else {
    centered = true;
    height = Math.min(PREFERRED_HEIGHT, maxHeight);
    top = (viewportHeight - height) / 2;
    left = (viewportWidth - width) / 2;
  }

  // Shrink first, then slide. Clamping position alone would push the far edge
  // back outside the viewport.
  height = Math.min(Math.max(0, height), maxHeight);
  const fittedWidth = Math.min(Math.max(0, width), maxWidth);
  left = clamp(left, VIEWPORT_PAD, viewportWidth - VIEWPORT_PAD - fittedWidth);
  top = clamp(top, VIEWPORT_PAD, viewportHeight - VIEWPORT_PAD - height);

  return {
    top: Math.round(top),
    left: Math.round(left),
    width: Math.round(fittedWidth),
    height: Math.round(height),
    centered,
  };
}
