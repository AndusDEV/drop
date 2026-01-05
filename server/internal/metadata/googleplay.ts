import { MetadataSource } from "~/prisma/client/enums";
import type { MetadataProvider } from ".";
import type {
  GameMetadataSearchResult,
  _FetchGameMetadataParams,
  GameMetadata,
  _FetchCompanyMetadataParams,
  CompanyMetadata,
  GameMetadataRating,
} from "./types";
import * as gplay from "google-play-scraper";
import * as jdenticon from "jdenticon";
import type { TaskRunContext } from "../tasks";
import type { TransactionDataType } from "../objects/transactional";

export class GooglePlayProvider implements MetadataProvider {
  name() {
    return "Google Play";
  }

  source() {
    return MetadataSource.GooglePlay;
  }

  /** Search Google Play for apps */
  async search(query: string): Promise<GameMetadataSearchResult[]> {
    try {
      const apps = await (gplay.default.search as any)({ term: query, num: 5, lang: "en", country: "us" });
      const results: GameMetadataSearchResult[] = (apps || [])
        .slice(0, 3)
        .map((a: any) => ({
          id: a.appId || a.appId || "",
          name: a.title || "",
          icon: a.icon || "",
          description: a.summary || "",
          year: 0,
        }));

      return results;
    } catch {
      return [];
    }
  }


  /** Fetch detailed metadata */
  async fetchGame(
    { id, createObject, publisher, developer }: _FetchGameMetadataParams,
    context?: TaskRunContext,
  ): Promise<GameMetadata> {
    context?.logger.info(`Starting Google Play fetch for ${id}`);
    context?.progress?.(0);

    try {
      const app = await (gplay.default.app as any)({ appId: id, lang: "en", country: "us" });

      context?.progress?.(10);

      const name = app.title || app.name || id;
      const metaDesc = app.summary || "";
      const descriptionHtml = app.description || metaDesc;

      context?.progress?.(20);

      let iconUrl: TransactionDataType = app.icon || app.headerImage || "";
      if (!iconUrl) iconUrl = jdenticon.toPng(id, 512);
      const icon = createObject(iconUrl);

      context?.progress?.(30);

      const screenshots: string[] = Array.isArray(app.screenshots || app.screenshot) ? (app.screenshots || app.screenshot) : [];
      const uniqScreens = Array.from(new Set(screenshots)).slice(0, 12);
      const images: string[] = [];
      for (const s of uniqScreens) {
        try {
          images.push(createObject(s));
        } catch {
        }
      }

      const coverId = icon ?? createObject(jdenticon.toPng(id, 512));
      const bannerId = images[0] ?? createObject(jdenticon.toPng(id, 512));

      context?.progress?.(60);

      const developerName = app.developer || app.developerId || "";
      const developersArr: any[] = [];
      const developerNames = developerName ? [developerName] : [];
      context?.logger?.info(`Found ${developerNames.length} developer(s) to process`);
      for (const devName of developerNames) {
        context?.logger?.info(`Processing developer: "${devName}"`);
        try {
          if (developer) {
            const comp = await developer(devName);
            if (!comp) {
              context?.logger?.warn(`Failed to import developer "${devName}"`);
              continue;
            }
            developersArr.push(comp);
            context?.logger?.info(`Successfully imported developer: "${devName}"`);
          }
        } catch (e) {
          context?.logger?.warn(e);
        }
      }

      context?.progress?.(80);

      const reviews: GameMetadataRating[] = [];
      if (app.score !== undefined) {
        reviews.push({
          metadataId: id,
          metadataSource: MetadataSource.GooglePlay,
          mReviewCount: Number(app.reviews) || 0,
          mReviewHref: app.url || `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`,
          mReviewRating: Number(app.score) / 5,
        });
      }

      context?.progress?.(95);

      let released = new Date();
      if (app.released) released = new Date(app.released);
      else if (app.updated) released = new Date(app.updated);

      let tags: string[] = [];

      if (Array.isArray(app.categories)) {
        tags = app.categories
          .map((cat: any) => cat?.name || cat)
          .filter(Boolean) as string[];
      }

      return {
        id,
        name: String(name),
        shortDescription: String(metaDesc),
        description: String(descriptionHtml),
        released,
        publishers: [],
        developers: developersArr,
        tags,
        reviews,
        icon,
        bannerId: bannerId!,
        coverId: coverId!,
        images: [...images],
      } as GameMetadata;
    } catch (e) {
      context?.logger?.warn(e);
      throw new Error(`Failed to fetch Google Play app ${id}: ${e}`);
    }
  }

  /** Minimal company metadata for a developer */
  async fetchCompany({ query, createObject }: _FetchCompanyMetadataParams): Promise<CompanyMetadata | undefined> {
    const logo = createObject(jdenticon.toPng(query, 512));
    const banner = createObject(jdenticon.toPng(query, 512));

    return {
      id: query.replaceAll(" ", ""),
      name: query,
      shortDescription: "",
      description: "",
      logo,
      banner,
      website: `https://play.google.com/store/search?q=${encodeURIComponent(query)}&c=apps`,
    };
  }
}

export default GooglePlayProvider;