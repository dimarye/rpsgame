# Rock Paper Scissors - Real-time Multiplayer Game

A modern, real-time multiplayer Rock Paper Scissors game built with React, Django, and WebSockets. Features smooth animations, responsive design, and robust error handling.

## 🎮 Features

- **Real-time multiplayer** gameplay with WebSocket communication
- **Smooth animations** and transitions for enhanced UX
- **Responsive design** that works on all devices
- **Error handling** for connection issues, timeouts, and edge cases
- **Toast notifications** for user feedback
- **Network status monitoring** with automatic reconnection
- **Integration tests** for reliable WebSocket communication
- **Modern UI** with Tailwind CSS and Framer Motion

## 🏗️ Architecture

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│   React Client  │ ◄──────────────► │  Django Server  │
│                 │                  │                 │
│ • Real-time UI  │                  │ • Game Logic    │
│ • Animations    │                  │ • WebSocket API │
│ • Error Handling│                  │ • Database      │
└─────────────────┘                  └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+ and pip
- PostgreSQL 12+ (or use Docker)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rpsgame
```

### 2. Backend Setup (Django)

```bash
# Navigate to backend directory
cd rps_backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database settings

# Run database migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Start the Django server
python manage.py runserver
```

The backend will be available at `http://localhost:8000`

### 3. Frontend Setup (React)

```bash
# Navigate to frontend directory (in a new terminal)
cd rps_frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. WebSocket Connection

The WebSocket server is automatically started with Django. The frontend connects to:
- Development: `ws://localhost:8000/ws/match/<match_id>/`
- Production: `wss://your-domain.com/ws/match/<match_id>/`

## 📋 Detailed Setup

### Backend Configuration

#### Environment Variables (.env)

```env
# Database Settings
DB_NAME=rpsgame
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# CORS Settings (for frontend)
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### Database Setup

**Option 1: PostgreSQL (Recommended)**
```bash
# Install PostgreSQL
# Create database
createdb rpsgame

# Run migrations
python manage.py migrate
```

**Option 2: SQLite (Development)**
```python
# In settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}
```

#### Running Tests

```bash
# Run Django tests
python manage.py test

# Run with coverage
pip install coverage
coverage run --source='.' manage.py test
coverage report
```

### Frontend Configuration

#### Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "test": "vitest",
    "test:integration": "vitest run tests/integration",
    "test:watch": "vitest watch"
  }
}
```

#### Environment Variables

Create `.env` in `rps_frontend/`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

#### Running Tests

```bash
# Run all tests
npm test

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

## 🔌 WebSocket Protocol

### Connection

```javascript
// Connect to a match WebSocket
const ws = new WebSocket('ws://localhost:8000/ws/match/123/');

// Send authentication token
ws.send(JSON.stringify({
  type: 'authenticate',
  token: 'your-jwt-token'
}));
```

### Message Types

#### Client → Server Messages

```json
// Make a move
{
  "type": "move",
  "payload": {
    "choice": "rock"  // "rock", "paper", or "scissors"
  }
}

// Request state sync
{
  "type": "sync_request"
}

