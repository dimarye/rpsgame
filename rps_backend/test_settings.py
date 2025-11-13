"""Test settings that disable CSRF for testing."""

from .core.settings import *

# Disable CSRF for testing
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    # Remove CSRF middleware for testing
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Allow all hosts for testing
ALLOWED_HOSTS = ['*']

# Disable password validation for testing
AUTH_PASSWORD_VALIDATORS = []
