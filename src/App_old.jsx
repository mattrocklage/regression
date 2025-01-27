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
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

// Utility: approximate random normal using Box-Muller transform
function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Utility function to compute correlation for the generated data
function computeCorrelation(xVals, yVals) {
  const n = xVals.length;
  if (n <= 1) return 0;

  const meanX = xVals.reduce((a, b) => a + b, 0) / n;
  const meanY = yVals.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xVals[i] - meanX;
    const dy = yVals[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) {
    return 0; // degenerate
  }

  return numerator / Math.sqrt(denomX * denomY);
}

// Utility function to compute slope and intercept for simple linear regression
function computeRegressionLine(data) {
  const n = data.length;
  if (n === 0) {
    return { slope: 0, intercept: 0 };
  }
  const meanX = data.reduce((acc, d) => acc + d.x, 0) / n;
  const meanY = data.reduce((acc, d) => acc + d.y, 0) / n;

  let numerator = 0;
  let denominator = 0;
  data.forEach((d) => {
    numerator += (d.x - meanX) * (d.y - meanY);
    denominator += (d.x - meanX) * (d.x - meanX);
  });
  if (denominator === 0) {
    // All x's are the same, fall back to slope=0
    return { slope: 0, intercept: meanY };
  }

  const slope = numerator / denominator;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

// Generate data with a desired correlation using 2D normal distribution approach
// Then scale to [xMin, xMax] in both x and y dimensions
function generateCorrelatedData(corr, n, xMin, xMax) {
  // correlation is between -1 and 1
  // We'll create 2D normal data (Z1, Z2) with correlation corr
  // Then we'll scale to [xMin, xMax].

  const data = [];

  // Create arrays of raw (xRaw, yRaw) in approx N(0,1) with correlation
  const xRaw = [];
  const yRaw = [];

  for (let i = 0; i < n; i++) {
    const z1 = randn();
    const z2 = randn();

    const xVal = z1;
    const yVal = corr * z1 + Math.sqrt(1 - corr * corr) * z2;

    xRaw.push(xVal);
    yRaw.push(yVal);
  }

  // find min & max for xRaw
  const minXraw = Math.min(...xRaw);
  const maxXraw = Math.max(...xRaw);
  const rangeXraw = maxXraw - minXraw || 1; // avoid zero division

  // find min & max for yRaw
  const minYraw = Math.min(...yRaw);
  const maxYraw = Math.max(...yRaw);
  const rangeYraw = maxYraw - minYraw || 1;

  // scale them to [xMin, xMax] for both X and Y
  for (let i = 0; i < n; i++) {
    const scaledX = xMin + ((xRaw[i] - minXraw) / rangeXraw) * (xMax - xMin);
    const scaledY = xMin + ((yRaw[i] - minYraw) / rangeYraw) * (xMax - xMin);

    data.push({ x: scaledX, y: scaledY });
  }

  return data;
}

export default function CorrelationAndRegressionVisualizer() {
  const [corr, setCorr] = useState(0);
  const [sampleSize, setSampleSize] = useState(30);
  const [fitLine, setFitLine] = useState(false);
  const [showDistances, setShowDistances] = useState(false);

  // Generate data based on correlation and sampleSize
  const scatterData = useMemo(() => {
    // Let’s keep domain X=0..10, Y=0..10, but ensure the final chart also shows that same domain.
return generateCorrelatedData(corr, sampleSize, 0, 10);
  }, [corr, sampleSize]);

  // Compute correlation from generated data
  const actualCorrelation = useMemo(() => {
    const xVals = scatterData.map((d) => d.x);
    const yVals = scatterData.map((d) => d.y);
    return computeCorrelation(xVals, yVals);
  }, [scatterData]);

  // Compute slope and intercept for best-fit line
  const { slope, intercept } = useMemo(() => {
    return computeRegressionLine(scatterData);
  }, [scatterData]);

  // Decide which slope/intercept to display
  const displayedSlope = fitLine ? slope : 0;
  const displayedIntercept = fitLine ? intercept : 0;

  // We'll create a line from x=0 to x=10 using displayedSlope and displayedIntercept
  const linePoints = [
    { x: 0, y: displayedIntercept },
    { x: 10, y: displayedSlope * 10 + displayedIntercept },
  ];

  // For each data point, create a small line from (x, actualY) to (x, predictedY).
  // Show these as dashed red lines.
  const residualLines = scatterData.map((d) => {
    const predictedY = slope * d.x + intercept;
    return [
      { x: d.x, y: d.y },
      { x: d.x, y: predictedY },
    ];
  });

  return (
    <div className="flex justify-center items-center p-4 w-full h-auto">
      <Card className="max-w-4xl w-full bg-white shadow-xl rounded-2xl p-4">
        <CardContent>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4 text-center"
          >
            <h1 className="text-2xl font-bold mb-2">Correlation & Regression Visualizer</h1>
            <p className="text-sm text-gray-600">Explore how correlation influences the best-fit regression line in a scatter plot.</p>
          </motion.div>

          {/* Controls */}
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 justify-center mb-6">
            <div className="flex flex-col">
              <label className="font-medium mb-1">Correlation (r): {corr.toFixed(2)}</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={corr}
                onChange={(e) => {
                  setFitLine(false);
                  setShowDistances(false);
                  setCorr(parseFloat(e.target.value));
                }}
                className="cursor-pointer"
              />
            </div>
            <div className="flex flex-col">
              <label className="font-medium mb-1">Sample Size: {sampleSize}</label>
              <input
                type="range"
                min="10"
                max="200"
                step="1"
                value={sampleSize}
                onChange={(e) => {
                  setFitLine(false);
                  setShowDistances(false);
                  setSampleSize(parseInt(e.target.value, 10));
                }}
                className="cursor-pointer"
              />
            </div>
          </div>

          {/* Button to fit line */}
          <div className="flex justify-center items-center space-x-4 mb-4">
            <Button
              onClick={() => {
                setFitLine(true);
                setShowDistances(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow"
            >
              Fit the best-fit regression line
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="bg-gray-100 rounded-xl p-4"
          >
            <div className="w-full h-96 overflow-auto">
              <ScatterChart width={600} height={350}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" domain={[0, 10]}>
                  <Label
                    value="X"
                    offset={-5}
                    position="insideBottom"
                  />
                </XAxis>
                <YAxis type="number" dataKey="y" domain={[0, 10]}>
                  <Label
                    value="Y"
                    angle={-90}
                    position="insideLeft"
                    style={{ textAnchor: 'middle' }}
                  />
                </YAxis>
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                {/* Original Data Points */}
                <Scatter data={scatterData} fill="#8884d8" />

                {/* Show dashed red lines for the distances if the line is fit */}
                {fitLine && showDistances && residualLines.map((line, idx) => (
                  <Scatter
                    key={idx}
                    data={line}
                    line={{ strokeDasharray: "4 4", stroke: "red" }}
                    shape="none"
                  />
                ))}

                {/* We'll add a scatter to show the best-fit line endpoints with a line connect. */}
                <Scatter
                  data={linePoints}
                  fill="red"
                  line
                  shape="none"
                />
              </ScatterChart>
            </div>
          </motion.div>

          {/* Now show correlation, slope, intercept below the chart */}
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
              {{
                false: 'Line not yet fit!',
                true: `Slope = ${slope.toFixed(2)}, Intercept = ${intercept.toFixed(2)}`
              }[fitLine]}
            </p>
            <p className="text-sm text-gray-700">
              This tool generates a random sample of (X,Y) from a 2D Normal distribution with a target correlation of {corr.toFixed(2)},
              then rescales it to the range [0, 10]. Because of randomness and sample size, the actual correlation (shown above)
              may differ slightly from the desired target.
              <br/><br/>
              By clicking the <em>Fit the best-fit regression line</em> button, you can see how the line is placed to minimize
              the total squared vertical distances (residuals) between each point and the line. The <span className="text-red-500">dashed red lines</span>
              show these residuals.
            </p>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );}