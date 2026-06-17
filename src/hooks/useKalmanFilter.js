import { useRef } from 'react';

export function useKalmanFilter(processNoise = 0.001, measurementNoise = 0.1) {
  const estimatedValue = useRef(null);
  const errorCovariance = useRef(1);

  function filter(measurement) {
    if (estimatedValue.current === null) {
      estimatedValue.current = measurement;
      return measurement;
    }
    const predicted = estimatedValue.current;
    const predictedError = errorCovariance.current + processNoise;
    const kalmanGain = predictedError / (predictedError + measurementNoise);

    estimatedValue.current = predicted + kalmanGain * (measurement - predicted);
    errorCovariance.current = (1 - kalmanGain) * predictedError;

    return estimatedValue.current;
  }

  return { filter };
}