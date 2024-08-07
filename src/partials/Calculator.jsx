import React, { useState } from "react";
import * as Math from "mathjs";

const Calculator = () => {
  const [results, setResults] = useState([]);
  const [survivalUnit, setSurvivalUnit] = useState("months");
  const [time, setTime] = useState(12);
  const [milestoneProbability, setMilestoneProbability] = useState(50);
  const [hazardRatio, setHazardRatio] = useState(0.62);
  const [lowerHazardRatio, setLowerHazardRatio] = useState("");
  const [upperHazardRatio, setUpperHazardRatio] = useState("");

  const calculateResults = () => {
    if (time > 0 && milestoneProbability > 0 && hazardRatio > 0) {
      const lnValue = Math.log(1 / (milestoneProbability / 100));
      const calculatedValue = Math.min((1 / Math.exp((lnValue / time) * hazardRatio * time)) * 100, 100);

      const lowerCIValue = lowerHazardRatio !== "" ? Math.min((1 / Math.exp((lnValue / time) * lowerHazardRatio * time)) * 100, 100) : null;
      const upperCIValue = upperHazardRatio !== "" ? Math.min((1 / Math.exp((lnValue / time) * upperHazardRatio * time)) * 100, 100) : null;
      const medianSurvivalValue = Math.log(2) / (lnValue / time);
      const meanSurvivalValue = 1.44 * medianSurvivalValue;

      const survivalWithTreatment = (hr) => {
        const median = Math.log(2) / ((lnValue / time) * hr);
        const mean = 1.44 * median;
        return { median, mean };
      };

      const medianSurvivalWithTreatmentValue = survivalWithTreatment(hazardRatio).median;
      const meanSurvivalWithTreatmentValue = survivalWithTreatment(hazardRatio).mean;

      const lowerSurvivalWithTreatment = lowerHazardRatio !== "" ? survivalWithTreatment(lowerHazardRatio) : null;
      const upperSurvivalWithTreatment = upperHazardRatio !== "" ? survivalWithTreatment(upperHazardRatio) : null;

      return {
        result: calculatedValue,
        lowerCIValue,
        upperCIValue,
        medianSurvival: medianSurvivalValue,
        meanSurvival: meanSurvivalValue,
        medianSurvivalWithTreatment: medianSurvivalWithTreatmentValue,
        meanSurvivalWithTreatment: meanSurvivalWithTreatmentValue,
        lowerMedianSurvivalWithTreatment: lowerSurvivalWithTreatment ? lowerSurvivalWithTreatment.median : null,
        lowerMeanSurvivalWithTreatment: lowerSurvivalWithTreatment ? lowerSurvivalWithTreatment.mean : null,
        upperMedianSurvivalWithTreatment: upperSurvivalWithTreatment ? upperSurvivalWithTreatment.median : null,
        upperMeanSurvivalWithTreatment: upperSurvivalWithTreatment ? upperSurvivalWithTreatment.mean : null,
      };
    }
    return null;
  };

  const handleInputChange = (setValue) => (e) => {
    const inputValue = e.target.value;
    setValue(inputValue === "" ? "" : Number(inputValue));
  };

  const handleChangeLimitTo100 = (setValue) => (e) => {
    const value = Math.min(Math.max(0, Number(e.target.value)), 100);
    setValue(isNaN(value) ? "" : value);
  };

  const addNewResult = () => {
    const newResult = calculateResults();
    if (newResult) {
      setResults(prevResults => [...prevResults, {
        ...newResult,
        inputs: {
          survivalUnit,
          time,
          milestoneProbability,
          hazardRatio,
          lowerHazardRatio,
          upperHazardRatio
        }
      }]);
    }
  };

  return (
    <div className="p-4">
      <div className="flex flex-row justify-between">
        <h1 className="text-2xl font-bold">Milestone Probability Calculator</h1>
      </div>

      <hr className="my-4" />
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 bg-slate-600 rounded text-white p-4">
        <div className="flex flex-col lg:flex-row gap-2 items-center col-span-1">
          <label className="text-md font-semibold">Units:</label>
          <select
            className="border-2 border-gray-300 text-black rounded-md text-center"
            value={survivalUnit}
            onChange={(e) => setSurvivalUnit(e.target.value)}
          >
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
        </div>

        <div className="flex flex-col lg:flex-row gap-2 items-center col-span-1">
          <label className="self-center text-md font-semibold">Time (t):</label>
          <input
            className="border-2 text-black border-gray-300 rounded-md p-2 w-20 text-center"
            type="number"
            value={time}
            min={0}
            onChange={handleInputChange(setTime)}
          />
        </div>
        <div className="relative flex lg:flex-row flex-col gap-2 group items-center col-span-1 lg:col-span-3">
          <label className="self-center font-semibold text-center">
            Milestone Probability at Time (t) with Control Therapy (%):
          </label>
          <input
            className="border-2 text-black border-gray-300 rounded-md p-2 w-20 text-center"
            type="number"
            min={0}
            max={100}
            value={milestoneProbability}
            onChange={handleChangeLimitTo100(setMilestoneProbability)}
          />
        </div>

        <div className="relative flex lg:flex-row flex-col gap-2 group col-span-1 items-center lg:col-span-2">
          <label className="self-center font-semibold text-center">
            Hazard Ratio (HR) Point Estimate:
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="border-2 border-gray-300 text-black rounded-md p-2 w-20 text-center"
            value={hazardRatio}
            onChange={handleInputChange(setHazardRatio)}
          />
        </div>
        <div className="flex flex-row col-span-1 lg:col-span-7 lg:mr-8 2xl:mr-12 justify-center gap-2 items-center lg:justify-end">
          <div className="relative flex lg:flex-row flex-col gap-2 group items-center">
            <label className="self-center text-sm lg:align-right font-semibold text-center w-full">
              Confidence Interval (CI):
            </label>
            <input
              type="number"
              className="border-2 border-gray-300 text-black h-6 text-sm rounded-md p-2 w-20 text-center"
              value={lowerHazardRatio}
              min="0"
              step="0.01"
              onChange={handleInputChange(setLowerHazardRatio)}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              className="border-2 border-gray-300 text-black h-6 text-sm rounded-md p-2 w-20 text-center"
              value={upperHazardRatio}
              onChange={handleInputChange(setUpperHazardRatio)}
            />
          </div>
        </div>
      </div>
      <div className="col-span-7 flex justify-end">
        <button
          onClick={addNewResult}
          className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded justify-end"
        >
          Add Result
        </button>
      </div>

      {results.map((result, index) => (
        <div key={index} className="p-4 mt-4 bg-white pb-10 shadow-lg rounded">
          <h2 className="text-xl font-semibold">Results</h2>
          <div className="text-xs text-gray-500 mb-2">
            <p>Time: {result.inputs.time} {result.inputs.survivalUnit},
              Milestone Probability: {result.inputs.milestoneProbability}%,
              Hazard Ratio: {result.inputs.hazardRatio}
              {result.inputs.lowerHazardRatio && result.inputs.upperHazardRatio ?
                `, CI: (${result.inputs.lowerHazardRatio}-${result.inputs.upperHazardRatio})` :
                ''}
            </p>
          </div>
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
                      <div>{result.result.toFixed(3)}%</div>
                      <div className="text-xs">
                        {result.lowerCIValue !== null && result.upperCIValue !== null && (
                          <div>
                            ({result.upperCIValue.toFixed(3)}-
                            {result.lowerCIValue.toFixed(3)})
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
                      <div>{(result.result - result.inputs.milestoneProbability).toFixed(3)}%</div>
                      <div className="text-xs">
                        {result.lowerCIValue !== null && result.upperCIValue !== null && (
                          <div>
                            (
                            {(result.upperCIValue - result.inputs.milestoneProbability).toFixed(3)}
                            -
                            {(result.lowerCIValue - result.inputs.milestoneProbability).toFixed(3)}
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
                        {result.medianSurvival?.toFixed(2)}{" "}
                        <span className="text-xs">({result.inputs.survivalUnit})</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="text-left font-medium border p-2">
                      Mean Survival with Control:
                    </td>
                    <td className="text-right p-2 border">
                      <div>
                        {result.meanSurvival?.toFixed(2)}{" "}
                        <span className="text-xs">({result.inputs.survivalUnit})</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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
                        {result.medianSurvivalWithTreatment?.toFixed(2)}{" "}
                        <span className="text-xs">({result.inputs.survivalUnit})</span>{" "}
                      </div>
                      {result.lowerMedianSurvivalWithTreatment !== null && result.upperMedianSurvivalWithTreatment !== null && (
                        <div className="text-xs text-center">
                          ({result.upperMedianSurvivalWithTreatment.toFixed(2)}-
                          {result.lowerMedianSurvivalWithTreatment.toFixed(2)})
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
                        {result.meanSurvivalWithTreatment?.toFixed(2)}{" "}
                        <span className="text-xs">({result.inputs.survivalUnit})</span>
                      </div>
                      {result.lowerMeanSurvivalWithTreatment !== null && result.upperMeanSurvivalWithTreatment !== null && (
                        <div className="text-xs text-center">
                          ({result.upperMeanSurvivalWithTreatment.toFixed(2)}-
                          {result.lowerMeanSurvivalWithTreatment.toFixed(2)})
                        </div>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Calculator;
