import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, eachDayOfInterval, getDay, addDays, startOfWeek } from 'date-fns'
import { ArrowLeft, Printer } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import api from '../utils/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function PrintView() {
  const [weeks, setWeeks] = useState(1)
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
  const endDate = end_date ? parseISO(end_date) : addDays(new Date(), 6)

  const days = eachDayOfInterval({ start: startDate, end: endDate }).map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOfWeek = getDay(date)

    return {
      date: dateStr,
      dateObj: date,
      dayOfWeek,
      travel: travel?.filter(t => {
        const depDate = t.departure_date?.split('T')[0] || t.departure_date
        const retDate = t.return_date?.split('T')[0] || t.return_date || depDate
        return dateStr >= depDate && dateStr <= retDate
      }) || [],
      holiday: holidays?.find(h => (h.date?.split('T')[0] || h.date) === dateStr),
      schoolDaysOff: school_days_off?.filter(s => (s.date?.split('T')[0] || s.date) === dateStr) || [],
      activities: activities?.filter(a => a.day_of_week === dayOfWeek) || [],
      childcare: childcare?.find(c => (c.date?.split('T')[0] || c.date) === dateStr),
    }
  })

  // Group days by week
  const weekGroups = []
  for (let i = 0; i < days.length; i += 7) {
    weekGroups.push(days.slice(i, i + 7))
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.4in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
          }
          .print-title {
            font-size: 16px !important;
            margin-bottom: 4px !important;
          }
          .print-subtitle {
            font-size: 11px !important;
            margin-bottom: 8px !important;
          }
          .print-legend {
            padding: 4px 8px !important;
            margin-bottom: 8px !important;
            font-size: 9px !important;
          }
          .print-week-title {
            font-size: 11px !important;
            margin-bottom: 4px !important;
          }
          .print-day-header {
            padding: 2px !important;
          }
          .print-day-header .day-name {
            font-size: 8px !important;
          }
          .print-day-header .day-num {
            font-size: 12px !important;
          }
          .print-day-cell {
            min-height: 70px !important;
            height: auto !important;
            padding: 2px !important;
            font-size: 8px !important;
          }
          .print-day-cell > div {
            margin-bottom: 1px !important;
            padding: 1px 2px !important;
          }
          .print-summary {
            margin-top: 8px !important;
          }
          .print-summary h3 {
            font-size: 10px !important;
            margin-bottom: 4px !important;
          }
          .print-summary table {
            font-size: 8px !important;
          }
          .print-summary th, .print-summary td {
            padding: 2px 4px !important;
          }
          .print-footer {
            margin-top: 8px !important;
            font-size: 8px !important;
          }
        }
      `}</style>

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
          </select>

          <button onClick={handlePrint} className="btn btn-primary flex items-center">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div className="print-container p-4 md:p-6 max-w-4xl mx-auto">
        {/* Title */}
        <div className="text-center mb-4">
          <h1 className="print-title text-xl font-bold text-gray-900">Family Schedule</h1>
          <p className="print-subtitle text-gray-500 text-sm">
            {format(startDate, 'MMMM d')} - {format(endDate, 'MMMM d, yyyy')}
          </p>
        </div>

        {/* Legend */}
        <div className="print-legend mb-4 p-2 bg-gray-50 rounded-lg print:bg-white print:border print:border-gray-200">
          <div className="flex flex-wrap gap-3 justify-center text-xs">
            {members?.map(member => (
              <div key={member.id} className="flex items-center">
                <div
                  className="w-2.5 h-2.5 rounded-full mr-1"
                  style={{ backgroundColor: member.color }}
                />
                <span>{member.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Calendars */}
        {weekGroups.map((week, weekIdx) => (
          <div key={weekIdx} className="mb-4">
            <h2 className="print-week-title text-sm font-semibold text-gray-800 mb-2">
              Week of {format(week[0].dateObj, 'MMMM d, yyyy')}
            </h2>

            <div className="border border-gray-300 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300">
                {week.map((day, idx) => (
                  <div
                    key={idx}
                    className={`print-day-header p-1.5 text-center border-r border-gray-300 last:border-r-0
                      ${day.dayOfWeek === 0 || day.dayOfWeek === 6 ? 'bg-gray-200' : ''}`}
                  >
                    <div className="day-name text-[10px] text-gray-500 uppercase">{DAYS[day.dayOfWeek]}</div>
                    <div className="day-num text-base font-semibold">{format(day.dateObj, 'd')}</div>
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

        {/* Compact Summary - side by side */}
        <div className="print-summary grid grid-cols-2 gap-4 mt-4">
          {/* Travel */}
          <div>
            <h3 className="text-xs font-semibold text-gray-800 mb-1">Travel</h3>
            <table className="w-full text-[10px] border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left border-b">Who</th>
                  <th className="px-2 py-1 text-left border-b">When</th>
                  <th className="px-2 py-1 text-left border-b">Where</th>
                </tr>
              </thead>
              <tbody>
                {travel?.slice(0, 4).map((trip, idx) => (
                  <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-2 py-1">{trip.member_name}</td>
                    <td className="px-2 py-1">
                      {format(parseISO(trip.departure_date), 'M/d')}
                      {trip.return_date && `-${format(parseISO(trip.return_date), 'M/d')}`}
                    </td>
                    <td className="px-2 py-1 truncate max-w-[80px]">{trip.destination || '-'}</td>
                  </tr>
                ))}
                {(!travel || travel.length === 0) && (
                  <tr><td colSpan={3} className="px-2 py-1 text-gray-400 text-center">None</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Childcare */}
          <div>
            <h3 className="text-xs font-semibold text-gray-800 mb-1">Childcare</h3>
            <table className="w-full text-[10px] border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left border-b">Date</th>
                  <th className="px-2 py-1 text-left border-b">Caregiver</th>
                </tr>
              </thead>
              <tbody>
                {childcare?.slice(0, 4).map((cc, idx) => (
                  <tr key={idx} className="border-b border-gray-200 last:border-b-0">
                    <td className="px-2 py-1">{format(parseISO(cc.date), 'EEE M/d')}</td>
                    <td className="px-2 py-1">{cc.caregiver_member_name || cc.caregiver_name || '-'}</td>
                  </tr>
                ))}
                {(!childcare || childcare.length === 0) && (
                  <tr><td colSpan={2} className="px-2 py-1 text-gray-400 text-center">None</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="print-footer mt-4 pt-2 border-t border-gray-200 text-center text-[10px] text-gray-400">
          Printed {format(new Date(), 'M/d/yyyy h:mm a')}
        </div>
      </div>
    </div>
  )
}

function DayCell({ day }) {
  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6

  return (
    <div className={`
      print-day-cell min-h-[80px] p-1 border-r border-gray-300 last:border-r-0 text-[10px]
      ${isWeekend ? 'bg-gray-50' : ''}
      ${day.holiday ? 'bg-yellow-50' : ''}
    `}>
      {/* Holiday */}
      {day.holiday && (
        <div className="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded mb-0.5 truncate text-[9px]">
          {day.holiday.name}
        </div>
      )}

      {/* School days off */}
      {day.schoolDaysOff.map((sdo, idx) => (
        <div key={idx} className="bg-orange-100 text-orange-800 px-1 py-0.5 rounded mb-0.5 truncate text-[9px]">
          {sdo.school_name}: Off
        </div>
      ))}

      {/* Travel */}
      {day.travel.map((trip, idx) => (
        <div
          key={idx}
          className="px-1 py-0.5 rounded mb-0.5 truncate text-[9px]"
          style={{ backgroundColor: `${trip.member_color || '#6B7280'}30`, color: trip.member_color || '#6B7280' }}
        >
          ✈ {trip.member_name}
        </div>
      ))}

      {/* Activities */}
      {day.activities.slice(0, 2).map((activity, idx) => (
        <div
          key={idx}
          className="px-1 py-0.5 rounded mb-0.5 truncate bg-gray-100 text-[9px]"
        >
          {activity.name}
        </div>
      ))}

      {day.activities.length > 2 && (
        <div className="text-gray-400 text-[8px]">+{day.activities.length - 2}</div>
      )}

      {/* Childcare */}
      {day.childcare && (
        <div className="bg-green-100 text-green-800 px-1 py-0.5 rounded truncate text-[9px]">
          👶 {day.childcare.caregiver_member_name || day.childcare.caregiver_name}
        </div>
      )}
    </div>
  )
}
