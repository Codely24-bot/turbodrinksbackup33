import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { applyTheme, getStoredTheme } from '@/utils/theme';

applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
);
