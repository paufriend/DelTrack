import { useState, useEffect } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';

import Navbar from './components/navbar.jsx';
import LocalizadoresMap from './components/map/LocalizadoresMap.jsx';


const App = () =>{
  
  return (
      <>
      <Navbar />
      <div className="  bg-page  dark:bg-page">
        <main className="flex justify-center px-0 py-1 bg-page">
          <LocalizadoresMap />
        </main>
      </div>
    </>
  );
};

export default App;