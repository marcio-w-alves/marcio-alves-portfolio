import { site } from '@/site-root';

const page = site.topicPage('education');

export const generateMetadata = page.generateMetadata;

export default page.Page;
