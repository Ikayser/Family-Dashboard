import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Plane, Upload, Trash2, Edit2, AlertTriangle } from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import api from '../utils/api'
import Modal from '../components/Modal'
import AlertBanner from '../components/AlertBanner'

export default function Travel() {
  const [showAddModal, setShowAddModal] = useState(false)
  const [showIngestModal, setShowIngestModal] = useState(false)
  const [editingTrip, setEditingTrip] = useState(null)

  const { data: travel, loading, execute: refreshTravel } = useApi(api.getTravel, [], true)
  const { data: members } = useApi(api.getMembers, [], true)
  const { data: childcareNeeds } = useApi(api.getChildcareNeeds, [], true)

  const { mutate: deleteTrip } = useMutation(api.deleteTravel)

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this trip?')) {
      await deleteTrip(id)
      refreshTravel()
    }
  }

  const needsChildcare = childcareNeeds?.filter(c => c.coverage_status === 'needed') || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Travel</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowIngestModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Itinerary
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Trip
          </button>
        </div>
      </div>

      {/* Childcare Alert */}
      {needsChildcare.length > 0 && (
        <AlertBanner
          type="warning"
          title="Childcare Coverage Needed"
          message={`There are ${needsChildcare.length} day(s) when both parents are traveling and no caregiver is assigned.`}
        />
      )}

      {/* Childcare Needs Table */}
      {needsChildcare.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
            Days Needing Coverage
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {needsChildcare.map((need, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm">
                      {format(parseISO(need.date), 'EEE, MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-red">Needs Caregiver</span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-sm text-primary-600 hover:text-primary-700">
                        Assign Caregiver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Travel List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming & Recent Trips</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : travel?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No trips recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {travel?.map(trip => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={() => setEditingTrip(trip)}
                onDelete={() => handleDelete(trip.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingTrip) && (
        <TripModal
          trip={editingTrip}
          members={members}
          onClose={() => {
            setShowAddModal(false)
            setEditingTrip(null)
          }}
          onSave={() => {
            refreshTravel()
            setShowAddModal(false)
            setEditingTrip(null)
          }}
        />
      )}

      {/* Ingest Modal */}
      {showIngestModal && (
        <IngestModal
          members={members}
          onClose={() => setShowIngestModal(false)}
          onSave={() => {
            refreshTravel()
            setShowIngestModal(false)
          }}
        />
      )}
    </div>
  )
}

function TripCard({ trip, onEdit, onDelete }) {
  return (
    <div className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mr-4"
        style={{ backgroundColor: `${trip.member_color}20` }}
      >
        <Plane className="w-5 h-5" style={{ color: trip.member_color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center">
          <span className="font-medium text-gray-900">{trip.member_name}</span>
          {trip.destination && (
            <span className="text-gray-500 ml-2">→ {trip.destination}</span>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {format(parseISO(trip.departure_date), 'MMM d')}
          {trip.return_date && ` - ${format(parseISO(trip.return_date), 'MMM d, yyyy')}`}
          {trip.flight_number && (
            <span className="ml-2 text-gray-400">({trip.flight_number})</span>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-600 rounded"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function TripModal({ trip, members, onClose, onSave }) {
  const [formData, setFormData] = useState({
    member_id: trip?.member_id || '',
    destination: trip?.destination || '',
    departure_date: trip?.departure_date || '',
    departure_time: trip?.departure_time || '',
    return_date: trip?.return_date || '',
    return_time: trip?.return_time || '',
    flight_number: trip?.flight_number || '',
    airline: trip?.airline || '',
    confirmation_code: trip?.confirmation_code || '',
    notes: trip?.notes || '',
  })

  const { mutate: saveTrip, loading } = useMutation(
    trip ? (data) => api.updateTravel(trip.id, data) : api.createTravel
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    await saveTrip(formData)
    onSave()
  }

  return (
    <Modal title={trip ? 'Edit Trip' : 'Add Trip'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Traveler</label>
          <select
            className="input"
            value={formData.member_id}
            onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
            required
          >
            <option value="">Select person...</option>
            {members?.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Destination</label>
          <input
            type="text"
            className="input"
            value={formData.destination}
            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
            placeholder="e.g., San Francisco, CA"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Departure Date</label>
            <input
              type="date"
              className="input"
              value={formData.departure_date}
              onChange={(e) => setFormData({ ...formData, departure_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Departure Time</label>
            <input
              type="time"
              className="input"
              value={formData.departure_time}
              onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Return Date</label>
            <input
              type="date"
              className="input"
              value={formData.return_date}
              onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Return Time</label>
            <input
              type="time"
              className="input"
              value={formData.return_time}
              onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Flight Number</label>
            <input
              type="text"
              className="input"
              value={formData.flight_number}
              onChange={(e) => setFormData({ ...formData, flight_number: e.target.value })}
              placeholder="e.g., AA 1234"
            />
          </div>
          <div>
            <label className="label">Airline</label>
            <input
              type="text"
              className="input"
              value={formData.airline}
              onChange={(e) => setFormData({ ...formData, airline: e.target.value })}
              placeholder="e.g., American Airlines"
            />
          </div>
        </div>

        <div>
          <label className="label">Confirmation Code</label>
          <input
            type="text"
            className="input"
            value={formData.confirmation_code}
            onChange={(e) => setFormData({ ...formData, confirmation_code: e.target.value })}
            placeholder="e.g., ABC123"
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input"
            rows={2}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

function IngestModal({ members, onClose, onSave }) {
  const [text, setText] = useState('')
  const [parsedFlights, setParsedFlights] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleParse = async () => {
    setLoading(true)
    try {
      const result = await api.parseFlightItinerary(text)
      setParsedFlights(result.flights)
    } catch (err) {
      alert('Error parsing itinerary: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await api.confirmFlights(parsedFlights)
      onSave()
    } catch (err) {
      alert('Error saving flights: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateFlight = (index, field, value) => {
    const updated = [...parsedFlights]
    updated[index] = { ...updated[index], [field]: value }
    setParsedFlights(updated)
  }

  return (
    <Modal title="Import Flight Itinerary" onClose={onClose} size="lg">
      {!parsedFlights ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Paste your flight confirmation email or itinerary text below.
            The system will try to extract flight details automatically.
          </p>
          <textarea
            className="input font-mono text-sm"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste flight itinerary here..."
          />
          <div className="flex justify-end space-x-2">
            <button onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button
              onClick={handleParse}
              disabled={!text.trim() || loading}
              className="btn btn-primary"
            >
              {loading ? 'Parsing...' : 'Parse Itinerary'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review the extracted flight information. Assign travelers and correct any details.
          </p>

          {parsedFlights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No flights could be extracted. Please try again with different text.
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {parsedFlights.map((flight, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Traveler</label>
                      <select
                        className="input"
                        value={flight.member_id || ''}
                        onChange={(e) => updateFlight(idx, 'member_id', e.target.value)}
                      >
                        <option value="">Select...</option>
                        {members?.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Flight</label>
                      <input
                        type="text"
                        className="input"
                        value={flight.flight_number || ''}
                        onChange={(e) => updateFlight(idx, 'flight_number', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Departure</label>
                      <input
                        type="date"
                        className="input"
                        value={flight.departure_date || ''}
                        onChange={(e) => updateFlight(idx, 'departure_date', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Return</label>
                      <input
                        type="date"
                        className="input"
                        value={flight.return_date || ''}
                        onChange={(e) => updateFlight(idx, 'return_date', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button onClick={() => setParsedFlights(null)} className="btn btn-secondary">
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || parsedFlights.every(f => !f.member_id)}
              className="btn btn-primary"
            >
              {loading ? 'Saving...' : 'Save Flights'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
