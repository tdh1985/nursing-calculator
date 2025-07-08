# Quick Deployment Instructions

Your Nursing Calculator is ready for GitHub Pages! Here's exactly what you need to do:

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" button in the top right corner
3. Select "New repository"
4. Name it: `nursing-calculator`
5. Make sure it's **Public**
6. **DO NOT** initialize with README, .gitignore, or license (we already have these)
7. Click "Create repository"

## Step 2: Connect Your Local Repository

Copy and paste these commands in your terminal (one at a time):

```bash
# Navigate to your project directory
cd /mnt/c/Users/Tim/nursing-calculator

# Add GitHub as remote (replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/nursing-calculator.git

# Push to GitHub
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on "Settings" tab (top right of repository page)
3. Scroll down to "Pages" section in the left sidebar
4. Under "Source", select "GitHub Actions"
5. That's it! No other configuration needed.

## Step 4: Wait for Deployment

- The GitHub Actions workflow will automatically run
- Check the "Actions" tab to see the deployment progress
- Once complete, your site will be live at:
  `https://YOUR_USERNAME.github.io/nursing-calculator`

## If You Get Stuck

- Make sure you replace `YOUR_USERNAME` with your actual GitHub username
- If you get permission errors, you may need to authenticate with GitHub
- Check the Actions tab for any build errors

## Your Site Features

✅ Fully responsive design
✅ 24-hour nursing shift calculator
✅ Patient ratio management (1:1, 1:2, 1:3)
✅ Automatic nurse assignments
✅ Admission capacity calculations
✅ Additional staff integration
✅ Visual bed management
✅ Comprehensive reporting

The site will automatically update whenever you push changes to the main branch!