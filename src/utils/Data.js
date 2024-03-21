import Fox from "../images/Fox.png";

export const clearCellTrials = [
  {
    id: "2",
    image: null,
    name: "CheckMate-9ER",
    year: "2021",
    totalEnrolled: 323,
    link: "https://www.nejm.org/doi/full/10.1056/nejmoa2026982",
    description:
      "Nivolumab plus Cabozantinib versus Sunitinib for Advanced Renal-Cell Carcinoma",
  },
  {
    id: "3",
    image: null,
    year: "2021",
    name: "KEYNOTE-426",
    totalEnrolled: 861,
    link: "https://pubmed.ncbi.nlm.nih.gov/33284113/",
    description:
      "Pembrolizumab plus axitinib versus sunitinib monotherapy as first-line",
  },
  {
    id: "4",
    image: null,
    year: "2022",
    name: "CLEAR Study",
    totalEnrolled: 1069,
    link: "https://www.nejm.org/doi/full/10.1056/NEJMoa2035716",
    description:
      "Lenvatinib plus Pembrolizumab or Everolimus for Advanced Renal Cell Carcinoma",
  },
  {
    id: "5",
    image: null,
    year: "2015",
    name: "CheckMate 025",
    totalEnrolled: 821,
    link: "https://www.nejm.org/doi/full/10.1056/NEJMoa1510665",
    description:
      "Cabozantinib versus Everolimus in Advanced Renal-Cell Carcinoma",
  },
  {
    id: "0",
    image: null,
    year: "2024",
    name: "KEYNOTE-564",
    totalEnrolled: 496,
    link: "https://www.nejm.org/doi/full/10.1056/NEJMoa2106391",
    description:
      "Adjuvant Pembrolizumab after Nephrectomy in Renal-Cell Carcinoma",
  },
  {
    id: "6",
    image: null,
    year: "2023",
    name: "COSMIC-313",
    totalEnrolled: 855,
    link: "https://www.nejm.org/doi/full/10.1056/NEJMoa2212851",
    description:
      "Cabozantinib plus Nivolumab and Ipilimumab in Renal-Cell Carcinoma",
  },
  {
    id: "7",
    image: null,
    year: "2022",
    name: "CHECKMATE-214",
    totalEnrolled: 139,
    link: "https://www.nejm.org/doi/full/10.1056/NEJMoa2212851",
    description:
      "Nivolumab plus Ipilimumab versus Sunitinib in first-line treatment of patients with advanced Sarcomatoid Renal Cell Carcinoma",
  },
];

export const nonClearCellTrials = [
  {
    id: "0",
    image: null,
    name: "PAPMET",
    year: "2023",
    totalEnrolled: 147,
    link: "https://ascopubs.org/doi/10.1200/JCO.2023.41.16_suppl.4562",
    description: "Cabozantinib vs. Sunitinib in Advanced pRCC",
  },
  {
    id: "1",
    image: null,
    name: "ESPN",
    year: "2016",
    totalEnrolled: 68,
    link: "https://pubmed.ncbi.nlm.nih.gov/26626617/",
    description:
      "Everolimus Versus Sunitinib Prospective Evaluation in Metastatic Non-Clear Cell Renal Cell Carcinoma",
  },
];

export const cancerOptions = [
  "kidney",
  "bladder",
  "prostate",
  "adrenal",
  "breast",
  "colon",
  "testicular",
  "penile",
  "urethral",
];

export const nonograms = [
  {
    id: 0,
    image: Fox,
    name: "Assure RCC Prognostic Nomogram",
    description:
      "A post-operative prediction model which provides a comprehensive review of expected oncological outcomes in patients with renal cell carcinoma.",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/492",
  },
  {
    id: 1,
    image: Fox,
    name: "A Preoperative Nomogram for Predicting the Probability of Malignancy and High-Grade RCC in Solid Enhancing Renal Tumors",
    description:
      "A Preoperative Prognostic Nomogram for Solid Enhancing Renal Tumors 7 cm or Less Amenable to Partial Nephrectomy",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/112",
  },
  {
    id: 2,
    image: Fox,
    name: "Heng Criteria Metastatic RCC - Prognostic Factors for Overall Survival in Patients With Metastatic Renal Cell Carcinoma",
    description:
      "Heng Criteria - Predicts survival in patients with metastatic renal cell carcinoma that were treated with Vascular Endothelial Growth Factor–Targeted Agents",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/1072",
  },
  {
    id: 3,
    image: Fox,
    name: "Karakiewicz Renal Cell Carcinoma Cancer-Specific Survival Nomogram",
    description:
      "Nomogram predicting renal cell carcinoma (RCC)–specific survival at 1, 2, 5, and 10 years",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/92",
  },
  {
    id: 4,
    image: Fox,
    name: "Leibovich RCC Model: Prediction of progression after radical nephrectomy for patients with clear cell renal cell carcinoma",
    description:
      "A post-operative prediction model that assesses the risk of recurrence in patients with resected clear cell Renal Cell Carcinoma",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/972",
  },
  {
    id: 5,
    image: Fox,
    name: "RCC Competing Risk Model",
    description:
      "Predicting risks of death from kidney cancer, a yet undiagnosed cancer, and from non-oncological causes",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/3",
  },
  {
    id: 6,
    image: Fox,
    name: "UISS RCC Model: Postoperative RCC Prognostic Model based on UCLA Risk Group Stratification",
    description:
      "What are my chances of being alive and of being free from recurrence 1, 2, 3, 4, and 5 years after surgery?",
    cancerType: "kidney",
    link: "https://cancernomograms.com/nomograms/7",
  },
];
