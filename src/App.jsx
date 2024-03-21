import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import "./css/style.css";

import "./charts/ChartjsConfig";

// Import pages
import Dashboard from "./pages/Dashboard";
import Trials from "./pages/Trials";
import Nonograms from "./pages/Nonograms";
import Privacy from "./pages/Privacy";
import Visual from "./pages/Visual";

function App() {
  const location = useLocation();

  useEffect(() => {
    document.querySelector("html").style.scrollBehavior = "auto";
    window.scroll({ top: 0 });
    document.querySelector("html").style.scrollBehavior = "";
  }, [location.pathname]); // triggered on route change

  return (
    <>
      <Routes>
        <Route
          exact
          path="/"
          element={<Dashboard rates={false} demographics={false} />}
        />
        <Route
          exact
          path="/nonograms"
          element={<Nonograms type="nonograms" />}
        />
        <Route exact path="/trials" element={<Trials type="trials" />} />
        <Route
          exact
          path="/visualizations"
          element={<Visual type="visualizations" />}
        />
        <Route exact path="/privacy" element={<Privacy />} />
      </Routes>
    </>
  );
}

export default App;
