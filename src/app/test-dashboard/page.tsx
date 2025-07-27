// src/app/test-dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';

export default function TestDashboard() {
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    setStatus('Component mounted!');
    
    fetch('/api/migration/health')
      .then(response => response.json())
      .then(data => {
        setStatus('Data loaded: ' + JSON.stringify(data));
      })
      .catch(error => {
        setStatus('Error: ' + error.message);
      });
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Test Dashboard</h1>
      <p>Status: {status}</p>
    </div>
  );
}