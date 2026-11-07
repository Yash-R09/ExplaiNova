const studioPaths = ['/projects', '/create', '/publishing', '/connections', '/settings'];
export function isStudioPath(path: string) {
  return studioPaths.some(base => path === base || path.startsWith(base + '/'));
}
export function safeReturnTo(value: unknown): string {
  return typeof value === 'string' && studioPaths.includes(value) ? value : '/projects';
}
