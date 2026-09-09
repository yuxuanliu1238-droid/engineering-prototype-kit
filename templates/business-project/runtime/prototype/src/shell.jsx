import { useMemo } from "react";
import { reviewConfig, NAVIGATION } from "./config.js";
import { EvaluationBar } from "./review.jsx";
import { Overview, Records, Rules, Exceptions } from "./pages.jsx";
export function BusinessShell({ location, navigate, back, reset }) {
  const scenario = reviewConfig.scenarios.find((item) => item.id === location.scenario);
  const navigateWithin = (path) =>
    scenario && !path.includes("scenario=")
      ? navigate(`${path}${path.includes("?") ? "&" : "?"}scenario=${scenario.id}`)
      : navigate(path);
  const pages = useMemo(
    () => ({
      overview: <Overview navigate={navigateWithin} />,
      records: <Records />,
      rules: <Rules />,
      exceptions: <Exceptions />,
    }),
    [location.page, location.scenario],
  );
  return (
    <div className="app-shell">
      <aside>
        <div className="brand">
          <b>K</b>
          <div>
            <strong>{{PROJECT_NAME}}</strong>
            <span>业务原型</span>
          </div>
        </div>
        <nav>
          {NAVIGATION.map(([id, icon, label]) => (
            <button
              key={id}
              className={location.page === id ? "active" : ""}
              onClick={() => navigateWithin(`/app/${id}`)}
            >
              <i>{icon}</i>
              {label}
            </button>
          ))}
        </nav>
        <footer>
          <span>{{MODE}}</span>
          <strong>Kit {{KIT_VERSION}}</strong>
          <small>演示数据 · 非生产系统</small>
        </footer>
      </aside>
      <div className="business-content">
        <EvaluationBar scenario={scenario} back={back} reset={reset} />
        <main>{pages[location.page] || pages.overview}</main>
      </div>
    </div>
  );
}
