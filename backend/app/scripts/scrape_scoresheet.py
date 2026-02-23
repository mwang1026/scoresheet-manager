#!/usr/bin/env python3
"""
CLI script for Scoresheet.com scraping.

Usage:
    python -m app.scripts.scrape_scoresheet leagues
    python -m app.scripts.scrape_scoresheet teams FOR_WWW1/AL_Catfish_Hunter
"""

import argparse
import asyncio

import httpx

from app.services.scoresheet_scraper import fetch_league_list, fetch_league_teams


async def cmd_leagues() -> None:
    """Fetch and print all leagues from BB_LeagueList.php."""
    print("Fetching league list from scoresheet.com...")
    async with httpx.AsyncClient() as client:
        leagues = await fetch_league_list(client)

    print(f"\nFound {len(leagues)} leagues:\n")
    for league in leagues:
        print(f"  {league.name:<40}  {league.data_path}")


async def cmd_teams(data_path: str) -> None:
    """Fetch and print team owner names for the given league."""
    print(f"Fetching teams for: {data_path}")
    async with httpx.AsyncClient() as client:
        teams = await fetch_league_teams(client, data_path)

    print(f"\nFound {len(teams)} teams:\n")
    for team in teams:
        print(f"  Team #{team.scoresheet_id:2d}  {team.owner_name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Scoresheet.com scraper CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m app.scripts.scrape_scoresheet leagues
  python -m app.scripts.scrape_scoresheet teams FOR_WWW1/AL_Catfish_Hunter
""",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # leagues subcommand
    subparsers.add_parser("leagues", help="List all Scoresheet leagues")

    # teams subcommand
    teams_parser = subparsers.add_parser(
        "teams", help="List teams for a specific league"
    )
    teams_parser.add_argument(
        "data_path",
        help="League data path (e.g. FOR_WWW1/AL_Catfish_Hunter)",
    )

    args = parser.parse_args()

    if args.command == "leagues":
        asyncio.run(cmd_leagues())
    elif args.command == "teams":
        asyncio.run(cmd_teams(args.data_path))


if __name__ == "__main__":
    main()
