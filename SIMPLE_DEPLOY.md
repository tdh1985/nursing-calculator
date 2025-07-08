# 🚀 One-Click Deployment

I've created an automated deployment script for you! Here's the simplest way to get your Nursing Calculator live on GitHub Pages:

## Option 1: Automated Script (Recommended)

### Step 1: Authenticate with GitHub
```bash
cd /mnt/c/Users/Tim/nursing-calculator
export PATH="/tmp/gh_2.61.0_linux_amd64/bin:$PATH"
gh auth login
```

### Step 2: Run the deployment script
```bash
./deploy.sh
```

That's it! The script will:
- ✅ Create your GitHub repository
- ✅ Update the homepage URL automatically
- ✅ Push your code to GitHub
- ✅ Enable GitHub Pages
- ✅ Give you the live URL

## Option 2: Manual Steps (If script doesn't work)

### Step 1: Create GitHub Repository
1. Go to [GitHub.com](https://github.com) and sign in
2. Click "+" → "New repository"
3. Name: `nursing-calculator`
4. Make it Public
5. Don't initialize with README
6. Click "Create repository"

### Step 2: Push Your Code
```bash
cd /mnt/c/Users/Tim/nursing-calculator
git remote add origin https://github.com/YOUR_USERNAME/nursing-calculator.git
git push -u origin main
```

### Step 3: Enable GitHub Pages
1. Go to repository Settings
2. Click "Pages" in sidebar
3. Select "GitHub Actions" as source

## Your Live Site
Once deployed, visit: `https://YOUR_USERNAME.github.io/nursing-calculator`

## Features of Your Deployed App
✅ **Responsive Design** - Works on all devices
✅ **24-Hour Staffing Calculator** - AM, PM, Night shifts
✅ **Patient Ratio Management** - 1:1, 1:2, 1:3 ratios
✅ **Smart Nurse Assignment** - Automatic bed assignments
✅ **Admission Capacity** - Real-time capacity calculations
✅ **Additional Staff** - In-Charge, Ward Clerks, CNE, etc.
✅ **Visual Interface** - Interactive bed management
✅ **Comprehensive Reports** - Detailed hours breakdown

## Troubleshooting
- If authentication fails, try: `gh auth login --web`
- If repository exists, the script will update it
- Check Actions tab for deployment status
- Site typically takes 1-2 minutes to go live

🎉 Your professional nursing calculator will be live on the web!