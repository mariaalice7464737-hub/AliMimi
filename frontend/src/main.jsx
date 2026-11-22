import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AvisoProvider, CardapioProvider } from "./estado";
import Inicio from "./telas/Inicio";
import Familia from "./telas/Familia";
import Cardapio from "./telas/Cardapio";
import Categorias from "./telas/Categorias";
import Pratos from "./telas/Pratos";
import Receita from "./telas/Receita";
/* fontes embutidas no app (sem depender do Google Fonts); só o subconjunto latino, que cobre o português */
import "@fontsource/playfair-display/latin-400.css";
import "@fontsource/playfair-display/latin-500.css";
import "@fontsource/playfair-display/latin-600.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "@fontsource/playfair-display/latin-500-italic.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "./estilo.css";

/*
  /                         primeira vez: começar ou entrar com o código da família
  /f/:codigo                Cardápio da semana (tela central)
  /f/:codigo/dia/:dia       qual a proteína do dia?
  /f/:codigo/dia/:dia/:cat  escolha o prato
  /f/:codigo/receita/:dia   receita e supermercado do dia (?aba=mercado)
*/
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AvisoProvider>
        <CardapioProvider>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/f/:codigo" element={<Familia />}>
              <Route index element={<Cardapio />} />
              <Route path="dia/:dia" element={<Categorias />} />
              <Route path="dia/:dia/:cat" element={<Pratos />} />
              <Route path="receita/:dia" element={<Receita />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CardapioProvider>
      </AvisoProvider>
    </BrowserRouter>
  </React.StrictMode>
);
