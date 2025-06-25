"""
Logging configuration for LadChat API
"""

import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from config import settings

def setup_logging():
    """
    Configure logging for the application
    """
    # Create logs directory if it doesn't exist
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)
    
    # Create formatters
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s'
    )
    console_formatter = logging.Formatter(
        '%(levelname)s - %(name)s - %(message)s'
    )
    
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)
    
    # File handler for general logs
    file_handler = RotatingFileHandler(
        logs_dir / "ladchat.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)
    
    # Error handler for errors only
    error_handler = RotatingFileHandler(
        logs_dir / "errors.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)
    
    # Security events handler
    security_handler = RotatingFileHandler(
        logs_dir / "security.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=10
    )
    security_handler.setLevel(logging.WARNING)
    security_handler.setFormatter(file_formatter)
    
    # Create security logger
    security_logger = logging.getLogger("security")
    security_logger.addHandler(security_handler)
    security_logger.setLevel(logging.WARNING)
    security_logger.propagate = False  # Don't propagate to root logger
    
    # Database operations logger
    db_handler = RotatingFileHandler(
        logs_dir / "database.log",
        maxBytes=5 * 1024 * 1024,  # 5MB
        backupCount=3
    )
    db_handler.setLevel(logging.INFO)
    db_handler.setFormatter(file_formatter)
    
    db_logger = logging.getLogger("database")
    db_logger.addHandler(db_handler)
    db_logger.setLevel(logging.INFO)
    db_logger.propagate = False
    
    # API requests logger
    api_handler = RotatingFileHandler(
        logs_dir / "api.log",
        maxBytes=20 * 1024 * 1024,  # 20MB
        backupCount=5
    )
    api_handler.setLevel(logging.INFO)
    api_handler.setFormatter(file_formatter)
    
    api_logger = logging.getLogger("api")
    api_logger.addHandler(api_handler)
    api_logger.setLevel(logging.INFO)
    api_logger.propagate = False
    
    logging.info("Logging system initialized")

def get_logger(name: str):
    """Get a logger instance"""
    return logging.getLogger(name)

def log_security_event(event_type: str, details: dict, user_id: int = None, ip_address: str = None):
    """Log security-related events"""
    security_logger = logging.getLogger("security")
    
    log_data = {
        "event_type": event_type,
        "details": details,
        "user_id": user_id,
        "ip_address": ip_address
    }
    
    security_logger.warning(f"Security Event: {log_data}")

def log_database_operation(operation: str, table: str, record_id: int = None, user_id: int = None):
    """Log database operations"""
    db_logger = logging.getLogger("database")
    
    log_data = {
        "operation": operation,
        "table": table,
        "record_id": record_id,
        "user_id": user_id
    }
    
    db_logger.info(f"DB Operation: {log_data}")

def log_api_request(method: str, endpoint: str, user_id: int = None, response_time: float = None, status_code: int = None):
    """Log API requests"""
    api_logger = logging.getLogger("api")
    
    log_data = {
        "method": method,
        "endpoint": endpoint,
        "user_id": user_id,
        "response_time": response_time,
        "status_code": status_code
    }
    
    api_logger.info(f"API Request: {log_data}") 