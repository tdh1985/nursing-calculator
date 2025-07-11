# Nursing Calculator

A modern, professional hospital nursing calculator for advanced shift planning. This tool helps healthcare administrators and nursing managers efficiently plan staffing across AM, PM, and Night shifts.

## Features

- **Real-time Nurse Assignment**: Automatically calculates and assigns nurses based on patient ratios
- **Flexible Patient Ratios**: Supports any ratio (1:1, 1:2, 1:3, 1:4, etc.)
- **Complex Bed Management**:
  - Track current patients and their movements
  - Handle bed transfers with ratio changes
  - Manage turnovers and new admissions
  - Plan for discharges and ward transfers
- **Shift Planning**: Calculate staffing needs for AM (8hr), PM (8hr), and Night (10hr) shifts
- **Additional Staff Support**: Include in-charge nurses, ward clerks, and other support staff
- **Visual Bed Status**: Color-coded bed occupancy visualization
- **Admission Capacity**: Real-time calculation of additional admission capacity

## Live Demo

Visit: [https://[YOUR-USERNAME].github.io/nursing-calculator](https://[YOUR-USERNAME].github.io/nursing-calculator)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/[YOUR-USERNAME]/nursing-calculator.git
cd nursing-calculator
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Deployment

To deploy to GitHub Pages:

1. Update the `homepage` field in `package.json` with your GitHub username
2. Run:
```bash
npm run deploy
```

## Usage

1. **AM Shift**: Enter the number of nurses for the morning shift
2. **Bed Management**: For each bed:
   - Enter the patient ratio (e.g., "1:2")
   - Select the patient status:
     - **Staying**: Patient remains for PM/Night
     - **Ratio Change**: Patient stays but acuity changes
     - **Moving Beds**: Patient transfers to another bed
     - **Move + Ratio**: Transfer with ratio change
     - **To Ward**: Patient leaves the unit
     - **New Admission**: Empty bed receiving a patient
     - **Discharge**: Patient leaves, bed remains empty
     - **Turnover**: Patient leaves and new patient arrives
3. **Additional Staff**: Check boxes for in-charge nurse, ward clerk, etc.
4. **View Results**: See automatic nurse assignments and total hours required

## Technology Stack

- React 18
- Tailwind CSS (via CDN)
- Modern ES6+ JavaScript

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

MIT