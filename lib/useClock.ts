import { useState, useEffect } from 'react';

export function useTime(refreshCycle = 1000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, refreshCycle);

    return () => clearInterval(intervalId);
  }, [refreshCycle]);

  return now;
}