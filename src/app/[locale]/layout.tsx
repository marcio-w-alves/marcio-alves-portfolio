import { site } from '@/site-root';
import '@/ui/globals.css';

export const generateStaticParams = site.localeParams;
export const generateMetadata = site.rootMetadata;
export const viewport = site.viewport;

export default site.RootLayout;
