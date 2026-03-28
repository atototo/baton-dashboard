import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { CompanyProvider } from "./context/CompanyContext";
import { Layout } from "./components/Layout";
import { DashboardHome } from "./pages/DashboardHome";
import { ProjectList } from "./pages/ProjectList";
import { AgentListPage } from "./pages/AgentListPage";
import { IssueListPage } from "./pages/IssueListPage";
import { Monitoring } from "./pages/Monitoring";

function App() {
  return (
    <CompanyProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardHome />} />
            <Route path="issues" element={<IssueListPage />} />
            <Route path="issues/:id" element={<IssueListPage />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:id" element={<ProjectList />} />
            <Route path="agents" element={<AgentListPage />} />
            <Route path="agents/:id" element={<AgentListPage />} />
            <Route path="monitoring" element={<Monitoring />} />
          </Route>
        </Routes>
      </Router>
    </CompanyProvider>
  );
}

export default App;
