import { describe, expect, it } from 'vitest';
import { answersFrom, say } from '@/testing/copy-answers';
import { textAnswer } from '@/testing/copy-variants';

/** Every way a template can be wrong is refused, saying what is wrong. */

describe('syntax', () => {
  it.each([
    ['an unknown escape', '{{"a\\q"}}', 'Unknown escape in a string'],
    ['an unclosed string', '{{"open}}', 'Unclosed string'],
    ['an unclosed comment', 'a {{! never closed', 'Unclosed tag: a comment needs its "}}"'],
    ['an unclosed tag', 'a {{first', 'Unclosed tag: missing "}}"'],
    ['a block without a name', '{{# if first}}', '"#" must be followed by a block name'],
    ['an unexpected character', '{{first @}}', 'Unexpected "@"'],
    ['two values in one tag', '{{first first}}', 'Unexpected "first"'],
    ['two strings in one tag', '{{"x" "y"}}', 'Unexpected the string "y"'],
    ['a filter left out', '{{first |}}', 'The tag ends too early'],
    ['an unclosed bracket', '{{role[first}}', 'Expected "]"'],
    ['a pipe for a path', '{{| first}}', 'Expected a path, found "|"'],
    ['a dot without a name', '{{role.|}}', 'Expected a name, found "|"'],
    [
      'a regular expression from the record',
      '{{first | replace first "x"}}',
      'A regular expression must be a string',
    ],
    ['a field that is not a name', '{{experience | map 3}}', 'A field must be a name'],
    [
      'a comparison with a path',
      '{{#if first == first}}x{{/if}}',
      'A comparison compares with a string',
    ],
    [
      'a separator that is not a string',
      '{{#each experience sep=3}}x{{/each}}',
      'sep= takes a string',
    ],
    ['an empty tag', '{{}}', 'An empty tag'],
    ['an unknown block', '{{#loop experience}}x{{/loop}}', 'Unknown block "#loop"'],
    ['a second else', '{{#if first}}a{{else}}b{{else}}c{{/if}}', '"else" outside an #if or #with'],
    ['an else-if in a #with', '{{#with first}}a{{else if first}}b{{/with}}', 'Unexpected "if"'],
  ])('refuses %s', (_case, template, problem) => {
    expect(() => say(template)).toThrow(problem);
  });

  it('refuses a condition written on its own that is more than one expression', () => {
    const twice = { ...textAnswer('Hi.'), parts: [{ text: 'Hi.', when: 'first first' }] };
    expect(() => answersFrom(twice, 'greeting')).toThrow(
      'answers/planted.yaml#greeting.parts[0].when:1:1: Unexpected "first"',
    );
    const closing = { ...textAnswer('Hi.'), parts: [{ text: 'Hi.', when: 'first }} {{ first' }] };
    expect(() => answersFrom(closing, 'greeting')).toThrow('Expected one expression');
  });

  it('trims across a tag and drops text trimmed to nothing', () => {
    expect(say('{{first}}{{~ first}}')).toBe('AdaAda');
    expect(say('a {{first}}   {{~ first}}')).toBe('a AdaAda');
  });
});

describe('misused values', () => {
  it.each([
    [
      'a list as a key',
      '{{role[role.acme.metrics]}}',
      '"role.acme.metrics" cannot be used as a key',
    ],
    ['a field of nothing', '{{role.acme.end.size}}', 'reads "size" of nothing'],
    ['a field of a string', '{{first.length}}', 'reads "length" of something that has no fields'],
    [
      'a list compared with a string',
      '{{#if role.acme.metrics == "x"}}y{{/if}}',
      'A list cannot be compared',
    ],
    ['a string iterated', '{{#each first}}x{{/each}}', 'A string cannot be iterated'],
    ['nothing iterated', '{{#each role.acme.end}}x{{/each}}', 'A missing value cannot be iterated'],
    ['nothing written', '{{role.acme.end}}', 'Nothing to write here'],
    ['a yes-or-no written', '{{role.acme.current}}', 'A boolean cannot be written as text'],
    ['the current item outside a block', '{{.}}', '"." is outside any block'],
  ])('refuses %s', (_case, template, problem) => {
    expect(() => say(template)).toThrow(problem);
  });

  it('compares a key that is not there as different from every string', () => {
    expect(say('{{#if practice.caseStudies[first] != "x"}}Y{{else}}N{{/if}}')).toBe('Y');
    expect(say('{{#if practice.caseStudies[first] == "x"}}Y{{else}}N{{/if}}')).toBe('N');
  });
});

describe('misused filters', () => {
  it.each([
    ['monthYear on words', '{{"May 2026" | monthYear}}', 'needs a date written YYYY or YYYY-MM'],
    ['monthYear on a number', '{{3 | monthYear}}', 'needs a string, got the number "3"'],
    ['list on objects', '{{experience | list}}', 'needs a string, got an object'],
    ['map on a missing field', '{{experience | map nickname}}', 'an item has no field "nickname"'],
    ['where on strings', '{{languages | map name | where name}}', 'needs a list of objects'],
    ['count on a string', '{{first | count}}', 'needs a list of objects'],
    ['first on a string', '{{first | first}}', 'needs a list'],
    ['replace with a number', '{{first | replace "A" 3}}', 'needs a string'],
    ['words on nothing', '{{role.acme.end | words}}', 'needs a whole number, got nothing'],
    ['words on a list', '{{experience | words}}', 'needs a whole number, got a list'],
    ['words on a yes-or-no', '{{role.acme.current | words}}', 'got the boolean "true"'],
  ])('refuses %s', (_case, template, problem) => {
    expect(() => say(template)).toThrow(problem);
  });
});
