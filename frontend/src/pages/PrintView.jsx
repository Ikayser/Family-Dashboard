import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, eachDayOfInterval, getDay, addDays, startOfWeek } from 'date-fns'
import { ArrowLeft, Printer } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import api from '../utils/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function PrintView() {
  const [weeks, setWeeks] = useState(2)
  const { data, loading } = useApi(() => api.getPrintData(weeks), [weeks], true)

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  const { start_date, end_date, members, travel, holidays, school_days_off, activities, childcare } = data || {}

  // Build day-by-day data
  const startDate = start_date ? parseISO(start_date) : new Date()
  const endDate = end_date ? parseISO(end_date) : addDays(new Date(), 13)

  const days = eachDayOfInterval({ start: startDate, end: endDate }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = getDay(date)

    return {
      date: dateStr,
      dateObj: date,
      dayOfWeek,
      travel: travel?.filter(t =>
        dateStr >= t.departure_date && dateStr <= (t.return_date || t.departure_date)
      ) || [],
      holiday: holidays?.find(h => h.date === dateStr),
      schoolDaysOff: school_days_off?.filter(s => s.date === dateStr) || [],
      activities: activities?.filter(a => a.day_of_week === dayOfWeek) || [],
      childcare: childcare?.find(c => c.date === dateStr),
    }
  })

  // Group days by week
  const weekGroups = []
  for (let i = 0; i < days.length; i += 7) {
    weekGroups.push(days.slice(i, i + 7))
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header - hidden when printing */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Dashboard
        </Link>

        <div className="flex items-center space-x-4">
          <select
            value={weeks}
            onChange={(e) => setWeeks(parseInt(e.target.value))}
            className="input py-1.5 w-auto"
          >
            <option value={1}>1 Week</option>
            <option value={2}>2 Weeks</option>
            <option value={4}>4 Weeks</option>
          </select>

          <button onClick={handlePrint} className="btn btn-primary flex items-center">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Family Schedule</h1>
          <p className="text-gray-500">
            {format(startDate, 'MMMM d')} - {format(endDate, 'MMMM d, yyyy')}
          </p>
        </div>

        {/* Legend */}
        <div className="mb-6 p-3 bg-gray-50 rounded-lg print:bg-white print:border print:border-gray-200">
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            {members?.map(member => (
              <div key={member.id} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-1.5"
                  style={{ backgroundColor: member.color }}
                />
                <span>{member.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Calendars */}
        {weekGroups.map((week, weekIdx) => (
          <div key={weekIdx} className="mb-8 page-break">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Week of {format(week[0].dateObj, 'MMMM d, yyyy')}
            </h2>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300">
                {week.map((day, idx) => (
                  <div
                    key={idx}
                    className={`p-2 text-center border-r border-gray-300 last:border-r-0
                      ${day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'bg-gray-200' : ''}`}
                  >
                    <div className="text-xs text-gray-500 uppercase">{DAYS[day.dayOfWeek]}</div>
                    <div className="text-lg font-semibold">{format(day.dateObj, 'd')}</div>
                  </div>
                ))}
              </div>

              {/* Content */}
              <div className="grid grid-cols-7">
                {week.map((day, idx) => (
                  <DayCell key={idx} day={day} />
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Summary Tables */}
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          {/* Upcoming Travel */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Travel Summary</h3>
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Who</th>
                  <th className="px-3 py-2 text-left border-b">Dates</th>
                  <th className="px-3 py-2 text-left border-b">Destination</th>
                </tr>
              </thead>
              <tbody>
                {travel?.map((trip, idx) => (
                  <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-3 py-2">{trip.member_name}</td>
                    <td className="px-3 py-2">
                      {format(parseISO(trip.departure_date), 'MMM d')}
                      {trip.return_date && ` - ${format(parseISO(trip.return_date), 'MMM d')}`}
                    </td>
                    <td className="px-3 py-2">{trip.destination || '-'}</td>
                  </tr>
                ))}
                {(!travel || travel.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-gray-500 text-center">No travel scheduled</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Childcare */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Childcare Coverage</h3>
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left border-b">Date</th>
                  <th className="px-3 py-2 text-left border-b">Caregiver</th>
                  <th className="px-3 py-2 text-left border-b">Status</th>
                </tr>
              </thead>
              <tbody>
                {childcare?.map((cc, idx) => (
                  <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-3 py-2">{format(parseISO(cc.date), 'EEE, MMM d')}</td>
                    <td className="px-3 py-2">{cc.caregiver_member_name || cc.caregiver_name || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        cc.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                        cc.status === 'tentative' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {cc.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!childcare || childcare.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-gray-500 text-center">No childcare scheduled</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          Printed on {format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}
        </div>
      </div>
    </div>
  )
}

function DayCell({ day }) {
  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6

  return (
    <div className={`
      min-h-[100px] p-1.5 border-r border-gray-300 last:border-r-0 text-xs
      ${isWeekend ? 'bg-gray-50' : ''}
      ${day.holiday ? 'bg-yellow-50' : ''}
    `}>
      {/* Holiday */}
      {day.holiday && (
        <div className="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded mb-1 truncate">
          {day.holiday.name}
        </div>
      )}

      {/* School days off */}
      {day.schoolDaysOff.map((sdo, idx) => (
        <div key={idx} className="bg-orange-100 text-orange-800 px-1 py-0.5 rounded mb-1 truncate">
          {sdo.school_name}: Off
        </div>
      ))}

      {/* Travel */}
      {day.travel.map((trip, idx) => (
        <div
          key={idx}
          className="px-1 py-0.5 rounded mb-1 truncate"
          style={{ backgroundColor: `${trip.member_color}30`, color: trip.member_color }}
        >
          ✈️ {trip.member_name}
        </div>
      ))}

      {/* Activities */}
      {day.activities.slice(0, 3).map((activity, idx) => (
        <div
          key={idx}
          className="px-1 py-0.5 rounded mb-1 truncate bg-gray-100"
        >
          {activity.member_name}: {activity.name}
        </div>
      ))}

      {day.activities.length > 3 && (
        <div className="text-gray-400">+{day.activities.length - 3}</div>
      )}

      {/* Childcare */}
      {day.childcare && (
        <div className="bg-green-100 text-green-800 px-1 py-0.5 rounded mt-auto truncate">
          👶 {day.childcare.caregiver_member_name || day.childcare.caregiver_name}
        </div>
      )}
    </div>
  )
}
