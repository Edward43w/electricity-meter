import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import AddMeterForm from './AddMeterForm';
import MeterHistoryModal from './MeterHistoryModal';
import './DataManagerView.css';

function DataManagerView({ user }) {
    const [campuses, setCampuses] = useState([]);
    const [selectedCampus, setSelectedCampus] = useState('');
    const [locationTypes, setLocationTypes] = useState([]);
    const [selectedLocationType, setSelectedLocationType] = useState('');
    const [meters, setMeters] = useState([]);
    const [selectedMeter, setSelectedMeter] = useState(null);
    const [showAddMeterForm, setShowAddMeterForm] = useState(false);
    const [showAddCampusForm, setShowAddCampusForm] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [newCampusName, setNewCampusName] = useState('');
    const [editedMeterInfo, setEditedMeterInfo] = useState({
        meter_type: '',
        brand: '',
        display_unit: [],
        ct_value: '',
        wiring_method: ''
    });
    const [showEditReadingModal, setShowEditReadingModal] = useState(false);
    const [selectedReading, setSelectedReading] = useState(null);
    const [newReadingValue, setNewReadingValue] = useState('');
    const [showEditMeterForm, setShowEditMeterForm] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);    
    const [showEditMeterModal, setShowEditMeterModal] = useState(false);


    useEffect(() => {
        fetchCampuses();
    }, []);

    useEffect(() => {
        if (selectedCampus) {
            fetchLocationTypes(selectedCampus);
            fetchMetersByCampus(selectedCampus); 
            setSelectedLocationType('');
            setSelectedMeter(null);
            setMeters([]);
            setShowEditMeterForm(false); 
        }
    }, [selectedCampus]);

    useEffect(() => {
        if (selectedLocationType) {
            fetchMeters(selectedLocationType);
            setSelectedMeter(null);
            setShowEditMeterForm(false); 
        }
    }, [selectedLocationType]);

    const fetchCampuses = async () => {
        try {
            const response = await apiService.get('/campuses');
            setCampuses(response.data);
        } catch (error) {
            console.error('Error fetching campuses:', error);
        }
    };

    const fetchLocationTypes = async (campusId) => {
        try {
            const response = await apiService.get(`/location-types/${campusId}`);
            setLocationTypes(response.data);
        } catch (error) {
            console.error('Error fetching location types:', error);
        }
    };

    const fetchMeters = async (locationTypeId) => {
      try {
        if (!locationTypeId) {
          console.warn('Location type ID is empty, skipping meter fetch');
          setMeters([]);
          return;
        }
        const response = await apiService.get(`/meters/location/${locationTypeId}`);
        if (response.data && response.data.meters) {
          setMeters(response.data.meters);
        } else {
          console.warn('Unexpected response format:', response.data);
          setMeters([]);
        }
      } catch (error) {
        console.error('Error fetching meters:', error);
        setMeters([]);
        // 可以在這裡添加一個錯誤通知給用戶
      }
    };

    // 獲取該校區所有電表的函數
    const fetchMetersByCampus = async (campusId) => {
        try {
            const response = await apiService.get(`/meters/campus/${campusId}`);
            if (response.data && response.data.meters) {
                console.log(response.data.meters);
                setMeters(response.data.meters);
                console.log(meters);
            } else {
                console.warn('Unexpected response format:', response.data);
                setMeters([]); // 如果沒有數據，設置為空數組
            }
        } catch (error) {
            console.error('Error fetching meters by campus:', error);
            setMeters([]); // 如果出現錯誤，也設置為空數組
            // 可以在這裡添加一個錯誤通知給用戶
        }
    };
    

    const handleAddMeter = async (meterData) => {
      try {
          await apiService.post('/meters', meterData);
          alert('電表添加成功');
          setShowAddMeterForm(false);
          fetchMeters(selectedLocationType);
      } catch (error) {
          console.error('Error adding meter:', error);
          alert('添加電表失敗：' + (error.response?.data || error.message));
      }
  };

    const handleAddCampus = async (e) => {
        e.preventDefault();
        try {
            await apiService.post('/campuses', { name: newCampusName });
            alert('校區添加成功');
            setShowAddCampusForm(false);
            setNewCampusName('');
            fetchCampuses();
        } catch (error) {
            console.error('Error adding campus:', error);
            alert('添加校區失敗：' + (error.response?.data || error.message));
        }
    };

    const handleDisplayUnitChange = (unit) => {
        setEditedMeterInfo(prevInfo => {
            const updatedUnits = prevInfo.display_unit.includes(unit)
                ? prevInfo.display_unit.filter(u => u !== unit)
                : [...prevInfo.display_unit, unit];
            return { ...prevInfo, display_unit: updatedUnits };
        });
    };

    const handleEditMeter = async (e) => {
        e.preventDefault();
        try {
            let updatedMeterInfo = {
                meter_type: editedMeterInfo.meter_type
            };

            if (editedMeterInfo.meter_type === 'digital') {
                updatedMeterInfo.brand = editedMeterInfo.brand;
                updatedMeterInfo.display_unit = editedMeterInfo.display_unit.join(',');
            } else {
                updatedMeterInfo.ct_value = editedMeterInfo.ct_value;
                updatedMeterInfo.wiring_method = editedMeterInfo.wiring_method;
            }

            await apiService.put(`/meters/${selectedMeter.meter_number}`, updatedMeterInfo);
            alert('電表信息更新成功');
            fetchMeters(selectedLocationType);
        } catch (error) {
            console.error('Error updating meter:', error);
            alert('更新電表失敗：' + (error.response?.data || error.message));
        }
        setShowEditMeterModal(false);
    };

    const handleEditReading = async () => {
        try {
            await apiService.put(`/update-meter-reading/${selectedMeter.meter_number}/${selectedReading.id}`, {
                new_reading_value: newReadingValue,
                meter_type: selectedMeter.meter_type
            });
            alert('讀數更新成功');
            setShowEditReadingModal(false);
            fetchMeters(selectedLocationType);
        } catch (error) {
            console.error('Error updating reading:', error);
            alert('更新失敗：' + (error.response?.data?.message || error.message));
        }
    };

    const handleMeterSelect = (meterId) => {
        const meter = meters.find(m => m.id === parseInt(meterId));
        setSelectedMeter(meter);
        setEditedMeterInfo({
            meter_type: meter.meter_type || '',
            brand: meter.brand || '',
            display_unit: meter.display_unit ? meter.display_unit.split(',') : [],
            ct_value: meter.ct_value || '',
            wiring_method: meter.wiring_method || ''
        });
        setShowEditMeterModal(true);  // 使用 setShowEditMeterModal 而不是 setShowEditMeterForm
    };

    const handleDeleteMeter = async (id) => {
      try {
          // 刪除 `meter` 表中的電表記錄
          await apiService.delete(`/meters/${id}`);
          alert('電表刪除成功');
          setSelectedMeter(null);  // 刪除成功後，重設選擇的電表
          fetchMeters(selectedLocationType);  // 重新載入電表列表
      } catch (error) {
          console.error('Error deleting meter:', error);
          alert('刪除電表失敗：' + (error.response?.data || error.message));
      }
  };

  const handleDeleteCampus = async (campusId, campusName) => {
    if (!campusId || !campusName) return;
    const isConfirmed = window.confirm(
        `確定要刪除 "${campusName}" 嗎？此校區內的地點和電表將一併刪除`
    );
    if (!isConfirmed) return;
    try {
        await apiService.delete(`/campuses/${campusId}`);
        alert('校區刪除成功');
        fetchCampuses();
    } catch (error) {
        console.error('Error deleting campus:', error);
        alert('刪除校區失敗：' + (error.response?.data || error.message));
    }
};

