import { app } from '@azure/functions';
import { renderWakatimeCard } from "../cards/wakatime-card.js";
import {
  clampValue,
  CONSTANTS,
  parseArray,
  parseBoolean,
  renderError,
} from "../common/utils.js";
import { fetchWakatimeStats } from "../fetchers/wakatime-fetcher.js";
import { isLocaleAvailable } from "../translations.js";

app.http('wakatime', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
      context.log(`HTTP function processed request for URL "${request.url}"`);
  
      const query = request.query;
      const {
        username,
        title_color,
        icon_color,
        hide_border,
        line_height,
        text_color,
        bg_color,
        theme,
        cache_seconds,
        hide_title,
        hide_progress,
        custom_title,
        locale,
        layout,
        langs_count,
        hide,
        api_domain,
        border_radius,
        border_color,
        display_format,
        disable_animations,
      } = Object.fromEntries(query.entries());
  
      context.res = {
        headers: { "Content-Type": "image/svg+xml" },
      };
  
      if (locale && !isLocaleAvailable(locale)) {
        context.res.body = renderError(
          "Something went wrong",
          "Language not found",
          { title_color, text_color, bg_color, border_color, theme }
        );
        return context.res;
      }
  
      try {
        const stats = await fetchWakatimeStats({ username, api_domain });
  
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
  
        context.res.body = renderWakatimeCard(stats, {
          custom_title,
          hide_title: parseBoolean(hide_title),
          hide_border: parseBoolean(hide_border),
          hide: parseArray(hide),
          line_height,
          title_color,
          icon_color,
          text_color,
          bg_color,
          theme,
          hide_progress,
          border_radius,
          border_color,
          locale: locale ? locale.toLowerCase() : null,
          layout,
          langs_count,
          display_format,
          disable_animations: parseBoolean(disable_animations),
        });
  
        return context.res;
      } catch (err) {
        context.res.headers["Cache-Control"] = `max-age=${CONSTANTS.ERROR_CACHE_SECONDS / 2}, s-maxage=${CONSTANTS.ERROR_CACHE_SECONDS}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`;
  
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
