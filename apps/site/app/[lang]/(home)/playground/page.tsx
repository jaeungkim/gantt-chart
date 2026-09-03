import type { Metadata } from 'next';
import { Playground } from '@/components/playground';

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'The real component, every switch live. Fullscreen is one click away, and the URL is the scenario.',
};

export default function PlaygroundPage() {
  return <Playground />;
}
