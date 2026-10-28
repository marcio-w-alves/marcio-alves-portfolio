import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { RichComponent } from '@/core/assistant/components';
import { knowledge } from '@/app/site-knowledge';
import { details, note, table } from '@/core/assistant/response-kit';
import { createFastPath } from '@/core/assistant/system1/fast-path';
import { exampleBlocks } from './examples';
import { RichBlock } from './rich-block';

const exampleBlock = exampleBlocks(createFastPath(knowledge));

// jsdom's accessible-name computation trims the space a browser keeps before the hidden note.
function opensInNewTab(label: string): RegExp {
  return new RegExp(`^${label} ?\\(opens in a new tab\\)$`);
}

function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected the element to be rendered');
  return value;
}

function renderBlock(block: RichComponent) {
  return render(<RichBlock block={block} />);
}

describe('metrics', () => {
  it('shows every figure with its label and where it was achieved', () => {
    const block = exampleBlock('metrics');
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
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Reduction in loading time on critical pages')).toBeInTheDocument();
  });
});

describe('timeline', () => {
  it('lists every role with its company, title and period', () => {
    const block = exampleBlock('timeline');
    renderBlock(block);
    const timelineRegion = screen.getByRole('region', { name: 'Career timeline' });
    for (const role of block.props.roles) {
      const toggle = within(timelineRegion).getByRole('button', {
        name: new RegExp(`^${role.company}`),
      });
      expect(toggle).toHaveTextContent(role.role);
      expect(within(timelineRegion).getByText(role.summary)).toBeInTheDocument();
    }
    expect(
      within(timelineRegion).getAllByText(block.props.roles[0]?.period ?? ''),
    ).not.toHaveLength(0);
  });

  it('marks the current role, and overlapping ones as concurrent', () => {
    renderBlock(exampleBlock('timeline'));
    expect(screen.getByRole('button', { name: /^Way2b1/ })).toHaveTextContent('Current');
    expect(screen.getByRole('button', { name: /^Roots/ })).toHaveTextContent('Concurrent');
    expect(screen.getByRole('button', { name: /^Deel/ })).not.toHaveTextContent(
      /Current|Concurrent/,
    );
  });

  it('opens a role to show its sections and closes it again', async () => {
    const user = userEvent.setup();
    renderBlock(exampleBlock('timeline'));
    const deel = screen.getByRole('button', { name: /^Deel/ });
    expect(deel).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Engineering impact')).not.toBeInTheDocument();

    await user.click(deel);

    expect(deel).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(deel.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    const sections = within(present(panel));
    expect(sections.getByText('Engineering impact')).toBeInTheDocument();
    expect(sections.getByText('Reduction in loading time on critical pages')).toBeInTheDocument();
    expect(sections.getByText('Focus areas')).toBeInTheDocument();

    await user.click(deel);

    expect(deel).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Engineering impact')).not.toBeInTheDocument();
  });

  it('opens the roles the answer asks for, and only those', () => {
    const { props } = exampleBlock('timeline');
    renderBlock({ component: 'timeline', props: { ...props, expanded: ['deel'] } });
    expect(screen.getByRole('button', { name: /^Deel/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Way2b1/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens one role without touching the others', async () => {
    const user = userEvent.setup();
    renderBlock(exampleBlock('timeline'));
    await user.click(screen.getByRole('button', { name: /^Roots/ }));
    expect(screen.getByRole('button', { name: /^Roots/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Deel/ })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('skills', () => {
  it('shows each group with its skills and how many there are', () => {
    const block = exampleBlock('skills');
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
  it('shows each project with its name, category, status and planned scope', () => {
    const block = exampleBlock('projects');
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
    renderBlock(exampleBlock('projects'));
    const concept = screen.getByRole('article', { name: 'Project: FictionDraft' });
    const live = screen.getByRole('article', { name: 'Project: TargUp' });
    expect(within(concept).getByText('Planned scope')).toBeInTheDocument();
    expect(within(live).getByText('Key features')).toBeInTheDocument();
    expect(within(live).queryByText('Planned scope')).not.toBeInTheDocument();
  });

  it('lists the platforms a product runs on, and nothing for one that names none', () => {
    renderBlock(exampleBlock('projects'));
    const evcopilot = screen.getByRole('article', { name: 'Project: EvCopilot' });
    expect(within(evcopilot).getByText('Platforms')).toBeInTheDocument();
    expect(within(evcopilot).getByText('iPhone (beta)')).toBeInTheDocument();
    const concept = screen.getByRole('article', { name: 'Project: FictionDraft' });
    expect(within(concept).queryByText('Platforms')).not.toBeInTheDocument();
  });

  it('leaves out sections the record does not document', () => {
    const block = exampleBlock('projects');
    const concept = block.props.projects.find((project) => project.id === 'fictiondraft');
    expect(concept?.technologies).toEqual([]);
    renderBlock(block);
    const card = screen.getByRole('article', { name: 'Project: FictionDraft' });
    expect(within(card).queryByText('Main technologies')).not.toBeInTheDocument();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  it('links only to web addresses, in a new tab', () => {
    const [project] = exampleBlock('projects').props.projects;
    if (!project) throw new Error('No project to render');
    renderBlock({
      component: 'projects',
      props: {
        projects: [
          {
            ...project,
            links: [
              { label: 'Visit TargUp', url: 'https://dev.targup.com/' },
              { label: 'Run it', url: 'javascript:alert(1)' },
            ],
          },
        ],
      },
    });
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName(opensInNewTab('Visit TargUp'));
    expect(links[0]).toHaveAttribute('href', 'https://dev.targup.com/');
    expect(links[0]).toHaveAttribute('target', '_blank');
  });
});

describe('table', () => {
  it('shows its caption, column headers and every cell', () => {
    const block = exampleBlock('table');
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
    renderBlock(note(tone, "The HRIS team's size isn't documented."));
    const aside = screen.getByRole('complementary');
    expect(aside).toHaveTextContent(label);
    expect(aside).toHaveTextContent("The HRIS team's size isn't documented.");
  });

  it('renders inline formatting and keeps unsafe links as text', () => {
    renderBlock(
      note('info', 'Read **the resume** or [his profile](https://example.com) [x](javascript:1)'),
    );
    expect(screen.getByText('the resume').tagName).toBe('STRONG');
    expect(screen.getByRole('link', { name: opensInNewTab('his profile') })).toHaveAttribute(
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
    const block = exampleBlock('details');
    renderBlock(block);
    const toggle = screen.getByRole('button', { name: block.props.summary });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/targeted refactoring/)).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveTextContent(block.props.text);

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/targeted refactoring/)).not.toBeInTheDocument();
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
  it('offers email with a subject, LinkedIn and GitHub', () => {
    const block = exampleBlock('contact');
    renderBlock(block);
    expect(
      screen.getByRole('region', { name: 'Interested in working together?' }),
    ).toHaveTextContent(block.props.text);
    expect(screen.getByRole('link', { name: 'Contact Marcio' })).toHaveAttribute(
      'href',
      'mailto:marcio.welben@gmail.com?subject=Engineering%20opportunity',
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

  it('offers no résumé download while there is no résumé to download', () => {
    const { props } = exampleBlock('contact');
    renderBlock({ component: 'contact', props: { ...props, resumeUrl: null } });
    expect(screen.queryByRole('link', { name: /resume/i })).not.toBeInTheDocument();
  });

  it('opens the résumé in a new tab once there is one, saying it is a PDF', () => {
    const { props } = exampleBlock('contact');
    renderBlock({ component: 'contact', props: { ...props, resumeUrl: '/marcio-alves.pdf' } });
    const resume = screen.getByRole('link', {
      name: /^View resume ?\(PDF, opens in a new tab\)$/,
    });
    expect(resume).toHaveAttribute('href', '/marcio-alves.pdf');
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
