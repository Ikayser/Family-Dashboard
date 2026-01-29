import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Travel from './pages/Travel'
import Activities from './pages/Activities'
import Schools from './pages/Schools'
import Survey from './pages/Survey'
import Settings from './pages/Settings'
import PrintView from './pages/PrintView'

export default function App() {
  return (
    <Routes>
      <Route path="/print" element={<PrintView />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="travel" element={<Travel />} />
        <Route path="activities" element={<Activities />} />
        <Route path="schools" element={<Schools />} />
        <Route path="survey" element={<Survey />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
