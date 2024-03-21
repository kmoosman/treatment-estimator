import React from "react";
import Header from "../partials/Header";
import DataCard from "../partials/DataCard";

export const Visual = ({ type }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/*  Site header */}
        <Header />

        <main>
          <div className="px-4 sm:px-6 lg:px-2 py-4 w-full max-w-9xl mx-auto">
            <div className="text-3xl font-bold text-slate-800 mt-16">
              Trial Data
            </div>
            <div className="ml-1 ">
              Enter trial data below to visualize the results.
            </div>
            <hr className="mt-4" />

            <div className="w-full mx-auto">
              <DataCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Visual;
