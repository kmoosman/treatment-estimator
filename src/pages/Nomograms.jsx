import React, { useState } from "react";

import { nomograms } from "../utils/Data";
import NomogramCard from "../partials/dashboard/NomogramCard";
import Header from "../partials/Header";
import { cancerOptions } from "../utils/Data";

export const Nomograms = () => {
  const [selectedCancer, setSelectedCancer] = useState("kidney");
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header />

        <main>
          <div className="px-4 sm:px-6 lg:px-8 py-8 w-full max-w-9xl mx-auto">
            <div className="flex flex-row gap-2 mt-12">
              <div className="text-3xl font-bold text-slate-800 mb-7">
                Nomograms
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
              <div className="grid grid-cols-12 gap-6 mb-6 ">
                {nomograms
                  .sort((a, b) => a.id - b.id)
                  .map((nomogram) => (
                    <NomogramCard
                      title={nomogram.name}
                      blurb={nomogram.description}
                      type="nomogram"
                      link={nomogram.link}
                      key={nomogram.id}
                      image={nomogram.image}
                    />
                  ))}
              </div>
            ) : (
              //todo: This will need to be revised when more trials are entered
              <div className="text-3xl font-bold text-slate-500 mt-10 border p-10 shadow-md ">
                No nomograms entered for {selectedCancer} cancer
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Nomograms;
