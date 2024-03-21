import React from "react";

export const BasicTable = ({ data, nameAlias, tableTitle, size }) => {
  const cssSize = () => {
    if (size === "large") {
      return `xl:col-span-12`;
    } else if (size === "medium") {
      return `xl:col-span-8`;
    } else {
      return `xl:col-span-5`;
    }
  };
  return (
    <div
      className={`col-span-full ${cssSize()} bg-white shadow-lg rounded-sm border border-slate-200`}
    >
      <header className="px-5 py-4 border-b border-slate-100 flex flex-row justify-between">
        <h2 className="font-semibold text-slate-800">{tableTitle}</h2>
      </header>
      <div className="p-3">
        {/* Table */}
        <div className="overflow-x-auto max-h-[400px]">
          <table className="table-auto w-full">
            {/* Table header */}
            <thead className="text-xs font-semibold uppercase text-slate-400 bg-slate-50">
              <tr>
                {data[0].year ? (
                  <th className="p-2 whitespace-nowrap">
                    <div className="font-semibold text-left">Year</div>
                  </th>
                ) : null}

                {data[0].totalEnrolled ? (
                  <th className="p-2 whitespace-nowrap text-center">
                    <div className="font-semibold text-center">Enrolled</div>
                  </th>
                ) : null}

                <th className="p-2 md:whitespace-nowrap">
                  <div className="font-semibold text-left">
                    {nameAlias ? nameAlias : "Name"}
                  </div>
                </th>

                {data[0].link ? (
                  <th className="p-2 whitespace-nowrap">
                    <div className="font-semibold text-left">Link</div>
                  </th>
                ) : null}

                {data[0].description && !data[0].link ? (
                  <th className="p-2 whitespace-nowrap">
                    <div className="font-semibold text-left">Description</div>
                  </th>
                ) : null}
              </tr>
            </thead>
            {/* Table body */}
            <tbody className="text-sm divide-y divide-slate-100">
              {data
                .sort((a, b) => b.year - a.year)
                .map((data) => {
                  return (
                    <tr key={data.id}>
                      <td className="p-2 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {data.year ? data.year : null}
                        </div>
                      </td>

                      {data.totalEnrolled ? (
                        <td className="p-2">
                          <div className="font-medium text-center text-slate-800">
                            {data.totalEnrolled.toLocaleString()}
                          </div>
                        </td>
                      ) : null}
                      <td className="p-2 md:whitespace-nowrap">
                        <div className="flex items-center">
                          {data.image ? (
                            <div className="w-6 h-5 shrink-0 mr-4 sm:mr-3 ">
                              <img
                                className="h-full w-full"
                                src={data.image}
                                width="40"
                                height="40"
                                alt={data.name}
                              />
                            </div>
                          ) : null}
                          <div className="font-medium text-slate-800 ml-2">
                            {data.name}
                          </div>
                        </div>
                      </td>

                      {data.link ? (
                        <td className="p-2">
                          <a
                            className="font-medium text-xs text-blue-500 hover:text-blue-600"
                            href={data.link}
                            target="_blank"
                          >
                            {data.description ? data.description : "View"}
                            <span className="hidden sm:inline"> -&gt;</span>
                          </a>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BasicTable;
