declare module 'jsdom';
declare module 'dompurify' {
  import { JSDOM } from 'jsdom';
  const createDOMPurify: (window?: Window) => any;
  export default createDOMPurify;
}
