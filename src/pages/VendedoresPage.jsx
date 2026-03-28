import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const VendedoresPage = () => {
  const [vendedores, setVendedores] = useState([]);
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
    comissao_percentual: '',
    ativo: true
  });

  useEffect(() => {
    if (user?.id) {
      loadVendedores();

      const subscription = supabase
        .channel('vendedores_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'vendedores', filter: `user_id=eq.${user.id}` }, () => {
          loadVendedores();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const loadVendedores = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendedores')
        .select('*')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setVendedores(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar vendedores',
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
          .from('vendedores')
          .select('id')
          .eq('user_id', user.id)
          .eq('cpf', formData.cpf)
          .single();
          
        if (existing && existing.id !== editingId) {
          throw new Error('CPF já cadastrado para outro vendedor.');
        }
      }

      const payload = { ...formData, user_id: user.id };

      if (editingId) {
        const { error } = await supabase
          .from('vendedores')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Vendedor atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('vendedores')
          .insert([payload]);
        if (error) throw error;
        toast({ title: 'Vendedor cadastrado com sucesso!' });
      }

      resetForm();
      loadVendedores();
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

  const handleEdit = (vendedor) => {
    setFormData({
      nome: vendedor.nome,
      cpf: vendedor.cpf || '',
      email: vendedor.email || '',
      telefone: vendedor.telefone || '',
      comissao_percentual: vendedor.comissao_percentual || '',
      ativo: vendedor.ativo
    });
    setEditingId(vendedor.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente excluir este vendedor?')) {
      try {
        const { error } = await supabase
          .from('vendedores')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
        toast({ title: 'Vendedor excluído com sucesso!' });
        loadVendedores();
      } catch (error) {
        toast({
          title: 'Erro ao excluir',
          description: error.message,
          variant: 'destructive'
        });
      }
    }
  };

  const toggleStatus = async (vendedor) => {
    try {
      const { error } = await supabase
        .from('vendedores')
        .update({ ativo: !vendedor.ativo })
        .eq('id', vendedor.id)
        .eq('user_id', user.id);
      
      if (error) throw error;
      toast({ title: 'Status atualizado!' });
      loadVendedores();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      email: '',
      telefone: '',
      comissao_percentual: '',
      ativo: true
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const filteredVendedores = vendedores.filter(v =>
    v.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.cpf && v.cpf.includes(searchTerm)) ||
    (v.email && v.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 sm:p-6">
      <Helmet>
        <title>Vendedores - PDV System</title>
        <meta name="description" content="Gerenciamento de vendedores" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Vendedores</h1>
        <p className="text-gray-400">Gerenciar cadastro de vendedores</p>
      </div>

      <div className="bg-[#2a3a4a] rounded-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, CPF ou email..."
              className="w-full bg-[#1a2332] border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:border-[#00d084] focus:outline-none"
            />
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-[#00d084] hover:bg-[#00b872] text-white w-full md:w-auto"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Vendedor
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Nome</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">CPF</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Telefone</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Comissão</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-400">
                     <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                     Carregando...
                  </td>
                </tr>
              ) : filteredVendedores.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-gray-500">
                    Nenhum vendedor encontrado
                  </td>
                </tr>
              ) : (
                filteredVendedores.map((vendedor) => (
                  <tr key={vendedor.id} className="border-b border-gray-700 hover:bg-[#1a2332] transition-colors">
                    <td className="py-3 px-4 text-white">{vendedor.nome}</td>
                    <td className="py-3 px-4 text-gray-300">{vendedor.cpf}</td>
                    <td className="py-3 px-4 text-gray-300">{vendedor.email}</td>
                    <td className="py-3 px-4 text-gray-300">{vendedor.telefone}</td>
                    <td className="py-3 px-4 text-gray-300">{vendedor.comissao_percentual}%</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleStatus(vendedor)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          vendedor.ativo
                            ? 'bg-[#00d084]/20 text-[#00d084]'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {vendedor.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleEdit(vendedor)}
                        className="text-blue-400 hover:text-blue-300 mr-3 transition-colors"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(vendedor.id)}
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
          <div className="bg-[#2a3a4a] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#2a3a4a] border-b border-gray-700 p-4 sm:p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editingId ? 'Editar Vendedor' : 'Novo Vendedor'}
              </h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#00d084] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#00d084] focus:outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    className="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#00d084] focus:outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#00d084] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Comissão (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.comissao_percentual}
                  onChange={(e) => setFormData({ ...formData, comissao_percentual: e.target.value })}
                  className="w-full bg-[#1a2332] border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-[#00d084] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-600 text-[#00d084] focus:ring-[#00d084]"
                />
                <label htmlFor="ativo" className="text-gray-300">Vendedor ativo</label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1 bg-transparent border-gray-600 text-white hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#00d084] hover:bg-[#00b872] text-white"
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

export default VendedoresPage;
