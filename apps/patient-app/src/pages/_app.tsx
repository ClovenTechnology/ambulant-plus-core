import '@/styles/globals.css';
import NavBar from '@/components/NavBar';
import { MockAuthProvider } from '@/packages/mock-auth/provider';

export default function App({ Component, pageProps }) {
  return (
    <MockAuthProvider>
      <div className="min-h-screen bg-slate-50 pt-12 pb-16">
        <NavBar />
        <Component {...pageProps} />
      </div>
    </MockAuthProvider>
  );
}
