import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTable, useFilters, useGlobalFilter, useSortBy, usePagination } from 'react-table';
import Select, { components } from 'react-select';
import { faChevronDown, faChevronUp, faTimes } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import toast from 'react-hot-toast';
import Chart from 'chart.js/auto';


const OPERATORS = {
  equals: 'equals',
  not_equals: 'not_equals',
  contains: 'contains',
  not_contains: 'not_contains',
  greater_than: 'greater_than',
  less_than: 'less_than',
  between: 'between',
  not_between: 'not_between'
};

const LOGIC_OPERATORS = {
  AND: 'AND',
};

const Explorer = () => {
  const [notes, setNotes] = useState('');
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [configName, setConfigName] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState([]);
  const [columns, setColumns] = useState([]);
  const [showChart, setShowChart] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedChartColumn1, setSelectedChartColumn1] = useState('');
  const [selectedChartColumn2, setSelectedChartColumn2] = useState('');
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const FILE_SIZE_LIMIT = 5 * 1024 * 1024;

  const visibleColumns = useMemo(() => {
    return columns.filter(column => selectedColumns.includes(column.accessor));
  }, [columns, selectedColumns]);

  const handleColumnSelection = (selectedOptions) => {
    setSelectedColumns(selectedOptions.map(option => option.value));
  };

  const removeColumn = useCallback((columnAccessor) => {
    setSelectedColumns(prev => prev.filter(col => col !== columnAccessor));
  }, []);

  const columnOptions = useMemo(() => [
    ...columns.map(col => ({ value: col.accessor, label: col.Header }))
  ], [columns]);

  // const isAllSelected = selectedColumns.length === columns.length;

  const filterTypes = useMemo(
    () => ({
      text: (rows, id, filterValue) => {
        return rows.filter(row => {
          const rowValue = row.values[id];
          if (rowValue === undefined) return true;

          const { operator, value } = filterValue;
          const stringRowValue = String(rowValue).toLowerCase();
          const stringFilterValue = String(value).toLowerCase();

          switch (operator) {
            case 'equals':
              return stringRowValue === stringFilterValue;
            case 'not_equals':
              return stringRowValue !== stringFilterValue;
            case 'contains':
              return stringRowValue.includes(stringFilterValue);
            case 'not_contains':
              return !stringRowValue.includes(stringFilterValue);
            default:
              return true;
          }
        });
      },
      number: (rows, id, filterValue) => {
        return rows.filter(row => {
          const rowValue = parseFloat(row.values[id]);
          if (isNaN(rowValue)) return true;

          const { operator, value, value2 } = filterValue;
          const numericValue = parseFloat(value);
          const numericValue2 = parseFloat(value2);

          switch (operator) {
            case 'equals':
              return rowValue === numericValue;
            case 'not_equals':
              return rowValue !== numericValue;
            case 'greater_than':
              return rowValue > numericValue;
            case 'less_than':
              return rowValue < numericValue;
            case 'between':
              return rowValue >= numericValue && rowValue <= numericValue2;
            case 'not_between':
              return rowValue < numericValue || rowValue > numericValue2;
            default:
              return true;
          }
        });
      },
    }),
    []
  );

  useEffect(() => {
    const savedConfigs = JSON.parse(localStorage.getItem('savedFilterConfigs') || '[]');
    setSavedConfigs(savedConfigs);
  }, []);



  const saveCurrentConfig = () => {
    if (configName) {
      const newConfig = {
        name: configName,
        filters: filters,
        selected: rows.length,
        total: data.length,
        notes: notes,
        globalFilter: globalFilter
      };
      const updatedConfigs = [...savedConfigs, newConfig];
      setSavedConfigs(updatedConfigs);
      localStorage.setItem('savedFilterConfigs', JSON.stringify(updatedConfigs));
      setConfigName('');
    }
  };

  const loadConfig = (config) => {
    // Ensure all columns in the config exist in the current data
    const configColumns = config.filters.map(filter => filter.column);
    const currentColumns = columns.map(col => col.accessor);
    const invalidColumns = configColumns.filter(col => !currentColumns.includes(col));

    if (invalidColumns.length > 0) {
      toast.error("Config doesn't match the current file. Some filters weren't applied.");
      const validFilters = config.filters.filter(filter => currentColumns.includes(filter.column));
      setFilters(validFilters);
    } else {
      setFilters(config.filters);
    }

    setNotes(config.notes);
    setGlobalFilter(config.globalFilter);
    setReactTableGlobalFilter(config.globalFilter);
  };

  const deleteConfig = (index) => {
    const updatedConfigs = savedConfigs.filter((_, i) => i !== index);
    setSavedConfigs(updatedConfigs);
    localStorage.setItem('savedFilterConfigs', JSON.stringify(updatedConfigs));
  };

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    setFilter,
    setAllFilters,
    setGlobalFilter: setReactTableGlobalFilter,
    state: { filters: tableFilters, pageIndex: tablePageIndex, pageSize: tablePageSize },
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize: setReactTablePageSize,
    rows,
  } = useTable(
    {
      columns: visibleColumns,
      data,
      filterTypes,
      initialState: { pageIndex, pageSize },
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  // Update local state when table state changes
  useEffect(() => {
    setPageIndex(tablePageIndex);
    setPageSize(tablePageSize);
  }, [tablePageIndex, tablePageSize]);

  // Apply filters
  useEffect(() => {
    const filtersToApply = filters
      .filter(f => f.column && f.operator && f.value)
      .map(filter => ({
        id: filter.column,
        value: {
          operator: filter.operator,
          value: filter.value,
          value2: filter.value2,
          isNot: filter.isNot
        }
      }));
    setAllFilters(filtersToApply);
    setReactTableGlobalFilter(globalFilter);
    gotoPage(0);
  }, [filters, globalFilter, setAllFilters, setReactTableGlobalFilter, gotoPage]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > FILE_SIZE_LIMIT) {
        console.error('File size exceeds the limit of 5MB');
        setDebugInfo('File size exceeds the limit of 5MB');
        return;
      }

      setIsProcessing(true);
      setProgress(0);

      try {
        const worker = new Worker(new URL('../utils/csvWorker.js', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          if (e.data.type === 'progress') {
            setProgress(e.data.progress);
          } else if (e.data.type === 'result') {
            const filteredColumns = e.data.fields.filter(field => {
              return e.data.data.some(row => row[field] && row[field] !== '--' && row[field] !== '');
            });

            setData(e.data.data);

            const newColumns = filteredColumns.map(field => ({
              Header: field,
              accessor: field,
              filter: isNaN(e.data.data[0][field]) ? 'text' : 'number'
            }));

            setColumns(newColumns);
            setSelectedColumns(newColumns.map(col => col.accessor));
            if (newColumns.length > 0) {
              setSelectedChartColumn1(newColumns[0].accessor);
              setSelectedChartColumn2(newColumns[0].accessor);
            }

            setIsProcessing(false);
            setDebugInfo(`File loaded successfully. ${e.data.data.length} rows.`);
          } else if (e.data.type === 'error') {
            setIsProcessing(false);
            setDebugInfo(`Error processing file: ${e.data.error}`);
          }
        };

        worker.onerror = (error) => {
          setIsProcessing(false);
          setDebugInfo(`Worker error: ${error.message}`);
        };

        worker.postMessage({ file });
      } catch (error) {
        setIsProcessing(false);
        setDebugInfo(`Error starting worker: ${error.message}`);
      }
    } else {
      console.error('No file selected');
    }
  };

  useEffect(() => {
    return () => {
      if (chartRef1.current) {
        chartRef1.current.destroy();
      }
      if (chartRef2.current) {
        chartRef2.current.destroy();
      }
    };
  }, []);

  const prepareAndRenderChart = (column, chartRef, chartId) => {
    if (!column || !rows.length) return;

    const aggregatedData = rows.reduce((acc, row) => {
      const value = row.values[column];
      if (acc[value]) {
        acc[value]++;
      } else {
        acc[value] = 1;
      }
      return acc;
    }, {});


    const totalCount = Object.values(aggregatedData).reduce((sum, count) => sum + count, 0);
    const chartData = Object.entries(aggregatedData).map(([key, value]) => ({
      label: key,
      count: value,
      percentage: (value / totalCount) * 100
    }));

    chartData.sort((a, b) => a.count - b.count);

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = document.getElementById(chartId).getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.map(item => item.label),
        datasets: [{
          label: `${column} Distribution`,
          data: chartData.map(item => item.count),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const data = chartData[context.dataIndex];
                const count = data.count;
                const percentage = data.percentage.toFixed(2);
                return `Count: ${count} (${percentage}%)`;
              }
            }
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            formatter: function (value, context) {
              const percentage = chartData[context.dataIndex].percentage.toFixed(1);
              return `${value} (${percentage}%)`;
            },
            font: {
              weight: 'bold'
            }
          }
        }
      }
    });
  };

  useEffect(() => {
    if (selectedChartColumn1 && showChart) {
      prepareAndRenderChart(selectedChartColumn1, chartRef1, 'myChart1');
    }
  }, [selectedChartColumn1, rows]);

  useEffect(() => {
    if (selectedChartColumn2 && showChart) {
      prepareAndRenderChart(selectedChartColumn2, chartRef2, 'myChart2');
    }
  }, [selectedChartColumn2, rows]);


  const addFilter = () => {
    setFilters([...filters, { column: '', operator: '', value: '', value2: '' }]);
  };

  const updateFilter = useCallback((index, field, value) => {
    setFilters(prevFilters => {
      const newFilters = [...prevFilters];
      newFilters[index] = { ...newFilters[index], [field]: value };

      if (field === 'operator') {
        newFilters[index].isNot = value.startsWith('not_');
      }

      return newFilters;
    });
  }, []);

  const removeFilter = (index) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
  };

  const handleGlobalFilterChange = (e) => {
    const value = e.target.value;
    setGlobalFilter(value);
    setReactTableGlobalFilter(value);
  };


  const exportFilteredData = () => {
    const filteredData = rows.map(row => row.values);
    const visibleColumns = columns.filter(col => selectedColumns.includes(col.accessor));
    const csv = [
      visibleColumns.map(col => col.Header).join(','),
      ...filteredData.map(row => visibleColumns.map(col => row[col.accessor]).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filtered_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const getExpandedOperatorOptions = (columnId) => {
    const column = columns.find(col => col.accessor === columnId);
    if (!column) return [];

    switch (column.filter) {
      case 'number':
        return [
          { value: 'equals', label: 'equals' },
          { value: 'not_equals', label: 'does not equal' },
          { value: 'greater_than', label: 'is greater than' },
          { value: 'less_than', label: 'is less than' },
          { value: 'between', label: 'is between' },
          { value: 'not_between', label: 'is not between' },
        ];
      case 'text':
        return [
          { value: 'equals', label: 'equals' },
          { value: 'not_equals', label: 'does not equal' },
          { value: 'contains', label: 'contains' },
          { value: 'not_contains', label: 'does not contain' },
        ];
      default:
        return [];
    }
  };

  const CustomMultiValue = ({ children, ...props }) => {
    const handleRemove = (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeColumn(props.data.value);
    };

    return (
      <div
        className={`px-1 bg-blue-100 cursor-pointer rounded-md mr-1 flex items-center text-sm mb-1 ${props.isSelected
          ? 'hover:bg-blue-600'
          : 'hover:bg-blue-100'
          }`}
      >

        <span className="mr-1 truncate">{children}</span>
        <button
          onClick={handleRemove}
          className="text-blue-500 hover:text-blue-700 flex-shrink-0"
        >
          <FontAwesomeIcon icon={faTimes} className="h-3 w-3" />
        </button>
      </div>
    );
  };



  return (
    <div className="">
      <h1 className="text-2xl font-bold mb-4">Basic Explorer</h1>


      <div className="bg-slate-600 text-white p-2 self-center rounded-sm">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="mt-2 mb-2 p-2"
        />
        <div className='pl-2 text-xs'>5 MB file size limit. </div>
        <div className='pl-2 text-xs'>This is a full front-end solution. No data is uploaded to a server, and all processing is done in the browser. Large datasets may become unresponsive or take longer to process. A refresh will clear the selected file. </div>
        {isProcessing && (
          <div className="mt-2">
            Processing file... {progress.toFixed(2)}%
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
              <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
          </div>
        )}
        {data.length > 0 && (
          <div className='p-2'>
            <div>
              <div className="mt-4">
                <div className='flex flex-row w-full justify-between mt-2 mb-4'>
                  <div className='text-lg font-semibold' >Saved Configurations</div>
                  <div className='text-slate-500' onClick={() => setShowConfig(!showConfig)}>{showConfig ? <FontAwesomeIcon className="text-white" icon={faChevronUp} /> : <FontAwesomeIcon className="text-white" icon={faChevronDown} />}</div>
                </div>
                {showConfig && (
                  <div className='flex flex-col p-2'>
                    <div className='grid grid-cols-1 gap-2 max-h-52 overflow-scroll rounded'>
                      <ConfigTable savedConfigs={savedConfigs} loadConfig={loadConfig} deleteConfig={deleteConfig} />
                    </div>
                    < div className="mt-5 font-medium ">
                      Add New
                      <div className="">
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Enter notes about this filter configuration..."
                          className="w-full px-3 py-2 border rounded border-gray-300 text-slate-700"
                          rows="3"
                        />
                      </div>

                      <div className="mt-4 flex items-center mb-4">
                        <input
                          type="text"
                          value={configName}
                          onChange={(e) => setConfigName(e.target.value)}
                          placeholder="Configuration name"
                          className="flex-grow px-3 py-2 border border-gray-300 rounded mr-2 text-slate-700"
                        />
                        <button
                          onClick={saveCurrentConfig}
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          Save Configuration
                        </button>
                      </div>

                    </div>
                  </div>)
                }

              </div>

            </div>

            <div className='flex flex-row w-full justify-between mt-2 mb-2 '>
              <div className='text-lg font-semibold' >Filters</div>
              <div className='text-slate-500' onClick={() => setShowFilters(!showFilters)}>{showFilters ? <FontAwesomeIcon className="text-white" icon={faChevronUp} /> : <FontAwesomeIcon className="text-white" icon={faChevronDown} />}</div>
            </div>

            {
              showFilters && (
                <div className='p-2 text-slate-700'>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2">
                      Select Columns to Display
                    </label>
                    <Select
                      isMulti
                      options={columnOptions}
                      value={selectedColumns.map(colName => ({
                        value: colName,
                        label: columns.find(col => col.accessor === colName)?.Header
                      }))}
                      onChange={handleColumnSelection}
                      className="basic-multi-select z-50"
                      classNamePrefix="select"
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      components={{
                        MultiValue: CustomMultiValue,
                        MenuList: CustomMenuList,
                        Control: CustomControl,
                        Option: CustomOption,
                        IndicatorsContainer: () => null
                      }}
                    />
                  </div>
                  <input
                    type="text"
                    value={globalFilter}
                    onChange={handleGlobalFilterChange}
                    placeholder="Search all fields..."
                    className="w-full px-3 py-2 border rounded mb-4 border-gray-300"
                  />
                  {filters.map((filter, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-12 items-center mb-2 relative">
                      {index > 0 && (
                        <div className="col-span-1">
                          <Select
                            options={[
                              { value: LOGIC_OPERATORS.AND, label: 'AND' },
                            ]}
                            value={{ value: filter.logic, label: filter.logic }}
                            onChange={(selected) => updateFilter(index, 'logic', selected.value)}
                            className="relative z-50 w-full"
                            classNamePrefix="select"
                          />
                        </div>
                      )}
                      <div className="md:col-span-4 relative">
                        <Select
                          options={columns.map(col => ({ value: col.accessor, label: col.Header }))}
                          value={filter.column ? { value: filter.column, label: columns.find(col => col.accessor === filter.column)?.Header } : null}
                          onChange={(selected) => updateFilter(index, 'column', selected?.value)}
                          className="relative z-40"
                          classNamePrefix="select"
                        />
                      </div>
                      <div className="col-span-3 relative z-40">
                        <Select
                          options={getExpandedOperatorOptions(filter.column)}
                          value={filter.operator ? { value: filter.operator, label: getExpandedOperatorOptions(filter.column).find(op => op.value === filter.operator)?.label } : null}
                          onChange={(selected) => {
                            updateFilter(index, 'operator', selected?.value);
                            updateFilter(index, 'isNot', selected?.value.startsWith('not_'));
                          }}
                          className="relative z-30"
                          classNamePrefix="select"
                        />
                      </div>
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilter(index, 'value', e.target.value)}
                        placeholder="Value"
                        className="col-span-2 px-3 py-2 border rounded border-gray-300 relative z-20"
                      />
                      {(filter.operator === OPERATORS.between || filter.operator === OPERATORS.not_between) && (
                        <input
                          type="text"
                          value={filter.value2}
                          onChange={(e) => updateFilter(index, 'value2', e.target.value)}
                          placeholder="Value 2"
                          className="col-span-2 px-3 py-2 border rounded border-gray-300 relative z-20"
                        />
                      )}
                      <button
                        onClick={() => removeFilter(index)}
                        className="col-span-1 px-3 py-2 border rounded hover:bg-gray-800 border-gray-300 text-white relative z-20"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  < button
                    onClick={addFilter}
                    className="mt-2 px-2 py-1 bg-blue-500 text-sm font-semibold text-white rounded hover:bg-blue-600"
                  >
                    Add Filter
                  </button>
                </div>
              )
            }
            <div className='flex flex-row w-full justify-between mt-2 mb-2 '>
              <div className='text-lg font-semibold' >Chart</div>
              <div className='text-slate-500' onClick={() => setShowChart(!showChart)}>{showChart ? <FontAwesomeIcon className="text-white" icon={faChevronUp} /> : <FontAwesomeIcon className="text-white" icon={faChevronDown} />}</div>
            </div>
            {showChart && (
              <>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <select
                    value={selectedChartColumn1}
                    onChange={(e) => setSelectedChartColumn1(e.target.value)}
                    className="mt-1 block text-slate-800 w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select a column to visualize</option>
                    {columns.map(column => (
                      <option key={column.accessor} value={column.accessor}>
                        {column.Header}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedChartColumn2}
                    onChange={(e) => setSelectedChartColumn2(e.target.value)}
                    className="mt-1 block text-slate-800 w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Select a column to visualize</option>
                    {columns.map(column => (
                      <option key={column.accessor} value={column.accessor}>
                        {column.Header}
                      </option>
                    ))}
                  </select>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2'>
                  <div className="col-span-1 mt-4">
                    <canvas id="myChart1"></canvas>
                  </div>
                  <div className="col-span-1 mt-4">
                    <canvas id="myChart2"></canvas>
                  </div>
                </div>
              </>
            )}
          </div>





        )}


      </div>

      <div className="mb-2 flex flex-wrap mt-2">
        {globalFilter && (
          <span className="mr-2 mb-2 px-3 py-1 bg-gray-200 rounded-full text-sm">
            All fields: {globalFilter}
            <button
              onClick={() => {
                setGlobalFilter('');
                setReactTableGlobalFilter('');
              }}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </span>
        )}


        <div className="w-full flex justify-end">
          <button
            onClick={() => exportFilteredData()}
            className="text-blue-500 text-xs rounded text-medium hover:text-blue-600 flex justify-end"
          >
            Export Filtered Data
          </button>
        </div>
        {tableFilters.map((filter, index) => (
          <span key={index} className="mr-2 px-3 py-1 bg-gray-200 rounded-full text-sm">
            {columns.find(col => col.accessor === filter.id).Header}
            {filter.value.operator} {filter.value.value}
            {filter.value.operator === OPERATORS.between && ` and ${filter.value.value2}`}
            <button
              onClick={() => removeFilter(index)}
              className="ml-2 text-gray-500 hover:text-gray-700"
            >
              &times;
            </button>
          </span>
        ))}

      </div>
      {
        data.length > 0 ? (
          <div className="max-h-[600px] overflow-y-auto">
            <table {...getTableProps()} className="min-w-full divide-y divide-gray-200 relative">
              <thead className="bg-gray-50 sticky top-0 z-10">
                {headerGroups.map(headerGroup => (
                  <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                      <th
                        {...column.getHeaderProps(column.getSortByToggleProps())}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {column.render('Header')}
                        <span>
                          {column.isSorted
                            ? column.isSortedDesc
                              ? ' 🔽'
                              : ' 🔼'
                            : ''}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody {...getTableBodyProps()} className="bg-white divide-y divide-gray-200">
                {page.map(row => {
                  prepareRow(row);
                  return (
                    <tr {...row.getRowProps()}>
                      {row.cells.map(cell => (
                        <td
                          {...cell.getCellProps()}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                        >
                          {cell.render('Cell')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pagination mt-4 flex items-center justify-between">
              <div>
                <button onClick={() => gotoPage(0)} disabled={!canPreviousPage} className="mr-2 px-3 py-1 bg-gray-200 rounded">
                  {'<<'}
                </button>
                <button onClick={() => previousPage()} disabled={!canPreviousPage} className="mr-2 px-3 py-1 bg-gray-200 rounded">
                  {'<'}
                </button>
                <button onClick={() => nextPage()} disabled={!canNextPage} className="mr-2 px-3 py-1 bg-gray-200 rounded">
                  {'>'}
                </button>
                <button onClick={() => gotoPage(pageCount - 1)} disabled={!canNextPage} className="mr-2 px-3 py-1 bg-gray-200 rounded">
                  {'>>'}
                </button>
              </div>
              <span>
                Page{' '}
                <strong>
                  {pageIndex + 1} of {pageOptions.length}
                </strong>{' '}
              </span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setReactTablePageSize(Number(e.target.value));
                }}
                className="ml-2 px-2 py-1 border rounded w-32"
              >
                {[10, 20, 30, 40, 50].map(pageSize => (
                  <option key={pageSize} value={pageSize}>
                    Show {pageSize}
                  </option>
                ))}
              </select>
            </div>

            <div className='flex flex-row gap-5 justify-between'>
              <div className='mt-4'>Total rows: {rows.length} of {data.length}</div>
              <div className='mt-4'>Showing: {page.length} of {rows.length}</div>
              <div className='mt-4'>Percentage of Total Records: {((rows.length / data.length) * 100).toFixed(2)}%</div>
            </div>
          </div>

        ) :
          <div className="text-red-500">No data to display. Please upload a CSV file.</div>
      }
    </div >
  );
};

export default Explorer;

const ConfigTable = ({ savedConfigs, loadConfig, deleteConfig }) => {
  const configTableHeaders =
    [
      "Name",
      "Selected",
      "Total",
      "Percentage",
      "Notes",
      " "
    ]
  return (
    <table className="min-w-full divide-y divide-gray-200 text-slate-800 rounded-md">
      <thead className="bg-gray-50">
        <tr>
          {configTableHeaders.map((header, index) => (
            <th key={index} className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{header}</th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200 text-sm">
        {savedConfigs.map((config, index) => (
          <tr key={index}>
            <td className="px-6 py-1 whitespace-nowrap">{config.name}</td>
            <td className="px-6 py-1 whitespace-nowrap">{config.selected}</td>
            <td className="px-6 py-1 whitespace-nowrap">{config.total}</td>
            <td className="px-6 py-1 whitespace-nowrap">{((config.selected / config.total) * 100).toFixed(2)}%</td>
            <td className="px-6 py-1 whitespace-nowrap max-w-xs overflow-auto">{config.notes}</td>
            <td className="px-6 py-1 whitespace-nowrap justify-end flex">
              <button onClick={() => deleteConfig(index)} className="px-2 py-1 bg-red-400 text-white text-sm rounded hover:bg-red-600 opacity-30">Delete</button>
              <button onClick={() => loadConfig(config)} className="px-3 py-1 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-700 ml-2">Load</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const CustomOption = ({ children, ...props }) => (
  <components.Option {...props}>
    <div
    >
      {children}
    </div>
  </components.Option>
);

const CustomMenuList = ({ children, ...props }) => {
  return (
    <components.MenuList {...props}>
      <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {children}
      </div>
    </components.MenuList>
  );
};

const CustomControl = ({ children, ...props }) => (
  <components.Control {...props}>
    <div className="flex items-center justify-between w-full pr-2 bg-white border border-gray-300 rounded-md">
      <div className="flex-grow overflow-x-auto overflow-y-hidden whitespace-nowrap max-h-36 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {children}
      </div>
      <div className="flex-shrink-0 ml-2">
        <FontAwesomeIcon icon={props.selectProps.menuIsOpen ? faChevronUp : faChevronDown} className="text-gray-400" />
      </div>
    </div>
  </components.Control>
);