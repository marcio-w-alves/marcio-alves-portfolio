import { describe, expect, it } from 'vitest';
import { knowledge } from './site-knowledge';
import { personStructuredData, serializeStructuredData } from './structured-data';

describe('personStructuredData', () => {
  const person = personStructuredData(new URL('https://marciomariani.dev'));

  it('describes Marcio from the record, at the canonical address', () => {
    expect(person).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Marcio Alves',
      jobTitle: 'Staff-level Frontend Engineer',
      url: 'https://marciomariani.dev/',
      sameAs: [
        'https://www.linkedin.com/in/marcio-montenegro',
        'https://github.com/marcio-w-alves',
      ],
    });
  });

  it('knows about a skill from every group of the record', () => {
    expect(person.knowsAbout).toEqual(
      expect.arrayContaining(['React', 'State Management', 'Accessibility', 'Mentoring', 'AWS']),
    );
  });

  it('does not claim coursework as expertise', () => {
    const courses = knowledge.certifications.map(({ name }) => name);

    expect(person.knowsAbout).not.toContain('AngularJS');
    expect(person.knowsAbout.some((topic) => courses.includes(topic))).toBe(false);
  });
});

describe('serializeStructuredData', () => {
  it('cannot close the script tag it is written into', () => {
    const hostile = { name: '</script><script>alert(1)</script>' };

    const serialized = serializeStructuredData(hostile);

    expect(serialized).not.toContain('</script>');
    expect(JSON.parse(serialized)).toEqual(hostile);
  });
});
