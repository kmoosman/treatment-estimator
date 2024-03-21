import React, { useState } from "react";
import Header from "../partials/Header";
import { BasicTable } from "../partials/dashboard/BasicTable";
import {
  clearCellTrials,
  cancerOptions,
  nonClearCellTrials,
} from "../utils/Data";

export const Trials = ({ type }) => {
  const [selectedCancer, setSelectedCancer] = useState("kidney");

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header />

        <main>
          <div className="px-4 sm:px-6 lg:px-8 y-8 w-full max-w-9xl mx-auto">
            <div className="flex flex-row gap-2 mt-20">
              <div className="text-3xl font-bold text-slate-800  mb-7">
                Clinical Trials
              </div>

              <select
                className="border-2 h-10 border-gray-300 text-black rounded-md text-md font-semibold capitalize text-center"
                onChange={(e) =>
                  setSelectedCancer(
                    cancerOptions.find((cancer) => cancer === e.target.value)
                  )
                }
              >
                {cancerOptions.map((cancer) => (
                  <option key={cancer} value={cancer}>
                    {cancer}
                  </option>
                ))}
              </select>
            </div>

            {selectedCancer === "kidney" ? (
              <>
                <div>
                  <BasicTable
                    data={clearCellTrials}
                    tableTitle={"Clear Cell Renal Cell Carcinoma"}
                    size="large"
                  />
                </div>
                <div className="mt-10">
                  <BasicTable
                    data={nonClearCellTrials}
                    tableTitle={"Non-Clear Cell Kidney Cancer"}
                    size="large"
                  />
                </div>
              </>
            ) : (
              //todo: This will need to be revised when more trials are entered
              <div className="text-3xl font-bold text-slate-500 mt-10 border p-10 shadow-md">
                No trials entered for {selectedCancer} cancer
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Trials;
