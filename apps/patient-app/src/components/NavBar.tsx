import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NavBar() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  const navItems = [
    { href: '/', label: '🏠 Home' },
    { href: '/book', label: '📅 Book' },
    { href: '/vitals', label: '💓 Vitals' },
  ];

  return (
    <nav
      className={`fixed ${isMobile ? 'bottom-0 w-full' : 'top-0 w-full'} bg-white border-t border-gray-200 shadow-md z-50`}
    >
      <div className={`flex ${isMobile ? 'justify-around' : 'justify-start gap-10'} px-4 py-3`}>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <span className="text-blue-900 font-semibold hover:text-purple-700 transition-colors">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
