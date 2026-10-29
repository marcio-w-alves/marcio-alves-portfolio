import { fixtureAnswers, fixturePortugueseAnswers } from '@/testing/fixture-profile';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { ComponentPart, RichComponent, RichComponentName } from '@/core/chat/components';
import { createResponseKit, details } from '@/core/assistant/response-kit';
import { localize } from '@/core/knowledge/localize';
import { fixtureKnowledge } from '@/testing/fixture-profile/knowledge';
import { renderWithMessages } from '@/testing/ui-messages';
import { RichBlock } from './rich-block';

const knowledge = localize(fixtureKnowledge, 'en');
const fixtureKit = createResponseKit(knowledge, fixtureAnswers.labels);
const { note, table } = fixtureKit;

type BlockOf<Name extends RichComponentName> = Extract<RichComponent, { component: Name }>;

/** The block as the kit builds it, narrowed to its kind so a test can read its props. */
function blockOf<Name extends RichComponentName>(part: ComponentPart, name: Name): BlockOf<Name> {
  const isNamed = (block: ComponentPart): block is ComponentPart & BlockOf<Name> =>
    block.component === name;
  if (!isNamed(part)) throw new Error(`Expected a ${name} block, got ${part.component}`);
  return part;
}

const timelineBlock = () => blockOf(fixtureKit.timeline(), 'timeline');
const projectsBlock = () => blockOf(fixtureKit.projects(), 'projects');
const contactBlock = () => blockOf(fixtureKit.contactCard(), 'contact');

// jsdom's accessible-name computation trims the space a browser keeps before the hidden note.
function opensInNewTab(label: string): RegExp {
  return new RegExp(`^${label} ?\\(opens in a new tab\\)$`);
}

function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected the element to be rendered');
  return value;
}

function renderBlock(block: RichComponent) {
  return renderWithMessages(<RichBlock block={block} />);
}

