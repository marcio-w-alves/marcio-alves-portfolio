import { ButtonLink } from '@/ui/primitives';
import { StatusNotice } from '@/ui/status/status-notice';

export default function NotFound() {
  return (
    <StatusNotice
      title="Page not found"
      description="There is nothing at this address. The link may be mistyped, or the page may have moved."
    >
      <ButtonLink variant="primary" href="/">
        Go to the home page
      </ButtonLink>
    </StatusNotice>
  );
}
