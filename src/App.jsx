import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Label,
} from 'recharts';

// Utility: approximate random normal using Box-Muller transform
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Compute correlation
function computeCorrelation(xVals, yVals) {
  const n = xVals.length;
  if (n <= 1) return 0;
  const meanX = xVals.reduce((a,b)=>a+b,0)/n;
  const meanY = yVals.reduce((a,b)=>a+b,0)/n;

  let numerator = 0, denomX = 0, denomY = 0;
  for (let i=0; i<n; i++){
    const dx = xVals[i] - meanX;
    const dy = yVals[i] - meanY;
    numerator += dx*dy;
    denomX   += dx*dx;
    denomY   += dy*dy;
  }
  if(!denomX || !denomY) return 0;
  return numerator / Math.sqrt(denomX * denomY);
}

// Compute slope/intercept & meanY
function computeRegressionLine(data) {
  const n = data.length;
  if(n===0){ 
    return { slope: 0, intercept: 0, meanY: 0 }; 
  }
  const sumX = data.reduce((acc,d)=>acc+d.x,0);
  const sumY = data.reduce((acc,d)=>acc+d.y,0);
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator=0, denominator=0;
  data.forEach(d => {
    numerator   += (d.x - meanX)*(d.y - meanY);
    denominator += (d.x - meanX)*(d.x - meanX);
  });
  if(denominator===0) {
    return { slope: 0, intercept: meanY, meanY };
  }
  const slope = numerator / denominator;
  const intercept = meanY - slope*meanX;
  return { slope, intercept, meanY };
}

// Generate correlated data
function generateCorrelatedData(corr, n, xMin, xMax) {
  const xRaw = [], yRaw = [], data = [];

  for(let i=0; i<n; i++){
    const z1=randn(), z2=randn();
    xRaw.push(z1);
    yRaw.push(corr*z1 + Math.sqrt(1 - corr*corr)*z2);
  }
  // scale to [xMin, xMax]
  const minX = Math.min(...xRaw), maxX = Math.max(...xRaw);
  const minY = Math.min(...yRaw), maxY = Math.max(...yRaw);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  for(let i=0; i<n; i++){
    const scaledX = xMin + ((xRaw[i]-minX)/rangeX)*(xMax - xMin);
    const scaledY = xMin + ((yRaw[i]-minY)/rangeY)*(xMax - xMin);
    data.push({x: scaledX, y: scaledY});
  }
  return data;
}

export default function App() {
  // Defaults
  const [corr, setCorr] = useState(0);
  const [sampleSize, setSampleSize] = useState(30);
  const [fitLine, setFitLine] = useState(false);
  const [showDistances, setShowDistances] = useState(false);

  // Generate data
  const scatterData = useMemo(() => {
    return generateCorrelatedData(corr, sampleSize, 0, 10);
  }, [corr, sampleSize]);

  // Actual correlation
  const actualCorrelation = useMemo(() => {
    const xVals = scatterData.map(d => d.x);
    const yVals = scatterData.map(d => d.y);
    return computeCorrelation(xVals, yVals);
  }, [scatterData]);

  // Regression line
  const { slope, intercept, meanY } = useMemo(() => {
    return computeRegressionLine(scatterData);
  }, [scatterData]);

  // Show a horizontal line at meanY until fitLine is clicked
  const displayedSlope = fitLine ? slope : 0;
  const displayedIntercept = fitLine ? intercept : meanY;

  // Build line from x=0 to x=10
  const linePoints = [
    {x:0,  y: displayedIntercept},
    {x:10, y: displayedSlope*10 + displayedIntercept},
  ];

  // Residual lines
  const residualLines = scatterData.map((d) => {
    const predictedY = slope*d.x + intercept;
    return [
      { x: d.x, y: d.y },
      { x: d.x, y: predictedY },
    ];
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      {/* Outer "card" container */}
      <div className="w-full max-w-5xl bg-white shadow-xl rounded-2xl p-6">
        {/* Title & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 text-center"
        >
          <h1 className="text-3xl font-bold mb-2">
            Correlation & Regression Visualizer
          </h1>
          <p className="text-gray-600">
            Explore how correlation influences the best-fit regression line in a scatter plot.
          </p>
        </motion.div>

        {/* Sliders */}
        <div className="flex flex-col space-y-6 md:flex-row md:space-y-0 md:space-x-6 justify-center mb-6">
          {/* Correlation Slider */}
          <div className="flex flex-col items-center">
            <label className="font-medium mb-1">
              Correlation (r): {corr.toFixed(2)}
            </label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={corr}
              onChange={(e)=>{
                setCorr(parseFloat(e.target.value));
                setFitLine(false);
                setShowDistances(false);
              }}
              className="cursor-pointer accent-blue-500"
            />
          </div>
          {/* Sample Size Slider */}
          <div className="flex flex-col items-center">
            <label className="font-medium mb-1">
              Sample Size: {sampleSize}
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="1"
              value={sampleSize}
              onChange={(e)=>{
                setSampleSize(parseInt(e.target.value,10));
                setFitLine(false);
                setShowDistances(false);
              }}
              className="cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* Button */}
        <div className="flex justify-center items-center mb-4">
          <button
            onClick={()=>{
              setFitLine(true);
              setShowDistances(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium shadow"
          >
            Fit the best-fit regression line
          </button>
        </div>

        {/* Chart */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="bg-gray-100 rounded-xl p-4"
        >
          <div className="w-full h-96 overflow-auto">
            <ScatterChart width={600} height={350}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="x" domain={[0,10]}>
                <Label value="X" offset={-5} position="insideBottom" />
              </XAxis>
              <YAxis type="number" dataKey="y" domain={[0,10]}>
                <Label
                  value="Y"
                  angle={-90}
                  position="insideLeft"
                  style={{ textAnchor: "middle" }}
                />
              </YAxis>
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              {/* Points */}
              <Scatter data={scatterData} fill="#8884d8" />
              {/* Residuals */}
              {fitLine && showDistances && residualLines.map((line, i) => (
                <Scatter
                  key={i}
                  data={line}
                  line={{ strokeDasharray: "4 4", stroke: "red" }}
                  shape="none"
                />
              ))}
              {/* Regression or Mean line */}
              <Scatter data={linePoints} line fill="red" shape="none" />
            </ScatterChart>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mt-4 text-center"
        >
          <p className="text-sm text-gray-700 mb-2">
            Actual Sample Correlation (r): {actualCorrelation.toFixed(2)}
          </p>
          <p className="text-sm text-gray-700 mb-2">
            {!fitLine
              ? "Line not yet fit!"
              : `Slope = ${slope.toFixed(2)}, Intercept = ${intercept.toFixed(2)}`
            }
          </p>
          <p className="text-sm text-gray-700">
            This tool generates a random sample of (X,Y) from a 2D Normal distribution
            with a target correlation of {corr.toFixed(2)}, then rescales it to [0,10].
            Because of randomness and sample size, the actual correlation can vary slightly.
            <br /><br />
            By clicking the <em>Fit the best-fit regression line</em> button, you can see
            how the line is placed to minimize the total squared vertical distances (residuals).
            The <span className="text-red-500">dashed red lines</span> show these residuals.
          </p>
        </motion.div>
      </div>
    </div>
  );
}