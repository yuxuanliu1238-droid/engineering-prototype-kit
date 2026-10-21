import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
const ComparisonReview = React.lazy(() => import("./comparison-review.jsx").then((module) => ({ default: module.ComparisonReview })));
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {window.location.pathname === "/compare" ? <React.Suspense fallback={<p role="status">正在打开评审页…</p>}><ComparisonReview /></React.Suspense> : <App />}
  </React.StrictMode>,
);
