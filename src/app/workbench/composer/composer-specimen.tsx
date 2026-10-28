'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChatComposer,
  ComposerDock,
  JumpToLatest,
  type ChatComposerHandle,
  type ComposerStatus,
  type ComposerVariant,
} from '@/ui/composer';

interface ComposerSpecimenProps {
  readonly variant: ComposerVariant;
  readonly status: ComposerStatus;
  readonly placeholder: string;
  readonly helper: string;
  readonly maxLength: number;
  readonly initialValue?: string | undefined;
  readonly focusOnMount?: boolean | undefined;
  readonly looksFocused?: boolean | undefined;
}

/** A composer with a parent that owns its draft, as the app shell will. */
export function ComposerSpecimen({
  status: initialStatus,
  initialValue = '',
  focusOnMount = false,
  ...props
}: ComposerSpecimenProps) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState(initialStatus);
  const composerRef = useRef<ChatComposerHandle>(null);

  useEffect(() => {
    if (focusOnMount) composerRef.current?.focus();
  }, [focusOnMount]);

  return (
    <ChatComposer
      {...props}
      ref={composerRef}
      status={status}
      value={value}
      onChange={setValue}
      onSubmit={() => {
        setValue('');
      }}
      onStop={() => {
        setStatus('idle');
      }}
    />
  );
}

type DockSpecimenProps = Omit<ComposerSpecimenProps, 'variant'>;

export function DockSpecimen(props: DockSpecimenProps) {
  return (
    <ComposerDock
      jumpToLatest={
        <JumpToLatest
          onClick={() => {
            // The workbench has no conversation to scroll back to.
          }}
        />
      }
    >
      <ComposerSpecimen {...props} variant="dock" />
    </ComposerDock>
  );
}
