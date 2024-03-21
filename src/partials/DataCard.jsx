import React, { useState } from "react";

const DataQuad = ({ title, onInputChange }) => {
  const [control, setControl] = useState({ total: 0, events: 0 });
  const [treatment, setTreatment] = useState({ total: 0, events: 0 });

  const handleChange = (setFunc, type, value) => {
    setFunc((prev) => ({ ...prev, [type]: value }));
    onInputChange(type, value);
  };

  return (
    <div className="">
      <h2 className="text-3xl font-bold text-left pl-4">{title}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-4">
        {/* Treatment */}
        <div className="border p-4 col-span-1 rounded bg-slate-600 text-white">
          <h3 className="w-full text-left font-semibold text-2xl mb-2">
            Treatment
          </h3>

          <div className="w-full flex justify-center gap-4">
            <div className="flex flex-col">
              <label className="text-sm">Total</label>
              <input
                className="border-2 border-gray-300 text-black rounded-md text-sm w-3/4 text-center"
                type="number"
                min={0}
                placeholder="Total"
                onChange={(e) =>
                  handleChange(setTreatment, "total", e.target.value)
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Events</label>
              <input
                className="border-2 border-gray-300 rounded-md text-black text-sm w-3/4 text-center"
                type="number"
                min={0}
                placeholder="Events"
                onChange={(e) =>
                  handleChange(setTreatment, "events", e.target.value)
                }
              />
            </div>
          </div>

          <div className="w- mx-auto mt-5">
            <div
              className="grid grid-flow-row auto-rows-max auto-cols-min gap-1"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(10px, 1fr))",
              }}
            >
              {treatment.events > 0 &&
                Array.from({ length: treatment.events }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-500"
                  ></div>
                ))}
              {treatment.total - treatment.events > 0 &&
                Array.from({ length: treatment.total - treatment.events }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-gray-300"
                    ></div>
                  )
                )}
            </div>
          </div>
        </div>

        {/* Control */}
        <div className="border p-4 col-span-1 rounded bg-slate-600 text-white">
          <h3 className="w-full text-left font-semibold text-2xl mb-2">
            Control
          </h3>
          <div className="w-full flex justify-center gap-4">
            <div className="flex flex-col">
              <label className="text-sm">Total</label>
              <input
                className="border-2 border-gray-300 text-black rounded-md text-sm w-3/4 text-center"
                type="number"
                min={0}
                placeholder="Total"
                onChange={(e) =>
                  handleChange(setControl, "total", e.target.value)
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm">Events</label>
              <input
                className="border-2 text-black border-gray-300 rounded-md text-sm w-3/4 text-center"
                type="number"
                min={0}
                placeholder="Events"
                onChange={(e) =>
                  handleChange(setControl, "events", e.target.value)
                }
              />
            </div>
          </div>

          <div className="w- mx-auto mt-5">
            <div
              className="grid grid-flow-row auto-rows-max auto-cols-min gap-1"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(10px, 1fr))",
              }}
            >
              {control.events > 0 &&
                Array.from({ length: control.events }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-500"
                  ></div>
                ))}
              {control.total - control.events > 0 &&
                Array.from({ length: control.total - control.events }).map(
                  (_, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-gray-300"
                    ></div>
                  )
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const VisualizerComponent = () => {
  const [selectedQuads, setSelectedQuads] = useState({
    OS: true,
    DFS: true,
    seriousSideEffects: true,
    sideEffects: true,
  });

  //todo: refactor this to take in an array of quad names and render them dynamically
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-4">
      <div className="col-span-1 mt-5">
        {selectedQuads.OS && <DataQuad title="Overall Survival" />}
      </div>
      <div className="col-span-1 mt-5">
        {selectedQuads.DFS && <DataQuad title="Disease-Free Survival" />}
      </div>

      <div className="col-span-1 mt-10">
        {selectedQuads.seriousSideEffects && (
          <DataQuad title="Serious Side Effects" />
        )}
      </div>
      <div className="col-span-1 mt-10">
        {selectedQuads.sideEffects && <DataQuad title="Side Effects" />}
      </div>
    </div>
  );
};

export default VisualizerComponent;
