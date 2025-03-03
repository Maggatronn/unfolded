import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

// This hook accepts a render callback and dependencies array
export const useD3 = (renderFn: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => void, deps: React.DependencyList = []) => {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (ref.current) {
      const svg = d3.select(ref.current);
      renderFn(svg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}; 