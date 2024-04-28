import React, { useState, useEffect } from 'react';
import axios from 'axios';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  TimeScale,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import faker from 'faker'; //this is for mock data
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  TimeScale,
);
import colorLib from '@kurkle/color';

//Runs array -> reformatData -> genChartData
//Calculate metrics from runs array (array of objects)
const reformatData = array => {
  let monthObj = {};
  const monthDataArr = [];
  array.forEach(run => {
    const runMonthYear = getMonthDate(run.started_at); //'january24'
    //check to see if month already exists
    if (monthObj.name === undefined) {
      monthObj = createMonthYear(run.started_at);
    }
    const existingMonth = monthDataArr.find(month => month.name === runMonthYear);

    // If the month doesn't exist, create a new monthObj and push it to monthDataArr
    if (!existingMonth) {
      monthObj = createMonthYear(run.started_at);
      // monthObj.isoDate = run.started_at;
      monthDataArr.push(monthObj);
    } else {
      // If the month already exists, assign the existing monthObj to monthObj
      monthObj = existingMonth;
    }
    if (run.conclusion === 'cancelled' || run.conclusion === 'failure') {
      //get success and failures
      monthObj.failure++;
      monthObj.total++;
    } else if (run.conclusion === 'success') {
      monthObj.success++;
      monthObj.total++;
    }

    //get workflow run time in seconds
    const workFlowStart = run.steps[0].started_at;
    const workFlowEnd = run.steps[run.steps.length - 1].completed_at;
    const runTime = timeDifSeconds(workFlowStart, workFlowEnd);
    monthObj.runTimes.push(runTime);
    shapedMetrics.lifetimeRuns.push(runTime);
    monthObj.monthAvg = calcAvg(monthObj.runTimes);
    //create labels for all runs chart
    chartData.eachRunLabel.push(eachRunTime(workFlowStart));
    chartData.eachRunDuration.push(runTime);
  });
  shapedMetrics.monthData = monthDataArr;
  shapedMetrics.lifetimeAvg = calcAvg(shapedMetrics.lifetimeRuns);
};

const reformatSteps = array => {
  const stepDataArr = [];

  array.forEach(run => {
    run.steps.forEach(step => {
      // Try to find if this step already exists in the array
      let existingStep = stepDataArr.find(el => el.name === step.name);

      if (!existingStep) {
        // Create a new step object if it doesn't exist
        existingStep = {
          name: step.name,
          total: 0,
          fail: 0,
          success: 0,
        };
        stepDataArr.push(existingStep);
      }

      // Increment the total number of times this step has been run
      existingStep.total++;

      // Increment the fail count if the conclusion is not success
      if (step.conclusion !== 'success') {
        existingStep.fail++;
      } else if (step.conclusion === 'success') {
        existingStep.success++;
      }
    });
  });

  // Update the global stepMetrics array with new data
  stepMetrics = stepDataArr;
};

//New shape of metrics after parsing response of /api/github/findRuns
let shapedMetrics = {
  lifetimeRuns: [],
  monthData: [],
  lifetimeAvg: null,
};

//For step calculations
let stepMetrics = [];

//Reads shapedMetrics for conversion to chartData for ChartJS display
const genChartData = arr => {
  arr.forEach(el => {
    chartData.labels.push(el.label);
    chartData.monthIso.push(el.isoDate);
    chartData.success.push(el.success);
    chartData.failure.push(el.failure);
    chartData.pieData[0] += el.failure;
    chartData.pieData[1] += el.success;
    chartData.horizBarData.push(calcAvg(el.runTimes) - shapedMetrics.lifetimeAvg);
    chartData.straightLine.push(shapedMetrics.lifetimeAvg);
    chartData.monthAvg.push(el.monthAvg);
  });
  // test1 = chartData.horizBarData.reduce((max, num) => Math.max(max, Math.abs(num)), 0);
  // horizBarOptions.scales.x.min = -test1;
  // horizBarOptions.scales.x.min = test1;
};

