"""
News scraper service: fetch RotoWire, match players, persist to DB.
"""

import asyncio
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.player_news import PlayerNews

from .matcher import MatchMethod, match_players_batch
from .parser import ScrapedNewsItem, parse_article_body, parse_news_page

logger = logging.getLogger(__name__)

NEWS_URL = "https://www.rotowire.com/baseball/news.php"
REQUEST_TIMEOUT = 15.0
ARTICLE_FETCH_DELAY = 0.5  # seconds between individual article requests

# Only one scrape at a time to avoid hammering the source.
_scrape_lock = asyncio.Lock()


async def scrape_and_persist_news(session: AsyncSession) -> dict:
    """
    Fetch the RotoWire news page, parse items, match to players, and persist.

    Returns a summary dict:
        {fetched, new, skipped, matched, unmatched, matched_by_method}
    """
    # 1. Fetch HTML under lock
    async with _scrape_lock:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    NEWS_URL,
                    timeout=REQUEST_TIMEOUT,
                    headers={"User-Agent": "ScoresheetManager/1.0"},
                )
                response.raise_for_status()
                html = response.text
        except httpx.HTTPStatusError as e:
            logger.error("HTTP error fetching news: %s", e)
            return {"fetched": 0, "new": 0, "skipped": 0, "matched": 0, "unmatched": 0, "matched_by_method": {}}
        except httpx.RequestError as e:
            logger.error("Request error fetching news: %s", e)
            return {"fetched": 0, "new": 0, "skipped": 0, "matched": 0, "unmatched": 0, "matched_by_method": {}}

    # 2. Parse
    items = parse_news_page(html)
    logger.info("Parsed %d news items from RotoWire", len(items))

    if not items:
        return {"fetched": 0, "new": 0, "skipped": 0, "matched": 0, "unmatched": 0, "matched_by_method": {}}

    # 3. Dedup: check which URLs already exist
    item_urls = [item.url for item in items]
    existing_result = await session.execute(
        select(PlayerNews.url).where(PlayerNews.url.in_(item_urls))
    )
    existing_urls = {row[0] for row in existing_result.all()}

    new_items = [item for item in items if item.url not in existing_urls]
    skipped = len(items) - len(new_items)

    logger.info(
        "Dedup: %d new, %d already exist",
        len(new_items),
        skipped,
    )

    # Gap detection: if all items are new, we may have missed items
    has_prior_news = (await session.execute(
        select(PlayerNews.id).limit(1)
    )).first() is not None

    if len(new_items) == len(items) and len(items) > 0 and has_prior_news:
        # Only warn if there were existing items (not the first run)
        logger.warning(
            "All %d items were new — news may have been missed between scrapes. "
            "Consider increasing scrape frequency.",
            len(items),
        )

    if not new_items:
        return {
            "fetched": len(items),
            "new": 0,
            "skipped": skipped,
            "matched": 0,
            "unmatched": 0,
            "matched_by_method": {},
        }

    # 3b. Fetch full article bodies for new items
    async with httpx.AsyncClient() as client:
        for i, item in enumerate(new_items):
            try:
                resp = await client.get(
                    item.url,
                    timeout=REQUEST_TIMEOUT,
                    headers={"User-Agent": "ScoresheetManager/1.0"},
                )
                resp.raise_for_status()
                full_body = parse_article_body(resp.text)
                if full_body:
                    item.body = full_body
                    logger.info("Fetched full article body for: %s", item.url)
            except (httpx.HTTPStatusError, httpx.RequestError) as e:
                logger.warning("Failed to fetch article body for %s: %s", item.url, e)
            if i < len(new_items) - 1:
                await asyncio.sleep(ARTICLE_FETCH_DELAY)

    # 4. Match players
    match_inputs = [(item.player_name, item.team_abbr) for item in new_items]
    match_results = await match_players_batch(session, match_inputs)

    # 5. Persist
    matched_count = 0
    unmatched_count = 0
    method_counts: dict[str, int] = {}

    for item, match in zip(new_items, match_results):
        method_counts[match.method.value] = method_counts.get(match.method.value, 0) + 1

        if match.method == MatchMethod.unmatched:
            unmatched_count += 1
            logger.warning("Unmatched player: %r (URL: %s)", item.player_name, item.url)
        else:
            matched_count += 1

        news_row = PlayerNews(
            player_id=match.player_id,
            source=item.source,
            headline=item.headline,
            url=item.url,
            published_at=item.published_at,
            body=item.body,
            raw_player_name=item.player_name,
            match_method=match.method.value,
            match_confidence=match.confidence,
        )
        session.add(news_row)

    await session.commit()

    summary = {
        "fetched": len(items),
        "new": len(new_items),
        "skipped": skipped,
        "matched": matched_count,
        "unmatched": unmatched_count,
        "matched_by_method": method_counts,
    }
    logger.info("News scrape complete: %s", summary)
    return summary