const handleShowHistory = (meter) => {
    setSelectedMeter(meter);
    setShowHistory(true);
};
return (
    <div className="data-manager-view">
        <h2 className="main-title">電表信息管理</h2>
        
        <div className="control-panel">
            <div className="select-container">
                <select 
                    className="select-input"
                    onChange={e => setSelectedCampus(e.target.value)} 
                    value={selectedCampus}
                >
                    <option value="">選擇校區</option>
                    {campuses.map(campus => (
                        <option key={campus.id} value={campus.id}>{campus.name}</option>
                    ))}
                </select>

                <select 
                    className="select-input"
                    onChange={e => setSelectedLocationType(e.target.value)} 
                    value={selectedLocationType}
                >
                    <option value="">選擇位置種類</option>
                    {locationTypes.map(locationType => (
                        <option key={locationType.id} value={locationType.id}>{locationType.name}</option>
                    ))}
                </select>
            </div>

            <button 
                className="action-button add-meter"
                onClick={() => setShowAddMeterForm(true)}
                title="新增電表"
            >
                +
            </button>
        </div>
        
        {selectedCampus && !showEditMeterForm && meters.length > 0 && (
            <div className="meter-list-container">
                <table className="meter-list">
                    <thead>
                        <tr>
                            <th>電表號</th>
                            <th>校區</th>
                            <th>位置</th>
                            <th>當前讀數</th>
                            <th>用電量</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meters.map((meter) => (
                            <tr key={meter.id}>
                                <td>{meter.meter_number}</td>
                                <td>{campuses.find(c => c.id == selectedCampus)?.name || ''}</td>
                                <td>{meter.location}</td>
                                <td>{meter.current_reading || '未設定'}</td>
                                <td>{meter.difference || '未設定'}</td>
                                <td>
                                    <button className="action-button edit" onClick={() => handleMeterSelect(meter.id)}>編輯</button>
                                    <button className="action-button history" onClick={() => handleShowHistory(meter)}>歷史</button>
                                    <button className="action-button delete" onClick={() => {
                                        if (window.confirm(`確定要刪除電表 ${meter.meter_number} 嗎？`)) {
                                            handleDeleteMeter(meter.id);
                                        }
                                    }}>刪除</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {/* 編輯電表 */}
        {showEditMeterModal && selectedMeter && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <h3 className="modal-title">編輯電表: {selectedMeter.meter_number}</h3>
                    <p className="modal-subtitle">位置: {selectedMeter.location}</p>
                    <form onSubmit={handleEditMeter} className="edit-meter-form">
                        <div className="form-group">
                            <label htmlFor="meter-type">電表類型:</label>
                            <select
                                id="meter-type"
                                value={editedMeterInfo.meter_type}
                                onChange={e => setEditedMeterInfo({...editedMeterInfo, meter_type: e.target.value})}
                                className="form-select"
                            >
                                <option value="">請選擇</option>
                                <option value="digital">數位式</option>
                                <option value="mechanical">機械式</option>
                            </select>
                        </div>
                        
                        {editedMeterInfo.meter_type === 'digital' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="brand">廠牌:</label>
                                    <select
                                        id="brand"
                                        value={editedMeterInfo.brand}
                                        onChange={e => setEditedMeterInfo({...editedMeterInfo, brand: e.target.value})}
                                        className="form-select"
                                    >
                                        <option value="">選擇廠牌</option>
                                        <option value="1">施耐德</option>
                                        <option value="2">其他</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>顯示單位:</label>
                                    <div className="checkbox-group">
                                        {['Wh', 'VAh', 'VARh'].map(unit => (
                                            <label key={unit} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={editedMeterInfo.display_unit.includes(unit)}
                                                    onChange={() => handleDisplayUnitChange(unit)}
                                                /> 
                                                {unit}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {editedMeterInfo.meter_type === 'mechanical' && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="ct-value">CT值:</label>
                                    <select
                                        id="ct-value"
                                        value={editedMeterInfo.ct_value}
                                        onChange={e => setEditedMeterInfo({...editedMeterInfo, ct_value: e.target.value})}
                                        className="form-select"
                                    >
                                        <option value="">選擇 CT 值</option>
                                        <option value="1">有裝電比值</option>
                                        <option value="2">沒有</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="wiring-method">電壓接線方式:</label>
                                    <input 
                                        id="wiring-method"
                                        type="text" 
                                        value={editedMeterInfo.wiring_method}
                                        onChange={e => setEditedMeterInfo({...editedMeterInfo, wiring_method: e.target.value})}
                                        placeholder="請輸入電壓接線方式"
                                        className="form-input"
                                    />
                                </div>
                            </>
                        )}
                        
                        <div className="form-actions">
                            <button type="submit" className="action-button edit">更新電表信息</button>
                            <button type="button" onClick={() => setShowEditMeterModal(false)} className="action-button delete">取消</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* 歷史記錄模態框 */}
        {showHistory && selectedMeter && (
                <MeterHistoryModal 
                    meterId={selectedMeter.meter_number}
                    meterType={selectedMeter.meter_type}
                    onClose={() => setShowHistory(false)}
                    onEditReading={(reading) => {
                        setSelectedReading(reading);
                        setNewReadingValue(reading.reading_value);
                        setShowEditReadingModal(true);
                    }}
                    userRole={user.role}
                />
            )}

        {/* 校區管理部分 */}
        <div className="action-section">
            <div
                className="action-section-header"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <h3 className="section-title" style={{ flex: 1, margin: 0 }}>校區管理</h3>
                <span style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.3s' }}>
                    ▼
                </span>
            </div>

            {!isCollapsed && (
                <div className="action-section-content">
                    <div className="campus-list-container">
                        <table className="campus-list">
                            <thead>
                                <tr>
                                    <th>校區</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {campuses.map(campus => (
                                    <tr key={campus.id}>
                                        <td>{campus.name}</td>
                                        <td>
                                            <button
                                                className="action-button delete"
                                                onClick={() => handleDeleteCampus(campus.id, campus.name)}
                                            >
                                                刪除
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="add-campus-container">
                        {showAddCampusForm ? (
                            <div className="add-campus-form">
                                <input
                                    type="text"
                                    value={newCampusName}
                                    onChange={(e) => setNewCampusName(e.target.value)}
                                    placeholder="輸入新校區名稱"
                                />
                                <button type="submit" onClick={handleAddCampus}>新增</button>
                                <button className="cancel" onClick={() => setShowAddCampusForm(false)}>取消</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddCampusForm(true)}
                                className="action-button add-campus"
                                title="新增校區"
                            >
                                +
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* 添加电表的模态框 */}
        {showAddMeterForm && (
            <div className="modal-overlay">
                <div className="modal-content">
                    <AddMeterForm
                        campuses={campuses}
                        onAddMeter={handleAddMeter}
                        onClose={() => setShowAddMeterForm(false)}
                    />
                </div>
            </div>
        )}

        {/* 編輯讀數模態框 */}
        {showEditReadingModal && (
            <div className="modal-overlay" onClick={() => setShowEditReadingModal(false)}>
                <div className="modal-content-edit" onClick={(e) => e.stopPropagation()}>
                    <h3>修改讀數</h3>
                    <p>當前讀數: {selectedReading?.reading_value || '未設定'}</p>
                    <input
                        type="number"
                        value={newReadingValue}
                        onChange={(e) => setNewReadingValue(e.target.value)}
                        placeholder="新讀數"
                        required
                    />
                    <div className="modal-edit-buttons-container">
                        <button className="modal-edit-buttons confirm" onClick={handleEditReading}>確認修改</button>
                        <button className="modal-edit-buttons cancel" onClick={() => setShowEditReadingModal(false)}>取消</button>
                    </div>
                </div>
            </div>
        )}

    </div>
    );
}
    
export default DataManagerView;