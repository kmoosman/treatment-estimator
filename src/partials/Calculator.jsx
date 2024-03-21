import React, { useState, useEffect } from "react";
import * as Math from "mathjs";

const Calculator = () => {
  const [survivalUnit, setSurvivalUnit] = useState("months");
  const [time, setTime] = useState(12);
  const [milestoneProbability, setMilestoneProbability] = useState(50);
  const [hazardRatio, setHazardRatio] = useState(0.62);
  const [result, setResult] = useState(null);
  const [medianSurvival, setMedianSurvival] = useState(null);
  const [meanSurvival, setMeanSurvival] = useState(null);
  const [medianSurvivalWithTreatment, setMedianSurvivalWithTreatment] =
    useState(null);
  const [meanSurvivalWithTreatment, setMeanSurvivalWithTreatment] =
    useState(null);

  useEffect(() => {
    const calculateResults = () => {
      // Ensure valid numbers before calcualting
      if (time > 0 && milestoneProbability > 0 && hazardRatio > 0) {
        const lnValue = Math.log(1 / (milestoneProbability / 100));
        const calculatedValue =
          (1 / Math.exp((lnValue / time) * hazardRatio * time)) * 100;
        const medianSurvivalValue =
          Math.log(2) / (Math.log(1 / (milestoneProbability / 100)) / time);
        const meanSurvivalValue = 1.44 * medianSurvivalValue;
        const medianSurvivalWithTreatmentValue =
          Math.log(2) /
          ((Math.log(1 / (milestoneProbability / 100)) / time) * hazardRatio);
        const meanSurvivalWithTreatmentValue =
          1.44 * medianSurvivalWithTreatmentValue;

        setMedianSurvivalWithTreatment(medianSurvivalWithTreatmentValue);
        setMeanSurvivalWithTreatment(meanSurvivalWithTreatmentValue);
        setResult(calculatedValue);
        setMedianSurvival(medianSurvivalValue);
        setMeanSurvival(meanSurvivalValue);
        setMedianSurvivalWithTreatment(medianSurvivalWithTreatmentValue);
      }
    };

    calculateResults();
  }, [time, milestoneProbability, hazardRatio]);

  return (
    <div>
      <div className="flex flex-row justify-between">
        <h1 className="text-2xl font-bold">Milestone Probability Calculator</h1>
      </div>

      <hr className="my-4" />
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 bg-slate-600 rounded text-white p-4">
        <div className="flex flex-row gap-2 items-center col-span-1">
          <label className="text-md font-semibold">Units:</label>
          <select
            className="border-2 border-gray-300 text-black rounded-md text-center"
            value={survivalUnit}
            onChange={(e) => setSurvivalUnit(e.target.value)}
          >
            <option value="months">Months</option>
            <option value="years">Years</option>
            {/* Add other units of time as necessary */}
          </select>
        </div>

        <div className="relative flex flex-row gap-2 group col-span-1">
          <label className="self-center text-md font-semibold">Time (t):</label>
          {/* on hover display this tooltop */}
          <div className="absolute bottom-0 flex-col items-center hidden mb-12 group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white  w-60 bg-slate-900 shadow-lg rounded-md">
              Uses the same time unit as the median survival (e.g., months)
            </span>
          </div>
          <input
            className="border-2 text-black  border-gray-300 rounded-md p-2 w-20 text-center"
            type="number"
            value={time}
            min={0}
            onChange={(e) => setTime(e.target.valueAsNumber)}
          />
        </div>
        <div className="relative flex flex-row gap-2 group col-span-3">
          <label className="self-center font-semibold">
            Milestone Probability at Time (t) with Control Therapy (%):
          </label>
          {/* on hover display this tooltop */}
          <div className="absolute bottom-0 flex-col items-center hidden mb-12 group-hover:flex">
            <span className="relative z-10 p-2 text-xs leading-none text-white w-60 bg-slate-900 shadow-lg rounded-md">
              Can use outputs from a prognostic calculator/nomogram
            </span>
          </div>
          <input
            className="border-2 text-black  border-gray-300 rounded-md p-2 w-20 text-center"
            type="number"
            min={0}
            value={milestoneProbability}
            onChange={(e) => setMilestoneProbability(e.target.valueAsNumber)}
          />
        </div>
        <div className="relative flex flex-row gap-2 group col-span-2">
          <label className="self-center font-semibold">
            Hazard Ratio (HR) Point Estimate:
          </label>
          {/* on hover display this tooltop */}
          <div className="absolute bottom-0 flex-col items-center hidden mb-12 group-hover:flex ">
            <span className="relative z-10 p-2 text-xs leading-none text-white  w-60 bg-slate-900 shadow-lg rounded-md">
              Uses the same time unit as the median survival (e.g., months)
            </span>
          </div>
          <input
            type="number"
            className="border-2 border-gray-300 text-black  rounded-md p-2 w-20 text-center"
            value={hazardRatio}
            onChange={(e) => setHazardRatio(e.target.valueAsNumber)}
          />
        </div>
      </div>

      {result !== null && (
        <div className="p-4 mt-4 bg-white pb-10 shadow-lg rounded">
          <h2 className="text-xl font-semibold mb-2">Results</h2>
          <div className="overflow-x-auto flex flex-col lg:flex-row justify-between">
            <div className="">
              <label className="text-sm font-bold">Summary</label>
              <table className="mt-1 ">
                <tbody className="">
                  <tr>
                    <td className="text-left font-medium  border p-2">
                      Approximated Milestone Probability:
                    </td>
                    <td className="text-right p-2 border">
                      {result.toFixed(3)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      <p>Approximated absolute risk reduction (ARR):</p>
                      <p className="text-xs italic">
                        At time t with treatment vs control based on HR point
                        estimate
                      </p>
                    </td>
                    <td className="text-right p-2 border">
                      {(result - milestoneProbability).toFixed(3)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="pt-2 lg:mt-0">
              <label className="text-sm font-bold">Control</label>
              <table className="mt-1">
                <tbody>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Median Survival with Control:
                    </td>
                    <td className="text-right p-2 border">
                      {medianSurvival?.toFixed(2)}{" "}
                      <span className="text-xs">({survivalUnit})</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Mean Survival with Control:
                    </td>
                    <td className="text-right p-2 border">
                      {meanSurvival?.toFixed(2)}{" "}
                      <span className="text-xs">({survivalUnit})</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {/* todo: make these into a component */}
            <div className="pt-2 lg:mt-0">
              <label className="text-sm font-bold">Treatment</label>
              <table className="mt-1">
                <tbody>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Median Survival with Treatment:
                    </td>
                    <td className="text-right p-2 border">
                      {medianSurvivalWithTreatment?.toFixed(2)}{" "}
                      <span className="text-xs">({survivalUnit})</span>{" "}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Mean Survival with Treatment:
                    </td>
                    <td className="text-right p-2 border">
                      {meanSurvivalWithTreatment?.toFixed(2)}{" "}
                      <span className="text-xs">({survivalUnit})</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;
