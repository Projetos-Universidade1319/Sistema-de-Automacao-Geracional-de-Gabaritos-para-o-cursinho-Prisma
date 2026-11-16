import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import Biblioteca from './pages/Biblioteca/Biblioteca';
import Revisao from './pages/Revisao/Revisao';
import Gabarito from './pages/Gabarito/Gabarito';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <header className="topo">
        <strong>PRISMA</strong>
        <nav>
          <NavLink to="/">Biblioteca</NavLink>
          <NavLink to="/revisao">Nova questão</NavLink>
          <NavLink to="/gabarito">Montar gabarito</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Biblioteca />} />
          <Route path="/revisao" element={<Revisao />} />
          <Route path="/revisao/:id" element={<Revisao />} />
          <Route path="/gabarito" element={<Gabarito />} />
        </Routes>
      </main>
    </BrowserRouter>
  </React.StrictMode>,
);
