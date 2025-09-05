
import React from 'react';
import reactLogo from '../assets/react.svg';
import viteLogo from '/vite.svg';

const Navbar = () => {
  return (
    <nav className='sticky top-0 z-50 py-3 backdrop-blur-lg border-b border-neutral-700/80 '>
      <div className="container px-4 mx-auto relative text-sm">
        <div className='flex justify-center items-center'>
          <h1 className="inline-flex items-center gap-2 font-extrabold leading-tight tracking-tight
           text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand2
           text-[clamp(1.25rem,2.2vw+1rem,2.3rem)] motion-safe:animate-fade-in-up
           relative after:content-[''] after:block after:h-[3px]
           after:w-[clamp(72px,14vw,180px)]
           after:bg-gradient-to-r after:from-brand after:to-brand2
           after:rounded-full after:mt-1.5">
            DelTracker
            <span className="text-l font-bold tracking-wider uppercase px-2 py-1 rounded-full
               text-white bg-gradient-to-r from-brand to-brand2 shadow-badge">
              DelTracker
            </span>
          </h1>
        </div>
      </div>
      
    </nav>
  );
};

export default Navbar;