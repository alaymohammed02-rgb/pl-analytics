"""Minimal stand-in for the `pitchapi` package, so sync.py can be imported by the tests without network or a key.
The Python tests replace `PitchAPI` with their own fake client."""


class PitchAPIError(Exception):
    pass


class NotFoundError(PitchAPIError):
    pass


class PlanUpgradeRequiredError(PitchAPIError):
    pass


class RateLimitError(PitchAPIError):
    pass


class PitchAPI:
    def __init__(self, api_key=None, **kw):
        raise RuntimeError("the pitchapi stub has no network access; tests must fake the client")

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False
