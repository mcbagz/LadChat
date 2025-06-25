"""
Error handling utilities for LadChat API
"""

from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from pydantic import ValidationError
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class LadChatException(Exception):
    """Base exception for LadChat application"""
    def __init__(self, message: str, status_code: int = 500, details: Dict[str, Any] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)

class AuthenticationError(LadChatException):
    """Authentication related errors"""
    def __init__(self, message: str = "Authentication failed", details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED, details)

class AuthorizationError(LadChatException):
    """Authorization related errors"""
    def __init__(self, message: str = "Access denied", details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_403_FORBIDDEN, details)

class NotFoundError(LadChatException):
    """Resource not found errors"""
    def __init__(self, message: str = "Resource not found", details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_404_NOT_FOUND, details)

class ValidationError(LadChatException):
    """Data validation errors"""
    def __init__(self, message: str = "Invalid data", details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_400_BAD_REQUEST, details)

class BusinessLogicError(LadChatException):
    """Business logic related errors"""
    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY, details)

class RateLimitError(LadChatException):
    """Rate limiting errors"""
    def __init__(self, message: str = "Rate limit exceeded", details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_429_TOO_MANY_REQUESTS, details)

class ServerError(LadChatException):
    """Internal server errors"""
    def __init__(self, message: str = "Internal server error", details: Dict[str, Any] = None):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR, details)

# Error response schemas
def create_error_response(
    message: str,
    status_code: int,
    details: Dict[str, Any] = None,
    request_id: str = None
) -> JSONResponse:
    """Create standardized error response"""
    error_data = {
        "success": False,
        "error": {
            "message": message,
            "code": status_code,
            "details": details or {}
        }
    }
    
    if request_id:
        error_data["request_id"] = request_id
    
    return JSONResponse(
        status_code=status_code,
        content=error_data
    )

# Exception handlers
async def ladchat_exception_handler(request: Request, exc: LadChatException):
    """Handle custom LadChat exceptions"""
    logger.error(f"LadChat exception: {exc.message}", extra={
        "status_code": exc.status_code,
        "details": exc.details,
        "path": request.url.path,
        "method": request.method
    })
    
    return create_error_response(
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        request_id=getattr(request.state, 'request_id', None)
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle Pydantic validation errors"""
    logger.warning(f"Validation error: {exc.errors()}", extra={
        "path": request.url.path,
        "method": request.method,
        "body": exc.body if hasattr(exc, 'body') else None
    })
    
    # Format validation errors for better readability
    formatted_errors = []
    for error in exc.errors():
        field_path = " -> ".join(str(loc) for loc in error["loc"])
        formatted_errors.append({
            "field": field_path,
            "message": error["msg"],
            "type": error["type"]
        })
    
    return create_error_response(
        message="Validation error",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        details={"validation_errors": formatted_errors},
        request_id=getattr(request.state, 'request_id', None)
    )

async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle FastAPI HTTP exceptions"""
    logger.warning(f"HTTP exception: {exc.detail}", extra={
        "status_code": exc.status_code,
        "path": request.url.path,
        "method": request.method
    })
    
    return create_error_response(
        message=exc.detail,
        status_code=exc.status_code,
        request_id=getattr(request.state, 'request_id', None)
    )

async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database-related exceptions"""
    logger.error(f"Database error: {str(exc)}", extra={
        "path": request.url.path,
        "method": request.method,
        "exception_type": type(exc).__name__
    })
    
    # Handle specific database errors
    if isinstance(exc, IntegrityError):
        # Handle unique constraint violations, foreign key errors, etc.
        error_message = "Data integrity error"
        if "UNIQUE constraint failed" in str(exc):
            error_message = "Duplicate entry detected"
        elif "FOREIGN KEY constraint failed" in str(exc):
            error_message = "Referenced data not found"
        
        return create_error_response(
            message=error_message,
            status_code=status.HTTP_409_CONFLICT,
            request_id=getattr(request.state, 'request_id', None)
        )
    
    # Generic database error
    return create_error_response(
        message="Database operation failed",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        request_id=getattr(request.state, 'request_id', None)
    )

async def generic_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", extra={
        "path": request.url.path,
        "method": request.method,
        "exception_type": type(exc).__name__
    }, exc_info=True)
    
    return create_error_response(
        message="An unexpected error occurred",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        request_id=getattr(request.state, 'request_id', None)
    )

# Utility functions for common error scenarios
def raise_not_found(resource: str, identifier: Any = None):
    """Raise a standardized not found error"""
    message = f"{resource} not found"
    if identifier:
        message += f" (ID: {identifier})"
    raise NotFoundError(message)

def raise_unauthorized(message: str = "Authentication required"):
    """Raise a standardized authentication error"""
    raise AuthenticationError(message)

def raise_forbidden(message: str = "Access denied"):
    """Raise a standardized authorization error"""
    raise AuthorizationError(message)

def raise_bad_request(message: str, details: Dict[str, Any] = None):
    """Raise a standardized bad request error"""
    raise ValidationError(message, details)

def raise_conflict(message: str, details: Dict[str, Any] = None):
    """Raise a conflict error (409)"""
    raise LadChatException(message, status.HTTP_409_CONFLICT, details)

def raise_rate_limit_exceeded(message: str = "Too many requests"):
    """Raise a rate limit error"""
    raise RateLimitError(message)

# Context managers for error handling
class handle_database_errors:
    """Context manager for handling database operations"""
    
    def __init__(self, operation: str = "database operation"):
        self.operation = operation
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            return False
        
        if issubclass(exc_type, IntegrityError):
            logger.error(f"Database integrity error during {self.operation}: {exc_val}")
            raise ValidationError(f"Data validation failed during {self.operation}")
        
        if issubclass(exc_type, SQLAlchemyError):
            logger.error(f"Database error during {self.operation}: {exc_val}")
            raise ServerError(f"Database operation failed: {self.operation}")
        
        return False  # Don't suppress other exceptions 