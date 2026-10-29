import { parse } from 'yaml';

export function read(text: string): void {
  parse(text);
}
