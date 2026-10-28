import { notFound } from 'next/navigation';

/** Any address under a language that names no page: its not-found page, with a 404. */
export default function UnknownPage(): never {
  notFound();
}
