import React, { useState, useEffect } from "react";
import * as Math from "mathjs";
import { formatNumber } from "../utils/Utils";
import {
  faCalculator,
  faClipboard,
  faSquareArrowUpRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const CaseEstimator = () => {
  const [collection, setCollection] = useState([]);
  const [title, setTitle] = useState("");
  const [totalCases, setTotalCases] = useState(81610);
  const [minSubgroupPercentage, setMinSubgroupPercentage] = useState();
  const [minSubgroupMetastaticPercentage, setMinSubgroupMetastaticPercentage] =
    useState();
  const [maxSubgroupPercentage, setMaxSubgroupPercentage] = useState();
  const [maxSubgroupMetastaticPercentage, setMaxSubgroupMetastaticPercentage] =
    useState();
  const [maxSubgroupCases, setMaxSubgroupCases] = useState();
  const [maxSubGroupMetastaticCases, setMaxSubgroupMetastaticCases] =
    useState();
  const [minSubgroupCases, setMinSubgroupCases] = useState();
  const [minSubGroupMetastaticCases, setMinSubgroupMetastaticCases] =
    useState();

  useEffect(() => {
    const calculateResults = () => {
      if (totalCases) {
        //convert text to number
        const totalCasesNumber = Number(totalCases);
        const subGroupTotal = totalCasesNumber * (minSubgroupPercentage / 100);
        const subGroupMetastaticTotal =
          subGroupTotal * (minSubgroupMetastaticPercentage / 100);
        setMinSubgroupCases(subGroupTotal);
        setMinSubgroupMetastaticCases(subGroupMetastaticTotal);

        const maxSubGroupTotal =
          totalCasesNumber * (maxSubgroupPercentage / 100);
        const maxSubGroupMetastaticTotal =
          maxSubGroupTotal * (maxSubgroupMetastaticPercentage / 100);
        setMaxSubgroupCases(maxSubGroupTotal);
        setMaxSubgroupMetastaticCases(maxSubGroupMetastaticTotal);
      }
    };

    calculateResults();
  }, [
    minSubgroupPercentage,
    totalCases,
    minSubgroupPercentage,
    minSubgroupMetastaticPercentage,
    maxSubgroupPercentage,
    maxSubgroupMetastaticPercentage,
  ]);

  const handleChangeLimitTo100 = (setValue) => (e) => {
    const inputValue = e.target.value;
    if (inputValue === "" || inputValue === "-") {
      setValue("");
    } else {
      const value = Number(inputValue);
      if (value > 100) {
        setValue(100);
      } else if (value < 0) {
        setValue(0);
      } else {
        setValue(value);
      }
    }
  };

  const addSubgroup = () => {
    // Add subgroup to list
    const newSubgroup = {
      title,
      totalCases,
      minSubgroupPercentage,
      maxSubgroupPercentage,
      minSubgroupMetastaticPercentage,
      maxSubgroupMetastaticPercentage,
      minSubgroupCases,
      maxSubgroupCases,
      minSubGroupMetastaticCases,
      maxSubGroupMetastaticCases,
    };
    setCollection([...collection, newSubgroup]);
  };

  return (
    <div>
      <div className="flex flex-row justify-between">
        <h1 className="text-2xl font-bold">Case Estimator Calculator</h1>
      </div>

      <hr className="my-4" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 bg-slate-600 rounded text-white p-6 pt-8">
        <div className="flex flex-col lg:flex-row gap-2 items-center col-span-1">
          <label className="self-center text-md font-semibold">Title</label>
          {/* on hover display this tooltop */}
          <input
            className="border-2 text-black border-gray-300 rounded-md p-2 w-full text-left"
            type="text"
            value={title}
            placeholder="Example: Chromophobe RCC"
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="flex flex-col lg:flex-row gap-2 items-center col-span-1 mx-auto">
          <label className="self-center text-md font-semibold">
            Reference Total:
          </label>
          {/* on hover display this tooltop */}
          <div className="absolute bottom-0 flex-col items-center hidden mb-12 group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white  w-60 bg-slate-900 shadow-lg rounded-md">
              Total number of cases looking to calculate based on (example
              82,000 kidney cancer)
            </span>
          </div>
          <input
            className="border-2 text-black border-gray-300 rounded-md p-2 w-40 text-center"
            type="text"
            value={formatNumber(totalCases)}
            onChange={(e) => {
              const value = e.target.value.replace(/,/g, "");
              const numericValue = value === "" ? null : Number(value);
              setTotalCases(numericValue);
            }}
          />
        </div>
        <div className="relative flex lg:flex-row flex-col gap-2 group items-center col-span-1 lg:col-span-1">
          <label className="self-center font-semibold text-center">
            Subgroup Total %
          </label>
          {/* on hover display this tooltop */}
          <div className="absolute bottom-0 flex-col items-center hidden mb-12 group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white w-60 bg-slate-900 shadow-lg rounded-md">
              Example 5% for chromophobe RCC
            </span>
          </div>
          <div className="lg:flex-row flex gap-2 self-center h-full justify-center">
            <input
              className="border-2 text-black  border-gray-300 rounded-md p-2 w-20 text-center"
              type="number"
              min={0}
              max={100}
              value={minSubgroupPercentage}
              onChange={handleChangeLimitTo100(setMinSubgroupPercentage)}
            />{" "}
            <span className="pt-2">-</span>
            <input
              className="border-2 text-black  border-gray-300 rounded-md p-2 w-20 text-center"
              type="number"
              min={0}
              max={100}
              value={maxSubgroupPercentage}
              onChange={handleChangeLimitTo100(setMaxSubgroupPercentage)}
            />
          </div>
        </div>

        <div className="relative flex lg:flex-row flex-col gap-2 group col-span-1 items-center lg:col-span-1">
          <label className="self-center font-semibold text-center">
            Metastatic %
          </label>
          {/* on hover display this tooltop */}
          <div className="absolute bottom-0 flex-col items-center hidden mb-12 group-hover:flex ">
            <span className="relative z-10 p-2 text-xs leading-none text-white  w-60 bg-slate-900 shadow-lg rounded-md">
              What % of the subset of cases typically become metastatic
            </span>
          </div>
          <div className="lg:flex-row flex gap-2 self-center h-full justify-center">
            <input
              className="border-2 text-black  border-gray-300 rounded-md p-2 w-20 text-center"
              type="number"
              min={0}
              max={100}
              malue={minSubgroupMetastaticPercentage}
              onChange={handleChangeLimitTo100(
                setMinSubgroupMetastaticPercentage
              )}
            />
            <span className="pt-2">-</span>
            <input
              className="border-2 text-black  border-gray-300 rounded-md p-2 w-20 text-center"
              type="number"
              min={0}
              max={100}
              value={maxSubgroupMetastaticPercentage}
              onChange={handleChangeLimitTo100(
                setMaxSubgroupMetastaticPercentage
              )}
            />
          </div>
        </div>

        <div className="col-span-1 lg:col-span-4 flex xl:justify-end justify-center xl:mr-12">
          <button
            className="w-40 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded"
            onClick={addSubgroup}
          >
            Add Subgroup
          </button>
        </div>
      </div>
      {collection.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-5">
          {collection.length > 0 &&
            collection.map((item, index) => (
              <div
                key={index}
                className="p-4 mt-4 bg-white pb-10 shadow-lg rounded"
              >
                <h2 className="text-xl font-semibold mb-2">{item.title}</h2>
                <div className="overflow-x-auto flex flex-col lg:flex-row justify-between">
                  <div className="">
                    <table className="mt-1 ">
                      <tbody className="">
                        <tr>
                          <td className="text-left font-medium  border p-2">
                            Estimated Total Cases:
                          </td>
                          <td className="text-right p-2 border">
                            <div>
                              {Number.isNaN(item.minSubgroupCases) ||
                              item.minSubgroupCases <= 0
                                ? Number.isNaN(item.maxSubgroupCases) ||
                                  item.maxSubgroupCases <= 0
                                  ? "N/A"
                                  : formatNumber(item.maxSubgroupCases)
                                : Number.isNaN(item.maxSubgroupCases) ||
                                  item.maxSubgroupCases <= 0
                                ? formatNumber(item.minSubgroupCases)
                                : `${formatNumber(
                                    item.minSubgroupCases
                                  )} - ${formatNumber(item.maxSubgroupCases)}`}
                            </div>
                            <div className="text-xs"></div>
                          </td>
                        </tr>
                        <tr>
                          <td className="text-left font-medium border p-2">
                            <p>Estimated Metastatic Cases:</p>
                            <p className="text-xs italic">
                              Based on {item.minSubgroupMetastaticPercentage}-
                              {item.maxSubgroupMetastaticPercentage}% of
                              subgroup cases
                            </p>
                          </td>
                          <td className="text-right p-2 border">
                            <div>
                              {" "}
                              {Number.isNaN(item.minSubGroupMetastaticCases) ||
                              item.minSubGroupMetastaticCases <= 0
                                ? Number.isNaN(
                                    item.maxSubGroupMetastaticCases
                                  ) || item.maxSubGroupMetastaticCases <= 0
                                  ? "N/A"
                                  : formatNumber(
                                      item.maxSubGroupMetastaticCases
                                    )
                                : Number.isNaN(
                                    item.maxSubGroupMetastaticCases
                                  ) || item.maxSubGroupMetastaticCases <= 0
                                ? formatNumber(item.minSubGroupMetastaticCases)
                                : `${formatNumber(
                                    item.minSubGroupMetastaticCases
                                  )} - ${formatNumber(
                                    item.maxSubGroupMetastaticCases
                                  )}`}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="p-4 bg-white pb-10 shadow-lg rounded mt-7">
          <div className="h-full self-center p-2 text-slate-500 text-center">
            <div className="hidden lg:block">
              <FontAwesomeIcon
                icon={faClipboard}
                className="w-10 h-10 text-slate-300"
              />
              <h3 className="p-2 font-semibold">No subgroups added</h3>
              <h3 className="text-sm">
                Add subgroups above to view and compare case counts
              </h3>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseEstimator;
