import type { Metadata } from 'next';
import { NotFoundNotice } from '@/os/NotFoundNotice';

export const metadata: Metadata = {
  title: 'Página no encontrada · Jesús García',
  description: 'La página que buscas no existe. Vuelve al inicio.',
};

export default function NotFound() {
  return <NotFoundNotice />;
}
