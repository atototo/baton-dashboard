import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { CompanyProvider } from "./context/CompanyContext.js";
import { Layout } from "./components/Layout.js";
import { DashboardHome } from "./pages/DashboardHome.js";
import { ProjectList } from "./pages/ProjectList.js";
import { ProjectDetail } from "./pages/ProjectDetail.js";
import { AgentListPage } from "./pages/AgentListPage.js";
import { AgentDetail } from "./pages/AgentDetail.js";
import { IssueListPage } from "./pages/IssueListPage.js";
import { IssueDetail } from "./pages/IssueDetail.js";
import { Monitoring } from "./pages/Monitoring.js";

function App() {
  return (
    <CompanyProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<DashboardHome />} />
            <Route path="issues" element={<IssueListPage />} />
            <Route path="issues/:id" element={<IssueDetail />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="projects/:id/:tab" element={<ProjectDetail />} />
            <Route path="agents" element={<AgentListPage />} />
            <Route path="agents/:id" element={<AgentDetail />} />
            <Route path="monitoring" element={<Monitoring />} />
          </Route>
        </Routes>
      </Router>
    </CompanyProvider>
  );
}

export default App;
