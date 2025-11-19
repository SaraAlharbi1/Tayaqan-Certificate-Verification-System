"""
Observer events for the certificates app.
Currently:
  - certificate_issued: after DB row is created + Storacha CID saved.
"""

_observers = {
    "certificate_issued": [],
}


def register(event_name: str, handler):
    if event_name in _observers:
        _observers[event_name].append(handler)


def emit(event_name: str, payload):
    for handler in _observers.get(event_name, []):
        handler(payload)


def certificate_issued(certificate):
    emit("certificate_issued", certificate)
