import React, { useState } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import {
  Home, Plane, Calendar, GraduationCap, ClipboardList,
  Settings, Menu, X, Printer, Bell
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import api from '../utils/api'

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/travel', icon: Plane, label: 'Travel' },
  { to: '/activities', icon: Calendar, label: 'Activities' },
  { to: '/schools', icon: GraduationCap, label: 'Schools' },
  { to: '/survey', icon: ClipboardList, label: 'Survey' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: surveyStatus } = useApi(api.getSurveyStatus, [], true)

  const pendingSurveys = surveyStatus?.pending_count || 0

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Mobile header */}
      <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between no-print">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Family Dashboard</h1>
        <Link to="/print" className="p-2 -mr-2 text-gray-500 hover:text-gray-700">
          <Printer className="w-5 h-5" />
        </Link>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto lg:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        no-print
      `}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">Family Dashboard</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  flex items-center px-3 py-2 rounded-md text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-5 h-5 mr-3" />
                {label}
                {label === 'Survey' && pendingSurveys > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingSurveys}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Print link */}
          <div className="p-4 border-t border-gray-200">
            <Link
              to="/print"
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-600
                         hover:bg-gray-100 hover:text-gray-900 rounded-md"
            >
              <Printer className="w-5 h-5 mr-3" />
              Printable View
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
