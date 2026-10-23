import { ReactNode } from 'react';
interface AppContainerProps {children: ReactNode}
export default function AppContainer({children}:AppContainerProps){
  return <main className="theme-light min-h-screen w-full bg-white text-slate-900">{children}</main>
}
