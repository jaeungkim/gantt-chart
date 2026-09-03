import defaultComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { ChartSketch } from '@/components/demo/chart-sketch';
import { GanttDemo } from '@/components/demo/gantt-demo';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultComponents,
    ChartSketch,
    GanttDemo,
    ...components,
  };
}
