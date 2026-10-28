import { site } from '@/site-root';

const page = site.topicPage('philosophy');

export const generateMetadata = page.generateMetadata;

export default page.Page;
