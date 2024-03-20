import React, { useState } from "react";

import Header from "../partials/Header";

import {
  faSquareArrowUpRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { NavLink } from "react-router-dom"
import Calculator from "../partials/Calculator";
import DataCard from "../partials/DataCard";

export const Dashboard = ({ rates, demographics, type }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <div className="flex h-screen overflow-hidden ">
        <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden w-full">
          <Header />
            <main>
           
            <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">              
              <div className="text-3xl font-bold text-slate-800 mt-12 mb-7">
                {type === "media" ? "Media " : null} Calculators
              </div>
             <a href="https://pubmed.ncbi.nlm.nih.gov/36010916/" target="_blank" rel="noreferrer">
              <div className="font-md text-slate-800 mt-2 p-4 bg-blue-100 rounded flex flex-row justify-between">   
                <div>
                <div className="font-semibold flex flex-row lg:text-lg text-md"> A Causal Framework for Making Individualized Treatment Decisions in Oncology 
                </div>
                <div className="text-xs font-md italic">Published: 2022 Aug 14;14(16):3923. doi: 10.3390/cancers14163923. Authors: Pavlos Msaouel, Juhee Lee, Jose A Karam, Peter F Thall
                </div>
                </div>
                
                  <div className="h-full self-center p-2 text-slate-500">
                    <div className="hidden lg:block"><FontAwesomeIcon icon={faSquareArrowUpRight} /></div>
                  </div>
              </div>
              </a>
              <a href="https://www.mdpi.com/article/10.3390/cancers14163923/s1" target="_blank" className="text-xs font-md p-2">Formulas behind this calculator are based on the above publication and are intended for educational purposes only. Worksheet from the publication to validate against can be <span className="text-blue-700">found here</span>.
              </a>
              <div className="mt-7">
             <Calculator />
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
