export interface PublicPageData {
  hero: {
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
  };
  features: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
  }>;
  news: Array<{
    id: string;
    title: string;
    date: string;
    slug: string;
  }>;
  navigation: Array<{
    label: string;
    href: string;
  }>;
}

export interface ThemeProps {
  data?: any;
}
