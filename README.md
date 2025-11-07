# AI Report Backend

Enhanced backend API for crypto due diligence and report generation platform.

## 🚀 Live API Endpoints

The backend is deployed and running on: **http://31.97.235.250:8080**

### Health Check
```bash
curl http://31.97.235.250:8080/api/health
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/send-otp` - Send OTP for authentication
- `POST /api/auth/verify-otp` - Verify OTP and get tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get user profile (requires auth)
- `POST /api/auth/logout` - Logout user (requires auth)

### Subscription Endpoints
- `GET /api/plans` - Get available subscription plans
- `POST /api/subscription/create-order` - Create Razorpay order (requires auth)
- `POST /api/subscription/verify-payment` - Verify payment (requires auth)
- `GET /api/subscription/history` - Get purchase history (requires auth)
- `GET /api/subscription/credits` - Get user credits (requires auth)

### Report Generation Endpoints
- `POST /api/reports/generate` - Generate new report (requires auth + file upload)
- `GET /api/reports/:reportId` - Get report details (requires auth)
- `GET /api/reports/status/:requestId` - Get report generation status
- `GET /api/reports` - Get user's reports (requires auth)
- `GET /api/reports/:reportId/download` - Download report (requires auth)

### Legacy Endpoints (Backward Compatibility)
- `POST /api/submit` - Submit analysis request
- `GET /api/status/:requestId` - Get request status
- `GET /api/results/:requestId` - Get analysis results
- `GET /api/recent` - Get recent assessments
- `GET /api/projects` - Get project statistics
- `GET /api/projects/:domain/history` - Get project history

### Webhook Endpoints
- `POST /api/webhook/razorpay` - Razorpay payment webhooks

## 🛠️ Local Development

### Prerequisites
- Node.js v18+
- MongoDB instance
- npm/yarn

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure
4. Start development server: `npm run dev`

### Environment Variables
```env
MONGODB_URI=your_mongodb_connection_string
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
# ... other variables
```

## 🚀 Deployment

### Quick Deploy
```bash
./deploy.sh
```

### Manual Deployment
1. Copy files to server: `/var/www/zuvomo_launchpad/ai-report-backend/`
2. Install dependencies: `npm install --production`
3. Set up environment: `cp .env.production .env`
4. Start with PM2: `PORT=8080 pm2 start server-enhanced.js --name ai-report-backend`

### PM2 Management
```bash
# Check status
pm2 status

# View logs
pm2 logs ai-report-backend

# Restart
pm2 restart ai-report-backend

# Stop
pm2 stop ai-report-backend
```

## 📁 Project Structure
```
backend/
├── auth/                 # Authentication controllers and middleware
├── controllers/          # Route controllers
├── models/              # MongoDB models
├── services/            # Business logic services
├── templates/           # Email templates
├── uploads/             # File upload directory
├── logs/                # Application logs
├── server-enhanced.js   # Main server file
├── ecosystem.config.js  # PM2 configuration
└── deploy.sh           # Deployment script
```

## 🔐 Security Features
- JWT-based authentication
- OTP verification
- CORS protection
- Environment-based configuration
- File upload validation
- Rate limiting ready

## 🌐 Git Workflow

### Setup GitHub Repository
1. Create new repository on GitHub
2. Add remote: `git remote add origin <your-repo-url>`
3. Push code: `git push -u origin main`

### Bidirectional Workflow
```bash
# Local to GitHub to Server
git add . && git commit -m "Your changes"
git push origin main

# On server, pull changes
git pull origin main
./deploy.sh

# Server to GitHub to Local
# (Work directly on server when needed)
git add . && git commit -m "Server changes"
git push origin main

# On local machine
git pull origin main
```

## 📊 Monitoring
- PM2 process monitoring
- Application logs in `logs/` directory
- Health check endpoint: `/api/health`
- MongoDB connection monitoring

## 🔧 Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports 3000/3003 are in use, use 8080
2. **MongoDB connection**: Verify MONGODB_URI in .env
3. **PM2 not starting**: Check logs with `pm2 logs ai-report-backend`
4. **File permissions**: Ensure uploads/ directory is writable

### Useful Commands
```bash
# Check running processes
pm2 status

# Check port usage
ss -tlnp | grep :8080

# Test API locally
curl localhost:8080/api/health

# Restart services
pm2 restart all
```

## 📝 Version History
- v2.0.0 - Enhanced features with authentication and subscriptions
- v1.0.0 - Initial crypto due diligence API