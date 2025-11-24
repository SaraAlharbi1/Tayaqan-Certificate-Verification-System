# backend/api/access/events.py
"""
Observer events for the access app.
Events:
  - access_request_created: when employer creates a new request
  - access_request_approved: when applicant approves a request
  - access_request_rejected: when applicant rejects a request
"""

_observers = {
    "access_request_created": [],
    "access_request_approved": [],
    "access_request_rejected": [],
}


def register(event_name: str, handler):
    """Register a handler for an event."""
    if event_name in _observers:
        _observers[event_name].append(handler)


def emit(event_name: str, payload):
    """Emit an event to all registered handlers."""
    for handler in _observers.get(event_name, []):
        handler(payload)


def access_request_created(access_request):
    """Emit when a new access request is created."""
    emit("access_request_created", access_request)


def access_request_approved(access_request):
    """Emit when an access request is approved."""
    emit("access_request_approved", access_request)


def access_request_rejected(access_request):
    """Emit when an access request is rejected."""
    emit("access_request_rejected", access_request)