This calculator is a responsive template built on top of TailwindCSS and fully coded in React. It comes with a few pre-coded calculators, estimators and visualizers. 

## Live demo

You can check a live demo here 👉️ [https://calculator.medtechstack.com/](https://calculator.medtechstack.com/)

## Usage

This project was bootstrapped with [Vite](https://vitejs.dev/) and Mosaic Lite. 

### Project setup
```
npm install
```

#### Compiles and hot-reloads for development
```
npm run dev
```

#### Compiles and minifies for production
```
npm run build
```

### Deployment 

The live demo if this application is deployed using [AWS Amplify](https://aws.amazon.com/amplify/) which can be a quick solution for deploying frontend only applications. They also offer a generous free tier for new users.

### Support notes 

We are shipping this templates with a very basic React configuration to let you quickly get into the development process, but we don't discourage you from using any other configuration or framework built on the top of React. 


## Data Explorer (beta) Key Features

- Full front-end solution: No server uploads, all processing done in-browser
- CSV file parsing with support for large files (up to 5MB)
- Dynamic table generation with sorting and filtering capabilities
- Column selection for customized views
- Advanced filtering options including text and numeric filters
- Saved configurations for quick access to frequent analyses
- Responsive design built with TailwindCSS

## Milestone Risk Calculator

This tool allows users to estimate survival probabilities and treatment effects.

### How to Use:

1. Enter the survival probability for the control group at a specific time point.
2. Input the Hazard Ratio (HR) from a relevant clinical trial.
3. The calculator will estimate:
   - Survival probability for the treatment group
   - Absolute risk reduction
   - Approximations of median and mean survival times

## Technical Details
- Built with React and modern JavaScript
- Utilizes Web Workers for efficient CSV parsing
- Implements chunking for handling large datasets
- Real-time search and filter functionality
- Responsive UI powered by TailwindCSS

## Terms and License

- Released under the [MIT](https://opensource.org/license/mit).
- We do not guarantee the accuracy or completeness of any code or content, and you are using this repo and tools at your own discretion and risk. No warranty, express or implied, is provided, and we disclaim all implied warranties. 