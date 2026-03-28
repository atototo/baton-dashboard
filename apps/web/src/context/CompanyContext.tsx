import React, { createContext, useContext, useState, useEffect } from "react";
import { api, type Company } from "../lib/api";

interface CompanyContextType {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (id: string | null) => void;
  companies: Company[];
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const MOCK_COMPANY: Company = {
  id: "d97c9664-315c-4230-84b0-833f8bf6be0a", // Current company ID found in agents/me
  name: "Baton Team",
};

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompanies() {
      try {
        const data = await api.getCompanies();
        setCompanies(data);
        if (data.length > 0 && !selectedCompanyId) {
          setSelectedCompanyId(data[0].id);
        } else if (data.length === 0) {
          // If no companies found but API succeeded, use mock
          setCompanies([MOCK_COMPANY]);
          setSelectedCompanyId(MOCK_COMPANY.id);
        }
      } catch (error) {
        console.error("Failed to fetch companies, using mock:", error);
        setCompanies([MOCK_COMPANY]);
        if (!selectedCompanyId) {
          setSelectedCompanyId(MOCK_COMPANY.id);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, [selectedCompanyId]);

  return (
    <CompanyContext.Provider value={{ selectedCompanyId, setSelectedCompanyId, companies, loading }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