describe('metrics', () => {
  it('shows every figure with its label and where it was achieved', () => {
    const block = blockOf(fixtureKit.metrics(Object.keys(knowledge.metrics)), 'metrics');
    renderBlock(block);
    const items = within(screen.getByRole('region', { name: 'Key metrics' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(block.props.items.length);
    block.props.items.forEach((metric, index) => {
      const item = present(items[index]);
      expect(item).toHaveTextContent(metric.value);
      expect(item).toHaveTextContent(metric.label);
      if (metric.context) expect(item).toHaveTextContent(metric.context);
    });
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('Faster builds')).toBeInTheDocument();
  });
});

describe('timeline', () => {
  it('lists every role with its company, title and period', () => {
    const block = timelineBlock();
    renderBlock(block);
    const timelineRegion = screen.getByRole('region', { name: 'Career timeline' });
    for (const role of block.props.roles) {
      const toggle = within(timelineRegion).getByRole('button', {
        name: new RegExp(`^${role.company}`),
      });
      expect(toggle).toHaveTextContent(role.role);
      expect(within(timelineRegion).getByText(role.summary)).toBeInTheDocument();
      expect(within(timelineRegion).getByText(role.period)).toBeInTheDocument();
    }
  });

  it('marks the current role and the contract roles, and calls none concurrent', () => {
    renderBlock(timelineBlock());
    expect(screen.getByRole('button', { name: /^Acme/ })).toHaveTextContent('Current');
    expect(screen.getByRole('button', { name: /^Initech/ })).toHaveTextContent('Contract');
    expect(screen.getByRole('button', { name: /^Globex/ })).not.toHaveTextContent(
      /Current|Contract/,
    );
    expect(screen.queryByText(/concurrent/i)).not.toBeInTheDocument();
  });

  it('opens a role to show its sections and closes it again', async () => {
    const user = userEvent.setup();
    const block = timelineBlock();
    const role = present(block.props.roles.find(({ id }) => id === 'globex'));
    renderBlock(block);
    const globex = screen.getByRole('button', { name: /^Globex/ });
    const [firstSection] = role.sections;
    expect(globex).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(present(firstSection).title)).not.toBeInTheDocument();

    await user.click(globex);

    expect(globex).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(globex.getAttribute('aria-controls') ?? '');
    const sections = within(present(panel));
    for (const section of role.sections) {
      expect(sections.getByText(section.title)).toBeInTheDocument();
    }
    expect(sections.getByText('More deploys a day')).toBeInTheDocument();

    await user.click(globex);

    expect(globex).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(present(firstSection).title)).not.toBeInTheDocument();
  });

  it('opens the roles the answer asks for, and only those', () => {
    const { props } = timelineBlock();
    renderBlock({ component: 'timeline', props: { ...props, expanded: ['globex'] } });
    expect(screen.getByRole('button', { name: /^Globex/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Acme/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens one role without touching the others', async () => {
    const user = userEvent.setup();
    renderBlock(timelineBlock());
    await user.click(screen.getByRole('button', { name: /^Initech/ }));
    expect(screen.getByRole('button', { name: /^Initech/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Globex/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});

describe('skills', () => {
  it('shows each group with its skills and how many there are', () => {
    const block = blockOf(fixtureKit.skills(), 'skills');
    renderBlock(block);
    const region = screen.getByRole('region', { name: 'Technical skills' });
    for (const group of block.props.groups) {
      expect(
        within(region).getByText(group.title, { selector: 'p', exact: false }),
      ).toHaveTextContent(`${group.title}${String(group.items.length)} skills`);
      for (const skill of group.items) {
        expect(within(region).getAllByText(skill).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('projects', () => {
  it('shows each project with its name, category, status and scope', () => {
    const block = projectsBlock();
    renderBlock(block);
    for (const project of block.props.projects) {
      const card = screen.getByRole('article', { name: `Project: ${project.name}` });
      expect(within(card).getByRole('heading', { name: project.name })).toBeInTheDocument();
      expect(card).toHaveTextContent(project.category);
      expect(card).toHaveTextContent(project.status);
      expect(card).toHaveTextContent(project.description);
      for (const item of project.scope) expect(card).toHaveTextContent(item);
    }
  });

  it("labels a concept's scope as planned and a live product's as its features", () => {
    renderBlock(projectsBlock());
    const concept = screen.getByRole('article', { name: 'Project: Loomstack' });
    const live = screen.getByRole('article', { name: 'Project: Pipewright' });
    expect(within(concept).getByText('Planned scope')).toBeInTheDocument();
    expect(within(live).getByText('Key features')).toBeInTheDocument();
    expect(within(live).queryByText('Planned scope')).not.toBeInTheDocument();
  });

  it('lists the platforms a product runs on, and nothing for one that names none', () => {
    renderBlock(projectsBlock());
    const live = screen.getByRole('article', { name: 'Project: Pipewright' });
    expect(within(live).getByText('Platforms')).toBeInTheDocument();
    expect(within(live).getByText('Web')).toBeInTheDocument();
    const concept = screen.getByRole('article', { name: 'Project: Loomstack' });
    expect(within(concept).queryByText('Platforms')).not.toBeInTheDocument();
  });

  it("shows a concept's status and no link to a site it does not have", () => {
    renderBlock(projectsBlock());
    const concept = screen.getByRole('article', { name: 'Project: Loomstack' });
    expect(within(concept).getByText('Concept')).toBeInTheDocument();
    expect(within(concept).queryByRole('link')).not.toBeInTheDocument();
  });

  it('lists the outcomes a project documents, and no such section for one without', () => {
    renderBlock(projectsBlock());
    const live = screen.getByRole('article', { name: 'Project: Pipewright' });
    expect(within(live).getByText('Outcomes')).toBeInTheDocument();
    expect(
      within(live).getByText('Builds its own monorepo in under a minute.'),
    ).toBeInTheDocument();
    const concept = screen.getByRole('article', { name: 'Project: Loomstack' });
    expect(within(concept).queryByText('Outcomes')).not.toBeInTheDocument();
  });

  it('shows the stack a project documents, and leaves the section out where none is', () => {
    const [live, concept] = projectsBlock().props.projects;
    renderBlock({
      component: 'projects',
      props: {
        projects: [{ ...present(live), technologies: ['Bazel', 'Go'] }, present(concept)],
        labels: projectsBlock().props.labels,
      },
    });
    const card = screen.getByRole('article', { name: 'Project: Pipewright' });
    expect(within(card).getByText('Main technologies')).toBeInTheDocument();
    expect(within(card).getByText('Bazel')).toBeInTheDocument();
    const planned = screen.getByRole('article', { name: 'Project: Loomstack' });
    expect(within(planned).queryByText('Main technologies')).not.toBeInTheDocument();
  });

  it("links to a project's site in a new tab", () => {
    renderBlock(projectsBlock());
    const card = screen.getByRole('article', { name: 'Project: Pipewright' });
    const link = within(card).getByRole('link', {
      name: opensInNewTab('Visit pipewright.example'),
    });
    expect(link).toHaveAttribute('href', 'https://pipewright.example');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('links only to web addresses, in a new tab', () => {
    const [project] = projectsBlock().props.projects;
    renderBlock({
      component: 'projects',
      props: {
        projects: [
          {
            ...present(project),
            links: [
              { label: 'Visit Pipewright', url: 'https://pipewright.example/' },
              { label: 'Run it', url: 'javascript:alert(1)' },
            ],
          },
        ],
        labels: projectsBlock().props.labels,
      },
    });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(opensInNewTab('Visit Pipewright'));
    expect(links[0]).toHaveAttribute('href', 'https://pipewright.example/');
    expect(links[0]).toHaveAttribute('target', '_blank');
  });
});

describe('table', () => {
  it('shows its caption, column headers and every cell', () => {
    const block = blockOf(
      table(
        ['Company', 'Role', 'Period'],
        [
          ['Acme', 'Principal Platform Engineer', '2022 — Present'],
          ['Globex', 'Senior Platform Engineer', '2018 — 2022'],
        ],
        'Roles',
      ),
      'table',
    );
    renderBlock(block);
    const tableElement = screen.getByRole('table');
    expect(tableElement).toHaveAccessibleName(block.props.caption);
    const headers = within(tableElement).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(block.props.columns);
    const rows = within(tableElement).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(block.props.rows.length);
    block.props.rows.forEach((cells, index) => {
      const rendered = within(present(rows[index])).getAllByRole('cell');
      expect(rendered.map((cell) => cell.textContent)).toEqual(cells);
    });
  });

  it('is named "Table" for a screen reader when it has no caption', () => {
    renderBlock(table(['Language'], [['Portuguese']], ''));
    expect(screen.getByRole('region', { name: 'Table' })).toBeInTheDocument();
  });

  it('can be scrolled by keyboard when it is wider than the answer', () => {
    renderBlock(table(['Language', 'Level'], [['Portuguese', 'Native']], 'Languages'));
    expect(screen.getByRole('region', { name: 'Languages' })).toHaveAttribute('tabindex', '0');
  });
});

describe('note', () => {
  it.each([
    ['inference', 'Assessment'],
    ['example', 'Illustrative example'],
    ['info', 'Note'],
  ] as const)('labels a %s note "%s" and shows its text', (tone, label) => {
    renderBlock(note(tone, "The payroll team's size isn't documented."));
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveTextContent(label);
    expect(aside).toHaveTextContent("The payroll team's size isn't documented.");
  });

  it('renders inline formatting and keeps unsafe links as text', () => {
    renderBlock(
      note('info', 'Read **the resume** or [her profile](https://example.com) [x](javascript:1)'),
    );
    expect(screen.getByText('the resume').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: opensInNewTab('her profile') })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('complementary')).toHaveTextContent('[x](javascript:1)');
  });
});

describe('details', () => {
  it('shows only its summary until opened, then its text, and hides it again', async () => {
    const user = userEvent.setup();
    const block = blockOf(details('How?', 'Remote caching across every build.'), 'details');
    renderBlock(block);
    const toggle = screen.getByRole('button', { name: block.props.summary });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Remote caching/)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveTextContent(block.props.text);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Remote caching/)).not.toBeInTheDocument();
  });

  it('splits its text into paragraphs at blank lines', async () => {
    const user = userEvent.setup();
    renderBlock(details('Why?', 'First paragraph\ncontinues here.\n\nSecond paragraph.'));
    await user.click(screen.getByRole('button', { name: 'Why?' }));
    expect(screen.getByText('First paragraph continues here.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
  });

  it('gives every list item a paragraph of its own, without its marker', async () => {
    const user = userEvent.setup();
    renderBlock(details('Courses', '- React course\n- Angular course\nAll on Udemy.'));
    const toggle = screen.getByRole('button', { name: 'Courses' });
    await user.click(toggle);
    const panel = present(document.getElementById(toggle.getAttribute('aria-controls') ?? ''));
    expect(
      within(panel)
        .getAllByRole('paragraph')
        .map((paragraph) => paragraph.textContent),
    ).toEqual(['React course', 'Angular course', 'All on Udemy.']);
  });
});

describe('contact', () => {
  it("offers email with the profile's subject, LinkedIn and GitHub, under the person's monogram", () => {
    const block = contactBlock();
    renderBlock(block);
    const card = screen.getByRole('region', { name: 'Interested in working together?' });
    expect(card).toHaveTextContent(block.props.text);
    expect(within(card).getByText('AR')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Ada' })).toHaveAttribute(
      'href',
      'mailto:ada@rivera.example?subject=Platform%20role',
    );
    const linkedin = screen.getByRole('link', { name: opensInNewTab('View LinkedIn') });
    expect(linkedin).toHaveAttribute('href', block.props.linkedin);
    expect(linkedin).toHaveAttribute('target', '_blank');
    expect(linkedin).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: opensInNewTab('GitHub') })).toHaveAttribute(
      'href',
      block.props.github,
    );
    expect(screen.getByText(block.props.email)).toBeInTheDocument();
  });

  it("states the person's availability from the record", () => {
    renderBlock(contactBlock());
    expect(
      screen.getByRole('region', { name: 'Interested in working together?' }),
    ).toHaveTextContent('Portugal · hybrid · UTC+0 · open to platform roles');
  });

  it('offers no résumé download while there is no résumé to download', () => {
    const { props } = contactBlock();
    renderBlock({ component: 'contact', props: { ...props, resumeUrl: null } });
    expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('opens the résumé in a new tab once there is one, saying it is a PDF', () => {
    renderBlock(contactBlock());
    const resume = screen.getByRole('link', {
      name: /^View resume ?\(PDF, opens in a new tab\)$/,
    });
    expect(resume).toHaveAttribute('href', '/ada-rivera-cv.pdf');
    expect(resume).toHaveAttribute('target', '_blank');
    expect(resume).not.toHaveAttribute('download');
  });
});

describe('RichBlock', () => {
  it('renders nothing for a kind outside the allow-list', () => {
    const forged = {
      component: 'html',
      props: { markup: '<script>alert(1)</script>' },
    } as unknown as RichComponent;
    const { container } = renderBlock(forged);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("a card in the answer's language", () => {
  const portugueseKit = createResponseKit(
    localize(fixtureKnowledge, 'pt-BR'),
    fixturePortugueseAnswers.labels,
  );
  const words = fixturePortugueseAnswers.labels;

  it('names and tags a Portuguese timeline in Portuguese on an English page', async () => {
    const user = userEvent.setup();
    renderBlock(blockOf(portugueseKit.timeline(), 'timeline'));

    const timeline = screen.getByRole('region', { name: words.cards.timeline });
    expect(within(timeline).getByText(words.badges.current)).toBeInTheDocument();
    expect(within(timeline).queryByText(fixtureAnswers.labels.badges.current)).toBeNull();
    const [firstRole] = within(timeline).getAllByRole('button');
    await user.click(present(firstRole));
    expect(within(timeline).getByText(words.roleSections.responsibilities)).toBeInTheDocument();
  });

  it("offers a Portuguese contact card's actions in Portuguese", () => {
    renderBlock(blockOf(portugueseKit.contactCard(), 'contact'));

    expect(screen.getByRole('heading', { name: words.contact.heading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Falar com Ada' })).toBeInTheDocument();
    expect(screen.getByText('Fale com Ada sobre engenharia de plataforma.')).toBeInTheDocument();
    // On an English page, a screen reader still hears the whole card in Portuguese.
    expect(
      screen.getByRole('link', { name: /^Ver LinkedIn ?\(abre em uma nova aba\)$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /^Ver currículo ?\(PDF, abre em uma nova aba\)$/ }),
    ).toBeInTheDocument();
  });

  it("tells a screen reader a Portuguese project card's link opens a new tab, in Portuguese", () => {
    renderBlock(blockOf(portugueseKit.projects(['pipewright']), 'projects'));

    const [link] = screen.getAllByRole('link');
    expect(link).toHaveAccessibleName(/\(abre em uma nova aba\)$/);
  });

  it('labels a Portuguese note in Portuguese', () => {
    renderBlock(portugueseKit.note('inference', 'Uma avaliação.'));
    expect(screen.getByRole('complementary')).toHaveTextContent(words.notes.inference);
  });
});
