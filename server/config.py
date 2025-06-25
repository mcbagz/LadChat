from decouple import config
import secrets

class Settings:
    """
    Application settings and configuration
    """
    # JWT Configuration
    SECRET_KEY: str = config("SECRET_KEY", default=secrets.token_urlsafe(32))
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = config("ACCESS_TOKEN_EXPIRE_MINUTES", default=30, cast=int)
    REFRESH_TOKEN_EXPIRE_DAYS: int = config("REFRESH_TOKEN_EXPIRE_DAYS", default=7, cast=int)
    
    # Database
    DATABASE_URL: str = config("DATABASE_URL", default="sqlite:///./ladchat.db")
    
    # Security
    BCRYPT_ROUNDS: int = config("BCRYPT_ROUNDS", default=12, cast=int)
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = config("RATE_LIMIT_REQUESTS", default=100, cast=int)
    RATE_LIMIT_WINDOW: int = config("RATE_LIMIT_WINDOW", default=3600, cast=int)  # 1 hour
    
    # Application
    APP_NAME: str = "LadChat API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = config("DEBUG", default=True, cast=bool)
    
    # Media Storage
    MEDIA_BASE_URL: str = config("MEDIA_BASE_URL", default="http://192.168.0.14:8000")
    
    # CORS
    ALLOWED_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:8081",  # Expo default
        "http://192.168.*.*:8081",  # Local network for mobile testing
    ]

# Create settings instance
settings = Settings()

# Create .env file template
ENV_TEMPLATE = """
# LadChat API Configuration
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
DATABASE_URL=sqlite:///./ladchat.db
BCRYPT_ROUNDS=12
DEBUG=true
""" 