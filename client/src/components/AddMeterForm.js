import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import './AddMeterForm.css';

function AddMeterForm({ campuses, onAddMeter, onClose }) {
    const [meterData, setMeterData] = useState({
        campus_id: '',
        location: '',
        meter_number: ''
    });
    const [suggestions, setSuggestions] = useState([]);
    const [locationTypes, setLocationTypes] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (meterData.campus_id) {
            fetchLocationTypes(meterData.campus_id);
        } else {
            setLocationTypes([]);
            setMeterData(prev => ({ ...prev, location: '' }));
        }
    }, [meterData.campus_id]);

    const fetchLocationTypes = async (campusId) => {
        try {
            const response = await apiService.get(`/location-types/${campusId}`);
            setLocationTypes(response.data);
        } catch (error) {
            console.error('Error fetching location types:', error);
            setError('無法獲取位置類型，請稍後再試。');
        }
    };

    const handleLocationChange = (e) => {
        const value = e.target.value;
        setMeterData({ ...meterData, location: value });
        if (value.length > 0 && meterData.campus_id) {
            const matchedSuggestions = locationTypes
                .filter(lt => lt.name.toLowerCase().includes(value.toLowerCase()))
                .map(lt => lt.name);
            setSuggestions(matchedSuggestions);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setMeterData({ ...meterData, location: suggestion });
        setSuggestions([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await onAddMeter(meterData);
            // 成功添加後清空表單
            setMeterData({ campus_id: '', location: '', meter_number: '' });
            onClose(); // 關閉表單
        } catch (error) {
            console.error('Error adding meter:', error);
            setError('添加電表失敗，請檢查輸入並重試。');
        }
    };

    return (
        <div className="add-meter-form">
            <h3 className="form-title">新增電表</h3>
            <form onSubmit={handleSubmit}>
                {error && <div className="error-message">{error}</div>}
                
                <div className="form-group">
                    <label htmlFor="campus">校區：</label>
                    <select
                        id="campus"
                        value={meterData.campus_id}
                        onChange={(e) => setMeterData({...meterData, campus_id: e.target.value, location: ''})}
                        required
                    >
                        <option value="">選擇校區</option>
                        {campuses.map(campus => (
                            <option key={campus.id} value={campus.id}>{campus.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="location">位置：</label>
                    <input
                        id="location"
                        type="text"
                        value={meterData.location}
                        onChange={handleLocationChange}
                        placeholder="輸入位置"
                        required
                        disabled={!meterData.campus_id}
                    />
                    {suggestions.length > 0 && (
                        <ul className="suggestions-list">
                            {suggestions.map((suggestion, index) => (
                                <li key={index} onClick={() => handleSuggestionClick(suggestion)}>
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="form-group">
                    <label htmlFor="meter-number">電表號：</label>
                    <input
                        id="meter-number"
                        type="text"
                        value={meterData.meter_number}
                        onChange={(e) => setMeterData({...meterData, meter_number: e.target.value})}
                        placeholder="輸入電表號"
                        required
                    />
                </div>

                <div className="button-group">
                    <button type="submit" className="submit-btn">添加電表</button>
                    <button type="button" onClick={onClose} className="cancel-btn">取消</button>
                </div>
            </form>
        </div>
    );
}

export default AddMeterForm;