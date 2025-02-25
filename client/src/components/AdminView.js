import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import './AdminView.css';

function AdminView({ user }) {
    const [users, setUsers] = useState([]);
    const [showAddUserForm, setShowAddUserForm] = useState(false);
    const [showEditUserForm, setShowEditUserForm] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: '' });
    const [editingUser, setEditingUser] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await apiService.get('/users');
            setUsers(response.data);
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('獲取用戶列表失敗');
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!newUser.username || !newUser.password || !newUser.role) {
            setError('請填寫所有必填字段');
            return;
        }

        try {
            await apiService.post('/users', newUser);
            alert('用戶添加成功');
            setShowAddUserForm(false);
            setNewUser({ username: '', password: '', role: '' });
            fetchUsers();
        } catch (error) {
            console.error('Error adding user:', error);
            setError('添加用戶失敗：' + (error.response?.data?.message || error.message));
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('確定要刪除此用戶嗎？')) {
            try {
                await apiService.delete(`/users/${userId}`);
                alert('用戶刪除成功');
                fetchUsers();
            } catch (error) {
                console.error('Error deleting user:', error);
                setError('刪除用戶失敗：' + (error.response?.data?.message || error.message));
            }
        }
    };

    const handleEditUser = (user) => {
        setEditingUser({...user, password: ''});
        setShowEditUserForm(true);
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setError('');

        if (!editingUser.role) {
            setError('角色是必填字段');
            return;
        }

        try {
            const dataToUpdate = {
                role: editingUser.role
            };
            if (editingUser.password) {
                dataToUpdate.password = editingUser.password;
            }
            await apiService.put(`/users/${editingUser.id}`, dataToUpdate);
            alert('用戶更新成功');
            setShowEditUserForm(false);
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            setError('更新用戶失敗：' + (error.response?.data?.message || error.message));
        }
    };

    return (
            <div className="admin-view">
            <h2 className="main-title">用戶管理</h2>
            <button 
                className="action-button add-user"
                onClick={() => setShowAddUserForm(true)}
                title="新增用戶"
            >
                +
            </button>
            {error && <p className="error-message">{error}</p>}
            <div className="user-list-container">
                <table className="user-list">
                    <thead>
                        <tr>
                            <th>用戶名</th>
                            <th>角色</th>
                            <th>密碼</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id}>
                                <td>{user.username}</td>
                                <td>{user.role}</td>
                                <td>{'********'}</td>
                                <td>
                                    <button className="action-button edit" onClick={() => handleEditUser(user)}>編輯</button>
                                    <button className="action-button delete" onClick={() => handleDeleteUser(user.id)}>刪除</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {showAddUserForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>新增用戶</h3>
                        <form onSubmit={handleAddUser}>
                            <div className="form-group">
                                <label htmlFor="username">用戶名：</label>
                                <input
                                    type="text"
                                    id="username"
                                    value={newUser.username}
                                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">密碼：</label>
                                <input
                                    type="password"
                                    id="password"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="role">角色：</label>
                                <select
                                    id="role"
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                                    required
                                >
                                    <option value="">選擇角色</option>
                                    <option value="admin">管理員</option>
                                    <option value="data_manager">數據管理員</option>
                                    <option value="reader">讀表員</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="action-button">添加用戶</button>
                                <button type="button" className="action-button cancel" onClick={() => setShowAddUserForm(false)}>取消</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showEditUserForm && editingUser && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>編輯用戶</h3>
                        <form onSubmit={handleUpdateUser}>
                            <div className="form-group">
                                <label>用戶名：{editingUser.username}</label>
                            </div>
                            <div className="form-group">
                                <label htmlFor="editRole">角色：</label>
                                <select
                                    id="editRole"
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                                    required
                                >
                                    <option value="">選擇角色</option>
                                    <option value="admin">管理員</option>
                                    <option value="data_manager">數據管理員</option>
                                    <option value="reader">讀表員</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="editPassword">新密碼（留空表示不更改）：</label>
                                <input
                                    type="password"
                                    id="editPassword"
                                    value={editingUser.password}
                                    onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                                />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="action-button">更新用戶</button>
                                <button type="button" className="action-button cancel" onClick={() => setShowEditUserForm(false)}>取消</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminView;