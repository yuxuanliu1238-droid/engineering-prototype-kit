import { useEffect, useState } from "react";
import { reviewConfig } from "./config.js";
import { ReviewCenter, ConclusionModal } from "./review.jsx";
import { BusinessShell } from "./shell.jsx";
import { publishReviewLocation } from "./comparison-bridge.js";
export function readLocation() {
  const path = window.location.pathname;
  if (path.startsWith("/review"))
    return {
      surface: "review",
      page: "review",
      scenario: null,
    };
  if (path === "/")
    return {
      surface: reviewConfig.reviewCenterEnabled ? "review" : "app",
      page: reviewConfig.reviewCenterEnabled ? "review" : "overview",
      scenario: null,
    };
  return {
    surface: "app",
    page: path.replace(/^\/app\/?/, "") || "overview",
    scenario: new URLSearchParams(window.location.search).get("scenario"),
  };
}
export default function App() {
  const [location, setLocation] = useState(readLocation);
  const [statuses, setStatuses] = useState({});
  const [conclusion, setConclusion] = useState(null);
  const [demoKey, setDemoKey] = useState(0);
  useEffect(() => { publishReviewLocation(location); }, [location]);
  useEffect(() => {
    if (window.location.pathname === "/")
      window.history.replaceState(
        {},
        "",
        reviewConfig.reviewCenterEnabled ? reviewConfig.reviewRoute : reviewConfig.businessRoute,
      );
    const listener = () => setLocation(readLocation());
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setLocation(readLocation());
    window.scrollTo(0, 0);
  };
  const launch = (id, path) => {
    if (id)
      setStatuses((old) => ({
        ...old,
        [id]: old[id] || "评审中",
      }));
    navigate(path);
  };
  return (
    <>
      {location.surface === "review" && reviewConfig.reviewCenterEnabled ? (
        <ReviewCenter
          statuses={statuses}
          launch={launch}
          record={(id) => setConclusion(reviewConfig.scenarios.find((item) => item.id === id))}
        />
      ) : (
        <BusinessShell
          key={demoKey}
          location={location}
          navigate={navigate}
          back={() => navigate(reviewConfig.reviewRoute)}
          reset={() => setDemoKey((value) => value + 1)}
        />
      )}
      {conclusion && (
        <ConclusionModal
          scenario={conclusion}
          close={() => setConclusion(null)}
          confirm={(status) => {
            setStatuses((old) => ({
              ...old,
              [conclusion.id]: status,
            }));
            setConclusion(null);
          }}
        />
      )}
    </>
  );
}
