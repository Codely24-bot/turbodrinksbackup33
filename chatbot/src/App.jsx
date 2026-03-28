import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from '@/components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';
import PDVPage from '@/pages/PDVPage';
import ClientesPage from '@/pages/ClientesPage';
import FuncionariosPage from '@/pages/FuncionariosPage';
import MotoboysPage from '@/pages/MotoboysPage';
import ProdutosPage from '@/pages/ProdutosPage';
import EstoquePage from '@/pages/EstoquePage';
import ContasApagarPage from '@/pages/ContasApagarPage';
import ContasAReceberPage from '@/pages/ContasAReceberPage';
import RelatoriosPage from '@/pages/RelatoriosPage';
import HistoricoVendasPage from '@/pages/HistoricoVendasPage';
import CaixaHistoricoPage from '@/pages/CaixaHistoricoPage';
import ChatbotApiPage from '@/pages/ChatbotApiPage';
import TemaLayoutPage from '@/pages/TemaLayoutPage';

// Import new components to ensure they are available in build
import SuprimentoCaixaModal from '@/components/SuprimentoCaixaModal';
import RetiradaCaixaModal from '@/components/RetiradaCaixaModal';
import CaixaMovimentacoesTable from '@/components/CaixaMovimentacoesTable';

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard/pdv" replace />} />
            <Route path="pdv" element={<PDVPage />} />
            <Route path="clientes" element={<ClientesPage />} />
            <Route path="pessoas" element={<Navigate to="/dashboard/clientes" replace />} />
            <Route path="pessoas/funcionarios" element={<FuncionariosPage />} />
            <Route path="motoboys" element={<MotoboysPage />} />
            <Route path="produtos" element={<ProdutosPage />} />
            <Route path="estoque" element={<EstoquePage />} />
            <Route path="contas-pagar" element={<ContasApagarPage />} />
            <Route path="contas-receber" element={<ContasAReceberPage />} />
            <Route path="relatorios" element={<RelatoriosPage />} />
            <Route path="relatorios/historico-vendas" element={<HistoricoVendasPage />} />
            <Route path="relatorios/caixa" element={<CaixaHistoricoPage />} />
            <Route path="chatbot" element={<ChatbotApiPage />} />
            <Route path="cores-layout" element={<TemaLayoutPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
