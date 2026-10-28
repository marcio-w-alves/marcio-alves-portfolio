import type { RichComponent } from '@/core/assistant/components';
import { ContactCard } from './contact-card';
import { DataTable } from './data-table';
import { Details } from './details';
import { Metrics } from './metrics';
import { Note } from './note';
import { Projects } from './projects';
import { Skills } from './skills';
import { Timeline } from './timeline';

/**
 * Renders one allow-listed block of an answer. The switch is exhaustive, so a
 * new kind in the contract fails to compile until it has a component, and a
 * kind outside the contract renders nothing.
 */
export function RichBlock({ block }: { readonly block: RichComponent }) {
  switch (block.component) {
    case 'metrics':
      return <Metrics {...block.props} />;
    case 'timeline':
      return <Timeline {...block.props} />;
    case 'skills':
      return <Skills {...block.props} />;
    case 'projects':
      return <Projects {...block.props} />;
    case 'table':
      return <DataTable {...block.props} />;
    case 'note':
      return <Note {...block.props} />;
    case 'details':
      return <Details {...block.props} />;
    case 'contact':
      return <ContactCard {...block.props} />;
    default:
      block satisfies never;
      return null;
  }
}
