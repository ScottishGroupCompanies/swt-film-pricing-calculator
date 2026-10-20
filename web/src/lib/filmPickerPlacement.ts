// Places the film picker so the panel stays inside the viewport.
// The list scrolls inside the panel; the search box and brand chips stay put.

export interface FilmPickerPlacement {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 6;
const VIEWPORT_PAD = 12;
const PREFERRED_MAX = 520;
const MIN_USEFUL = 280;
const MIN_HEIGHT = 160;

export function placeFilmPicker(args: {
  trigger: { top: number; bottom: number; left: number };
  viewportWidth: number;
  viewportHeight: number;
  isMobile: boolean;
}): FilmPickerPlacement {
  const { trigger, viewportWidth, viewportHeight, isMobile } = args;
  const dropdownWidth = isMobile ? Math.min(viewportWidth - 24, 420) : 580;

  let left = isMobile ? 12 : trigger.left;
  if (left + dropdownWidth > viewportWidth - VIEWPORT_PAD) {
    left = viewportWidth - dropdownWidth - VIEWPORT_PAD;
  }
  if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

  const spaceBelow = viewportHeight - trigger.bottom - GAP - VIEWPORT_PAD;
  const spaceAbove = trigger.top - GAP - VIEWPORT_PAD;
  const openUp = spaceBelow < MIN_USEFUL && spaceAbove > spaceBelow;
  const available = Math.max(MIN_HEIGHT, openUp ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(PREFERRED_MAX, Math.max(0, available));

  if (openUp) {
    return {
      bottom: Math.max(VIEWPORT_PAD, viewportHeight - trigger.top + GAP),
      left,
      width: dropdownWidth,
      maxHeight,
    };
  }

  const top = Math.max(VIEWPORT_PAD, trigger.bottom + GAP);
  return { top, left, width: dropdownWidth, maxHeight };
}
