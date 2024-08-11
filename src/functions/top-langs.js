import { app } from '@azure/functions';
import { renderTopLanguages } from "../cards/top-languages-card.js";
import { blacklist } from "../common/blacklist.js";
import {
  clampValue,
  CONSTANTS,
  parseArray,
  parseBoolean,
  renderError,
} from "../common/utils.js";
import { fetchTopLanguages } from "../fetchers/top-languages-fetcher.js";
import { isLocaleAvailable } from "../translations.js";

app.http('top-langs', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
      context.log(`HTTP function processed request for URL "${request.url}"`);
  
      const query = request.query;
      const {
        username,
        hide,
        hide_title,
        hide_border,
        card_width,
        title_color,
        text_color,
        bg_color,
        theme,
        cache_seconds,
        layout,
        langs_count,
        exclude_repo,
        size_weight,
        count_weight,
        custom_title,
        locale,
        border_radius,
        border_color,
        disable_animations,
        hide_progress,
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
        context.res.body = renderError("Something went wrong", "Locale not found");
        return context.res;
      }
  
      if (
        layout !== undefined &&
        (typeof layout !== "string" ||
          !["compact", "normal", "donut", "donut-vertical", "pie"].includes(layout))
      ) {
        context.res.body = renderError(
          "Something went wrong",
          "Incorrect layout input"
        );
        return context.res;
      }
  
      try {
        const topLangs = await fetchTopLanguages(
          username,
          parseArray(exclude_repo),
          size_weight,
          count_weight
        );
  
        let cacheSeconds = clampValue(
          parseInt(cache_seconds || CONSTANTS.CARD_CACHE_SECONDS, 10),
          CONSTANTS.SIX_HOURS,
          CONSTANTS.ONE_DAY
        );
        cacheSeconds = process.env.CACHE_SECONDS
          ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
          : cacheSeconds;
  
        context.res.headers["Cache-Control"] = `max-age=${
          cacheSeconds / 2
        }, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`;
  
        context.res.body = renderTopLanguages(topLangs, {
          custom_title,
          hide_title: parseBoolean(hide_title),
          hide_border: parseBoolean(hide_border),
          card_width: parseInt(card_width, 10),
          hide: parseArray(hide),
          title_color,
          text_color,
          bg_color,
          theme,
          layout,
          langs_count,
          border_radius,
          border_color,
          locale: locale ? locale.toLowerCase() : null,
          disable_animations: parseBoolean(disable_animations),
          hide_progress: parseBoolean(hide_progress),
        });
  
        return context.res;
      } catch (err) {
        context.res.headers["Cache-Control"] = `max-age=${
          CONSTANTS.ERROR_CACHE_SECONDS / 2
        }, s-maxage=${CONSTANTS.ERROR_CACHE_SECONDS}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`;
  
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