//Reads stepMetrics for conversion to chartData for ChartJS display
const genChartStepData = arr => {
  arr.forEach(el => {
    chartData.stepLabels.push(el.name);
    chartData.stepFailPct.push(el.fail / el.total);
    chartData.stepSuccPct.push(el.success / el.total);
  });
};
//*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~
//CHART JS DATA
let chartData = {
  labels: [],
  success: [], //[1, 2, 3, ...]
  failure: [], //[5, 5, 5, ...]
  pieData: [0, 0], //[12, 19] [Failure, Success]
  horizBarData: [], //[-5, 12, -13, 4, -5, 6, -7] Month avg workflow run - Lifetime avg workflow run (seconds)
  straightLine: [], //Lifetime average run line
  monthAvg: [], //Monthly average
  eachRunLabel: [], //"4/18 19:23"
  eachRunDuration: [],
  monthIso: [],
  stepLabels: [],
  stepFailPct: [],
  stepSuccPct: [],
};

//*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~
//HELPER FUNCTIONS TO GENERATE METRICS

const createMonthYear = isoDate => {
  const date = new Date(isoDate);
  const month = date.toLocaleString('default', { month: 'long' }); // Get month name
  const year = date.getFullYear().toString().substr(-2); // Get the last two digits of year
  return {
    name: `${month.toLowerCase()}${year}`, //January '24
    label: `${month} '${year}`, //january24
    runTimes: [],
    monthAvg: null,
    success: 0,
    failure: 0,
    total: 0,
    isoDate: null,
  };
};

const getMonthDate = isoDate => {
  const date = new Date(isoDate);
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear().toString().substr(-2);
  return `${month.toLowerCase()}${year}`; //january24
};

const timeDifSeconds = (start, end) => {
  const time1 = new Date(start);
  const time2 = new Date(end);
  return (time2.getTime() - time1.getTime()) / 1000;
};

const calcAvg = array => {
  if (array.length === 0) {
    return 0;
  }
  let sum = array.reduce((acc, val) => acc + val, 0);
  let average = sum / array.length;
  return parseFloat(average.toFixed(1));
};

const eachRunTime = isoDate => {
  // Parse the ISO date string
  const date = new Date(isoDate);

  // Get the month (getMonth() returns 0-11, so add 1 for a 1-12 range)
  const month = date.getMonth() + 1;

  // Get the day of the month
  const day = date.getDate();

  // Get hours and minutes
  const hours = date.getHours();
  const minutes = date.getMinutes();

  // Format hours and minutes to ensure two digits
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  // Format the date string as "month/day time"
  return `${month}/${day} ${formattedHours}:${formattedMinutes}`;
};

const sortRuns = array => {
  return array.sort((a, b) => {
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    return dateA - dateB;
  });
};

const resetChartData = () => {
  chartData = {
    labels: [],
    success: [], //[1, 2, 3, ...]
    failure: [], //[5, 5, 5, ...]
    pieData: [0, 0], //[12, 19] [Failure, Success]
    horizBarData: [], //[-5, 12, -13, 4, -5, 6, -7] Month avg workflow run - Lifetime avg workflow run (seconds)
    straightLine: [], //Lifetime average run line
    monthAvg: [], //Monthly average
    eachRunLabel: [], //"4/18 19:23"
    eachRunDuration: [],
    monthIso: [],
    stepLabels: [],
    stepFailPct: [],
    stepSuccPct: [],
  };
};

const resetShapedMetrics = () => {
  shapedMetrics = {
    lifetimeRuns: [],
    monthData: [],
    lifetimeAvg: null,
  };
};

//*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~
//CHARTJS OPTIONS AND UTILS
//options for loading ChartJS animations
let delayed;
export const options = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Total Workflow Runs',
    },
  },
  animation: {
    onComplete: () => {
      delayed = true;
    },
    delay: context => {
      let delay = 0;
      if (context.type === 'data' && context.mode === 'default' && !delayed) {
        delay = context.dataIndex * 300 + context.datasetIndex * 100;
      }
      return delay;
    },
  },
};
export function transparentize(value, opacity) {
  var alpha = opacity === undefined ? 0.5 : 1 - opacity;
  return colorLib(value).alpha(alpha).rgbString();
}
export const CHART_COLORS = {
  red: 'rgb(255, 99, 132)',
  orange: 'rgb(255, 159, 64)',
  yellow: 'rgb(255, 205, 86)',
  green: 'rgb(75, 192, 192)',
  blue: 'rgb(54, 162, 235)',
  purple: 'rgb(153, 102, 255)',
  grey: 'rgb(201, 203, 207)',
};

