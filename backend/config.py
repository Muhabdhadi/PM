import os

from dotenv import load_dotenv
from slowapi import Limiter
from slowapi.util import get_remote_address

_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_PROJECT_ROOT, ".env"))

VALID_USERNAME: str = os.environ.get("APP_USERNAME", "user")
VALID_PASSWORD: str = os.environ.get("APP_PASSWORD", "password")
SESSION_COOKIE_NAME: str = "session_token"
COOKIE_SECURE: bool = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
STATIC_DIR: str = os.path.join(os.path.dirname(__file__), "static")

# Shared limiter instance — imported by both the app and route decorators.
# Can be disabled (e.g. for e2e tests) via DISABLE_RATE_LIMIT=1.
RATE_LIMIT_ENABLED: bool = os.environ.get("DISABLE_RATE_LIMIT", "").lower() not in (
    "1",
    "true",
    "yes",
)
limiter = Limiter(key_func=get_remote_address, enabled=RATE_LIMIT_ENABLED)
