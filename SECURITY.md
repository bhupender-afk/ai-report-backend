# 🔒 Security Guidelines

## ⚠️ Critical Security Practices

### Environment Files
- **NEVER** commit `.env`, `.env.production`, `.env.local` files to Git
- These files contain sensitive credentials that should never be exposed
- Always use `.env.example` and `.env.production.example` as templates

### Files That Must Stay Private:
- `.env` - Development environment variables
- `.env.production` - Production environment variables
- `.env.deploy` - Deployment credentials
- Any files containing:
  - Database connection strings
  - API keys and tokens
  - SMTP passwords
  - JWT secrets
  - Payment gateway credentials

## 🛡️ Security Checklist

### Before Deployment:
- [ ] All `.env*` files are in `.gitignore`
- [ ] No hardcoded secrets in source code
- [ ] Strong JWT secret generated
- [ ] Production database uses authentication
- [ ] SMTP credentials are app-specific passwords

### MongoDB Security:
- [ ] Use MongoDB Atlas or properly secured MongoDB instance
- [ ] Enable authentication
- [ ] Use connection string with credentials
- [ ] Restrict network access to known IPs

### Email Security:
- [ ] Use app-specific passwords for Gmail/Outlook
- [ ] Enable 2FA on email accounts
- [ ] Use dedicated email service for production

### API Security:
- [ ] JWT tokens properly configured
- [ ] CORS configured for production domains
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints

## 🚨 If Credentials Are Exposed:

### Immediate Actions:
1. **Change all exposed credentials immediately**
2. **Remove from Git history** (use `git filter-branch` or BFG)
3. **Update `.gitignore`** to prevent future exposure
4. **Notify team members** about the security incident

### For This Project:
If you see GitGuardian or similar alerts:
1. Change MongoDB password immediately
2. Generate new JWT secret
3. Update SMTP credentials
4. Push security fixes to repository
5. Verify no credentials remain in Git history

## 📋 Credential Rotation Schedule:
- JWT secrets: Every 6 months
- Database passwords: Every 3 months
- API keys: As recommended by provider
- SMTP passwords: Every 6 months

## 🔧 Tools for Security:
- GitGuardian - Secret detection
- git-secrets - Prevent committing secrets
- dotenv-safe - Ensure all required env vars are set
- Security-focused linting rules

Remember: **Security is everyone's responsibility!** 🛡️