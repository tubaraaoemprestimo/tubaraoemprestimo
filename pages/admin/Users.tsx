import React, { useState, useEffect } from 'react';
import { UserPlus, Trash2, Search, Shield, User, Users as UsersIcon } from 'lucide-react';
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
    password: ''
  });

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

    const success = await supabaseService.createUser(formData);
    
    if (success) {
        addToast("Usuário criado com sucesso!", 'success');
        setIsModalOpen(false);
        setFormData({ name: '', email: '', role: UserRole.CLIENT, password: '' });
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
                <UserPlus size={18} className="mr-2"/> Novo Usuário
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
                          {user.name.substring(0,2).toUpperCase()}
                        </div>
                        {user.name}
                      </div>
                    </td>
                    <td className="p-4 text-zinc-300">{user.email}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        user.role === UserRole.ADMIN 
                            ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50' 
                            : 'bg-blue-900/20 text-blue-400 border-blue-900/50'
                      }`}>
                        {user.role === UserRole.ADMIN ? <span className="flex items-center gap-1"><Shield size={12}/> ADMINISTRADOR</span> : <span className="flex items-center gap-1"><User size={12}/> CLIENTE</span>}
                      </span>
                    </td>
                    <td className="p-4">
                        <span className="text-green-500 text-xs font-bold bg-green-900/20 px-2 py-1 rounded-full">ATIVO</span>
                    </td>
                    <td className="p-4 text-right">
                       <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.email === 'admin@tubarao.com'} // Prevent deleting main admin
                       >
                          <Trash2 size={16} />
                       </Button>
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-200">
                <h2 className="text-xl font-bold text-white mb-6">Criar Novo Acesso</h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Nome Completo</label>
                        <input 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                            placeholder="Ex: João Silva"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Email (Login)</label>
                        <input 
                            value={formData.email}
                            onChange={e => setFormData({...formData, email: e.target.value})}
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                            placeholder="joao@email.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Senha Temporária</label>
                        <input 
                            type="password"
                            value={formData.password}
                            onChange={e => setFormData({...formData, password: e.target.value})}
                            className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                            placeholder="******"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-zinc-400 mb-1">Tipo de Acesso</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setFormData({...formData, role: UserRole.CLIENT})}
                                className={`p-3 rounded-lg border text-sm font-bold transition-all ${formData.role === UserRole.CLIENT ? 'bg-zinc-800 border-white text-white' : 'bg-black border-zinc-800 text-zinc-500'}`}
                            >
                                Cliente
                            </button>
                            <button 
                                onClick={() => setFormData({...formData, role: UserRole.ADMIN})}
                                className={`p-3 rounded-lg border text-sm font-bold transition-all ${formData.role === UserRole.ADMIN ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-black border-zinc-800 text-zinc-500'}`}
                            >
                                Administrador
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancelar</Button>
                        <Button onClick={handleCreateUser} className="flex-1">Criar Usuário</Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};