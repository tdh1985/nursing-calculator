# Hospital Nursing Calculator

A comprehensive React application for calculating hospital nursing staffing requirements and hours across all shifts (AM, PM, and Night).

## Features

- **24-Hour Staffing Analysis**: Calculate nurse requirements for AM (8hr), PM (8hr), and Night (10hr) shifts
- **Patient Ratio Management**: Support for 1:1, 1:2, and 1:3 patient-to-nurse ratios
- **Intelligent Nurse Assignment**: Automatically assigns nurses to beds based on patient acuity
- **Admission Capacity Planning**: Real-time calculation of admission capacity for each shift
- **Additional Staff Integration**: Include In-Charge nurses, Ward Clerks, AM 515, and CNE staff
- **Visual Bed Management**: Interactive bed occupancy visualization
- **Comprehensive Reporting**: Detailed hours breakdown and staffing summaries

## Live Demo

Visit the live application: [https://username.github.io/nursing-calculator](https://username.github.io/nursing-calculator)

## Deployment Instructions

### Prerequisites

1. **GitHub Account**: You'll need a GitHub account
2. **Node.js**: Install Node.js (version 18 or higher)
3. **Git**: Install Git on your local machine

### Setup Steps

1. **Create a new GitHub repository**:
   - Go to GitHub and create a new repository named `nursing-calculator`
   - Don't initialize with README (we'll push our existing code)

2. **Update package.json**:
   - Edit `package.json` and replace `username` in the homepage URL with your actual GitHub username:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/nursing-calculator"
   ```

3. **Initialize and push to GitHub**:
   ```bash
   # Navigate to your project directory
   cd nursing-calculator
   
   # Initialize git repository
   git init
   
   # Add all files
   git add .
   
   # Commit files
   git commit -m "Initial commit: Hospital Nursing Calculator"
   
   # Add remote repository (replace YOUR_USERNAME with your GitHub username)
   git remote add origin https://github.com/YOUR_USERNAME/nursing-calculator.git
   
   # Push to GitHub
   git push -u origin main
   ```

4. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click on "Settings" tab
   - Scroll down to "Pages" section
   - Under "Source", select "GitHub Actions"
   - The workflow will automatically run when you push to main branch

5. **Install dependencies and test locally** (optional):
   ```bash
   npm install
   npm start
   ```

### Automatic Deployment

The repository includes a GitHub Actions workflow that will:

1. **Trigger on push to main branch**
2. **Install dependencies** using npm
3. **Build the React application**
4. **Deploy to GitHub Pages** automatically

Your site will be available at: `https://YOUR_USERNAME.github.io/nursing-calculator`

### Manual Deployment (Alternative)

If you prefer manual deployment:

1. **Install gh-pages package**:
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Deploy manually**:
   ```bash
   npm run deploy
   ```

### Customization

To customize the application:

1. **Edit src/App.js** to modify the main component
2. **Update public/index.html** to change meta tags or title
3. **Modify src/index.css** for global styles
4. **Push changes** to trigger automatic redeployment

### Troubleshooting

- **404 Error**: Make sure the homepage URL in package.json matches your GitHub username
- **Build Failures**: Check the Actions tab in your GitHub repository for error details
- **Permissions**: Ensure GitHub Actions has permissions to write to the repository

## Usage

1. **AM Shift**: Enter the number of current AM shift nurses (8-hour shifts)
2. **Bed Ratios**: Enter patient ratios (1:1, 1:2, 1:3) for each bed
3. **Additional Staff**: Toggle options for In-Charge nurses, Ward Clerks, etc.
4. **Review Results**: View comprehensive staffing analysis and admission capacity

## Built With

- **React 18** - Frontend framework
- **Tailwind CSS** - Styling via CDN
- **GitHub Actions** - Automated deployment
- **GitHub Pages** - Static site hosting

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues or questions, please open an issue on the GitHub repository.