"""Daily cron: fetch yesterday's MLB boxscores and seed into database."""

import logging
import subprocess
import sys

from app.logging_config import setup_logging

setup_logging()
logger = logging.getLogger(__name__)


def main():
    for script in ["app.scripts.fetch_mlb_boxscores", "app.scripts.seed_daily_stats"]:
        logger.info("Running %s...", script)
        result = subprocess.run([sys.executable, "-m", script])
        if result.returncode != 0:
            logger.error("%s failed (exit %d)", script, result.returncode)
            sys.exit(result.returncode)
    logger.info("Daily ingest complete.")


if __name__ == "__main__":
    main()
