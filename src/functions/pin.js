import { app } from "@azure/functions";
import { renderRepoCard } from "../cards/repo-card.js";
import { blacklist } from "../common/blacklist.js";
import {
  clampValue,
  CONSTANTS,
  parseBoolean,
  renderError,
} from "../common/utils.js";
import { fetchRepo } from "../fetchers/repo-fetcher.js";
import { isLocaleAvailable } from "../translations.js";

app.http("pin", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (request, context) => {
    context.log(`HTTP function processed request for URL "${request.url}"`);

    const query = request.query;
    const {
      username,
      repo,
      hide_border,
      title_color,
      icon_color,
      text_color,
      bg_color,
      theme,
      show_owner,
      cache_seconds,
      locale,
      border_radius,
      border_color,
      description_lines_count,
    } = Object.fromEntries(query.entries());

    context.res = {
      headers: { "Content-Type": "image/svg+xml" },
    };

    if (blacklist.includes(username)) {
      context.res.body = renderError(
        "Something went wrong",
        "This username is blacklisted",
        { title_color, text_color, bg_color, border_color, theme }
      );
      return context.res;
    }

    if (locale && !isLocaleAvailable(locale)) {
      context.res.body = renderError(
        "Something went wrong",
        "Language not found",
        { title_color, text_color, bg_color, border_color, theme }
      );
      return context.res;
    }

    try {
      const repoData = await fetchRepo(username, repo);

      let cacheSeconds = clampValue(
        parseInt(cache_seconds || CONSTANTS.CARD_CACHE_SECONDS, 10),
        CONSTANTS.SIX_HOURS,
        CONSTANTS.ONE_DAY
      );
      cacheSeconds = process.env.CACHE_SECONDS
        ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
        : cacheSeconds;

      const stars = repoData.starCount;
      const forks = repoData.forkCount;
      const isBothOver1K = stars > 1000 && forks > 1000;
      const isBothUnder1 = stars < 1 && forks < 1;
      if (!cache_seconds && (isBothOver1K || isBothUnder1)) {
        cacheSeconds = CONSTANTS.SIX_HOURS;
      }

      context.res.headers["Cache-Control"] = `max-age=${
        cacheSeconds / 2
      }, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`;

      context.res.body = renderRepoCard(repoData, {
        hide_border: parseBoolean(hide_border),
        title_color,
        icon_color,
        text_color,
        bg_color,
        theme,
        border_radius,
        border_color,
        show_owner: parseBoolean(show_owner),
        locale: locale ? locale.toLowerCase() : null,
        description_lines_count,
      });

      return context.res;
    } catch (err) {
      context.res.headers["Cache-Control"] = `max-age=${
        CONSTANTS.ERROR_CACHE_SECONDS / 2
      }, s-maxage=${CONSTANTS.ERROR_CACHE_SECONDS}, stale-while-revalidate=${
        CONSTANTS.ONE_DAY
      }`;

      context.res.body = renderError(err.message, err.secondaryMessage, {
        title_color,
        text_color,
        bg_color,
        border_color,
        theme,
      });

      return context.res;
    }
  },
});
