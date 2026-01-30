import React, { useState } from 'react'
import { Plus, Calendar, Trash2, Edit2, Clock } from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import api from '../utils/api'
import Modal from '../components/Modal'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ACTIVITY_TYPES = ['climbing', 'tennis', 'basketball', 'soccer', 'swimming', 'music', 'dance', 'art', 'tutoring', 'other']

export default function Activities() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingActivity, setEditingActivity] = useState(null)
  const [selectedMember, setSelectedMember] = useState('')

  const { data: activities, loading, execute: refreshActivities } = useApi(api.getActivities, [], true)
  const { data: members } = useApi(api.getMembers, [], true)
  const { mutate: deleteActivity } = useMutation(api.deleteActivity)

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this activity?')) {
      await deleteActivity(id)
      refreshActivities()
    }
  }

  const filteredActivities = selectedMember
    ? selectedMember === 'family'
      ? activities?.filter(a => !a.member_id)
      : activities?.filter(a => a.member_id?.toString() === selectedMember)
    : activities

  const children = members?.filter(m => m.role === 'child') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Activity
        </button>
      </div>

      {/* Filter by child */}
      <div className="flex space-x-2 flex-wrap gap-y-2">
        <button
          onClick={() => setSelectedMember('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${!selectedMember ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        <button
          onClick={() => setSelectedMember('family')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${selectedMember === 'family' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Family
        </button>
        {children.map(child => (
          <button
            key={child.id}
            onClick={() => setSelectedMember(child.id.toString())}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${selectedMember === child.id.toString()
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={selectedMember === child.id.toString() ? { backgroundColor: child.color } : {}}
          >
            {child.name}
          </button>
        ))}
      </div>

      {/* Activities Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : filteredActivities?.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No activities yet. Add some to start tracking schedules.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActivities?.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onEdit={() => setEditingActivity(activity)}
              onDelete={() => handleDelete(activity.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingActivity) && (
        <ActivityModal
          activity={editingActivity}
          members={members}
          onClose={() => {
            setShowAddModal(false)
            setEditingActivity(null)
          }}
          onSave={() => {
            refreshActivities()
            setShowAddModal(false)
            setEditingActivity(null)
          }}
        />
      )}
    </div>
  )
}

function ActivityCard({ activity, onEdit, onDelete }) {
  const scheduleItems = activity.schedule?.filter(s => s.id) || []

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mr-3"
            style={{ backgroundColor: `${activity.color}20` }}
          >
            <Calendar className="w-5 h-5" style={{ color: activity.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{activity.name}</h3>
            <p className="text-sm text-gray-500">{activity.member_name || 'Family'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activity.type && (
        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full mb-3">
          {activity.type}
        </span>
      )}

      {activity.location && (
        <p className="text-sm text-gray-600 mb-2">📍 {activity.location}</p>
      )}

      {scheduleItems.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">WEEKLY SCHEDULE</p>
          <div className="space-y-1">
            {scheduleItems.map((slot, idx) => (
              <div key={idx} className="flex items-center text-sm">
                <Clock className="w-3 h-3 mr-2 text-gray-400" />
                <span className="text-gray-700">{DAYS[slot.day_of_week]}</span>
                {slot.start_time && (
                  <span className="text-gray-500 ml-2">
                    {formatTime(slot.start_time)}
                    {slot.end_time && ` - ${formatTime(slot.end_time)}`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityModal({ activity, members, onClose, onSave }) {
  const [formData, setFormData] = useState({
    member_id: activity?.member_id || '',
    name: activity?.name || '',
    type: activity?.type || '',
    location: activity?.location || '',
    instructor: activity?.instructor || '',
    notes: activity?.notes || '',
    color: activity?.color || '#10B981',
  })

  // Determine if this is a recurring or one-time activity based on existing data
  const hasSchedule = activity?.schedule?.filter(s => s.id).length > 0
  const [activityMode, setActivityMode] = useState(hasSchedule || !activity ? 'recurring' : 'one-time')

  const [schedule, setSchedule] = useState(
    activity?.schedule?.filter(s => s.id) || []
  )
  const [newSlot, setNewSlot] = useState({ day_of_week: '', start_time: '', end_time: '' })

  // One-time activity fields
  const [oneTimeData, setOneTimeData] = useState({
    date: '',
    start_time: '',
    end_time: ''
  })

  const { mutate: saveActivity, loading: savingActivity } = useMutation(
    activity ? (data) => api.updateActivity(activity.id, data) : api.createActivity
  )
  const { mutate: addSchedule, loading: addingSchedule } = useMutation(
    (data) => api.addActivitySchedule(activity?.id, data)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await saveActivity(formData)
    const activityId = activity?.id || result.id

    if (activityMode === 'recurring') {
      // Get original schedule IDs for comparison
      const originalSlotIds = new Set(
        (activity?.schedule || []).filter(s => s.id).map(s => s.id)
      )
      const currentSlotIds = new Set(
        schedule.filter(s => s.id).map(s => s.id)
      )

      // Delete removed slots
      for (const slotId of originalSlotIds) {
        if (!currentSlotIds.has(slotId)) {
          await api.deleteActivitySchedule(activityId, slotId)
        }
      }

      // Add new slots (those without an id)
      for (const slot of schedule) {
        if (!slot.id) {
          await api.addActivitySchedule(activityId, slot)
        }
      }

      // Update existing slots that might have changed
      for (const slot of schedule) {
        if (slot.id && slot._modified) {
          await api.updateActivitySchedule(activityId, slot.id, slot)
        }
      }
    } else {
      // One-time activity - create an activity instance
      if (oneTimeData.date) {
        await api.addActivityInstance(activityId, {
          date: oneTimeData.date,
          start_time: oneTimeData.start_time || null,
          end_time: oneTimeData.end_time || null,
          status: 'scheduled',
          source: 'manual'
        })
      }
    }

    onSave()
  }

  const addSlot = () => {
    if (newSlot.day_of_week !== '' && newSlot.start_time) {
      setSchedule([...schedule, { ...newSlot, day_of_week: parseInt(newSlot.day_of_week) }])
      setNewSlot({ day_of_week: '', start_time: '', end_time: '' })
    }
  }

  const removeSlot = (index) => {
    setSchedule(schedule.filter((_, i) => i !== index))
  }

  const children = members?.filter(m => m.role === 'child') || []

  return (
    <Modal title={activity ? 'Edit Activity' : 'Add Activity'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">For (optional)</label>
            <select
              className="input"
              value={formData.member_id}
              onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
            >
              <option value="">None / Family</option>
              {children.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Activity Name</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Basketball Practice"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              <option value="">Select...</option>
              {ACTIVITY_TYPES.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Color</label>
            <input
              type="color"
              className="input h-10"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="label">Location</label>
          <input
            type="text"
            className="input"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            placeholder="e.g., Community Center"
          />
        </div>

        {/* Activity Type Toggle */}
        <div className="border-t border-gray-200 pt-4">
          <label className="label">Frequency</label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setActivityMode('recurring')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border-2 ${
                activityMode === 'recurring'
                  ? 'bg-primary-100 border-primary-500 text-primary-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              📅 Weekly (recurring)
            </button>
            <button
              type="button"
              onClick={() => setActivityMode('one-time')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors border-2 ${
                activityMode === 'one-time'
                  ? 'bg-primary-100 border-primary-500 text-primary-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              📌 One-time event
            </button>
          </div>
        </div>

        {/* Weekly Schedule - only show for recurring */}
        {activityMode === 'recurring' && (
        <div className="border-t border-gray-200 pt-4">
          <label className="label">Weekly Schedule</label>

          {schedule.map((slot, idx) => (
            <div key={idx} className="flex items-center space-x-2 mb-2">
              <select
                className="input text-sm w-28"
                value={slot.day_of_week}
                onChange={(e) => {
                  const updated = [...schedule]
                  updated[idx] = { ...updated[idx], day_of_week: parseInt(e.target.value), _modified: true }
                  setSchedule(updated)
                }}
              >
                {DAYS.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
              <input
                type="time"
                className="input text-sm w-28"
                value={slot.start_time || ''}
                onChange={(e) => {
                  const updated = [...schedule]
                  updated[idx] = { ...updated[idx], start_time: e.target.value, _modified: true }
                  setSchedule(updated)
                }}
              />
              <input
                type="time"
                className="input text-sm w-28"
                value={slot.end_time || ''}
                onChange={(e) => {
                  const updated = [...schedule]
                  updated[idx] = { ...updated[idx], end_time: e.target.value, _modified: true }
                  setSchedule(updated)
                }}
              />
              <button
                type="button"
                onClick={() => removeSlot(idx)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex items-end space-x-2 mt-2">
            <div className="flex-1">
              <select
                className="input text-sm"
                value={newSlot.day_of_week}
                onChange={(e) => setNewSlot({ ...newSlot, day_of_week: e.target.value })}
              >
                <option value="">Day...</option>
                {DAYS.map((day, idx) => (
                  <option key={idx} value={idx}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="time"
                className="input text-sm"
                value={newSlot.start_time}
                onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
              />
            </div>
            <div>
              <input
                type="time"
                className="input text-sm"
                value={newSlot.end_time}
                onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                placeholder="End"
              />
            </div>
            <button
              type="button"
              onClick={addSlot}
              className="btn btn-secondary text-sm"
            >
              Add
            </button>
          </div>
        </div>
        )}

        {/* One-time activity date picker */}
        {activityMode === 'one-time' && (
        <div className="border-t border-gray-200 pt-4">
          <label className="label">Event Date & Time</label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500">Date</label>
              <input
                type="date"
                className="input"
                value={oneTimeData.date}
                onChange={(e) => setOneTimeData({ ...oneTimeData, date: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Start Time</label>
              <input
                type="time"
                className="input"
                value={oneTimeData.start_time}
                onChange={(e) => setOneTimeData({ ...oneTimeData, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">End Time</label>
              <input
                type="time"
                className="input"
                value={oneTimeData.end_time}
                onChange={(e) => setOneTimeData({ ...oneTimeData, end_time: e.target.value })}
              />
            </div>
          </div>
        </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={savingActivity} className="btn btn-primary">
            {savingActivity ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
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