// Report timeout
{
  "type": "timeout",
  "payload": {
    "playerId": 1,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### Server → Client Messages

```json
// Move notification
{
  "type": "move",
  "payload": {
    "move": {
      "playerId": 2,
      "choice": "paper",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  }
}

// Round result
{
  "type": "result",
  "payload": {
    "result": {
      "winner": 2,
      "result": "win",
      "player1_id": 1,
      "player2_id": 2,
      "moves": [
        {"playerId": 1, "choice": "rock", "timestamp": "..."},
        {"playerId": 2, "choice": "paper", "timestamp": "..."}
      ],
      "round_number": 1
    }
  }
}

// Opponent left
{
  "type": "opponent_left"
}

// Server error
{
  "type": "error",
  "payload": {
    "message": "Error description"
  }
}

// Full state sync
{
  "type": "state",
  "status": "active",
  "moves": [...],
  "opponent": {...},
  "timer": {...},
  "current_round": {...},
  "wins_needed": 3,
  "winner": null
}
```

## 🎯 Game Flow

1. **Match Creation**: Players create or join matches through the API
2. **WebSocket Connection**: Both players connect to the match WebSocket
3. **Game Start**: Server signals game start, timers begin
4. **Move Selection**: Players select moves within time limit
5. **Result Calculation**: Server determines winner and broadcasts result
6. **Next Round**: Game continues until one player wins required rounds
7. **Match End**: Final results are recorded and displayed

## 🧪 Testing

### Integration Tests

Comprehensive integration tests ensure WebSocket communication works correctly:

```bash
# Run WebSocket integration tests
npm run test:integration

# Test scenarios covered:
# • Player A makes move → Player B sees instantly
# • Player B makes move → server determines result → both see result
# • Disconnect A → B receives opponent_left
# • Reconnect A → state is restored
# • Timeout → server sends result
```

### Manual Testing

1. **Open two browser windows** to `http://localhost:5173`
2. **Create/join matches** in each window
3. **Test gameplay** by making moves
4. **Test edge cases**:
   - Disconnect one browser
   - Wait for timeout
   - Refresh during active game

## 🎨 UI Components

### Key Components

- **MoveSelector**: Animated move selection buttons
- **TurnTimer**: Real-time countdown with visual feedback
- **NetworkStatus**: Connection monitoring and notifications
- **ErrorBoundary**: React error boundary with recovery
- **Toast Notifications**: User feedback system

### Animations

- **Smooth transitions** for all UI state changes
- **Loading states** with spinners and progress indicators
- **Success/error animations** for user feedback
- **Responsive animations** that respect user preferences

## 🔧 Development

### Code Structure

```
rpsgame/
├── rps_backend/          # Django backend
│   ├── game/            # Game app
│   │   ├── consumers.py # WebSocket consumers
│   │   ├── models.py    # Database models
│   │   ├── views.py     # API views
│   │   └── urls.py      # URL routing
│   └── manage.py        # Django management
├── rps_frontend/         # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── store/       # State management
│   │   └── tests/       # Test files
│   └── package.json
└── README.md
```

### State Management

Uses **Zustand** for lightweight state management:

```javascript
// Match store structure
{
  matchId: string,
  playerId: number,
  opponent: object,
  moves: array,
  roundResult: object,
  isConnected: boolean,
  error: string,
  countdown: number,
  timeoutOccurred: boolean
}
```

### Error Handling

Comprehensive error handling includes:

- **WebSocket errors**: Automatic reconnection with exponential backoff
- **Network issues**: User notifications and retry mechanisms
- **Game errors**: Clear error messages and recovery options
- **React errors**: Error boundaries with fallback UI

## 🚀 Deployment

### Backend Deployment (Docker)

```dockerfile
# Dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "rpsgame.wsgi:application"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:13
    environment:
      POSTGRES_DB: rpsgame
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./rps_backend
    ports:
      - "8000:8000"
    depends_on:
      - db
    environment:
      - DB_HOST=db
      - DB_NAME=rpsgame
      - DB_USER=postgres
      - DB_PASSWORD=password

volumes:
  postgres_data:
```

### Frontend Deployment

```bash
# Build for production
npm run build

# Deploy build/ directory to web server
# Configure reverse proxy for WebSocket connections
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    location / {
        root /path/to/rps_frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket connections
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🐛 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Check if Django server is running
- Verify CORS settings in Django
- Check firewall/network restrictions

**Database Connection Error**
- Verify PostgreSQL is running
- Check database credentials in .env
- Run migrations: `python manage.py migrate`

**Frontend Build Errors**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version (requires 16+)
- Verify environment variables

**Game Not Responding**
- Check browser console for errors
- Verify WebSocket connection in Network tab
- Test with different browsers

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('debug', 'rps:*');

// Django settings
LOGGING = {
    'version': 1,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'game': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Code Style

- **Python**: Follow PEP 8, use Black formatter
- **JavaScript**: Use ESLint and Prettier
- **Components**: Keep components small and focused
- **Tests**: Write tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React** for the frontend framework
- **Django** for the backend framework
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Vitest** for testing
- **WebSocket API** for real-time communication

## 📞 Support

For questions or issues:

1. Check the troubleshooting section
2. Search existing GitHub issues
3. Create new issue with detailed description
4. Include error logs and steps to reproduce

---

**Enjoy playing Rock Paper Scissors! 🎮✂️📄**