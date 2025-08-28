// Language configuration for path mapping
export const languageConfig = {
  locales: {
    root: { label: "English", lang: "en" },
    zh: { label: "简体中文", lang: "zh-CN" }
  },
  // Define path mapping for language switching
  pathMapping: {
    root: {
      zh: (path: string) => path.replace(/^\/docs/, '/zh/docs')
    },
    zh: {
      root: (path: string) => path.replace(/^\/zh\/docs/, '/docs')
    }
  }
}

// Generic function to detect current locale from URL
export function detectLocaleFromPath(path: string): string {
  const segments = path.split('/');
  if (segments.length > 1 && segments[1] !== 'docs') {
    return segments[1];
  }
  return 'root';
}

// Generic function to build path mapping
export function buildPathMapping(locales: Record<string, any>): Record<string, Record<string, (path: string) => string>> {
  const mapping: Record<string, Record<string, (path: string) => string>> = {};
  
  Object.keys(locales).forEach(locale => {
    if (locale === 'root') return;
    
    // Root to locale
    if (!mapping.root) mapping.root = {};
    mapping.root[locale] = (path: string) => path.replace(/^\/docs/, `/${locale}/docs`);
    
    // Locale to root
    if (!mapping[locale]) mapping[locale] = {};
    mapping[locale].root = (path: string) => path.replace(new RegExp(`^/${locale}/docs`), '/docs');
  });
  
  return mapping;
} 