//Vertical Bar Chart
export const data = {
  labels: chartData.labels,
  datasets: [
    {
      label: 'Success',
      data: chartData.success,
      backgroundColor: 'rgba(53, 162, 235, 0.5)',
    },
    {
      label: 'Failure',
      data: chartData.failure,
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
    },
  ],
};

//Pie
export const pieOptions = {
  aspectRatio: 0.5,
};
export const pieData = {
  labels: ['Failure', 'Success'],
  datasets: [
    {
      label: 'Lifetime Workflow Attempts',
      data: chartData.pieData,
      backgroundColor: ['rgb(255, 99, 132)', 'rgb(75, 192, 192)'],
      borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
      borderWidth: 1,
    },
  ],
};

//Horizontal Bar Chart
export const horizBarOptions = {
  indexAxis: 'y',
  elements: {
    bar: {
      borderWidth: 2,
    },
  },
  responsive: true,
  plugins: {
    legend: {
      position: 'right',
    },
    title: {
      display: true,
      text: 'Monthly Run Time vs Lifetime Average Run Time (seconds)',
    },
  },
  scales: {
    x: {
      min: -50,
      max: 50,
    },
  },
};
export const horizBarData = {
  labels: chartData.labels,
  datasets: [
    {
      label: '2024',
      data: chartData.horizBarData, //Month avg workflow run - Lifetime avg workflow run (seconds)
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
    },
  ],
};

//Combo Bar Chart
export const comboBarOptions = {
  type: 'bar',
  data: data,
  options: {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Monthly vs Lifetime Average (seconds)',
      },
    },
  },
};
export const comboBarData = {
  labels: chartData.labels,
  datasets: [
    {
      label: 'Month',
      data: chartData.monthAvg,
      borderColor: CHART_COLORS.red,
      backgroundColor: transparentize(CHART_COLORS.red, 0.5),
      order: 0,
    },
    {
      label: 'Lifetime',
      data: chartData.straightLine,
      borderColor: CHART_COLORS.blue,
      backgroundColor: transparentize(CHART_COLORS.blue, 0.5),
      type: 'line',
      order: 1,
    },
  ],
};
//Line Chart Options
export const lineOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Execution Time Trend (seconds)',
    },
  },
  scales: {
    x: {
      minRotation: 50,
    },
  },
};
export const lineChartData = {
  labels: chartData.eachRunLabel,
  datasets: [
    {
      label: 'Run Times',
      data: chartData.eachRunDuration,
      borderColor: CHART_COLORS.blue,
      backgroundColor: CHART_COLORS.blue,
    },
  ],
};
//Step Bar Chart
export const stepBarOptions = {
  indexAxis: 'y',
  elements: {
    bar: {
      borderWidth: 2,
    },
  },
  responsive: true,
  plugins: {
    legend: {
      position: 'right',
    },
    title: {
      display: true,
      text: 'Failure Rate By Job Step',
    },
  },
  scales: {
    x: {
      stacked: true,
      ticks: {
        format: {
          style: 'percent',
        },
        display: true,
      },
      grid: {
        display: false,
      },
    },
    y: {
      stacked: true,
      grid: {
        display: false,
      },
    },
  },
};
export const stepBarData = {
  labels: chartData.stepLabels,
  datasets: [
    {
      label: 'Fails',
      data: chartData.stepFailPct,
      borderColor: 'rgb(255, 99, 132)',
      backgroundColor: 'rgba(255, 99, 132, 0.5)',
    },
    {
      label: 'Success',
      data: chartData.stepSuccPct,
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.5)',
    },
  ],
};

