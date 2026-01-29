import React, { useState } from 'react'
import { Users, Plus, Edit2, Trash2, RefreshCw, Upload, Calendar, Eye, Check, X } from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import api from '../utils/api'
import Modal from '../components/Modal'
import AlertBanner from '../components/AlertBanner'

// Hardcoded calendar URL
const CALENDAR_URL = 'https://calendar.google.com/calendar/ical/family03792455813076733653%40group.calendar.google.com/private-b8780f011620ae68068a9b4b356c827e/basic.ics';

export default function Settings() {
  const [showAddMember, setShowAddMember] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [fetchingHolidays, setFetchingHolidays] = useState(false)
  const [holidayResult, setHolidayResult] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [previewData, setPreviewData] = useState(null)

  const { data: members, loading, execute: refreshMembers } = useApi(api.getMembers, [], true)
  const { mutate: deleteMember } = useMutation(api.deleteMember)

  const handleDelete = async (id, name) => {
    if (confirm(`Are you sure you want to remove ${name} from the family?`)) {
      await deleteMember(id)
      refreshMembers()
    }
  }

  const handleFetchHolidays = async () => {
    setFetchingHolidays(true)
    setHolidayResult(null)
    try {
      const currentYear = new Date().getFullYear()
      const result = await api.fetchHolidays(currentYear)
      const resultNext = await api.fetchHolidays(currentYear + 1)
      setHolidayResult({
        success: true,
        message: `Fetched holidays for ${currentYear} and ${currentYear + 1}`
      })
    } catch (err) {
      setHolidayResult({
        success: false,
        message: err.message
      })
    } finally {
      setFetchingHolidays(false)
    }
  }

  const handlePreviewSync = async () => {
    setPreviewing(true)
    setPreviewData(null)
    setSyncResult(null)
    try {
      const result = await api.previewCalendarSync(CALENDAR_URL)
      setPreviewData(result)
    } catch (err) {
      setSyncResult({ success: false, message: err.message })
    } finally {
      setPreviewing(false)
    }
  }

  const handleSyncCalendar = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await api.syncCalendar(CALENDAR_URL)
      setSyncResult({
        success: true,
        message: `Imported ${result.imported} trips. ${result.skipped} skipped (duplicates or unmatched).`
      })
      setPreviewData(null)
    } catch (err) {
      setSyncResult({ success: false, message: err.message })
    } finally {
      setSyncing(false)
    }
  }

  const parents = members?.filter(m => m.role === 'parent') || []
  const children = members?.filter(m => m.role === 'child') || []
  const others = members?.filter(m => !['parent', 'child'].includes(m.role)) || []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Family Members */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Family Members
          </h2>
          <button
            onClick={() => setShowAddMember(true)}
            className="btn btn-primary flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Member
          </button>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Parents */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">PARENTS</p>
              <div className="space-y-2">
                {parents.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onEdit={() => setEditingMember(member)}
                    onDelete={() => handleDelete(member.id, member.name)}
                  />
                ))}
              </div>
            </div>

            {/* Children */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">CHILDREN</p>
              <div className="space-y-2">
                {children.map(member => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onEdit={() => setEditingMember(member)}
                    onDelete={() => handleDelete(member.id, member.name)}
                  />
                ))}
              </div>
            </div>

            {/* Others */}
            {others.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">OTHER</p>
                <div className="space-y-2">
                  {others.map(member => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      onEdit={() => setEditingMember(member)}
                      onDelete={() => handleDelete(member.id, member.name)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Holidays */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Federal Holidays</h2>

        {holidayResult && (
          <AlertBanner
            type={holidayResult.success ? 'success' : 'error'}
            message={holidayResult.message}
            onDismiss={() => setHolidayResult(null)}
          />
        )}

        <p className="text-sm text-gray-600 mb-4">
          Automatically fetch US federal holidays to track school closures and plan around important dates.
        </p>

        <button
          onClick={handleFetchHolidays}
          disabled={fetchingHolidays}
          className="btn btn-secondary flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${fetchingHolidays ? 'animate-spin' : ''}`} />
          {fetchingHolidays ? 'Fetching...' : 'Fetch Federal Holidays'}
        </button>
      </div>

      {/* Calendar Sync */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Calendar Sync
        </h2>

        {syncResult && (
          <AlertBanner
            type={syncResult.success ? 'success' : 'error'}
            message={syncResult.message}
            onDismiss={() => setSyncResult(null)}
          />
        )}

        <p className="text-sm text-gray-600 mb-4">
          Sync travel events from your shared Google Calendar. Events should be named like "Ivan NYC" or "Alison Paris".
        </p>

        <div className="flex space-x-2 mb-4">
          <button
            onClick={handlePreviewSync}
            disabled={previewing || syncing}
            className="btn btn-secondary flex items-center"
          >
            <Eye className={`w-4 h-4 mr-2 ${previewing ? 'animate-pulse' : ''}`} />
            {previewing ? 'Loading...' : 'Preview'}
          </button>
          <button
            onClick={handleSyncCalendar}
            disabled={syncing || previewing}
            className="btn btn-primary flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>

        {/* Preview Results */}
        {previewData && (
          <div className="mt-4 border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <p className="text-sm font-medium text-gray-700">
                Preview: {previewData.will_import} of {previewData.total_events} events will be imported
              </p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {previewData.events?.map((event, idx) => (
                <div key={idx} className={`px-4 py-2 border-b last:border-b-0 flex items-center justify-between ${event.will_import ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{event.original}</p>
                    <p className="text-xs text-gray-500">
                      {event.departure_date} → {event.return_date}
                    </p>
                  </div>
                  <div className="flex items-center">
                    {event.will_import ? (
                      <>
                        <span className="text-xs text-green-600 mr-2">{event.matched_member} → {event.destination}</span>
                        <Check className="w-4 h-4 text-green-600" />
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400 mr-2">No match</span>
                        <X className="w-4 h-4 text-gray-400" />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Data Import */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Import</h2>
        <p className="text-sm text-gray-600 mb-4">
          Import schedules and itineraries from various sources.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          <ImportCard
            title="Flight Itinerary"
            description="Paste email or text"
            icon="✈️"
          />
          <ImportCard
            title="PDF Schedule"
            description="Upload activity PDFs"
            icon="📄"
          />
          <ImportCard
            title="Image/Screenshot"
            description="OCR extraction"
            icon="🖼️"
          />
        </div>
      </div>

      {/* Modals */}
      {(showAddMember || editingMember) && (
        <MemberModal
          member={editingMember}
          onClose={() => {
            setShowAddMember(false)
            setEditingMember(null)
          }}
          onSave={() => {
            refreshMembers()
            setShowAddMember(false)
            setEditingMember(null)
          }}
        />
      )}
    </div>
  )
}

function MemberRow({ member, onEdit, onDelete }) {
  return (
    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
      <div
        className="w-8 h-8 rounded-full mr-3 flex items-center justify-center text-white font-medium"
        style={{ backgroundColor: member.color }}
      >
        {member.name.charAt(0)}
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{member.name}</p>
        <p className="text-xs text-gray-500">{member.role}</p>
      </div>
      <div className="flex items-center space-x-1">
        <button
          onClick={onEdit}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function MemberModal({ member, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: member?.name || '',
    role: member?.role || 'other',
    email: member?.email || '',
    phone: member?.phone || '',
    color: member?.color || '#3B82F6',
  })

  const { mutate: saveMember, loading } = useMutation(
    member ? (data) => api.updateMember(member.id, data) : api.createMember
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    await saveMember(formData)
    onSave()
  }

  return (
    <Modal title={member ? 'Edit Family Member' : 'Add Family Member'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            className="input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="parent">Parent</option>
              <option value="child">Child</option>
              <option value="nanny">Nanny</option>
              <option value="other">Other</option>
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
          <label className="label">Email (optional)</label>
          <input
            type="email"
            className="input"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Phone (optional)</label>
          <input
            type="tel"
            className="input"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ImportCard({ title, description, icon }) {
  return (
    <button className="p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/50 transition-colors text-left">
      <span className="text-2xl mb-2 block">{icon}</span>
      <p className="font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </button>
  )
}
