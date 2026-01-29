import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { GraduationCap, Plus, Calendar, ExternalLink, Trash2 } from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import api from '../utils/api'
import Modal from '../components/Modal'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Schools() {
  const [showDayOffModal, setShowDayOffModal] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(null)

  const { data: schools, loading, execute: refreshSchools } = useApi(api.getSchools, [], true)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Schools</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {schools?.map(school => (
          <SchoolCard
            key={school.id}
            school={school}
            onAddDayOff={() => setShowDayOffModal(school)}
            onManageSchedule={(student) => setShowScheduleModal({ school, student })}
            onRefresh={refreshSchools}
          />
        ))}
      </div>

      {showDayOffModal && (
        <DayOffModal
          school={showDayOffModal}
          onClose={() => setShowDayOffModal(null)}
          onSave={() => {
            refreshSchools()
            setShowDayOffModal(null)
          }}
        />
      )}

      {showScheduleModal && (
        <ScheduleModal
          school={showScheduleModal.school}
          student={showScheduleModal.student}
          onClose={() => setShowScheduleModal(null)}
          onSave={() => {
            refreshSchools()
            setShowScheduleModal(null)
          }}
        />
      )}
    </div>
  )
}

function SchoolCard({ school, onAddDayOff, onManageSchedule, onRefresh }) {
  const [showDaysOff, setShowDaysOff] = useState(false)
  const { data: schoolDetails } = useApi(
    () => api.getSchool(school.id),
    [school.id],
    true
  )

  const students = school.students?.filter(s => s.student_id) || []

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
            <GraduationCap className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{school.name || school.short_name}</h3>
            {school.website && (
              <a
                href={school.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
              >
                Website <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Students */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 mb-2">STUDENTS</p>
        <div className="space-y-2">
          {students.map((student, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center">
                <span className="font-medium text-gray-700">{student.student_name}</span>
                {student.current_week_type && (
                  <span className={`
                    ml-2 px-2 py-0.5 rounded text-xs font-bold
                    ${student.current_week_type === 'A'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'}
                  `}>
                    Week {student.current_week_type}
                  </span>
                )}
              </div>
              <button
                onClick={() => onManageSchedule(student)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Schedule
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Link */}
      {school.calendar_url && (
        <a
          href={school.calendar_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-sm text-gray-600 hover:text-primary-600 mb-4"
        >
          <Calendar className="w-4 h-4 mr-2" />
          View School Calendar
        </a>
      )}

      {/* Days Off */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500">DAYS OFF</p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDaysOff(!showDaysOff)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {showDaysOff ? 'Hide' : 'Show All'}
            </button>
            <button
              onClick={onAddDayOff}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center"
            >
              <Plus className="w-3 h-3 mr-1" /> Add
            </button>
          </div>
        </div>

        {schoolDetails?.days_off?.slice(0, showDaysOff ? undefined : 3).map((dayOff, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between py-1 text-sm"
          >
            <span className="text-gray-600">{dayOff.name || 'Day Off'}</span>
            <span className="text-gray-400">
              {format(parseISO(dayOff.date), 'MMM d')}
            </span>
          </div>
        ))}

        {(!schoolDetails?.days_off || schoolDetails.days_off.length === 0) && (
          <p className="text-sm text-gray-400">No days off recorded</p>
        )}
      </div>
    </div>
  )
}

function DayOffModal({ school, onClose, onSave }) {
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    description: '',
  })

  const { mutate: addDayOff, loading } = useMutation(
    (data) => api.addSchoolDayOff(school.id, data)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    await addDayOff(formData)
    onSave()
  }

  return (
    <Modal title={`Add Day Off - ${school.short_name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="label">Name/Reason</label>
          <input
            type="text"
            className="input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Teacher Professional Day"
          />
        </div>

        <div>
          <label className="label">Description (optional)</label>
          <textarea
            className="input"
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Adding...' : 'Add Day Off'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ScheduleModal({ school, student, onClose, onSave }) {
  const [weekType, setWeekType] = useState('A')
  const [newItem, setNewItem] = useState({
    day_of_week: '',
    activity_name: '',
    start_time: '',
    end_time: '',
  })

  const { data: schedule, execute: refreshSchedule } = useApi(
    () => api.getSchoolSchedule(school.id, student.student_id),
    [school.id, student.student_id],
    true
  )

  const { mutate: addItem, loading } = useMutation(
    (data) => api.addScheduleItem(school.id, student.student_id, data)
  )

  const handleAdd = async () => {
    if (newItem.day_of_week !== '' && newItem.activity_name) {
      await addItem({
        ...newItem,
        day_of_week: parseInt(newItem.day_of_week),
        week_type: weekType,
      })
      setNewItem({ day_of_week: '', activity_name: '', start_time: '', end_time: '' })
      refreshSchedule()
    }
  }

  const weekSchedule = weekType === 'A' ? schedule?.week_a : schedule?.week_b

  return (
    <Modal
      title={`${student.student_name}'s Schedule at ${school.short_name}`}
      onClose={onClose}
      size="lg"
    >
      <div className="space-y-4">
        {/* Week Type Selector */}
        <div className="flex space-x-2">
          <button
            onClick={() => setWeekType('A')}
            className={`px-4 py-2 rounded-md font-medium ${
              weekType === 'A'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Week A
          </button>
          <button
            onClick={() => setWeekType('B')}
            className={`px-4 py-2 rounded-md font-medium ${
              weekType === 'B'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            Week B
          </button>
        </div>

        {/* Current Schedule */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Day</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Activity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {weekSchedule?.filter(s => s.schedule_id).map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-sm">{DAYS[item.day_of_week]}</td>
                  <td className="px-4 py-2 text-sm">{item.activity_name}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">
                    {item.start_time && formatTime(item.start_time)}
                    {item.end_time && ` - ${formatTime(item.end_time)}`}
                  </td>
                </tr>
              ))}
              {(!weekSchedule || weekSchedule.filter(s => s.schedule_id).length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-sm text-gray-500 text-center">
                    No activities scheduled for Week {weekType}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add New Item */}
        <div className="border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Add Activity to Week {weekType}</p>
          <div className="flex items-end space-x-2">
            <div>
              <select
                className="input text-sm"
                value={newItem.day_of_week}
                onChange={(e) => setNewItem({ ...newItem, day_of_week: e.target.value })}
              >
                <option value="">Day...</option>
                {DAYS.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <input
                type="text"
                className="input text-sm"
                value={newItem.activity_name}
                onChange={(e) => setNewItem({ ...newItem, activity_name: e.target.value })}
                placeholder="Activity name..."
              />
            </div>
            <div>
              <input
                type="time"
                className="input text-sm"
                value={newItem.start_time}
                onChange={(e) => setNewItem({ ...newItem, start_time: e.target.value })}
              />
            </div>
            <div>
              <input
                type="time"
                className="input text-sm"
                value={newItem.end_time}
                onChange={(e) => setNewItem({ ...newItem, end_time: e.target.value })}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={loading}
              className="btn btn-primary text-sm"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}

function formatTime(time) {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}
