import React from "react";
import { NavLink, useLocation } from "react-router-dom";

function Header() {
  const location = useLocation();
  const { pathname } = location;

  return (
    <header className="sticky top-0 bg-white border-b border-slate-200 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 -mb-px overflow-x-auto">
          <nav
            aria-label="Main navigation"
            className="flex items-center whitespace-nowrap text-sm sm:text-base pr-4"
          >
            <NavLink
              to="/"
              className={`${
                pathname === "/" ? "text-slate-900" : null
              } ml-4 text-slate-500 hover:text-slate-600`}
            >
              <div>Calculator</div>
            </NavLink>

            <NavLink
              to="/nomograms"
              className={`${
                pathname === "/nomograms" ? "text-black" : null
              } ml-4 text-slate-500 hover:text-slate-600`}
            >
              <div>Nomograms</div>
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
                <span className="hidden lg:block">Clinical</span>Trials
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
            <NavLink
              to="/schedule"
              className={`ml-4 ${
                pathname.startsWith("/schedule")
                  ? "text-slate-900"
                  : "text-slate-500 hover:text-slate-600"
              }`}
            >
              Schedule
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
