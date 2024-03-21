import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

function Header({}) {
  const location = useLocation();
  const { pathname } = location;

  const routes = ["/", "/nonograms", "/trials"];

  const standardRoutes = [
    "/",
    "/nonograms",
    "/trials/",
    "/nonograms/",
    "/trials",
  ];

  return (
    <header className="sticky top-0 bg-white border-b border-slate-200 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 -mb-px">
          <div className="flex items-center">
            <NavLink
              to="/"
              className={`${
                pathname === "/" ? "text-slate-900" : null
              } ml-4 text-slate-500 hover:text-slate-600`}
            >
              <div>Calculator</div>
            </NavLink>

            <NavLink
              to="/nonograms"
              className={`${
                pathname === "/nonograms" ? "text-black" : null
              } ml-4 text-slate-500 hover:text-slate-600`}
            >
              <div>Nonograms</div>
            </NavLink>

            <NavLink
              to="/trials"
              className={`${
                pathname === "/trials" || pathname === "/trials/"
                  ? "text-black"
                  : null
              } ml-4 text-slate-500 hover:text-slate-600`}
            >
              <div className="flex flex-row gap-1">
                <span className="hidden lg:block">Clincial</span>Trials
              </div>
            </NavLink>

            <NavLink
              to="/visualizations"
              className={`${
                pathname === "/visualizations" ||
                pathname === "/visualizations/"
                  ? "text-black"
                  : null
              } ml-4 text-slate-500 hover:text-slate-600`}
            >
              <div>Visualize</div>
            </NavLink>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
