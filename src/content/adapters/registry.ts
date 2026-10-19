import { SiteAdapter } from '../../types/adapter';
import { MangaDexAdapter } from './mangadex';
import { GenericLongstripAdapter } from './genericLongstrip';
import { GenericHorizontalAdapter } from './genericHorizontal';

export class AdapterRegistry {
  private static adapters: SiteAdapter[] = [
    new MangaDexAdapter(),
    new GenericLongstripAdapter(),
    new GenericHorizontalAdapter(),
  ];

  public static getMatchingAdapter(url: string, doc: Document): SiteAdapter | null {
    // 1. Check domain-specific adapters first
    for (const adapter of this.adapters) {
      if (adapter.domainMatches(url) && adapter.id !== 'generic_horizontal' && adapter.id !== 'generic_longstrip') {
        if (adapter.isReaderPage(url, doc)) {
          return adapter;
        }
      }
    }

    // 2. Check generic adapters if reader page matches
    for (const adapter of this.adapters) {
      if (adapter.id === 'generic_longstrip' && adapter.isReaderPage(url, doc)) {
        return adapter;
      }
    }

    for (const adapter of this.adapters) {
      if (adapter.id === 'generic_horizontal' && adapter.isReaderPage(url, doc)) {
        return adapter;
      }
    }

    return null;
  }
}
