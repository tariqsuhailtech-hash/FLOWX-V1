import asyncio


class BaseExchangeProvider:
    """Provider abstraction. Analytics never depends on exchange-specific fields;
    every provider normalizes into session.on_trade / on_book / on_ticker."""

    name = "BASE"

    def capabilities(self):
        return {"spot": False, "perp": False, "history": False}

    async def seed(self, session):
        """Optionally backfill session.candles / ticker from REST history."""
        return

    async def run(self, session):
        """Connect, subscribe and stream until session.stopped. Must reconnect."""
        while not session.stopped:
            await asyncio.sleep(1)
