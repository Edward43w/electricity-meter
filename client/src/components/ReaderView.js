import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import MeterHistoryModal from './MeterHistoryModal';
import { storeFormData } from '../services/offlineService';
import './ReaderView.css';

function ReaderView({ user }) {
    const [campuses, setCampuses] = useState([]);
    const [selectedCampus, setSelectedCampus] = useState('');
    const [locationTypes, setLocationTypes] = useState([]);
    const [selectedLocationType, setSelectedLocationType] = useState('');
    const [meters, setMeters] = useState([]);
    const [selectedMeter, setSelectedMeter] = useState(null);
    const [reading, setReading] = useState('');
    const [photo, setPhoto] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedReading, setSelectedReading] = useState(null);
    const [newReadingValue, setNewReadingValue] = useState('');
    const [fileInputKey, setFileInputKey] = useState(Date.now());
    const [showEditReadingModal, setShowEditReadingModal] = useState(false);
    const [showEditWindow, setShowEditWindow] = useState(false);
    

    // 初始獲取校區資料
    useEffect(() => {
        fetchCampuses();
    }, []);

    // 根據選擇的校區獲取位置類型
    useEffect(() => {
        if (selectedCampus) {
            fetchLocationTypes(selectedCampus);
            setSelectedLocationType('');
            setSelectedMeter(null);
            setMeters([]);
        }
    }, [selectedCampus]);

    // 根據選擇的位置類型獲取電表
    useEffect(() => {
        if (selectedLocationType) {
            fetchMeters(selectedLocationType);
        }
    }, [selectedLocationType]);

    // 獲取校區
    const fetchCampuses = async () => {
        try {
            const response = await apiService.get('/campuses');
            setCampuses(response.data);
        } catch (error) {
            console.error('Error fetching campuses:', error);
        }
    };

    // 獲取位置類型
    const fetchLocationTypes = async (campusId) => {
        try {
            const response = await apiService.get(`/location-types/${campusId}`);
            setLocationTypes(response.data);
        } catch (error) {
            console.error('Error fetching location types:', error);
        }
    };

    // 獲取電表
    const fetchMeters = async (locationTypeId) => {
        try {
            const response = await apiService.get(`/meters/location/${locationTypeId}`);
            const uniqueMeters = Array.from(new Set(response.data.meters.map(m => m.meter_number)))
                .map(meter_number => {
                    return response.data.meters.find(m => m.meter_number === meter_number);
                });
            setMeters(uniqueMeters);
        } catch (error) {
            console.error('Error fetching meters:', error);
        }
    };

    
    // 更新電表讀數
    const handleReadingSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMeter || !reading) {
            alert('請選擇電表並輸入度數');
            return;
        }

        const formData = new FormData();
        formData.append('meter_id', selectedMeter.meter_number);
        formData.append('reading_value', reading);
        if (photo) {
            formData.append('photo', photo);
        }

        try {
            await apiService.post('/update-meter-reading', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('讀數更新成功');
            resetForm();
            fetchMeters(selectedLocationType);
        } catch (error) {
            console.error('Error updating reading:', error);
            handleOfflineStore();
        }
    };

    // 保存表單資料到離線模式
    const handleOfflineStore = async () => {
        try {
            await storeFormData({
                meter_id: selectedMeter.meter_number,
                reading_value: reading,
                photo: photo
            });
            alert('數據已儲存離線，稍後將自動重新上傳');
        } catch (error) {
            console.error('Error storing offline data:', error);
            alert('數據儲存失敗：' + error.message);
        }
    };

    // 重置表單
    const resetForm = () => {
        setReading('');
        setPhoto(null);
        setFileInputKey(Date.now()); // 重置文件輸入框
    };

    // 編輯讀數
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
        const meter = meters.find(m => m.id === meterId);
        setSelectedMeter(meter);
        setShowEditWindow(true);
    };

    const handleShowHistory = (meter) => {
        setSelectedMeter(meter);
        setShowHistory(true);
    };

    return (
        <div className="data-manager-view">
            <h2 className="main-title">更新電表讀數</h2>

            <div className="control-panel">
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
                    style={{ marginLeft: '5px' }}
                >
                    <option value="">選擇位置種類</option>
                    {locationTypes.map(locationType => (
                        <option key={locationType.id} value={locationType.id}>{locationType.name}</option>
                    ))}
                </select>
            </div>

            {selectedCampus && meters.length > 0 && (
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
                                        <button className="action-button edit" onClick={() => handleMeterSelect(meter.id)}>
                                            編輯
                                        </button>
                                        <button className="action-button history" onClick={() => handleShowHistory(meter)}>
                                            歷史
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}


            {selectedMeter && showEditWindow && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>編輯電表讀數</h3>
                        <form onSubmit={handleReadingSubmit}>
                            <div className="modal-field">
                                <label>電表號: {selectedMeter.meter_number}</label>
                            </div>
                            <div className="modal-field">
                                <label>位置: {selectedMeter.location}</label>
                            </div>
                            <div className="modal-field">
                                <label>新讀數: </label>
                                <input
                                    type="number"
                                    value={reading}
                                    onChange={e => setReading(e.target.value)}
                                    placeholder="新電表度數"
                                    required
                                />
                            </div>
                            <div className="modal-field">
                                <label>上傳照片: </label>
                                <input
                                    key={fileInputKey}
                                    type="file"
                                    onChange={e => setPhoto(e.target.files[0])}
                                    accept="image/*"
                                />
                            </div>
                            <div className="modal-edit-buttons-container">
                                <button type="submit" className="modal-edit-buttons confirm">更新讀數</button>
                                <button type="button" className="modal-edit-buttons cancel" onClick={() => setShowEditWindow(false)}>取消</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showHistory && selectedMeter && (
                <MeterHistoryModal 
                    meterId={selectedMeter.meter_number}
                    meterType={selectedMeter.meter_type}
                    onClose={() => setShowHistory(false)}
                    onEditReading={(reading) => {
                        setSelectedReading(reading);
                        setNewReadingValue("");
                        setShowEditReadingModal(true);
                    }}
                    userRole={user.role}
                />
            )}
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

export default ReaderView;
