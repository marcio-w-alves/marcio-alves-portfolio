import { useId } from 'react';
import { cn } from '../cn';

interface DataTableProps {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly caption: string;
}

export function DataTable({ columns, rows, caption }: DataTableProps) {
  const captionId = useId();
  return (
    // Focusable and named, so a keyboard can scroll a table wider than the column.
    <div
      role="region"
      aria-labelledby={caption ? captionId : undefined}
      aria-label={caption ? undefined : 'Table'}
      tabIndex={0}
      className="animate-block-enter overflow-x-auto rounded-md bg-surface shadow-ring"
    >
      <table className="w-full border-collapse text-14 leading-body">
        {caption ? (
          <caption
            id={captionId}
            className="caption-top px-4.5 pt-3.5 pb-2.5 text-left font-display text-14 leading-label font-semibold tracking-name text-ink"
          >
            {caption}
          </caption>
        ) : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="bg-ice px-4.5 py-2.25 text-left text-12 font-medium whitespace-nowrap text-ink-muted inset-shadow-rule-y"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    'border-t border-border px-4.5 py-3 align-top',
                    rowIndex === 0 && 'border-t-0',
                    cellIndex === 0 && 'font-medium whitespace-nowrap',
                    cellIndex > 0 &&
                      cellIndex === cells.length - 1 &&
                      'whitespace-nowrap text-ink-muted',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
