# 🐙 GitHub Repository Setup

## Quick Start Commands

### 1. Initialize Git Repository (if not already done)
```bash
git init
git add .
git commit -m "Initial commit: BanterBox AI Streaming Platform

- Discord bot integration with slash commands
- OpenAI-powered banter generation with TTS
- WebSocket real-time communication
- PostgreSQL database with Drizzle ORM
- Dual authentication (Google OAuth + email/password)
- Production-ready Render.com deployment configuration
- Complete documentation and deployment guides"
```

### 2. Create GitHub Repository
1. Go to [GitHub.com](https://github.com)
2. Click "New repository"
3. Name: `banterbox` (or your preferred name)
4. Description: `AI-powered Discord streaming platform with real-time banter generation`
5. Choose Public or Private
6. **Don't** initialize with README (we have one)
7. Click "Create repository"

### 3. Connect Local Repository to GitHub
```bash
# Replace 'your-username' with your GitHub username
git remote add origin https://github.com/your-username/banterbox.git
git branch -M main
git push -u origin main
```

## Repository Files Checklist

### ✅ Core Application Files
- [ ] All source code (client/, server/, shared/)
- [ ] Configuration files (package.json, tsconfig.json, etc.)
- [ ] Build scripts and Vite configuration

### ✅ Documentation Files  
- [ ] `README.md` - Project overview and setup instructions
- [ ] `DEPLOYMENT.md` - Detailed deployment guide for Render.com
- [ ] `DEPLOYMENT_CHECKLIST.md` - Step-by-step deployment verification
- [ ] `GITHUB_SETUP.md` - This file
- [ ] `replit.md` - Project architecture and user preferences

### ✅ Configuration Files
- [ ] `.env.example` - Environment variable template
- [ ] `.gitignore` - Excludes sensitive and build files
- [ ] `render.yaml` - Render.com deployment configuration

### ✅ Excluded Files (via .gitignore)
- [ ] `.env` - Your actual environment variables (NEVER commit)
- [ ] `node_modules/` - Dependencies (will be installed on deployment)
- [ ] `dist/` - Build output (will be generated on deployment)
- [ ] `.replit` - Replit-specific files

## Environment Variables Security

### ❌ NEVER commit these files:
- `.env` - Contains your actual API keys
- Any files with real Discord bot tokens
- Database passwords or connection strings
- API keys for OpenAI, ElevenLabs, Google OAuth

### ✅ Safe to commit:
- `.env.example` - Template without real values
- Documentation referencing environment variables
- Configuration files that use `process.env.*` references

## GitHub Repository Settings

### Recommended Settings:
1. **Branch Protection**: Protect `main` branch
2. **Security**: Enable dependency vulnerability alerts
3. **Issues**: Enable issue tracking
4. **Wiki**: Enable for additional documentation
5. **Discussions**: Enable for community feedback

### Optional Features:
- **GitHub Actions**: CI/CD workflows
- **Dependabot**: Automated dependency updates
- **Code Scanning**: Security analysis
- **Pages**: Host documentation

## Next Steps After GitHub Push

1. **Verify Upload**: Check that all files appear correctly on GitHub
2. **Test Clone**: Clone to a new directory to verify completeness
3. **Deploy to Render**: Follow DEPLOYMENT.md instructions
4. **Set Repository URL**: Update README.md with your actual repository URL
5. **Create Release**: Tag v1.0.0 when deployed successfully

## Team Collaboration

### If working with a team:
1. **Add Collaborators**: Settings → Manage access
2. **Branch Strategy**: Consider using feature branches
3. **Pull Requests**: Enable PR reviews for code quality
4. **Issue Templates**: Create templates for bugs/features
5. **Contributing Guide**: Add CONTRIBUTING.md if accepting external contributions

## Troubleshooting

### Common Issues:
- **Large files**: Use Git LFS for files >100MB
- **Permission denied**: Check SSH keys or use HTTPS
- **Branch conflicts**: Use `git pull --rebase` before pushing
- **Missing files**: Check .gitignore isn't excluding needed files

### Quick Fixes:
```bash
# Fix large bundle warning
git config http.postBuffer 157286400

# Check what's being tracked
git ls-files

# Remove accidentally committed .env
git rm --cached .env
git commit -m "Remove .env from tracking"
```

---

**Ready to push to GitHub! 🚀**

Once pushed, your repository will be ready for Render.com deployment.