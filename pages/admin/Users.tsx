import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Search, Shield, User, Users as UsersIcon, Phone, MapPin, FileText, Edit2, Key, X, Save } from 'lucide-react';
import { Button } from '../../components/Button';
import { supabaseService } from '../../services/supabaseService';
import { UserAccess, UserRole } from '../../types';
import { useToast } from '../../components/Toast';

export const Users: React.FC = () => {
  const { addToast } = useToast();
  const [users, setUsers] = useState<UserAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.CLIENT,
    password: '',
    // Campos adicionais para cliente
    cpf: '',
    phone: '',
    address: '',
    city: '',
    neighborhood: ''
  });
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const data = await supabaseService.getUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleCreateUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      addToast("Preencha todos os campos obrigatórios.", 'warning');
      return;
    }

    // Se for cliente, validar campos adicionais
    if (formData.role === UserRole.CLIENT && (!formData.cpf || !formData.phone)) {
      addToast("Para clientes, CPF e Telefone são obrigatórios.", 'warning');
      return;
    }

    setCreatingUser(true);
    const success = await supabaseService.createUser(formData);
    setCreatingUser(false);

    if (success) {
      addToast("Usuário criado com sucesso!", 'success');
      setIsModalOpen(false);
      setFormData({
        name: '', email: '', role: UserRole.CLIENT, password: '',
        cpf: '', phone: '', address: '', city: '', neighborhood: ''
      });
      loadUsers();
    } else {
      addToast("Erro ao criar usuário. Email pode já estar em uso.", 'error');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm("Tem certeza que deseja remover este usuário?")) {
      await supabaseService.deleteUser(id);
      addToast("Usuário removido.", 'info');
      loadUsers();
    }
  };

  // Estado para edição
  const [editingUser, setEditingUser] = useState<UserAccess | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    role: UserRole.CLIENT,
    phone: '',
    address: '',
    city: '',
    neighborhood: ''
  });
  const [newPassword, setNewPassword] = useState('');
  const [updatingUser, setUpdatingUser] = useState(false);

  // Abrir modal de edição
  const handleEditUser = (user: UserAccess) => {
    setEditingUser(user);
    setEditFormData({
      name: user.name,
      role: user.role,
      phone: (user as any).phone || '',
      address: (user as any).address || '',
      city: (user as any).city || '',
      neighborhood: (user as any).neighborhood || ''
    });
    setNewPassword('');
  };

  // Atualizar usuário
  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setUpdatingUser(true);
    const success = await supabaseService.updateUser(editingUser.id, editFormData);
    setUpdatingUser(false);

    if (success) {
      addToast("Usuário atualizado com sucesso!", 'success');
      setEditingUser(null);
      loadUsers();
    } else {
      addToast("Erro ao atualizar usuário.", 'error');
    }
  };

  // Resetar senha
  const handleResetPassword = async () => {
    if (!editingUser || !newPassword) {
      addToast("Digite a nova senha.", 'warning');
      return;
    }
    if (newPassword.length < 6) {
      addToast("A senha deve ter pelo menos 6 caracteres.", 'warning');
      return;
    }

    setUpdatingUser(true);
    const success = await supabaseService.resetUserPassword(editingUser.id, newPassword);
    setUpdatingUser(false);

    if (success) {
      addToast("Senha alterada com sucesso!", 'success');
      setNewPassword('');
    } else {
      addToast("Erro ao alterar senha.", 'error');
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(filter.toLowerCase()) ||
    u.email.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 bg-black min-h-screen text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#D4AF37] flex items-center gap-2">
            <UsersIcon size={32} /> Gestão de Acessos
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie quem tem acesso ao painel administrativo e ao sistema.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
            <input
              type="text"
              placeholder="Buscar usuários..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full md:w-64 bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-[#D4AF37] outline-none"
            />
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="w-full md:w-auto">
            <UserPlus size={18} className="mr-2" /> Novo Usuário
          </Button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-zinc-950 text-zinc-400 text-sm uppercase tracking-wider">
              <tr>
                <th className="p-4">Usuário</th>
                <th className="p-4">Email / Login</th>
                <th className="p-4">Função</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Carregando usuários...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-zinc-500">Nenhum usuário encontrado.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-black font-bold text-xs ${user.role === UserRole.ADMIN ? 'bg-[#D4AF37]' : 'bg-zinc-200'}`}>
                          {user.name.substring(0, 2).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td className="p-4 text-zinc-300">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${user.role === UserRole.ADMIN
                        ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50'
                        : 'bg-blue-900/20 text-blue-400 border-blue-900/50'
                        }`}>
                        {user.role === UserRole.ADMIN ? <span className="flex items-center gap-1"><Shield size={12} /> ADMINISTRADOR</span> : <span className="flex items-center gap-1"><User size={12} /> CLIENTE</span>}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-green-500 text-xs font-bold bg-green-900/20 px-2 py-1 rounded-full">ATIVO</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          title="Editar usuário"
                        >
                          <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.email === 'admin@tubarao.com'}
                          title="Remover usuário"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in duration-200 my-4">
            <h2 className="text-xl font-bold text-white mb-6">Criar Novo Acesso</h2>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Tipo de Acesso - primeiro para mostrar/esconder campos */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Tipo de Acesso</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, role: UserRole.CLIENT })}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${formData.role === UserRole.CLIENT ? 'bg-zinc-800 border-white text-white' : 'bg-black border-zinc-800 text-zinc-500'}`}
                  >
                    Cliente
                  </button>
                  <button
                    onClick={() => setFormData({ ...formData, role: UserRole.ADMIN })}
                    className={`p-3 rounded-lg border text-sm font-bold transition-all ${formData.role === UserRole.ADMIN ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-black border-zinc-800 text-zinc-500'}`}
                  >
                    Administrador
                  </button>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-4">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Dados de Acesso</p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Nome Completo *</label>
                <input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Email (Login) *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                  placeholder="joao@email.com"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Senha Temporária *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              {/* Campos adicionais para Cliente */}
              {formData.role === UserRole.CLIENT && (
                <>
                  <div className="border-t border-zinc-800 pt-4">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Dados do Cliente</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">CPF *</label>
                      <input
                        value={formData.cpf}
                        onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Telefone *</label>
                      <input
                        value={formData.phone}
                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Endereço</label>
                    <input
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                      placeholder="Rua, número, complemento"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Bairro</label>
                      <input
                        value={formData.neighborhood}
                        onChange={e => setFormData({ ...formData, neighborhood: e.target.value })}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                        placeholder="Bairro"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Cidade</label>
                      <input
                        value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                        placeholder="Cidade"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex gap-3 border-t border-zinc-800">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleCreateUser} isLoading={creatingUser} className="flex-1">
                  Criar Usuário
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit2 size={20} className="text-[#D4AF37]" /> Editar Usuário
                </h2>
                <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-zinc-800 rounded-lg">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>

              {/* Info do usuário */}
              <div className="bg-zinc-800 rounded-lg p-4 mb-6">
                <p className="text-zinc-400 text-sm">Email (não editável)</p>
                <p className="text-white font-medium">{editingUser.email}</p>
              </div>

              {/* Campos editáveis */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Nome</label>
                  <input
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Função</label>
                  <select
                    value={editFormData.role}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as UserRole })}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                  >
                    <option value={UserRole.CLIENT}>Cliente</option>
                    <option value={UserRole.ADMIN}>Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Telefone</label>
                  <input
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                    placeholder="(81) 99999-9999"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Cidade</label>
                    <input
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">Bairro</label>
                    <input
                      value={editFormData.neighborhood}
                      onChange={(e) => setEditFormData({ ...editFormData, neighborhood: e.target.value })}
                      className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Salvar alterações */}
              <div className="pt-4 mt-4 border-t border-zinc-800">
                <Button onClick={handleUpdateUser} isLoading={updatingUser} className="w-full">
                  <Save size={18} className="mr-2" /> Salvar Alterações
                </Button>
              </div>

              {/* Seção de Reset de Senha */}
              <div className="mt-6 pt-4 border-t border-zinc-800">
                <h3 className="text-sm font-bold text-[#D4AF37] flex items-center gap-2 mb-4">
                  <Key size={16} /> Alterar Senha
                </h3>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="flex-1 bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                    placeholder="Nova senha (mín. 6 caracteres)"
                  />
                  <Button onClick={handleResetPassword} isLoading={updatingUser} variant="outline">
                    Alterar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};