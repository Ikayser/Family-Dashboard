import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  ChevronLeft, ChevronRight, AlertTriangle, Plane, Calendar,
  Users, ClipboardList, Sun, Moon
} from 'lucide-react'
import { useApi } from '../hooks/useApi'
import api from '../utils/api'
import WeekView from '../components/WeekView'
import AlertBanner from '../components/AlertBanner'

export default function Dashboard() {
  const [weekOffset, setWeekOffset] = useState(0)
  const { data, loading, error, execute } = useApi(
    () => api.getDashboardWeek(weekOffset),
    [weekOffset],
    true
  )

  const goToPreviousWeek = () => setWeekOffset(prev => prev - 1)
  const goToNextWeek = () => setWeekOffset(prev => prev + 1)
  const goToCurrentWeek = () => setWeekOffset(0)

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p>Error loading dashboard: {error}</p>
        <button onClick={execute} className="mt-2 btn btn-secondary">
          Try Again
        </button>
      </div>
    )
  }

  const { week_start, week_end, days, members, schools, alerts } = data || {}

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts?.childcare_needed?.length > 0 && (
        <AlertBanner
          type="warning"
          title="Childcare Needed"
          message={`Both parents away on ${alerts.childcare_needed.length} day(s) with no caregiver assigned.`}
          action={
            <Link to="/travel" className="text-yellow-800 underline hover:no-underline">
              View Details
            </Link>
          }
        />
      )}

      {alerts?.pending_surveys > 0 && (
        <AlertBanner
          type="info"
          title="Weekly Survey"
          message={`You have ${alerts.pending_surveys} question(s) to answer.`}
          action={
            <Link to="/survey" className="text-blue-800 underline hover:no-underline">
              Complete Survey
            </Link>
          }
        />
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={goToPreviousWeek}
            className="p-2 hover:bg-gray-100 rounded-md"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={goToNextWeek}
            className="p-2 hover:bg-gray-100 rounded-md"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={goToCurrentWeek}
              className="text-sm text-primary-600 hover:text-primary-700 ml-2"
            >
              Today
            </button>
          )}
        </div>

        <h2 className="text-lg font-semibold text-gray-900">
          {week_start && week_end && (
            <>
              {format(parseISO(week_start), 'MMM d')} - {format(parseISO(week_end), 'MMM d, yyyy')}
            </>
          )}
        </h2>

        <div className="flex items-center space-x-4">
          {/* School Week Types - only show for schools with A/B weeks (BFS) */}
          {schools?.filter(s => s.short_name === 'BFS').map((school, idx) => (
            <div
              key={idx}
              className="text-sm text-gray-600 flex items-center"
              title={`${school.student_name}'s week at ${school.short_name}`}
            >
              <span className="font-medium">{school.student_name}:</span>
              <span className={`
                ml-1 px-2 py-0.5 rounded text-xs font-bold
                ${school.calculated_week_type === 'A' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}
              `}>
                Week {school.calculated_week_type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Week View */}
      {days && <WeekView days={days} members={members} />}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Plane}
          label="Travelers"
          value={days?.reduce((acc, day) => {
            day.travel.forEach(t => {
              if (!acc.includes(t.member_name)) acc.push(t.member_name)
            })
            return acc
          }, []).length || 0}
          color="blue"
        />
        <StatCard
          icon={Calendar}
          label="Activities"
          value={days?.reduce((acc, day) => acc + day.activities.length, 0) || 0}
          color="green"
        />
        <StatCard
          icon={Sun}
          label="Days Off"
          value={days?.filter(d => d.holiday || d.school_days_off.length > 0).length || 0}
          color="yellow"
        />
        <StatCard
          icon={Users}
          label="Childcare Gaps"
          value={alerts?.childcare_needed?.length || 0}
          color={alerts?.childcare_needed?.length > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Family Members Legend */}
      <div className="card">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Family Members</h3>
        <div className="flex flex-wrap gap-3">
          {members?.map(member => (
            <div key={member.id} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: member.color }}
              />
              <span className="text-sm text-gray-600">
                {member.name}
                <span className="text-gray-400 ml-1">({member.role})</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-600',
  }

  return (
    <div className="card flex items-center">
      <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="ml-3">
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
