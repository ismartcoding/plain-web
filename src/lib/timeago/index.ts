import * as Languages from './lang';
import { register } from './register';
import type { LocaleFunc } from './interface';

Object.keys(Languages).forEach((locale: string) => {
  register(locale, Languages[locale] as LocaleFunc);
});

export { format } from './format';
export { render, cancel } from './realtime';
export { register };
export * from './interface';
