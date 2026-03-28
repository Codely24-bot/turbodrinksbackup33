import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ClientesPage = () => {
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    endereco: '',
    cidade: '',
    estado: ''
  });

  useEffect(() => {
    if (user?.id) {
      loadClientes();
      
      const subscription = supabase
        .channel('pessoas_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pessoas', filter: `user_id=eq.${user.id}` }, (payload) => {
           loadClientes(); 
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const loadClientes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pessoas')
        .select('*')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar clientes',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Check CPF uniqueness if provided
      if (formData.cpf) {
        const { data: existing } = await supabase
          .from('pessoas')
          .select('id')
          .eq('user_id', user.id)
          .eq('cpf', formData.cpf)
          .single();
          
        if (existing && existing.id !== editingId) {
          throw new Error('CPF já cadastrado para outro cliente.');
        }
      }

      const payload = { ...formData, user_id: user.id };

      if (editingId) {
        const { error } = await supabase
          .from('pessoas')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast({ title: 'Cliente atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('pessoas')
          .insert([payload]);

        if (error) throw error;
        toast({ title: 'Cliente cadastrado com sucesso!' });
      }

      resetForm();
      // Optimistically update or just wait for subscription
      loadClientes();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cliente) => {
    setFormData({
      nome: cliente.nome,
      cpf: cliente.cpf || '',
      email: cliente.email || '',
      telefone: cliente.telefone || '',
      endereco: cliente.endereco || '',
      cidade: cliente.cidade || '',
      estado: cliente.estado || ''
    });
    setEditingId(cliente.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente excluir este cliente?')) {
      try {
        const { error } = await supabase
          .from('pessoas')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast({ title: 'Cliente excluído com sucesso!' });
        loadClientes();
      } catch (error) {
        toast({
          title: 'Erro ao excluir',
          description: error.message,
          variant: 'destructive'
        });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      email: '',
      telefone: '',
      endereco: '',
      cidade: '',
      estado: ''
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const filteredClientes = clientes.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cpf && c.cpf.includes(searchTerm)) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6">
      <Helmet>
        <title>Clientes - PDV System</title>
        <meta name="description" content="Gerenciamento de clientes" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Clientes</h1>
        <p className="text-[var(--layout-text-muted)]">Gerenciar cadastro de clientes</p>
      </div>

      <div className="bg-[var(--layout-surface-2)] rounded-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, CPF ou email..."
              className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-3 text-white placeholder-[var(--layout-text-muted)] focus:border-[var(--layout-accent)] focus:outline-none"
            />
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Cliente
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--layout-border)]">
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Nome</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">CPF</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Email</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Telefone</th>
                <th className="text-left py-3 px-4 text-[var(--layout-text-muted)] font-medium">Cidade</th>
                <th className="text-right py-3 px-4 text-[var(--layout-text-muted)] font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[var(--layout-text-muted)]">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    Carregando...
                  </td>
                </tr>
              ) : filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[var(--layout-text-muted)]">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="border-b border-[var(--layout-border)] hover:bg-[var(--layout-bg)] transition-colors">
                    <td className="py-3 px-4 text-white">{cliente.nome}</td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)]">{cliente.cpf}</td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)]">{cliente.email}</td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)]">{cliente.telefone}</td>
                    <td className="py-3 px-4 text-[var(--layout-text-muted)]">{cliente.cidade} - {cliente.estado}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleEdit(cliente)}
                        className="text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cliente.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--layout-surface-2)] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[var(--layout-surface-2)] border-b border-[var(--layout-border)] p-4 sm:p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button onClick={resetForm} className="text-[var(--layout-text-muted)] hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Endereço</label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Cidade</label>
                  <input
                    type="text"
                    value={formData.cidade}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Estado</label>
                  <input
                    type="text"
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                    placeholder="UF"
                    maxLength="2"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1 bg-transparent border-[var(--layout-border)] text-white hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingId ? 'Atualizar' : 'Cadastrar'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientesPage;
