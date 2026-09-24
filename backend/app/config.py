from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """App settings, read from environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://gains:gains@localhost:5432/gains"
    frontend_origin: str = "http://localhost:5173"
    # Downloaded datasets (exercise library JSON + images). Not committed to git.
    data_dir: Path = BACKEND_DIR / "data"

    # --- Auth ---
    google_client_id: str = ""
    # Signs session cookies. Required for login; see .env.example for how to generate one.
    session_secret: SecretStr | None = None
    session_days: int = 30
    # Browsers only send Secure cookies over HTTPS, so this must be false on http://localhost.
    cookie_secure: bool = False
    # Comma-separated. Empty: any Google account that can pass the consent screen may sign in.
    allowed_emails: str = ""

    @property
    def allowed_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.allowed_emails.split(",") if e.strip()}


settings = Settings()
