import React, { useState, useEffect } from "react";
import * as Math from "mathjs";

const Calculator = () => {
  const [survivalUnit, setSurvivalUnit] = useState("months");
  const [time, setTime] = useState(12);
  const [milestoneProbability, setMilestoneProbability] = useState(50);
  const [hazardRatio, setHazardRatio] = useState(0.62);
  const [lowerHazardRatio, setLowerHazardRatio] = useState();
  const [upperHazardRatio, setUpperHazardRatio] = useState();
  const [result, setResult] = useState(null);
  const [medianSurvival, setMedianSurvival] = useState(null);
  const [meanSurvival, setMeanSurvival] = useState(null);
  const [medianSurvivalWithTreatment, setMedianSurvivalWithTreatment] =
    useState(null);
  const [meanSurvivalWithTreatment, setMeanSurvivalWithTreatment] =
    useState(null);
  const [
    lowerMedianSurvivalWithTreatment,
    setLowerMedianSurvivalWithTreatment,
  ] = useState(null);
  const [lowerMeanSurvivalWithTreatment, setLowerMeanSurvivalWithTreatment] =
    useState(null);
  const [
    upperMedianSurvivalWithTreatment,
    setUpperMedianSurvivalWithTreatment,
  ] = useState(null);
  const [upperMeanSurvivalWithTreatment, setUpperMeanSurvivalWithTreatment] =
    useState(null);
  const [lowerCIValue, setLowerCIValue] = useState(null);
  const [upperCIValue, setUpperCIValue] = useState(null);

  useEffect(() => {
    const calculateResults = () => {
      if (time > 0 && milestoneProbability > 0 && hazardRatio > 0) {
        const lnValue = Math.log(1 / (milestoneProbability / 100));
        const calculatedValue =
          (1 / Math.exp((lnValue / time) * hazardRatio * time)) * 100;
        // calculate based on lowerHazardRatio and upperHazardRatio for bounds of CI
        const lowerCIValue =
          (1 / Math.exp((lnValue / time) * lowerHazardRatio * time)) * 100;
        const upperCIValue =
          (1 / Math.exp((lnValue / time) * upperHazardRatio * time)) * 100;
        const medianSurvivalValue = Math.log(2) / (lnValue / time);

        const meanSurvivalValue = 1.44 * medianSurvivalValue;

        // Calculate survival based on hazard ratio
        const survivalWithTreatment = (hr) => {
          const median = Math.log(2) / ((lnValue / time) * hr);
          const mean = 1.44 * median;
          return { median, mean };
        };

        const medianSurvivalWithTreatmentValue =
          survivalWithTreatment(hazardRatio).median;
        const meanSurvivalWithTreatmentValue =
          survivalWithTreatment(hazardRatio).mean;

        const lowerSurvivalWithTreatment =
          survivalWithTreatment(lowerHazardRatio);
        const upperSurvivalWithTreatment =
          survivalWithTreatment(upperHazardRatio);

        setMedianSurvivalWithTreatment(medianSurvivalWithTreatmentValue);
        setMeanSurvivalWithTreatment(meanSurvivalWithTreatmentValue);
        setResult(calculatedValue);
        setLowerCIValue(lowerCIValue);
        setUpperCIValue(upperCIValue);
        setMedianSurvival(medianSurvivalValue);
        setMeanSurvival(meanSurvivalValue);

        // Set the lower and upper CI values for the median and mean survival with treatment
        setLowerMedianSurvivalWithTreatment(lowerSurvivalWithTreatment.median);
        setLowerMeanSurvivalWithTreatment(lowerSurvivalWithTreatment.mean);
        setUpperMedianSurvivalWithTreatment(upperSurvivalWithTreatment.median);
        setUpperMeanSurvivalWithTreatment(upperSurvivalWithTreatment.mean);
      }
    };

    calculateResults();
  }, [
    time,
    milestoneProbability,
    hazardRatio,
    lowerHazardRatio,
    upperHazardRatio,
  ]);

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
        <div className="flex flex-row col-span-7 mr-12 gap-2 justify-end">
          <div className="relative flex flex-row gap-2 group">
            <label className="self-center text-sm align-right font-semibold">
              Confidence Interval (CI):
            </label>
            {/* on hover display this tooltop */}
            <div className="absolute bottom-0 flex-col items-center hidden mb-5 group-hover:flex">
              <span className="relative z-10 text-xs leading-none text-white p-2 w-40 bg-slate-900 shadow-lg rounded-md">
                Of the hazard ratio (HR)
              </span>
            </div>
            <input
              type="number"
              className="border-2 border-gray-300 text-black h-6 text-sm rounded-md p-2 w-20 text-center"
              value={lowerHazardRatio}
              onChange={(e) => setLowerHazardRatio(e.target.valueAsNumber)}
            />
            <input
              type="number"
              className="border-2 border-gray-300 text-black h-6 text-sm rounded-md p-2 w-20 text-center"
              value={upperHazardRatio}
              onChange={(e) => setUpperHazardRatio(e.target.valueAsNumber)}
            />
          </div>
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
                      <div>{result.toFixed(3)}%</div>
                      <div className="text-xs">
                        {!Number.isNaN(upperCIValue) &&
                          !Number.isNaN(lowerCIValue) && (
                            <div>
                              ({upperCIValue.toFixed(3)}-
                              {lowerCIValue.toFixed(3)})
                            </div>
                          )}
                      </div>
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
                      <div>{(result - milestoneProbability).toFixed(3)}%</div>
                      <div className="text-xs">
                        {!Number.isNaN(upperCIValue) &&
                          !Number.isNaN(lowerCIValue) && (
                            <div>
                              (
                              {(upperCIValue - milestoneProbability).toFixed(3)}
                              -
                              {(lowerCIValue - milestoneProbability).toFixed(3)}
                              )
                            </div>
                          )}
                      </div>
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
                      <div>
                        {medianSurvival?.toFixed(2)}{" "}
                        <span className="text-xs">({survivalUnit})</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Mean Survival with Control:
                    </td>
                    <td className="text-right p-2 border">
                      <div>
                        {meanSurvival?.toFixed(2)}{" "}
                        <span className="text-xs">({survivalUnit})</span>
                      </div>
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
                      <div>
                        {medianSurvivalWithTreatment?.toFixed(2)}{" "}
                        <span className="text-xs">({survivalUnit})</span>{" "}
                      </div>
                      {!Number.isNaN(upperCIValue) &&
                        !Number.isNaN(lowerCIValue) && (
                          <div className="text-xs text-center">
                            ({upperMedianSurvivalWithTreatment.toFixed(2)}-
                            {lowerMedianSurvivalWithTreatment.toFixed(2)})
                          </div>
                        )}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Mean Survival with Treatment:
                    </td>
                    <td className="text-right p-2 border">
                      <div>
                        {meanSurvivalWithTreatment?.toFixed(2)}{" "}
                        <span className="text-xs">({survivalUnit})</span>
                      </div>
                      <div className="text-xs text-center">
                        {!Number.isNaN(upperCIValue) &&
                          !Number.isNaN(lowerCIValue) && (
                            <div>
                              ({upperMeanSurvivalWithTreatment.toFixed(2)}-
                              {lowerMeanSurvivalWithTreatment.toFixed(2)})
                            </div>
                          )}
                      </div>
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
