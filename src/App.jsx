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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  const [sampleSize, setSampleSize] = useState(200);
  const [fitLine, setFitLine] = useState(false);
  const [showDistances, setShowDistances] = useState(false);

  // Generate data based on correlation and sampleSize
  const scatterData = useMemo(() => {
    // Keep domain X=0..10, Y=0..10, ensuring the final chart also shows that same domain.
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

  // Compute the mean Y (for the horizontal line before fitting)
  const meanY = useMemo(() => {
    if (!scatterData.length) return 0;
    return (
      scatterData.reduce((sum, d) => sum + d.y, 0) / scatterData.length
    );
  }, [scatterData]);

  // Decide which slope/intercept to display:
  // before user clicks "Fit" => line at meanY (slope = 0),
  // after user clicks "Fit"  => best-fit line (slope & intercept)
  const displayedSlope = fitLine ? slope : 0;
  const displayedIntercept = fitLine ? intercept : meanY;

  // We'll create a line from x=0 to x=10 using displayedSlope and displayedIntercept
  const linePoints = [
    { x: 0, y: displayedIntercept },
    { x: 10, y: displayedSlope * 10 + displayedIntercept },
  ];

  // Create dashed lines from each point to the best-fit line
  const residualLines = scatterData.map((d) => {
    const predictedY = slope * d.x + intercept;
    return [
      { x: d.x, y: d.y },
      { x: d.x, y: predictedY },
    ];
  });

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-white shadow-md rounded-lg">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold mb-2">Correlation & Regression Visualizer</h1>
  <h2 className="text-md font-bold mb-2">Created by Matt Rocklage</h2>
              <p className="text-sm text-gray-600">
                Choose a correlation strength (-1 to +1) and sample size. The red line starts at the mean for that set of data. After you generate the correlation, you can fit the best-fit line by clicking the blue button below.
              </p>
            </motion.div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 place-items-center">
              <div className="flex flex-col items-center">
                <label className="font-medium mb-2">
                  Correlation (r): {corr.toFixed(2)}
                </label>
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
                  className="w-48"
                />
              </div>
              <div className="flex flex-col items-center">
                <label className="font-medium mb-2">Sample Size: {sampleSize}</label>
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
                  className="w-48"
                />
              </div>
            </div>

            {/* Button to fit line */}
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  setFitLine(true);
                  setShowDistances(true);
                }}
                className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600"
              >
                Fit the best-fit regression line
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="bg-gray-100 rounded-xl p-4 flex justify-center"
            >
              <div className="flex justify-center w-full">
                <ScatterChart width={600} height={350}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" domain={[0, 10]}>
                    <Label value="X" offset={-5} position="insideBottom" />
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
                  <Scatter data={scatterData} fill="#8884d8" />

{fitLine && showDistances && residualLines.map((line, idx) => (
  <Scatter
    key={idx}
    data={line}
    line={{ strokeDasharray: "4 4", stroke: "red" }}
    shape={() => null} // ensures no scatter markers
  />
))}

                  <Scatter
  data={linePoints}
  line={{ stroke: "red", strokeWidth: 2 }} // specify how you want the line to appear
  shape={() => null}                      // hide the scatter points
/>
                </ScatterChart>
              </div>
            </motion.div>

            {/* Stats and explanation section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center space-y-4"
            >
              <p className="text-sm text-gray-700">
                Actual Sample Correlation (r): {actualCorrelation.toFixed(2)}
              </p>
              <p className="text-sm text-gray-700">
                {fitLine 
                  ? `Slope = ${slope.toFixed(2)}, Intercept = ${intercept.toFixed(2)}`
                  : 'Line not yet fit! (currently showing mean Y)'}
              </p>
              <p className="text-sm text-gray-700">
                The figure above is currently showing a random sample of data with a target correlation of {corr.toFixed(2)}. Because of randomness and sample size, the actual correlation (shown above)
                may differ slightly from the desired target.
                <br/><br/>
                By clicking the <em>Fit the best-fit regression line</em> button, you can see how the line is placed to minimize
                the total squared vertical distances (residuals) between each point and the line. The <span className="text-red-500">dashed red lines </span>
                show these residuals.
              </p>
            </motion.div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}