import { app } from '@azure/functions';
import { renderStatsCard } from "../cards/stats-card.js";
import { blacklist } from "../common/blacklist.js";
import {
  clampValue,
  CONSTANTS,
  parseArray,
  parseBoolean,
  renderError,
} from "../common/utils.js";
import { fetchStats } from "../fetchers/stats-fetcher.js";
import { isLocaleAvailable } from "../translations.js";

app.http('card', {
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
          hide_rank,
          show_icons,
          include_all_commits,
          line_height,
          title_color,
          ring_color,
          icon_color,
          text_color,
          text_bold,
          bg_color,
          theme,
          cache_seconds,
          exclude_repo,
          custom_title,
          locale,
          disable_animations,
          border_radius,
          number_format,
          border_color,
          rank_icon,
          show,
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
            const showStats = parseArray(show);
            const stats = await fetchStats(
                username,
                parseBoolean(include_all_commits),
                parseArray(exclude_repo),
                showStats.includes("prs_merged") || showStats.includes("prs_merged_percentage"),
                showStats.includes("discussions_started"),
                showStats.includes("discussions_answered"),
            );

            let cacheSeconds = clampValue(
                parseInt(cache_seconds || CONSTANTS.CARD_CACHE_SECONDS, 10),
                CONSTANTS.SIX_HOURS,
                CONSTANTS.ONE_DAY,
            );
            cacheSeconds = process.env.CACHE_SECONDS
                ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
                : cacheSeconds;

            context.res.headers["Cache-Control"] = 
                `max-age=${cacheSeconds / 2}, s-maxage=${cacheSeconds}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`;

            context.res.body = renderStatsCard(stats, {
                hide: parseArray(hide),
                show_icons: parseBoolean(show_icons),
                hide_title: parseBoolean(hide_title),
                hide_border: parseBoolean(hide_border),
                card_width: parseInt(card_width, 10),
                hide_rank: parseBoolean(hide_rank),
                include_all_commits: parseBoolean(include_all_commits),
                line_height,
                title_color,
                ring_color,
                icon_color,
                text_color,
                text_bold: parseBoolean(text_bold),
                bg_color,
                theme,
                custom_title,
                border_radius,
                border_color,
                number_format,
                locale: locale ? locale.toLowerCase() : null,
                disable_animations: parseBoolean(disable_animations),
                rank_icon,
                show: showStats,
            });

            return context.res;
        } catch (err) {
            context.res.headers["Cache-Control"] = 
                `max-age=${CONSTANTS.ERROR_CACHE_SECONDS / 2}, s-maxage=${CONSTANTS.ERROR_CACHE_SECONDS}, stale-while-revalidate=${CONSTANTS.ONE_DAY}`;

            context.res.body = renderError(
                err.message, 
                err.secondaryMessage, 
                { title_color, text_color, bg_color, border_color, theme }
            );
            return context.res;
        }
    }
});