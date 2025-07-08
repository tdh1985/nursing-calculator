#!/bin/bash

# GitHub deployment script for Nursing Calculator
echo "🚀 Starting GitHub Pages deployment..."

# Install GitHub CLI if not available
if ! command -v gh &> /dev/null; then
    echo "📦 Installing GitHub CLI..."
    curl -L https://github.com/cli/cli/releases/download/v2.61.0/gh_2.61.0_linux_amd64.tar.gz -o /tmp/gh_linux_amd64.tar.gz
    tar -xzf /tmp/gh_linux_amd64.tar.gz -C /tmp
    export PATH="/tmp/gh_2.61.0_linux_amd64/bin:$PATH"
fi

# Check if already authenticated
if ! gh auth status &> /dev/null; then
    echo "🔑 GitHub authentication required..."
    echo "Please run: gh auth login"
    echo "Then run this script again."
    exit 1
fi

# Get GitHub username
USERNAME=$(gh api user --jq .login)
echo "👤 GitHub username: $USERNAME"

# Update package.json with correct homepage
sed -i "s/https:\/\/.*\.github\.io\/nursing-calculator/https:\/\/$USERNAME.github.io\/nursing-calculator/" package.json
echo "✅ Updated package.json homepage URL"

# Commit the change
git add package.json
git commit -m "Update homepage URL for $USERNAME" || echo "No changes to commit"

# Create GitHub repository
echo "🔨 Creating GitHub repository..."
gh repo create nursing-calculator --public --description "Hospital Nursing Calculator - Calculate staffing and hours for all shifts" || echo "Repository may already exist"

# Add remote and push
echo "📤 Pushing to GitHub..."
git remote add origin https://github.com/$USERNAME/nursing-calculator.git 2>/dev/null || git remote set-url origin https://github.com/$USERNAME/nursing-calculator.git
git push -u origin main

# Enable GitHub Pages
echo "🌐 Enabling GitHub Pages..."
gh api repos/$USERNAME/nursing-calculator/pages -X POST -f source='{\"branch\":\"main\",\"path\":\"/\"}' || echo "Pages may already be enabled"

echo "✅ Deployment complete!"
echo "🎉 Your site will be available at: https://$USERNAME.github.io/nursing-calculator"
echo "📊 Check deployment status: https://github.com/$USERNAME/nursing-calculator/actions"