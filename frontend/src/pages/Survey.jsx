import React, { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ClipboardList, Check, SkipForward, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useApi, useMutation } from '../hooks/useApi'
import api from '../utils/api'
import Modal from '../components/Modal'
import AlertBanner from '../components/AlertBanner'

export default function Survey() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [showAddQuestion, setShowAddQuestion] = useState(false)

  const { data: pending, loading, execute: refreshPending } = useApi(
    () => api.getPendingSurveys(weekOffset),
    [weekOffset],
    true
  )

  const { data: questions } = useApi(
    () => api.getSurveyQuestions({ active: true }),
    [],
    true
  )

  const { mutate: submitResponse } = useMutation(api.submitResponse)
  const { mutate: skipSurvey } = useMutation(api.skipSurvey)

  const [responses, setResponses] = useState({})

  const handleResponseChange = (questionId, value) => {
    setResponses({ ...responses, [questionId]: value })
  }

  const handleSubmit = async (questionId) => {
    await submitResponse({
      question_id: questionId,
      response_text: responses[questionId],
      week_start_date: pending.week_start,
    })
    setResponses({ ...responses, [questionId]: '' })
    refreshPending()
  }

  const handleSkip = async (pendingSurveyId) => {
    await skipSurvey(pendingSurveyId)
    refreshPending()
  }

  const pendingQuestions = pending?.questions || []
  const completionRate = pendingQuestions.length > 0
    ? Math.round(((questions?.length || 0) - pendingQuestions.length) / (questions?.length || 1) * 100)
    : 100

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Weekly Survey</h1>
        <button
          onClick={() => setShowAddQuestion(true)}
          className="btn btn-secondary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between card">
        <button
          onClick={() => setWeekOffset(prev => prev - 1)}
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-sm text-gray-500">Week of</p>
          <p className="font-semibold text-gray-900">
            {pending?.week_start && format(parseISO(pending.week_start), 'MMM d, yyyy')}
          </p>
        </div>

        <button
          onClick={() => setWeekOffset(prev => prev + 1)}
          className="p-2 hover:bg-gray-100 rounded-md"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Survey Progress</span>
          <span className="text-sm text-gray-500">{completionRate}% complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Pending Questions */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : pendingQuestions.length === 0 ? (
        <AlertBanner
          type="success"
          title="All Done!"
          message="You've answered all questions for this week."
        />
      ) : (
        <div className="space-y-4">
          {pendingQuestions.map(question => (
            <QuestionCard
              key={question.id}
              question={question}
              value={responses[question.question_id] || ''}
              onChange={(value) => handleResponseChange(question.question_id, value)}
              onSubmit={() => handleSubmit(question.question_id)}
              onSkip={() => handleSkip(question.id)}
            />
          ))}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddQuestion && (
        <AddQuestionModal
          onClose={() => setShowAddQuestion(false)}
          onSave={() => {
            refreshPending()
            setShowAddQuestion(false)
          }}
        />
      )}
    </div>
  )
}

function QuestionCard({ question, value, onChange, onSubmit, onSkip }) {
  const categoryColors = {
    childcare: 'bg-yellow-100 text-yellow-800',
    activities: 'bg-blue-100 text-blue-800',
    logistics: 'bg-green-100 text-green-800',
    social: 'bg-purple-100 text-purple-800',
  }

  const renderInput = () => {
    switch (question.question_type) {
      case 'boolean':
        return (
          <div className="flex space-x-4">
            <button
              onClick={() => {
                onChange('Yes')
                setTimeout(onSubmit, 100)
              }}
              className={`flex-1 py-3 rounded-lg border-2 transition-colors ${
                value === 'Yes'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => {
                onChange('No')
                setTimeout(onSubmit, 100)
              }}
              className={`flex-1 py-3 rounded-lg border-2 transition-colors ${
                value === 'No'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              No
            </button>
          </div>
        )

      case 'select':
        const options = question.options || []
        return (
          <select
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select...</option>
            {options.map((opt, idx) => (
              <option key={idx} value={opt}>{opt}</option>
            ))}
          </select>
        )

      default:
        return (
          <textarea
            className="input"
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer..."
          />
        )
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <ClipboardList className="w-5 h-5 text-gray-400 mr-2" />
          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[question.category] || 'bg-gray-100 text-gray-600'}`}>
            {question.category}
          </span>
        </div>
      </div>

      <p className="text-gray-900 font-medium mb-4">{question.question_text}</p>

      {renderInput()}

      {question.question_type !== 'boolean' && (
        <div className="flex justify-end space-x-2 mt-4">
          <button
            onClick={onSkip}
            className="btn btn-secondary flex items-center text-sm"
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Skip
          </button>
          <button
            onClick={onSubmit}
            disabled={!value}
            className="btn btn-primary flex items-center text-sm"
          >
            <Check className="w-4 h-4 mr-1" />
            Submit
          </button>
        </div>
      )}
    </div>
  )
}

function AddQuestionModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'text',
    category: 'logistics',
    recurring: true,
    recurrence_pattern: 'weekly',
  })

  const { mutate: createQuestion, loading } = useMutation(api.createQuestion)

  const handleSubmit = async (e) => {
    e.preventDefault()
    await createQuestion(formData)
    onSave()
  }

  return (
    <Modal title="Add Survey Question" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Question</label>
          <textarea
            className="input"
            rows={2}
            value={formData.question_text}
            onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
            placeholder="Enter your question..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <select
              className="input"
              value={formData.question_type}
              onChange={(e) => setFormData({ ...formData, question_type: e.target.value })}
            >
              <option value="text">Text</option>
              <option value="boolean">Yes/No</option>
              <option value="select">Multiple Choice</option>
            </select>
          </div>

          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              <option value="childcare">Childcare</option>
              <option value="activities">Activities</option>
              <option value="logistics">Logistics</option>
              <option value="social">Social</option>
            </select>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="recurring"
            className="mr-2"
            checked={formData.recurring}
            onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
          />
          <label htmlFor="recurring" className="text-sm text-gray-700">
            Ask this question every week
          </label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Adding...' : 'Add Question'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
