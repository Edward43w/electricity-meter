import React, { useState, useEffect } from 'react';
import apiService from './services/apiService';
import LoginForm from './components/LoginForm';
import ReaderView from './components/ReaderView';
import DataManagerView from './components/DataManagerView';
import AdminView from './components/AdminView';
import { getAllOfflineData, retryUpload } from './services/offlineService'; // 导入离线服务
import './App.css'; // Import CSS
import './index.css';


function App() {
  const [user, setUser] = useState(null);
  const [selectedView, setSelectedView] = useState(''); // Add state for the selected view

  useEffect(() => {
    const token = localStorage.getItem('token');

    // Add an event listener to handle the app going online
    window.addEventListener('online', handleOnline);

    // Check if we're online on initial load
    if (navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleLogin = async (username, password) => {
    try {
      const response = await apiService.post('/login', { username, password });
      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      
    } catch (error) {
      console.error('Login error:', error);
      alert('登錄失敗：' + (error.response?.data || error.message));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSelectedView(''); // Clear selected view on logout
  };

  // Function to handle online status
  const handleOnline = async () => {
    try {
      const offlineData = await getAllOfflineData(); // Get all offline data from IndexedDB
      
      if (offlineData.length > 0) { // Check if there is any offline data
        for (const data of offlineData) {
          await retryUpload(data); // Retry uploading each data entry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        alert('All offline data successfully uploaded'); // Alert if all data is uploaded
      }

    } catch (error) {
      console.error('Error uploading offline data:', error);
    }
  };
  const handleViewChange = (e) => {
    setSelectedView(e.target.value); // Set selected view based on dropdown selection
  };

  const renderView = () => {
    switch (selectedView) {
      case 'reader':
        return <ReaderView user={user} />;
      case 'data_manager':
        return <DataManagerView user={user} />;
      case 'admin':
        return <AdminView user={user} />;
      default:
        return null;
    }
  };


  return (
    <div>
      {!user ? (
        <LoginForm onLogin={handleLogin} />
      ) : (
        <div>
          <div className="header">
            <h1>電表系統</h1>

            {/* View selection dropdown for admin and data_manager */}
            {user.role === 'admin' && (
              <select className="select-input-view" value={selectedView} onChange={handleViewChange}>
                <option value="">選擇視圖</option>
                <option value="reader">Reader</option>
                <option value="data_manager">DataManager</option>
                <option value="admin">Admin</option>
              </select>
            )}

            {user.role === 'data_manager' && (
              <select className="select-input-view" value={selectedView} onChange={handleViewChange}>
                <option value="">選擇視圖</option>
                <option value="reader">Reader</option>
                <option value="data_manager">DataManager</option>
              </select>
            )}

            {/* Logout button */}
            <button className="action-button logout" onClick={handleLogout}>登出</button>
          </div>

          {/* Render the selected view */}
          {user.role === 'reader' && <ReaderView user={user} />}
          {selectedView && renderView()}
        </div>
      )}
    </div>
  );
}

export default App;
