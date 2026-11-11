import type { Metadata } from 'next';
import './style.css';
export const metadata: Metadata = {title:'Spelling Bee | Practice Studio', description:'Build your own word lists and practice spelling at your pace.'};
export default function Layout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
