import React from 'react'
import { AlertTriangle, Info, CheckCircle, X } from 'lucide-react'

const typeConfig = {
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: AlertTriangle,
    iconColor: 'text-yellow-400',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: Info,
    iconColor: 'text-blue-400',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: CheckCircle,
    iconColor: 'text-green-400',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
  },
}

export default function AlertBanner({
  type = 'info',
  title,
  message,
  action,
  onDismiss,
}) {
  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-4`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${config.text}`}>{title}</h3>
          )}
          {message && (
            <p className={`text-sm ${config.text} ${title ? 'mt-1' : ''}`}>
              {message}
            </p>
          )}
          {action && (
            <div className="mt-2">
              {action}
            </div>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <button
              onClick={onDismiss}
              className={`-mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex ${config.text} hover:bg-white/50`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
