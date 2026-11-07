type LinkClick = {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
  stopPropagation(): void;
};

export function guardDraftLinkClick(event: LinkClick, confirmLeave: () => boolean) {
  // These gestures can open another tab/window or download without leaving us.
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (!confirmLeave()) {
    event.preventDefault();
    event.stopPropagation();
  }
  // Acceptance is not navigation completion. The editor clears its dirty flag
  // on unmount; keep unload protection if navigation is cancelled downstream.
}
