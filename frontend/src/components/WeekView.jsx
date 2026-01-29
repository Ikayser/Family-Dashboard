import React from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { Plane, Calendar, AlertTriangle, Sun, Users, BookOpen } from 'lucide-react'

export default function WeekView({ days, members }) {
  return (
    <div className="grid grid-cols-7 gap-2 md:gap-4">
      {days?.map(day => (
        <DayCard key={day.date} day={day} />
      ))}
    </div>
  )
}

function DayCard({ day }) {
  const date = parseISO(day.date)
  const today = isToday(date)
  const isWeekend = day.day_of_week === 0 || day.day_of_week === 6

  return (
    <div className={`
      card p-2 md:p-3 min-h-[140px] md:min-h-[180px]
      ${today ? 'ring-2 ring-primary-500 bg-primary-50/50' : ''}
      ${isWeekend ? 'bg-gray-50' : ''}
      ${day.holiday ? 'bg-yellow-50' : ''}
      ${day.needs_childcare ? 'ring-2 ring-red-400' : ''}
    `}>
      {/* Day header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-gray-500 uppercase">{day.day_short}</div>
          <div className={`text-lg font-semibold ${today ? 'text-primary-700' : 'text-gray-900'}`}>
            {format(date, 'd')}
          </div>
        </div>
        {day.needs_childcare && (
          <div className="text-red-500" title="Childcare needed">
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Holiday */}
      {day.holiday && (
        <div className="mb-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded truncate">
          {day.holiday.name}
        </div>
      )}

      {/* School days off */}
      {day.school_days_off?.map((sdo, idx) => (
        <div key={idx} className="mb-1 text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded truncate">
          {sdo.school_name}: {sdo.name || 'No School'}
        </div>
      ))}

      {/* School specials (Week A/B) */}
      {day.school_specials?.map((special, idx) => (
        <div
          key={`special-${idx}`}
          className="mb-1 text-xs px-1.5 py-0.5 rounded truncate flex items-center"
          style={{ backgroundColor: `${special.student_color}15`, borderLeft: `2px solid ${special.student_color}` }}
          title={`${special.student_name}: ${special.activity_name}`}
        >
          <BookOpen className="w-3 h-3 mr-1 flex-shrink-0 text-gray-500" />
          <span className="truncate">{special.activity_name}</span>
        </div>
      ))}

      {/* Travel */}
      {day.travel?.map((trip, idx) => (
        <div
          key={idx}
          className="mb-1 text-xs px-1.5 py-0.5 rounded truncate flex items-center"
          style={{ backgroundColor: `${trip.member_color}20`, color: trip.member_color }}
          title={`${trip.member_name}: ${trip.destination || 'Traveling'}`}
        >
          <Plane className="w-3 h-3 mr-1 flex-shrink-0" />
          <span className="truncate">{trip.member_name}</span>
        </div>
      ))}

      {/* Activities */}
      {day.activities?.slice(0, 3).map((activity, idx) => (
        <div
          key={idx}
          className="mb-1 text-xs px-1.5 py-0.5 rounded truncate flex items-center"
          style={{ backgroundColor: `${activity.color || activity.member_color}20` }}
          title={`${activity.member_name}: ${activity.name} ${activity.start_time ? `at ${activity.start_time}` : ''}`}
        >
          <Calendar className="w-3 h-3 mr-1 flex-shrink-0 text-gray-500" />
          <span className="truncate">{activity.name}</span>
        </div>
      ))}

      {day.activities?.length > 3 && (
        <div className="text-xs text-gray-500">
          +{day.activities.length - 3} more
        </div>
      )}

      {/* Childcare */}
      {day.childcare && (
        <div className="mt-auto pt-1 text-xs text-green-700 flex items-center">
          <Users className="w-3 h-3 mr-1" />
          {day.childcare.caregiver_member_name || day.childcare.caregiver_name}
        </div>
      )}

      {/* Both parents away indicator */}
      {day.both_parents_away && !day.childcare && (
        <div className="mt-auto pt-1 text-xs text-red-600 flex items-center">
          <AlertTriangle className="w-3 h-3 mr-1" />
          No caregiver
        </div>
      )}
    </div>
  )
}
