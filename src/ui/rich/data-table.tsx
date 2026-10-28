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
      className="animate-block-enter overflow-x-auto rounded-md bg-surface shadow-raised"
    >
      <table className="w-full border-collapse text-14 leading-normal">
        {caption ? (
          <caption
            id={captionId}
            className="caption-top px-4 pt-3.5 pb-1.5 text-left font-mono text-11 leading-label font-medium tracking-label text-ink-muted uppercase"
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
                className="border-b border-border px-4 py-2 text-left text-12.5 font-medium whitespace-nowrap text-ink-muted"
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
                    'border-b border-border px-4 py-2.75 align-top',
                    rowIndex === rows.length - 1 && 'border-b-0',
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
