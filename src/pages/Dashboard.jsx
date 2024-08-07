import React, { useState, Fragment, useEffect } from "react";

import Header from "../partials/Header";

import { faSquareArrowUpRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NavLink } from "react-router-dom";
import Calculator from "../partials/Calculator";
import DataCard from "../partials/DataCard";
import CaseEstimator from "../partials/CaseEstimator";
import Modal from "../partials/Modal";
import Explorer from "../partials/Explorer";


export const Dashboard = ({ type }) => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [acceptedAcknowledgement, setAcceptedAcknowledgement] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("acknowledgement")
      : "false"
  );
  const calculatorOptions = [
    {
      calculator: "Probability",
      highlightTitle:
        "A Causal Framework for Making Individualized Treatment Decisions in Oncology",
      highlightSubtext:
        "Published: 2022 Aug 14;14(16):3923. doi: 10.3390/cancers14163923. Authors: Pavlos Msaouel, Juhee Lee, Jose A Karam, Peter F Thall",
      highlightLink: "https://pubmed.ncbi.nlm.nih.gov/36010916/",
    },
    {
      calculator: "Case Estimator",
      highlightTitle: `${new Date().getFullYear()} Estimated New Cancer Cases from American Cancer Society`,
      highlightSubtext:
        "Search by cancer type, locate the case counts to use as your reference range to estimate the cases by subgroup below",
      highlightLink:
        "https://cancerstatisticscenter.cancer.org/?_ga=2.74990034.1963401142.1712297613-345829780.1712297613&_gl=1*lvi03j*_ga*MzQ1ODI5NzgwLjE3MTIyOTc2MTM.*_ga_12CJLLFFQT*MTcxMjI5NzYxMi4xLjEuMTcxMjI5NzYyNS40Ny4wLjA.#/",
    },
    {
      calculator: "Explorer (beta)",
      highlightTitle:
        "Data Explorer for CSV",
      highlightSubtext:
        "To quickly explore small datasets, upload a CSV file and use the filters below. This tool is intended for educational purposes only.",
      highlightLink: null,
    },
  ];
  const [selectedCalculator, setSelectedCalculator] = useState(
    calculatorOptions[0]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      checkAcknowledgement();
    }
  }, []);

  function checkAcknowledgement() {
    const ackData = JSON.parse(localStorage.getItem("AcceptedAcknowledgement"));
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    if (!ackData || now - new Date(ackData.date).getTime() > oneWeek) {
      // If data doesn't exist or it's been a week, prompt the user
      openModal();
    } else {
      setAcceptedAcknowledgement("true");
      closeModal();
    }
  }

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const openModal = () => {
    setIsModalOpen(true);
  };

  //add the acknowledgment to local storage
  const handleAcknowledgement = () => {
    localStorage.setItem(
      "AcceptedAcknowledgement",
      JSON.stringify({ accepted: true, date: new Date() })
    );
    setAcceptedAcknowledgement("true");
    closeModal();
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden ">
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden w-full">
          <Header />
          <main>
            {acceptedAcknowledgement !== "true" && (
              <Modal
                show={isModalOpen}
                fragment={Fragment}
                closeModal={closeModal}
              >
                <div>
                  <div className="w-full mb-5 mt-10"></div>
                  <h1 className="w-full text-center text-2xl font-semibold">
                    Terms
                  </h1>

                  <p className="w-full pl-20 pr-20 pt-7 text-left text-sm">
                    The tools and calculators provided on this platform are
                    intended solely for general informational and educational
                    purposes. We do not guarantee the accuracy or completeness
                    of any content, and you are using these tools at your own
                    discretion and risk. No warranty, express or implied, is
                    provided, and we disclaim all implied warranties. The entire
                    risk regarding the quality, accuracy, and performance of
                    these tools rests with the user. The developers or
                    contributors to this platform are not liable for any direct,
                    indirect, incidental, or consequential damages, including
                    but not limited to loss of profits, data, or any other
                    losses incurred by the user or third parties, as a result of
                    operating or failing to operate these tools.
                  </p>
                  <div className="w-full text-center">
                    <button
                      onClick={handleAcknowledgement}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-10"
                    >
                      Accept and Continue
                    </button>
                  </div>
                </div>
              </Modal>
            )}
            <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
              <div className="flex flex-row mt-12 gap-4">
                <div className="text-3xl font-bold text-slate-800 mb-7">
                  {type === "media" ? "Media " : null} Calculators
                </div>
                <select
                  className="border-2 h-10 border-gray-300 text-black rounded-md text-md font-semibold capitalize text-center"
                  onChange={(e) =>
                    setSelectedCalculator(
                      calculatorOptions.find(
                        (option) => option.calculator === e.target.value
                      )
                    )
                  }
                >
                  {calculatorOptions.map((option) => (
                    <option key={option.calculator} value={option.calculator}>
                      {option.calculator}
                    </option>
                  ))}
                </select>
              </div>
              <a
                href={selectedCalculator.highlightLink}
                target="_blank"
                rel="noreferrer"
              >
                <div className="font-md text-slate-800 mt-2 p-4 bg-blue-100 rounded flex flex-row justify-between">
                  <div>
                    <div className="font-semibold flex flex-row lg:text-lg text-md">
                      {" "}
                      {selectedCalculator.highlightTitle}
                    </div>
                    <div className="text-xs font-md italic">
                      {selectedCalculator.highlightSubtext}
                    </div>
                  </div>

                  <div className="h-full self-center p-2 text-slate-500">
                    <div className="hidden lg:block">
                      <FontAwesomeIcon icon={faSquareArrowUpRight} />
                    </div>
                  </div>
                </div>
              </a>
              {selectedCalculator.calculator === "Explorer (beta)" && (
                <div
                  className="text-xs font-md pt-2"
                >
                  <div>
                    This tool is meant to drive curiosity and exploration of small and simple datasets. Full statistical analysis should be done with the original data and statistical software. Be mindful of methods and assumptions when working with combined datasets.

                  </div>
                </div>
              )}
              {selectedCalculator.calculator === "Probability" && (
                <a
                  href="https://www.mdpi.com/article/10.3390/cancers14163923/s1"
                  target="_blank"
                  className="text-xs font-md pt-2"
                >
                  Formulas behind this calculator are based on the above
                  publication and are intended for educational purposes only.
                  Worksheet from the publication to validate against can be{" "}
                  <span className="text-blue-700">found here</span>.
                </a>
              )}

              <div className="mt-7">
                {selectedCalculator.calculator === "Explorer (beta)" ? (
                  <Explorer />
                ) : selectedCalculator.calculator === "Probability" ? (
                  <Calculator />
                ) : (
                  <CaseEstimator />
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      <Footer />
    </>
  );
};

export const Footer = () => {
  return (
    <footer className="bottom-20 left-0 w-full p-4">
      <div className="container mx-auto text-left text-sm">
        <NavLink to="/privacy" className="text-gray-500">
          Privacy Policy
        </NavLink>
      </div>
    </footer>
  );
};

export default Dashboard;
