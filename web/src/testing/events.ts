export function inputEvent(value: string): Event {
  const input = document.createElement('input');
  input.value = value;
  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);
  return event;
}

export function fileInputEvent(file?: Partial<Pick<File, 'name' | 'size' | 'text'>>): Event {
  const input = document.createElement('input');
  input.value = 'old';
  const files: File[] = [];
  if (file) {
    const upload = new File([], file.name ?? 'scenario.txt');
    if (file.size !== undefined) Object.defineProperty(upload, 'size', { value: file.size });
    if (file.text) Object.defineProperty(upload, 'text', { value: file.text });
    files.push(upload);
  }
  Object.defineProperty(input, 'files', { value: files });
  const event = new Event('change', { bubbles: true });
  input.dispatchEvent(event);
  return event;
}
