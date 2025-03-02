import { ReactNode } from 'react';

export interface TableData {
  additionalStyle: string;
  node: ReactNode;
}

export interface TableOptions {
  rowHeight?: string | { header: string; body: string };
  nesting?: boolean;
}