const Mvpmetrics = () => {
  const [username, setUsername] = useState(() => {
    // Get the value of the 'username' cookie
    const usernameCookie = document.cookie
      .split(';')
      .find(cookie => cookie.trim().startsWith('username='));
    return usernameCookie ? usernameCookie.split('=')[1] : '';
  });
//for username to populate dropdown options
  const [repos, setRepos] = useState([]); //for dropdown menu options
  const [selectedRepo, setSelectedRepo] = useState(''); //for selection from dropdown

  const [owner, setOwner] = useState(''); //for type in field
  const [repo, setRepo] = useState(''); //for type in field

  //Set state for charts
  const [vertBarChart, setVertBarChart] = useState({
    labels: chartData.monthIso,
    datasets: [
      {
        label: 'Success',
        data: chartData.success,
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'Failure',
        data: chartData.failure,
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  });
  const [pieChart, setPieChart] = useState(pieData);
  const [horizBarChart, setHorizBarChart] = useState(horizBarData);
  const [horizBarOptions, setHorizBarOptions] = useState({
    indexAxis: 'y',
    elements: {
      bar: {
        borderWidth: 2,
      },
    },
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Monthly Run Time vs Lifetime Average Run Time (seconds)',
      },
    },
    scales: {
      x: {
        min: -50,
        max: 50,
      },
    },
  });
  const [comboBarChart, setComboBarChart] = useState({
    labels: chartData.labels,
    datasets: [
      {
        label: 'Month',
        data: chartData.monthAvg,
        borderColor: CHART_COLORS.purple,
        backgroundColor: transparentize(CHART_COLORS.purple, 0.5),
        order: 0,
      },
      {
        label: 'Lifetime',
        data: chartData.straightLine,
        borderColor: CHART_COLORS.blue,
        backgroundColor: transparentize(CHART_COLORS.blue, 0.5),
        type: 'line',
        order: 1,
      },
    ],
  });
  const [lineChart, setLineChart] = useState(lineChartData);
  const [stepChart, setStepChart] = useState(stepBarData);

  useEffect(() => {
    if (username) {
      fetch(`https://api.github.com/users/${username}/repos`)
        .then(response => response.json())
        .then(data => {
          setRepos(
            data.map(repo => ({
              name: repo.name,
              url: repo.html_url,
            })),
          );
        })
        .catch(error => console.error('Error fetching repositories:', error));
    }
  }, [username]);

  // logic to get the name of the repo
  const handleRepoChange = e => {
    const selectedRepoUrl = e.target.value;
    setSelectedRepo(selectedRepoUrl);
    const repoName = selectedRepoUrl.split('/').pop(); // Get the last segment of the URL
    // setSelectedRepo(repoName); //returns repo name to save, but wont display properly
    setSelectedRepo(e.target.value); // returns repo url
  };

  async function fetchData() {
    console.log('Fetching runs from db ...');
    try {
      let findJobs = await axios.get('http://localhost:3000/api/github/findRuns', {
        withCredentials: true,
        params: {
          owner: owner,
          repo: repo,
        },
      });
      // console.log('findJobs:', findJobs.data[0].runs);
      console.log('findJobs:', findJobs.data[0].runs);
      resetShapedMetrics();
      resetChartData();
      reformatData(sortRuns(findJobs.data[0].runs));
      reformatSteps(findJobs.data[0].runs);
      console.log('stepMetrics:', stepMetrics);
      console.log('shapedMetrics:', shapedMetrics);
      genChartData(shapedMetrics.monthData);
      genChartStepData(stepMetrics);
      console.log('chartData: ', chartData);
      //Load Chart JS data after fetch
      setVertBarChart({
        labels: chartData.labels,
        datasets: [
          {
            label: 'Success',
            data: chartData.success,
            backgroundColor: 'rgba(53, 162, 235, 0.5)',
          },
          {
            label: 'Failure',
            data: chartData.failure,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
          },
        ],
      });
      setPieChart({
        labels: ['Failure', 'Success'],
        datasets: [
          {
            label: 'Lifetime Workflow Attempts',
            data: chartData.pieData,
            backgroundColor: ['rgb(255, 99, 132)', 'rgb(75, 192, 192)'],
            borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
            borderWidth: 1,
          },
        ],
      });
      const maxVal = Math.max.apply(null, chartData.horizBarData) + 10; //for use in centering horiz bar chart
      setHorizBarOptions({
        indexAxis: 'y',
        elements: {
          bar: {
            borderWidth: 2,
          },
        },
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Monthly Run Time vs Lifetime Average Run Time (seconds)',
          },
        },
        scales: {
          x: {
            min: -maxVal,
            max: maxVal,
          },
        },
      });
      setHorizBarChart({
        labels: chartData.labels.reverse(),
        datasets: [
          {
            label: '2024',
            data: chartData.horizBarData.reverse(), //Month avg workflow run - Lifetime avg workflow run (seconds)
            borderColor: CHART_COLORS.red,
            backgroundColor: CHART_COLORS.orange,
          },
        ],
      });
      setComboBarChart({
        labels: chartData.labels,
        datasets: [
          {
            label: 'Month',
            data: chartData.monthAvg,
            borderColor: CHART_COLORS.purple,
            backgroundColor: transparentize(CHART_COLORS.purple, 0.5),
            order: 0,
          },
          {
            label: 'Lifetime',
            data: chartData.straightLine,
            borderColor: CHART_COLORS.blue,
            backgroundColor: transparentize(CHART_COLORS.blue, 0.5),
            type: 'line',
            order: 1,
          },
        ],
      });
      setLineChart({
        labels: chartData.eachRunLabel,
        datasets: [
          {
            label: 'Run Times (seconds)',
            data: chartData.eachRunDuration,
            borderColor: CHART_COLORS.green,
            backgroundColor: CHART_COLORS.green,
          },
        ],
      });
      setStepChart({
        labels: chartData.stepLabels,
        datasets: [
          {
            label: 'Fails',
            data: chartData.stepFailPct,
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
          },
          {
            label: 'Success',
            data: chartData.stepSuccPct,
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
          },
        ],
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  const handleSubmit = e => {
    e.preventDefault();
  };

  // for the handtyped field
  const handleSubmitTyped = e => {
    e.preventDefault();
    console.log('owner', owner);
    console.log('repo goes here', repo);
    fetchData();
  };

  return (
    <>
      <div className='searchBar'>
        <label>Please enter your Username and select a public Repository</label>
        <form onSubmit={handleSubmit}>
          <input
            type='text'
            placeholder='Enter GitHub Username'
            id='username'
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          {repos.length > 0 && (
            <select value={selectedRepo} onChange={handleRepoChange}>
              <option value=''>Select a repository</option>
              {repos.map(repo => (
                <option key={repo.name} value={repo.url}>
                  {repo.name}
                </option>
              ))}
            </select>
          )}
          <button type='submit'>Submit</button>
        </form>
      </div>

      <div className='searchBar'>
        <label>Please enter your Owner and Repository</label>
        <form onSubmit={handleSubmitTyped}>
          <input
            type='text'
            placeholder='Enter Owner'
            id='owner'
            value={owner}
            onChange={e => setOwner(e.target.value)}
          />
          <input
            type='text'
            placeholder='Enter Repository Name'
            id='repo'
            value={repo}
            onChange={e => setRepo(e.target.value)}
          />
          <button type='submit'>Submit</button>
        </form>
      </div>

      <div className={'grid-container'}>
        <div className={'viz-a'}>
          <Bar options={options} data={vertBarChart} />
        </div>
        <div className={'viz-b'}>
          <Pie data={pieChart} />
        </div>
        <div>
          <Bar options={horizBarOptions} data={horizBarChart} />
        </div>
        <div>
          <Bar options={comboBarOptions} data={comboBarChart} />
        </div>
        <div>
          <Line options={lineOptions} data={lineChart} />;
        </div>
        <div>
          <Bar options={stepBarOptions} data={stepChart} />
        </div>
      </div>
    </>
  );
};

export default Mvpmetrics;
